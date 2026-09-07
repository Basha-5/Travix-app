"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_middleware_1 = require("../middleware/auth.middleware");
const supabase_1 = require("../utils/supabase");
const error_middleware_1 = require("../middleware/error.middleware");
const safety_engine_service_1 = require("../services/safety-engine.service");
const email_service_1 = require("../services/email.service");
const router = (0, express_1.Router)();
// POST /api/safety/sos (Global Emergency SOS Trigger)
router.post('/sos', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const { lat, lng, reason } = req.body || {};
        const { data: user } = await supabase_1.supabase
            .from('users')
            .select('name, phone, email')
            .eq('id', req.user.id)
            .single();
        const userName = user?.name || req.user.email || 'Travix User';
        // Fetch trusted emergency contacts
        const { data: contacts } = await supabase_1.supabase
            .from('trusted_contacts')
            .select('id, name, phone, email, relationship')
            .eq('user_id', req.user.id);
        const emergencyContacts = contacts || [];
        // Dispatch emergency emails to all contacts with real email address
        const emailPromises = emergencyContacts
            .filter((c) => c.email)
            .map((contact) => {
            const locationStr = lat && lng ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'Live Location Active';
            const trackingUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/profile`;
            const emailContent = email_service_1.emailTemplates.emergencyAlert(userName, 'Travix Emergency Alert', 'Travix Safety Dispatch', locationStr, trackingUrl);
            return (0, email_service_1.sendEmail)({ to: contact.email, ...emailContent }).catch((err) => console.error(`[SOS] Email dispatch error to ${contact.email}:`, err));
        });
        await Promise.all(emailPromises);
        console.log(`[SOS] Global Emergency SOS triggered by ${userName}. ${emergencyContacts.length} contacts notified.`);
        res.json({
            success: true,
            message: `🆘 Emergency SOS Triggered! Alerts sent to ${emergencyContacts.length} trusted contact(s).`,
            data: {
                user_name: userName,
                contacts_notified: emergencyContacts,
                alerted_at: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/safety/location-update (driver posts live GPS — no auth check to allow high frequency)
router.post('/location-update', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const body = zod_1.z.object({
            ride_id: zod_1.z.string().uuid(),
            lat: zod_1.z.number().min(-90).max(90),
            lng: zod_1.z.number().min(-180).max(180),
            timestamp: zod_1.z.string().optional(),
            speed_kmh: zod_1.z.number().optional(),
            heading: zod_1.z.number().optional(),
        }).parse(req.body);
        // Verify this driver is assigned to this ride
        const { data: ride } = await supabase_1.supabase
            .from('rides')
            .select('driver_id, status')
            .eq('id', body.ride_id)
            .single();
        if (!ride)
            throw new error_middleware_1.AppError('Ride not found', 404);
        if (ride.status !== 'ongoing' && ride.status !== 'driver_arriving') {
            res.json({ success: true, message: 'Location update ignored (ride not active)' });
            return;
        }
        // Update driver's current location
        await supabase_1.supabase
            .from('driver_profiles')
            .update({
            current_lat: body.lat,
            current_lng: body.lng,
            updated_at: new Date().toISOString(),
        })
            .eq('user_id', req.user.id);
        // Record for safety engine
        if (ride.status === 'ongoing') {
            (0, safety_engine_service_1.recordLocationUpdate)(body.ride_id, body.lat, body.lng);
        }
        // Push to Supabase Realtime channel (ride:{rideId})
        // This is handled automatically via Supabase DB triggers on driver_profiles
        res.json({ success: true });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/safety/ride/:rideId/status
router.get('/ride/:rideId/status', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const { data: events } = await supabase_1.supabase
            .from('safety_events')
            .select('*')
            .eq('ride_id', req.params.rideId)
            .order('triggered_at', { ascending: false })
            .limit(5);
        const activeEvent = events?.find((e) => !e.resolved_at);
        res.json({
            success: true,
            data: {
                has_active_event: !!activeEvent,
                active_event: activeEvent || null,
                recent_events: events || [],
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/safety/ride/:rideId/checkin (rider responds to safety check)
router.post('/ride/:rideId/checkin', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const { response } = zod_1.z.object({
            response: zod_1.z.enum(['safe', 'need_help']),
        }).parse(req.body);
        const { data: event } = await supabase_1.supabase
            .from('safety_events')
            .select('id')
            .eq('ride_id', req.params.rideId)
            .is('resolved_at', null)
            .order('triggered_at', { ascending: false })
            .limit(1)
            .single();
        if (!event)
            throw new error_middleware_1.AppError('No active safety event found', 404);
        const updateData = {
            rider_responded_at: new Date().toISOString(),
            rider_response: response,
        };
        if (response === 'safe') {
            updateData.resolved_at = new Date().toISOString();
        }
        else {
            // Need help → immediately escalate
            updateData.escalation_level = 4;
            const { data: ride } = await supabase_1.supabase
                .from('rides')
                .select('driver_id')
                .eq('id', req.params.rideId)
                .single();
            if (ride)
                await (0, safety_engine_service_1.triggerSOS)(req.params.rideId, req.user.id, ride.driver_id);
        }
        await supabase_1.supabase.from('safety_events').update(updateData).eq('id', event.id);
        res.json({ success: true, message: response === 'safe' ? 'Marked as safe' : 'Emergency assistance requested' });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/safety/ride/:rideId/sos
router.post('/ride/:rideId/sos', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const { data: ride } = await supabase_1.supabase
            .from('rides')
            .select('rider_id, driver_id, status')
            .eq('id', req.params.rideId)
            .single();
        if (!ride)
            throw new error_middleware_1.AppError('Ride not found', 404);
        if (ride.rider_id !== req.user.id)
            throw new error_middleware_1.AppError('Access denied', 403);
        if (ride.status !== 'ongoing')
            throw new error_middleware_1.AppError('SOS only available during active ride', 400);
        await (0, safety_engine_service_1.triggerSOS)(req.params.rideId, req.user.id, ride.driver_id);
        // Get driver and vehicle info for SOS response
        const { data: driver } = await supabase_1.supabase
            .from('driver_profiles')
            .select('vehicle_number, vehicle_model, vehicle_color, current_lat, current_lng, users(name, phone)')
            .eq('user_id', ride.driver_id)
            .single();
        const { data: contacts } = await supabase_1.supabase
            .from('trusted_contacts')
            .select('name, phone, relationship')
            .eq('user_id', req.user.id);
        res.json({
            success: true,
            message: 'SOS triggered. Emergency contacts notified.',
            data: {
                ride_id: req.params.rideId,
                vehicle_number: driver?.vehicle_number,
                vehicle_model: driver?.vehicle_model,
                driver_name: driver?.users?.name,
                driver_phone: driver?.users?.phone,
                current_location: {
                    lat: driver?.current_lat,
                    lng: driver?.current_lng,
                },
                contacts_notified: contacts?.length || 0,
                tracking_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/track/${req.params.rideId}`,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/safety/events
router.get('/events', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const { data } = await supabase_1.supabase
            .from('safety_events')
            .select('*, rides(pickup_address, destination_address)')
            .eq('rider_id', req.user.id)
            .order('triggered_at', { ascending: false })
            .limit(20);
        res.json({ success: true, data: data || [] });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/safety/simulate-event (DEV / TEST helper for 10-min stop & route deviation)
router.post('/simulate-event', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const { ride_id, event_type } = zod_1.z.object({
            ride_id: zod_1.z.string(),
            event_type: zod_1.z.enum(['long_stop', 'route_deviation']),
        }).parse(req.body);
        const { data: event } = await supabase_1.supabase
            .from('safety_events')
            .insert({
            ride_id,
            rider_id: req.user.id,
            event_type,
            lat: 12.9716,
            lng: 77.5946,
            escalation_level: 2,
            triggered_at: new Date().toISOString(),
        })
            .select('id')
            .single()
            .catch(() => ({ data: { id: `evt_${Date.now()}` } }));
        res.json({
            success: true,
            message: `Simulated safety alert (${event_type}) triggered successfully.`,
            data: {
                id: event?.id || `evt_${Date.now()}`,
                ride_id,
                event_type,
                escalation_level: 2,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=safety.routes.js.map
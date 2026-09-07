"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_middleware_1 = require("../middleware/auth.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const supabase_1 = require("../utils/supabase");
const error_middleware_1 = require("../middleware/error.middleware");
const notification_service_1 = require("../services/notification.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// POST /api/driver/register
router.post('/register', async (req, res, next) => {
    try {
        const body = zod_1.z.object({
            license_number: zod_1.z.string().min(5),
            vehicle_type: zod_1.z.enum(['auto', 'bike', 'go', 'comfort']),
            vehicle_model: zod_1.z.string().min(2),
            vehicle_number: zod_1.z.string().min(5),
            vehicle_color: zod_1.z.string().min(2),
            rc_document_url: zod_1.z.string().url().optional(),
            insurance_url: zod_1.z.string().url().optional(),
            license_url: zod_1.z.string().url().optional(),
        }).parse(req.body);
        const { data, error } = await supabase_1.supabase
            .from('driver_profiles')
            .upsert({
            user_id: req.user.id,
            ...body,
            is_verified: false,
            rating: 5.0,
            total_trips: 0,
            total_safe_trips: 0,
            route_compliance_percentage: 100,
            is_online: false,
        })
            .select()
            .single();
        if (error)
            throw new error_middleware_1.AppError('Failed to register driver', 500);
        // Update user role to driver
        await supabase_1.supabase.from('users').update({ role: 'driver' }).eq('id', req.user.id);
        res.status(201).json({
            success: true,
            message: 'Driver registration submitted. Pending verification.',
            data,
        });
    }
    catch (error) {
        next(error);
    }
});
// PUT /api/driver/online
router.put('/online', (0, role_middleware_1.requireRole)('driver'), async (req, res, next) => {
    try {
        const { lat, lng } = zod_1.z.object({ lat: zod_1.z.number(), lng: zod_1.z.number() }).parse(req.body);
        const { data: profile } = await supabase_1.supabase
            .from('driver_profiles')
            .select('is_verified')
            .eq('user_id', req.user.id)
            .single();
        if (!profile?.is_verified)
            throw new error_middleware_1.AppError('Your account is pending verification', 403);
        await supabase_1.supabase
            .from('driver_profiles')
            .update({ is_online: true, current_lat: lat, current_lng: lng })
            .eq('user_id', req.user.id);
        res.json({ success: true, message: 'You are now online' });
    }
    catch (error) {
        next(error);
    }
});
// PUT /api/driver/offline
router.put('/offline', (0, role_middleware_1.requireRole)('driver'), async (req, res, next) => {
    try {
        await supabase_1.supabase
            .from('driver_profiles')
            .update({ is_online: false })
            .eq('user_id', req.user.id);
        res.json({ success: true, message: 'You are now offline' });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/driver/requests
router.get('/requests', (0, role_middleware_1.requireRole)('driver'), async (req, res, next) => {
    try {
        const { data } = await supabase_1.supabase
            .from('rides')
            .select('id, pickup_address, destination_address, ride_type, estimated_fare, surge_multiplier, created_at')
            .eq('status', 'searching')
            .order('created_at', { ascending: true })
            .limit(10);
        res.json({ success: true, data: data || [] });
    }
    catch (error) {
        next(error);
    }
});
// PUT /api/driver/requests/:rideId/accept
router.put('/requests/:rideId/accept', (0, role_middleware_1.requireRole)('driver'), async (req, res, next) => {
    try {
        const { data: ride } = await supabase_1.supabase
            .from('rides')
            .select('status, rider_id, ride_pin, destination_address, estimated_fare')
            .eq('id', req.params.rideId)
            .single();
        if (!ride)
            throw new error_middleware_1.AppError('Ride not found', 404);
        if (ride.status !== 'searching')
            throw new error_middleware_1.AppError('Ride already assigned', 400);
        const { data: driver } = await supabase_1.supabase
            .from('driver_profiles')
            .select('vehicle_model, vehicle_number, users(name)')
            .eq('user_id', req.user.id)
            .single();
        await supabase_1.supabase
            .from('rides')
            .update({ driver_id: req.user.id, status: 'driver_assigned' })
            .eq('id', req.params.rideId);
        // Notify rider
        await (0, notification_service_1.sendNotificationToUser)(ride.rider_id, notification_service_1.notifications.driverAssigned(driver?.users?.name || 'Driver', driver?.vehicle_model || 'Vehicle', driver?.vehicle_number || 'XXXX-0000', 5, // ETA mock
        ride.ride_pin));
        res.json({ success: true, message: 'Ride accepted', data: { ride, driver } });
    }
    catch (error) {
        next(error);
    }
});
// PUT /api/driver/requests/:rideId/decline
router.put('/requests/:rideId/decline', (0, role_middleware_1.requireRole)('driver'), async (req, res, next) => {
    try {
        res.json({ success: true, message: 'Ride declined' });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/driver/earnings
router.get('/earnings', (0, role_middleware_1.requireRole)('driver'), async (req, res, next) => {
    try {
        const period = req.query.period || 'today';
        let fromDate = new Date();
        if (period === 'week')
            fromDate.setDate(fromDate.getDate() - 7);
        else if (period === 'month')
            fromDate.setMonth(fromDate.getMonth() - 1);
        else
            fromDate.setHours(0, 0, 0, 0);
        const { data: rides } = await supabase_1.supabase
            .from('rides')
            .select('final_fare, estimated_fare, status, completed_at, created_at')
            .eq('driver_id', req.user.id)
            .eq('status', 'completed')
            .gte('completed_at', fromDate.toISOString());
        const total = (rides || []).reduce((sum, r) => sum + (r.final_fare || r.estimated_fare || 0), 0);
        const tripCount = (rides || []).length;
        res.json({
            success: true,
            data: {
                total_earnings: total,
                trip_count: tripCount,
                period,
                rides: rides || [],
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=driver.routes.js.map
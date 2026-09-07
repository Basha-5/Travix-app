"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_middleware_1 = require("../middleware/auth.middleware");
const supabase_1 = require("../utils/supabase");
const error_middleware_1 = require("../middleware/error.middleware");
const maps_service_1 = require("../services/maps.service");
const fare_service_1 = require("../services/fare.service");
const geo_1 = require("../utils/geo");
const notification_service_1 = require("../services/notification.service");
const safety_engine_service_1 = require("../services/safety-engine.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// POST /api/rides/estimate
router.post('/estimate', async (req, res, next) => {
    try {
        const body = zod_1.z.object({
            pickup_lat: zod_1.z.number(),
            pickup_lng: zod_1.z.number(),
            destination_lat: zod_1.z.number(),
            destination_lng: zod_1.z.number(),
        }).parse(req.body);
        const route = await (0, maps_service_1.getRoute)(body.pickup_lat, body.pickup_lng, body.destination_lat, body.destination_lng);
        const surge = (0, fare_service_1.calculateSurge)(body.pickup_lat, body.pickup_lng, new Date().getHours());
        const fareConfigs = (0, fare_service_1.getAllFareConfigs)();
        const rideTypes = ['auto', 'bike', 'go', 'comfort', 'group'];
        const estimates = rideTypes.map((type) => {
            const config = fareConfigs[type];
            const fare = (0, fare_service_1.calculateFare)({
                rideType: type,
                distanceKm: route.distanceKm,
                durationMinutes: route.durationMinutes,
                surgeMultiplier: surge,
                isGroupRide: type === 'group',
                groupSize: type === 'group' ? 3 : 1,
            });
            return {
                type,
                label: config.label,
                icon: config.icon,
                eta_minutes: Math.round(3 + Math.random() * 5), // Mock ETA
                estimated_fare: fare.groupFare,
                normal_fare: type === 'group' ? fare.normalFare : undefined,
                savings: type === 'group' ? fare.savings : undefined,
                distance_km: route.distanceKm,
                duration_minutes: route.durationMinutes,
                capacity: config.capacity,
                description: config.description,
                available: true,
                badge: type === 'group' ? 'Best Value' : undefined,
                surge_multiplier: surge,
            };
        });
        res.json({ success: true, data: estimates });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/rides/book
router.post('/book', async (req, res, next) => {
    try {
        const body = zod_1.z.object({
            pickup_address: zod_1.z.string(),
            pickup_lat: zod_1.z.number(),
            pickup_lng: zod_1.z.number(),
            destination_address: zod_1.z.string(),
            destination_lat: zod_1.z.number(),
            destination_lng: zod_1.z.number(),
            ride_type: zod_1.z.enum(['auto', 'bike', 'go', 'comfort', 'group']),
            payment_method: zod_1.z.enum(['upi', 'card', 'cash', 'wallet']).default('cash'),
        }).parse(req.body);
        const route = await (0, maps_service_1.getRoute)(body.pickup_lat, body.pickup_lng, body.destination_lat, body.destination_lng);
        const surge = (0, fare_service_1.calculateSurge)(body.pickup_lat, body.pickup_lng, new Date().getHours());
        const fare = (0, fare_service_1.calculateFare)({
            rideType: body.ride_type,
            distanceKm: route.distanceKm,
            durationMinutes: route.durationMinutes,
            surgeMultiplier: surge,
        });
        const pin = (0, geo_1.generateRidePin)();
        const shareToken = (0, geo_1.generateShareToken)();
        const { data: ride, error } = await supabase_1.supabase
            .from('rides')
            .insert({
            rider_id: req.user.id,
            pickup_address: body.pickup_address,
            pickup_lat: body.pickup_lat,
            pickup_lng: body.pickup_lng,
            destination_address: body.destination_address,
            destination_lat: body.destination_lat,
            destination_lng: body.destination_lng,
            ride_type: body.ride_type,
            status: 'searching',
            estimated_fare: fare.groupFare,
            surge_multiplier: surge,
            ride_pin: pin,
            is_pin_verified: false,
            distance_km: route.distanceKm,
            is_group_ride: body.ride_type === 'group',
            payment_method: body.payment_method,
            payment_status: 'pending',
            route_polyline: route.encodedPolyline,
            share_token: shareToken,
        })
            .select('*')
            .single();
        let createdRide = ride;
        if (error || !createdRide) {
            console.warn('[RIDES] Supabase insert notice:', error?.message || 'Using fallback booking');
            createdRide = {
                id: `ride_${Date.now()}`,
                rider_id: req.user.id,
                pickup_address: body.pickup_address,
                pickup_lat: body.pickup_lat,
                pickup_lng: body.pickup_lng,
                destination_address: body.destination_address,
                destination_lat: body.destination_lat,
                destination_lng: body.destination_lng,
                ride_type: body.ride_type,
                status: 'searching',
                estimated_fare: fare.groupFare,
                surge_multiplier: surge,
                ride_pin: pin,
                is_pin_verified: false,
                distance_km: route.distanceKm,
                is_group_ride: body.ride_type === 'group',
                payment_method: body.payment_method,
                payment_status: 'pending',
                route_polyline: route.encodedPolyline,
                created_at: new Date().toISOString(),
            };
        }
        // Auto-assign mock driver after 3 seconds in dev mode
        setTimeout(() => simulateDriverAssignment(createdRide.id), 3000);
        res.status(201).json({ success: true, data: { ...createdRide, share_token: shareToken } });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/rides/:id
router.get('/:id', async (req, res, next) => {
    try {
        const { data: ride, error } = await supabase_1.supabase
            .from('rides')
            .select(`
        *,
        driver_profiles (
          user_id, vehicle_model, vehicle_number, vehicle_color, rating, current_lat, current_lng,
          users ( id, name, gender, profile_photo_url, phone )
        ),
        safety_events ( id, event_type, escalation_level, triggered_at, resolved_at )
      `)
            .eq('id', req.params.id)
            .single();
        if (error || !ride) {
            // Fallback for generated dev rides
            const mockRide = {
                id: req.params.id,
                rider_id: req.user.id,
                pickup_address: 'HSR Layout, Bangalore',
                pickup_lat: 12.9082,
                pickup_lng: 77.6476,
                destination_address: 'Koramangala, Bangalore',
                destination_lat: 12.9352,
                destination_lng: 77.6245,
                ride_type: 'auto',
                status: 'searching',
                estimated_fare: 85,
                surge_multiplier: 1.0,
                ride_pin: '4829',
                is_pin_verified: false,
                distance_km: 4.2,
                is_group_ride: false,
                payment_method: 'cash',
                payment_status: 'pending',
                created_at: new Date().toISOString(),
                driver_profiles: {
                    user_id: 'drv-01',
                    vehicle_model: 'Bajaj RE Auto',
                    vehicle_number: 'KA-01-AB-1234',
                    vehicle_color: 'Yellow/Black',
                    rating: 4.8,
                    users: { name: 'Ramesh Kumar', gender: 'male', phone: '+91 98765 43210' },
                },
            };
            res.json({ success: true, data: mockRide });
            return;
        }
        // Ensure the requesting user is the rider, driver, or admin
        const isRider = ride.rider_id === req.user.id;
        const isDriver = ride.driver_profiles?.user_id === req.user.id;
        const isAdmin = req.user.role === 'admin';
        if (!isRider && !isDriver && !isAdmin)
            throw new error_middleware_1.AppError('Access denied', 403);
        res.json({ success: true, data: ride });
    }
    catch (error) {
        next(error);
    }
});
// PUT /api/rides/:id/cancel
router.put('/:id/cancel', async (req, res, next) => {
    try {
        const { data: ride } = await supabase_1.supabase.from('rides').select('rider_id, status').eq('id', req.params.id).single();
        if (!ride)
            throw new error_middleware_1.AppError('Ride not found', 404);
        if (ride.rider_id !== req.user.id)
            throw new error_middleware_1.AppError('Access denied', 403);
        if (['ongoing', 'completed', 'cancelled'].includes(ride.status)) {
            throw new error_middleware_1.AppError(`Cannot cancel a ride in '${ride.status}' status`, 400);
        }
        await supabase_1.supabase
            .from('rides')
            .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
            .eq('id', req.params.id);
        res.json({ success: true, message: 'Ride cancelled' });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/rides/:id/verify-pin (driver verifies PIN)
router.post('/:id/verify-pin', async (req, res, next) => {
    try {
        const { pin } = zod_1.z.object({ pin: zod_1.z.string().length(4) }).parse(req.body);
        const { data: ride } = await supabase_1.supabase
            .from('rides')
            .select('ride_pin, status, driver_id, rider_id')
            .eq('id', req.params.id)
            .single();
        if (!ride)
            throw new error_middleware_1.AppError('Ride not found', 404);
        if (ride.status !== 'driver_arrived')
            throw new error_middleware_1.AppError('PIN can only be verified when driver has arrived', 400);
        if (ride.ride_pin !== pin)
            throw new error_middleware_1.AppError('Invalid PIN', 400);
        await supabase_1.supabase
            .from('rides')
            .update({ status: 'pin_verified', is_pin_verified: true })
            .eq('id', req.params.id);
        res.json({ success: true, message: 'PIN verified' });
    }
    catch (error) {
        next(error);
    }
});
// PUT /api/rides/:id/start
router.put('/:id/start', async (req, res, next) => {
    try {
        const { data: ride } = await supabase_1.supabase
            .from('rides')
            .select('status, rider_id, driver_id, destination_address, share_token')
            .eq('id', req.params.id)
            .single();
        if (!ride)
            throw new error_middleware_1.AppError('Ride not found', 404);
        if (ride.status !== 'pin_verified')
            throw new error_middleware_1.AppError('PIN must be verified before starting ride', 400);
        await supabase_1.supabase
            .from('rides')
            .update({ status: 'ongoing', started_at: new Date().toISOString() })
            .eq('id', req.params.id);
        // Trigger location sharing to trusted contacts
        const { data: contacts } = await supabase_1.supabase
            .from('trusted_contacts')
            .select('user_id, name')
            .eq('user_id', ride.rider_id)
            .eq('auto_share_on_ride_start', true);
        const trackingUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/track/${req.params.id}`;
        if (contacts && contacts.length > 0) {
            const { data: rider } = await supabase_1.supabase.from('users').select('name').eq('id', ride.rider_id).single();
            for (const contact of contacts) {
                await (0, notification_service_1.sendNotificationToUser)(contact.user_id, notification_service_1.notifications.rideStarted(rider?.name || 'Rider', ride.destination_address, trackingUrl), false);
            }
        }
        res.json({ success: true, data: { tracking_url: trackingUrl } });
    }
    catch (error) {
        next(error);
    }
});
// PUT /api/rides/:id/complete
router.put('/:id/complete', async (req, res, next) => {
    try {
        const { data: ride } = await supabase_1.supabase
            .from('rides')
            .select('status, rider_id, estimated_fare, destination_address')
            .eq('id', req.params.id)
            .single();
        if (!ride)
            throw new error_middleware_1.AppError('Ride not found', 404);
        if (ride.status !== 'ongoing')
            throw new error_middleware_1.AppError('Ride is not ongoing', 400);
        await supabase_1.supabase
            .from('rides')
            .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            final_fare: ride.estimated_fare,
            payment_status: 'success',
        })
            .eq('id', req.params.id);
        (0, safety_engine_service_1.clearRideTracking)(req.params.id);
        await (0, notification_service_1.sendNotificationToUser)(ride.rider_id, notification_service_1.notifications.rideCompleted(ride.destination_address, ride.estimated_fare));
        res.json({ success: true, message: 'Ride completed' });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/rides/:id/rating
router.post('/:id/rating', async (req, res, next) => {
    try {
        const body = zod_1.z.object({
            rated_id: zod_1.z.string().uuid(),
            rating: zod_1.z.number().min(1).max(5),
            tags: zod_1.z.array(zod_1.z.string()).optional(),
            comment: zod_1.z.string().optional(),
        }).parse(req.body);
        await supabase_1.supabase.from('ratings').insert({
            ride_id: req.params.id,
            rater_id: req.user.id,
            ...body,
        });
        res.status(201).json({ success: true, message: 'Rating submitted' });
    }
    catch (error) {
        next(error);
    }
});
// DEV ONLY: Simulate driver assignment
async function simulateDriverAssignment(rideId) {
    await supabase_1.supabase
        .from('rides')
        .update({ status: 'driver_assigned' })
        .eq('id', rideId);
    console.log(`[DEV] Driver auto-assigned for ride ${rideId}`);
}
exports.default = router;
//# sourceMappingURL=rides.routes.js.map
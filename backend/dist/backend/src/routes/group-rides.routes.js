"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_middleware_1 = require("../middleware/auth.middleware");
const supabase_1 = require("../utils/supabase");
const error_middleware_1 = require("../middleware/error.middleware");
const group_match_service_1 = require("../services/group-match.service");
const fare_service_1 = require("../services/fare.service");
const geo_1 = require("../utils/geo");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// POST /api/group-rides/search
router.post('/search', async (req, res, next) => {
    try {
        const body = zod_1.z.object({
            pickup_lat: zod_1.z.number(),
            pickup_lng: zod_1.z.number(),
            destination_lat: zod_1.z.number(),
            destination_lng: zod_1.z.number(),
            gender_preference: zod_1.z.enum(['anyone', 'same_gender', 'female_only', 'male_only']).default('anyone'),
        }).parse(req.body);
        // Get rider's gender
        const { data: rider } = await supabase_1.supabase.from('users').select('gender').eq('id', req.user.id).single();
        const matches = await (0, group_match_service_1.findGroupMatches)({
            pickupLat: body.pickup_lat,
            pickupLng: body.pickup_lng,
            destinationLat: body.destination_lat,
            destinationLng: body.destination_lng,
            genderPreference: body.gender_preference,
            riderGender: rider?.gender || 'other',
        });
        res.json({ success: true, data: matches });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/group-rides/:id
router.get('/:id', async (req, res, next) => {
    try {
        const { data: group, error } = await supabase_1.supabase
            .from('group_rides')
            .select(`
        id, vehicle_capacity, status, created_at,
        driver_profiles!inner (
          vehicle_model, vehicle_number, vehicle_color, rating,
          users!inner ( name, gender )
        ),
        group_ride_members (
          id, pickup_sequence, drop_sequence, group_fare, normal_fare, savings, estimated_extra_minutes,
          users!inner ( gender )
        )
      `)
            .eq('id', req.params.id)
            .single();
        if (error || !group)
            throw new error_middleware_1.AppError('Group ride not found', 404);
        // Privacy: return only gender counts, not names/phones
        const members = group.group_ride_members || [];
        const genderCounts = { female: 0, male: 0, other: 0 };
        for (const m of members) {
            const g = m.users?.gender;
            if (g === 'female')
                genderCounts.female++;
            else if (g === 'male')
                genderCounts.male++;
            else
                genderCounts.other++;
        }
        const preview = {
            id: group.id,
            status: group.status,
            vehicle_capacity: group.vehicle_capacity,
            current_member_count: members.length,
            driver_gender: group.driver_profiles?.users?.gender,
            driver_vehicle_model: group.driver_profiles?.vehicle_model,
            driver_vehicle_number: group.driver_profiles?.vehicle_number,
            driver_vehicle_color: group.driver_profiles?.vehicle_color,
            driver_rating: group.driver_profiles?.rating,
            riders_female_count: genderCounts.female,
            riders_male_count: genderCounts.male,
            riders_other_count: genderCounts.other,
        };
        res.json({ success: true, data: preview });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/group-rides/:id/join
router.post('/:id/join', async (req, res, next) => {
    try {
        const body = zod_1.z.object({
            ride_id: zod_1.z.string().uuid(),
            pickup_lat: zod_1.z.number(),
            pickup_lng: zod_1.z.number(),
            destination_lat: zod_1.z.number(),
            destination_lng: zod_1.z.number(),
        }).parse(req.body);
        // Verify group is still forming
        const { data: group } = await supabase_1.supabase
            .from('group_rides')
            .select('*, group_ride_members(id)')
            .eq('id', req.params.id)
            .single();
        if (!group)
            throw new error_middleware_1.AppError('Group ride not found', 404);
        if (group.status !== 'forming')
            throw new error_middleware_1.AppError('This group ride is no longer accepting members', 400);
        const currentCount = group.group_ride_members.length;
        if (currentCount >= group.vehicle_capacity)
            throw new error_middleware_1.AppError('Group is full', 400);
        const distKm = (0, geo_1.haversineDistance)(body.pickup_lat, body.pickup_lng, body.destination_lat, body.destination_lng);
        const fare = (0, fare_service_1.calculateFare)({
            rideType: 'go',
            distanceKm: distKm,
            durationMinutes: 20,
            isGroupRide: true,
            groupSize: currentCount + 2,
        });
        const { data: member, error } = await supabase_1.supabase
            .from('group_ride_members')
            .insert({
            group_ride_id: req.params.id,
            ride_id: body.ride_id,
            rider_id: req.user.id,
            pickup_lat: body.pickup_lat,
            pickup_lng: body.pickup_lng,
            destination_lat: body.destination_lat,
            destination_lng: body.destination_lng,
            pickup_sequence: currentCount + 1,
            drop_sequence: currentCount + 1,
            normal_fare: fare.normalFare,
            group_fare: fare.groupFare,
            savings: fare.savings,
            estimated_extra_minutes: Math.round(currentCount * 3),
        })
            .select()
            .single();
        if (error || !member)
            throw new error_middleware_1.AppError('Failed to join group ride', 500);
        // Update ride to link to group
        await supabase_1.supabase
            .from('rides')
            .update({ group_ride_id: req.params.id, is_group_ride: true })
            .eq('id', body.ride_id);
        res.status(201).json({
            success: true,
            data: {
                member,
                group_fare: fare.groupFare,
                normal_fare: fare.normalFare,
                savings: fare.savings,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// DELETE /api/group-rides/:id/leave
router.delete('/:id/leave', async (req, res, next) => {
    try {
        const { error } = await supabase_1.supabase
            .from('group_ride_members')
            .delete()
            .eq('group_ride_id', req.params.id)
            .eq('rider_id', req.user.id);
        if (error)
            throw new error_middleware_1.AppError('Failed to leave group', 500);
        res.json({ success: true, message: 'Left group ride' });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=group-rides.routes.js.map
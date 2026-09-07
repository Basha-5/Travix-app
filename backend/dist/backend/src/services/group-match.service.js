"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findGroupMatches = findGroupMatches;
exports.createFormingGroupRide = createFormingGroupRide;
const supabase_1 = require("../utils/supabase");
const geo_1 = require("../utils/geo");
const maps_service_1 = require("./maps.service");
const fare_service_1 = require("./fare.service");
const MAX_PICKUP_KM = Number(process.env.GROUP_MATCH_MAX_PICKUP_KM) || 1.5;
const MAX_DEST_KM = Number(process.env.GROUP_MATCH_MAX_DEST_KM) || 2.0;
const MIN_OVERLAP_PCT = Number(process.env.GROUP_MATCH_MIN_OVERLAP_PCT) || 60;
const MAX_DETOUR_MIN = Number(process.env.GROUP_MATCH_MAX_DETOUR_MIN) || 10;
async function findGroupMatches(input) {
    // 1. Query all forming group rides
    const { data: formingGroups, error } = await supabase_1.supabase
        .from('group_rides')
        .select(`
      id, driver_id, vehicle_capacity, route_polyline, created_at,
      driver_profiles!inner (
        user_id, vehicle_model, vehicle_number, vehicle_color, rating, is_verified,
        users!inner ( gender )
      ),
      group_ride_members (
        id, rider_id, pickup_lat, pickup_lng, destination_lat, destination_lng,
        normal_fare, group_fare, savings, estimated_extra_minutes,
        rides!inner ( id ),
        users!inner ( gender )
      )
    `)
        .eq('status', 'forming')
        .order('created_at', { ascending: true });
    if (error || !formingGroups) {
        console.error('Group match query error:', error);
        return [];
    }
    const matches = [];
    for (const group of formingGroups) {
        const members = group.group_ride_members || [];
        const currentCount = members.length;
        const capacity = group.vehicle_capacity;
        // Check remaining capacity
        if (capacity - currentCount < 1)
            continue;
        // Check gender preference
        const driverGender = group.driver_profiles?.users?.gender;
        if (!passesGenderFilter(input.genderPreference, input.riderGender, driverGender, members)) {
            continue;
        }
        // Calculate pickup proximity (average of existing members' pickups)
        const avgPickupLat = members.length > 0
            ? members.reduce((sum, m) => sum + m.pickup_lat, 0) / members.length
            : input.pickupLat;
        const avgPickupLng = members.length > 0
            ? members.reduce((sum, m) => sum + m.pickup_lng, 0) / members.length
            : input.pickupLng;
        const pickupDist = (0, geo_1.haversineDistance)(input.pickupLat, input.pickupLng, avgPickupLat, avgPickupLng);
        if (pickupDist > MAX_PICKUP_KM)
            continue;
        // Calculate destination proximity
        const avgDestLat = members.length > 0
            ? members.reduce((sum, m) => sum + m.destination_lat, 0) / members.length
            : input.destinationLat;
        const avgDestLng = members.length > 0
            ? members.reduce((sum, m) => sum + m.destination_lng, 0) / members.length
            : input.destinationLng;
        const destDist = (0, geo_1.haversineDistance)(input.destinationLat, input.destinationLng, avgDestLat, avgDestLng);
        if (destDist > MAX_DEST_KM)
            continue;
        // Calculate route overlap
        let overlapPct = 70; // Default if no polyline yet
        if (group.route_polyline) {
            try {
                const existingRoute = (0, geo_1.decodePolyline)(group.route_polyline);
                const newRoute = await (0, maps_service_1.getRoute)(input.pickupLat, input.pickupLng, input.destinationLat, input.destinationLng);
                overlapPct = (0, maps_service_1.calculateRouteOverlap)(existingRoute, newRoute.polylinePoints);
            }
            catch {
                overlapPct = 60;
            }
        }
        if (overlapPct < MIN_OVERLAP_PCT)
            continue;
        // Estimate detour (extra minutes for this rider)
        const extraMinutes = Math.round(pickupDist * 3 + destDist * 2); // rough estimate
        if (extraMinutes > MAX_DETOUR_MIN)
            continue;
        // Calculate fare for this rider
        const newGroupSize = currentCount + 2; // +1 for driver perspective
        const fareResult = (0, fare_service_1.calculateFare)({
            rideType: 'go',
            distanceKm: (0, geo_1.haversineDistance)(input.pickupLat, input.pickupLng, input.destinationLat, input.destinationLng),
            durationMinutes: 20,
            isGroupRide: true,
            groupSize: newGroupSize,
        });
        // Build preview
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
        const pickupsBefore = members.filter((m) => m.pickup_sequence < (currentCount + 1)).length;
        matches.push({
            group_ride_id: group.id,
            driver_gender: driverGender,
            driver_vehicle_model: group.driver_profiles?.vehicle_model || 'Unknown',
            driver_vehicle_number: group.driver_profiles?.vehicle_number || 'XXXX-0000',
            driver_vehicle_color: group.driver_profiles?.vehicle_color || 'White',
            driver_rating: group.driver_profiles?.rating || 4.5,
            riders_female_count: genderCounts.female,
            riders_male_count: genderCounts.male,
            riders_other_count: genderCounts.other,
            vehicle_capacity: capacity,
            current_member_count: currentCount,
            normal_fare: fareResult.normalFare,
            group_fare: fareResult.groupFare,
            savings: fareResult.savings,
            estimated_extra_minutes: extraMinutes,
            pickups_before_yours: pickupsBefore,
            route_overlap_percentage: overlapPct,
            score: overlapPct * 2 + fareResult.savings - extraMinutes,
        });
    }
    // Sort by score (overlap, savings, eta)
    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, 3).map(({ score: _score, ...preview }) => preview);
}
function passesGenderFilter(preference, riderGender, driverGender, members) {
    switch (preference) {
        case 'anyone':
            return true;
        case 'same_gender':
            if (driverGender !== riderGender)
                return false;
            return members.every((m) => m.users?.gender === riderGender);
        case 'female_only':
            if (driverGender !== 'female')
                return false;
            return members.every((m) => m.users?.gender === 'female');
        case 'male_only':
            if (driverGender !== 'male')
                return false;
            return members.every((m) => m.users?.gender === 'male');
        default:
            return true;
    }
}
// Create a new forming group ride for a rider who found no match
async function createFormingGroupRide(driverId, vehicleCapacity, routePolyline) {
    const { data, error } = await supabase_1.supabase
        .from('group_rides')
        .insert({
        driver_id: driverId,
        vehicle_capacity: vehicleCapacity,
        status: 'forming',
        route_polyline: routePolyline,
    })
        .select('id')
        .single();
    if (error || !data)
        throw new Error('Failed to create group ride');
    return data.id;
}
//# sourceMappingURL=group-match.service.js.map
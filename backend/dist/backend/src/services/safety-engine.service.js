"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordLocationUpdate = recordLocationUpdate;
exports.checkActiveRides = checkActiveRides;
exports.triggerSOS = triggerSOS;
exports.clearRideTracking = clearRideTracking;
const supabase_1 = require("../utils/supabase");
const geo_1 = require("../utils/geo");
const notification_service_1 = require("./notification.service");
const email_service_1 = require("./email.service");
const STOP_RADIUS_METERS = Number(process.env.SAFETY_STOP_RADIUS_METERS) || 100;
const STOP_DURATION_MINUTES = Number(process.env.SAFETY_STOP_DURATION_MINUTES) || 10;
const WOMEN_STOP_DURATION_MINUTES = Number(process.env.SAFETY_WOMEN_STOP_DURATION_MINUTES) || 7;
const DEVIATION_METERS = Number(process.env.SAFETY_DEVIATION_METERS) || 500;
const DEVIATION_MINUTES = Number(process.env.SAFETY_DEVIATION_MINUTES) || 2;
const RESPONSE_WAIT_MINUTES = Number(process.env.SAFETY_RESPONSE_WAIT_MINUTES) || 3;
// In-memory tracking for location history per ride
// In production, this would use Redis
const locationHistory = new Map();
const deviationTracking = new Map();
function recordLocationUpdate(rideId, lat, lng) {
    const history = locationHistory.get(rideId) || [];
    history.push({ lat, lng, timestamp: new Date() });
    // Keep only last 20 minutes of history
    const cutoff = new Date(Date.now() - 20 * 60 * 1000);
    const filtered = history.filter((h) => h.timestamp > cutoff);
    locationHistory.set(rideId, filtered);
}
// Run safety checks on all active rides
async function checkActiveRides() {
    const { data: activeRides, error } = await supabase_1.supabase
        .from('rides')
        .select(`
      id, rider_id, driver_id, route_polyline,
      driver_profiles!inner (current_lat, current_lng),
      users!inner (id, gender),
      safety_events (id, event_type, escalation_level, resolved_at, rider_responded_at, rider_response, triggered_at)
    `)
        .eq('status', 'ongoing');
    if (error || !activeRides)
        return;
    for (const ride of activeRides) {
        try {
            await checkSingleRide(ride);
        }
        catch (err) {
            console.error(`Safety check error for ride ${ride.id}:`, err);
        }
    }
}
async function checkSingleRide(ride) {
    const rideId = ride.id;
    const driverProfile = ride.driver_profiles;
    if (!driverProfile?.current_lat || !driverProfile?.current_lng)
        return;
    // Women safety mode check
    const isWomenSafetyMode = ride.users?.gender === 'female';
    const stopDuration = isWomenSafetyMode ? WOMEN_STOP_DURATION_MINUTES : STOP_DURATION_MINUTES;
    // Check for existing OPEN safety events
    const openEvents = (ride.safety_events || []).filter((e) => !e.resolved_at);
    const hasOpenEvent = openEvents.length > 0;
    // ── A. Check long stop (10-min same location) ──
    await checkLongStop(ride, rideId, stopDuration, hasOpenEvent, openEvents);
    // ── B. Check route deviation ──
    if (ride.route_polyline) {
        await checkRouteDeviation(ride, rideId, hasOpenEvent, openEvents);
    }
    // ── C. Check escalation for existing open events ──
    if (hasOpenEvent) {
        for (const event of openEvents) {
            await checkEscalation(event, rideId, ride.rider_id, ride.driver_id);
        }
    }
}
async function checkLongStop(ride, rideId, stopDurationMinutes, hasOpenEvent, openEvents) {
    const history = locationHistory.get(rideId) || [];
    if (history.length < 3)
        return;
    const lookback = new Date(Date.now() - stopDurationMinutes * 60 * 1000);
    const recentHistory = history.filter((h) => h.timestamp > lookback);
    if (recentHistory.length < 3)
        return;
    const stoppedLong = (0, geo_1.allWithinRadius)(recentHistory.map((h) => ({ lat: h.lat, lng: h.lng })), STOP_RADIUS_METERS);
    if (!stoppedLong)
        return;
    // Avoid duplicate events
    const hasStopEvent = openEvents.some((e) => e.event_type === 'long_stop');
    if (hasStopEvent)
        return;
    console.log(`[SAFETY] Long stop detected for ride ${rideId}`);
    // Create safety event at level 2
    const lat = recentHistory[recentHistory.length - 1].lat;
    const lng = recentHistory[recentHistory.length - 1].lng;
    const { data: event } = await supabase_1.supabase
        .from('safety_events')
        .insert({
        ride_id: rideId,
        rider_id: ride.rider_id,
        driver_id: ride.driver_id,
        event_type: 'long_stop',
        lat,
        lng,
        escalation_level: 2,
    })
        .select('id')
        .single();
    // Log to audit_logs
    await supabase_1.supabase.from('audit_logs').insert({
        user_id: ride.rider_id,
        action: 'safety_event_created',
        metadata: { ride_id: rideId, event_type: 'long_stop', lat, lng },
    });
    // Send push to rider
    await (0, notification_service_1.sendNotificationToUser)(ride.rider_id, notification_service_1.notifications.safetyCheck('long_stop'));
}
async function checkRouteDeviation(ride, rideId, hasOpenEvent, openEvents) {
    const driverProfile = ride.driver_profiles;
    const routePoints = (0, geo_1.decodePolyline)(ride.route_polyline);
    const distanceFromRoute = (0, geo_1.pointToPolylineDistanceMeters)({ lat: driverProfile.current_lat, lng: driverProfile.current_lng }, routePoints);
    if (distanceFromRoute <= DEVIATION_METERS) {
        // Within route — clear deviation tracking
        deviationTracking.delete(rideId);
        return;
    }
    // Outside route — track when deviation started
    if (!deviationTracking.has(rideId)) {
        deviationTracking.set(rideId, { firstDetectedAt: new Date() });
        return;
    }
    const deviationStart = deviationTracking.get(rideId).firstDetectedAt;
    const deviationDurationMin = (Date.now() - deviationStart.getTime()) / (1000 * 60);
    if (deviationDurationMin < DEVIATION_MINUTES)
        return;
    // Check for existing deviation event
    const hasDeviationEvent = openEvents.some((e) => e.event_type === 'route_deviation');
    if (hasDeviationEvent)
        return;
    console.log(`[SAFETY] Route deviation detected for ride ${rideId}: ${distanceFromRoute.toFixed(0)}m from route`);
    await supabase_1.supabase
        .from('safety_events')
        .insert({
        ride_id: rideId,
        rider_id: ride.rider_id,
        driver_id: ride.driver_id,
        event_type: 'route_deviation',
        lat: driverProfile.current_lat,
        lng: driverProfile.current_lng,
        escalation_level: 2,
    });
    await supabase_1.supabase.from('audit_logs').insert({
        user_id: ride.rider_id,
        action: 'safety_event_created',
        metadata: {
            ride_id: rideId,
            event_type: 'route_deviation',
            distance_from_route: distanceFromRoute,
        },
    });
    await (0, notification_service_1.sendNotificationToUser)(ride.rider_id, notification_service_1.notifications.safetyCheck('route_deviation'));
}
async function checkEscalation(event, rideId, riderId, driverId) {
    const triggeredAt = new Date(event.triggered_at);
    const minutesSinceTrigger = (Date.now() - triggeredAt.getTime()) / (1000 * 60);
    // Level 2: Rider has been notified, wait 3 min for response
    if (event.escalation_level === 2 && minutesSinceTrigger >= RESPONSE_WAIT_MINUTES) {
        if (!event.rider_responded_at) {
            // No response → escalate to level 3
            console.log(`[SAFETY] Escalating to level 3 for ride ${rideId}`);
            await escalateToLevel3(event.id, rideId, riderId, driverId);
        }
    }
    // Level 3: Trusted contacts alerted, wait 5 more min
    if (event.escalation_level === 3 && minutesSinceTrigger >= RESPONSE_WAIT_MINUTES + 5) {
        if (!event.rider_responded_at) {
            console.log(`[SAFETY] Escalating to level 4 for ride ${rideId}`);
            await escalateToLevel4(event.id, rideId, riderId, driverId);
        }
    }
}
async function escalateToLevel3(eventId, rideId, riderId, driverId) {
    await supabase_1.supabase
        .from('safety_events')
        .update({ escalation_level: 3 })
        .eq('id', eventId);
    // Get rider info and trusted contacts
    const { data: rider } = await supabase_1.supabase
        .from('users')
        .select('name, phone')
        .eq('id', riderId)
        .single();
    const { data: driver } = await supabase_1.supabase
        .from('driver_profiles')
        .select('vehicle_number, users(name)')
        .eq('user_id', driverId)
        .single();
    const { data: contacts } = await supabase_1.supabase
        .from('trusted_contacts')
        .select('id, name, phone, email, user_id')
        .eq('user_id', riderId);
    if (!contacts || contacts.length === 0) {
        console.log(`[SAFETY] Level 3: No trusted contacts for rider ${riderId}`);
        return;
    }
    // Get event location
    const { data: event } = await supabase_1.supabase
        .from('safety_events')
        .select('lat, lng')
        .eq('id', eventId)
        .single();
    const location = event ? `${event.lat.toFixed(4)}, ${event.lng.toFixed(4)}` : 'Unknown';
    const trackingUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/track/${rideId}`;
    // Alert each trusted contact via DB, Push, and Gmail SMTP Email
    for (const contact of contacts) {
        await supabase_1.supabase.from('emergency_alerts').insert({
            safety_event_id: eventId,
            contact_id: contact.id,
            message: `⚠️ Safety Alert: ${rider?.name} may need help. Vehicle: ${driver?.vehicle_number}. Location: ${location}. Track: ${trackingUrl}`,
            delivery_status: 'sent',
        });
        // Send Gmail SMTP Emergency Email if contact email is configured
        if (contact.email) {
            const emailContent = email_service_1.emailTemplates.emergencyAlert(rider?.name || 'Rider', driver?.vehicle_number || 'Unknown Vehicle', driver?.users?.name || 'Unknown Driver', location, trackingUrl);
            (0, email_service_1.sendEmail)({ to: contact.email, ...emailContent }).catch((err) => console.error(`[SAFETY] Emergency email dispatch error for ${contact.email}:`, err));
        }
        // Send push notification if contact has app
        await (0, notification_service_1.sendNotificationToUser)(contact.user_id, notification_service_1.notifications.emergencyAlert(rider?.name || 'Unknown', driver?.vehicle_number || 'Unknown', driver?.users?.name || 'Unknown', location), false);
    }
    console.log(`[SAFETY] Level 3 alerts sent to ${contacts.length} contacts for ride ${rideId}`);
}
async function escalateToLevel4(eventId, rideId, riderId, _driverId) {
    await supabase_1.supabase
        .from('safety_events')
        .update({ escalation_level: 4 })
        .eq('id', eventId);
    await supabase_1.supabase.from('audit_logs').insert({
        user_id: riderId,
        action: 'safety_escalated_level_4',
        metadata: { ride_id: rideId, event_id: eventId },
    });
    // Alert admin team (via notification to all admin users)
    const { data: admins } = await supabase_1.supabase
        .from('users')
        .select('id')
        .eq('role', 'admin');
    if (admins) {
        await (0, notification_service_1.notifyMultipleUsers)(admins.map((a) => a.id), {
            title: '🚨 URGENT: Safety Escalation Level 4',
            body: `Ride ${rideId} requires immediate intervention. Rider is unresponsive.`,
            data: { type: 'admin_safety_alert', ride_id: rideId, event_id: eventId },
        });
    }
    console.log(`[SAFETY] Level 4 escalation: Travix Safety Team alerted for ride ${rideId}`);
}
// Handle SOS triggered by rider
async function triggerSOS(rideId, riderId, driverId) {
    const { data: existingEvent } = await supabase_1.supabase
        .from('safety_events')
        .select('id')
        .eq('ride_id', rideId)
        .eq('event_type', 'sos')
        .single();
    if (existingEvent)
        return; // Already triggered
    // Get current driver location
    const { data: driver } = await supabase_1.supabase
        .from('driver_profiles')
        .select('current_lat, current_lng')
        .eq('user_id', driverId)
        .single();
    const { data: event } = await supabase_1.supabase
        .from('safety_events')
        .insert({
        ride_id: rideId,
        rider_id: riderId,
        driver_id: driverId,
        event_type: 'sos',
        lat: driver?.current_lat || 0,
        lng: driver?.current_lng || 0,
        escalation_level: 4,
    })
        .select('id')
        .single();
    if (event) {
        await escalateToLevel3(event.id, rideId, riderId, driverId);
        await escalateToLevel4(event.id, rideId, riderId, driverId);
    }
}
// Clear location history when ride ends
function clearRideTracking(rideId) {
    locationHistory.delete(rideId);
    deviationTracking.delete(rideId);
}
//# sourceMappingURL=safety-engine.service.js.map
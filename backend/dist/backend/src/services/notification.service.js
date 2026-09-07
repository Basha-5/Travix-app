"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifications = void 0;
exports.sendPushToToken = sendPushToToken;
exports.sendNotificationToUser = sendNotificationToUser;
exports.notifyMultipleUsers = notifyMultipleUsers;
const axios_1 = __importDefault(require("axios"));
const supabase_1 = require("../utils/supabase");
const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY || '';
// Send FCM push notification to a device token
async function sendPushToToken(fcmToken, notification) {
    if (!FCM_SERVER_KEY || FCM_SERVER_KEY === 'YOUR_FCM_SERVER_KEY') {
        console.log(`[DEV] Push notification to ${fcmToken.substring(0, 10)}...:`, notification.title);
        return;
    }
    await axios_1.default.post('https://fcm.googleapis.com/fcm/send', {
        to: fcmToken,
        notification: {
            title: notification.title,
            body: notification.body,
            sound: 'default',
        },
        data: notification.data || {},
        priority: 'high',
    }, {
        headers: {
            Authorization: `key=${FCM_SERVER_KEY}`,
            'Content-Type': 'application/json',
        },
    });
}
// Send notification to a user (looks up their FCM token)
async function sendNotificationToUser(userId, notification, saveToDb = true) {
    // Save notification to DB
    if (saveToDb) {
        await supabase_1.supabase.from('notifications').insert({
            user_id: userId,
            title: notification.title,
            body: notification.body,
            type: notification.data?.type || 'general',
            data: notification.data || {},
            is_read: false,
        });
    }
    // Look up FCM token (stored in user preferences/device table)
    const { data: device } = await supabase_1.supabase
        .from('user_devices')
        .select('fcm_token')
        .eq('user_id', userId)
        .single();
    if (device?.fcm_token) {
        await sendPushToToken(device.fcm_token, notification);
    }
    else {
        console.log(`[NOTIFY] No FCM token for user ${userId}:`, notification.title);
    }
}
// Notify multiple users at once
async function notifyMultipleUsers(userIds, notification) {
    await Promise.allSettled(userIds.map((uid) => sendNotificationToUser(uid, notification)));
}
// Predefined notification templates
exports.notifications = {
    driverAssigned: (driverName, vehicleModel, vehicleNumber, eta, pin) => ({
        title: '🚗 Driver assigned!',
        body: `${driverName} is on the way in ${vehicleModel} (${vehicleNumber}). ETA: ${eta} min. Your PIN: ${pin}`,
        data: { type: 'driver_assigned', eta: String(eta), pin },
    }),
    driverArrived: (driverName) => ({
        title: '📍 Your driver is here!',
        body: `${driverName} has arrived at your pickup location.`,
        data: { type: 'driver_arrived' },
    }),
    rideStarted: (riderName, destination, trackingUrl) => ({
        title: `🚗 ${riderName}'s ride has started`,
        body: `Heading to ${destination}. Track live:`,
        data: { type: 'ride_started', tracking_url: trackingUrl, destination },
    }),
    safetyCheck: (eventType) => ({
        title: '🛡️ Safety Check',
        body: eventType === 'long_stop'
            ? 'Your vehicle has been stopped for 10+ minutes. Are you safe?'
            : 'Unexpected route change detected. Are you safe?',
        data: { type: 'safety_check', event_type: eventType },
    }),
    emergencyAlert: (riderName, vehicleNumber, driverName, location) => ({
        title: `⚠️ Safety Alert: ${riderName}`,
        body: `${riderName} may need help. Vehicle: ${vehicleNumber}, Driver: ${driverName}. Location: ${location}`,
        data: { type: 'emergency_alert', rider_name: riderName, vehicle_number: vehicleNumber },
    }),
    rideCompleted: (destination, fare) => ({
        title: '✅ Ride completed',
        body: `You've arrived at ${destination}. Fare: ₹${fare}. How was your ride?`,
        data: { type: 'ride_completed', fare: String(fare) },
    }),
    newRideRequest: (pickupArea, estimatedEarnings) => ({
        title: '🚗 New ride request!',
        body: `Pickup near ${pickupArea}. Estimated earnings: ₹${estimatedEarnings}`,
        data: { type: 'new_ride_request', estimated_earnings: String(estimatedEarnings) },
    }),
};
//# sourceMappingURL=notification.service.js.map
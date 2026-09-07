"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.haversineDistance = haversineDistance;
exports.allWithinRadius = allWithinRadius;
exports.pointToPolylineDistanceMeters = pointToPolylineDistanceMeters;
exports.generateRidePin = generateRidePin;
exports.generateShareToken = generateShareToken;
exports.formatDuration = formatDuration;
exports.decodePolyline = decodePolyline;
exports.encodePolyline = encodePolyline;
// Haversine formula to calculate distance between two coordinates in km
function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function toRad(deg) {
    return (deg * Math.PI) / 180;
}
// Check if all locations are within a given radius (meters) of a center point
function allWithinRadius(locations, radiusMeters) {
    if (locations.length < 2)
        return false;
    const center = locations[0];
    return locations.every((loc) => {
        const distKm = haversineDistance(center.lat, center.lng, loc.lat, loc.lng);
        return distKm * 1000 <= radiusMeters;
    });
}
// Distance from a point to a polyline (encoded as array of {lat,lng})
function pointToPolylineDistanceMeters(point, polyline) {
    if (polyline.length === 0)
        return Infinity;
    if (polyline.length === 1) {
        return haversineDistance(point.lat, point.lng, polyline[0].lat, polyline[0].lng) * 1000;
    }
    let minDistance = Infinity;
    for (let i = 0; i < polyline.length - 1; i++) {
        const d = pointToSegmentDistance(point, polyline[i], polyline[i + 1]);
        if (d < minDistance)
            minDistance = d;
    }
    return minDistance * 1000; // convert to meters
}
function pointToSegmentDistance(p, a, b) {
    const ab = { lat: b.lat - a.lat, lng: b.lng - a.lng };
    const ap = { lat: p.lat - a.lat, lng: p.lng - a.lng };
    const abLen = Math.sqrt(ab.lat ** 2 + ab.lng ** 2);
    if (abLen === 0)
        return haversineDistance(p.lat, p.lng, a.lat, a.lng);
    const t = Math.max(0, Math.min(1, (ap.lat * ab.lat + ap.lng * ab.lng) / (abLen * abLen)));
    const closest = { lat: a.lat + t * ab.lat, lng: a.lng + t * ab.lng };
    return haversineDistance(p.lat, p.lng, closest.lat, closest.lng);
}
// Generate a 4-digit PIN
function generateRidePin() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}
// Generate a secure share token
function generateShareToken() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
// Format duration in minutes to human-readable string
function formatDuration(minutes) {
    if (minutes < 60)
        return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
// Decode a simplified polyline string (lat,lng|lat,lng|...)
function decodePolyline(encoded) {
    return encoded.split('|').map((pair) => {
        const [lat, lng] = pair.split(',').map(Number);
        return { lat, lng };
    });
}
// Encode polyline
function encodePolyline(points) {
    return points.map((p) => `${p.lat},${p.lng}`).join('|');
}
//# sourceMappingURL=geo.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRoute = getRoute;
exports.getPlaceDetails = getPlaceDetails;
exports.autocompletePlaces = autocompletePlaces;
exports.calculateRouteOverlap = calculateRouteOverlap;
const axios_1 = __importDefault(require("axios"));
const MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
// Calculate route between two points
async function getRoute(originLat, originLng, destLat, destLng) {
    if (!MAPS_API_KEY || MAPS_API_KEY === 'YOUR_GOOGLE_MAPS_API_KEY') {
        // Return mock data in dev mode
        const distanceKm = Math.sqrt(Math.pow(destLat - originLat, 2) + Math.pow(destLng - originLng, 2)) * 111; // rough conversion
        const durationMinutes = (distanceKm / 30) * 60; // assume 30 km/h avg
        return {
            distanceKm: Math.max(distanceKm, 1),
            durationMinutes: Math.max(durationMinutes, 3),
            polylinePoints: [
                { lat: originLat, lng: originLng },
                { lat: destLat, lng: destLng },
            ],
            encodedPolyline: `${originLat},${originLng}|${destLat},${destLng}`,
        };
    }
    const response = await axios_1.default.get('https://maps.googleapis.com/maps/api/directions/json', {
        params: {
            origin: `${originLat},${originLng}`,
            destination: `${destLat},${destLng}`,
            mode: 'driving',
            key: MAPS_API_KEY,
        },
    });
    if (response.data.status !== 'OK') {
        throw new Error(`Google Maps API error: ${response.data.status}`);
    }
    const route = response.data.routes[0].legs[0];
    const distanceKm = route.distance.value / 1000;
    const durationMinutes = route.duration.value / 60;
    // Decode polyline points (simplified)
    const points = response.data.routes[0].overview_polyline.points;
    return {
        distanceKm,
        durationMinutes,
        polylinePoints: decodeGooglePolyline(points),
        encodedPolyline: points,
    };
}
// Get place details from placeId
async function getPlaceDetails(placeId) {
    if (!MAPS_API_KEY || MAPS_API_KEY === 'YOUR_GOOGLE_MAPS_API_KEY') {
        return { lat: 12.9716, lng: 77.5946, address: 'Mock Address, Bangalore' };
    }
    const response = await axios_1.default.get('https://maps.googleapis.com/maps/api/place/details/json', {
        params: {
            place_id: placeId,
            fields: 'geometry,formatted_address',
            key: MAPS_API_KEY,
        },
    });
    const result = response.data.result;
    return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        address: result.formatted_address,
    };
}
// Autocomplete place suggestions
async function autocompletePlaces(input, lat, lng) {
    if (!MAPS_API_KEY || MAPS_API_KEY === 'YOUR_GOOGLE_MAPS_API_KEY') {
        return [
            { placeId: 'mock-1', description: 'MG Road, Bangalore', mainText: 'MG Road', secondaryText: 'Bangalore, Karnataka' },
            { placeId: 'mock-2', description: 'Koramangala, Bangalore', mainText: 'Koramangala', secondaryText: 'Bangalore, Karnataka' },
            { placeId: 'mock-3', description: 'Indiranagar, Bangalore', mainText: 'Indiranagar', secondaryText: 'Bangalore, Karnataka' },
        ].filter((p) => p.description.toLowerCase().includes(input.toLowerCase()));
    }
    const params = {
        input,
        components: 'country:in',
        key: MAPS_API_KEY,
    };
    if (lat && lng) {
        params.location = `${lat},${lng}`;
        params.radius = '50000';
    }
    const response = await axios_1.default.get('https://maps.googleapis.com/maps/api/place/autocomplete/json', { params });
    return response.data.predictions.map((p) => ({
        placeId: p.place_id,
        description: p.description,
        mainText: p.structured_formatting.main_text,
        secondaryText: p.structured_formatting.secondary_text,
    }));
}
// Calculate route overlap percentage between two routes
function calculateRouteOverlap(route1, route2) {
    if (route1.length === 0 || route2.length === 0)
        return 0;
    const OVERLAP_THRESHOLD_KM = 0.3; // 300m threshold for "same path"
    let overlapCount = 0;
    for (const point of route1) {
        const minDist = Math.min(...route2.map((p) => {
            const dLat = point.lat - p.lat;
            const dLng = point.lng - p.lng;
            return Math.sqrt(dLat * dLat + dLng * dLng) * 111;
        }));
        if (minDist <= OVERLAP_THRESHOLD_KM)
            overlapCount++;
    }
    return Math.round((overlapCount / route1.length) * 100);
}
// Decode Google Maps encoded polyline
function decodeGooglePolyline(encoded) {
    const points = [];
    let index = 0;
    let lat = 0;
    let lng = 0;
    while (index < encoded.length) {
        let b;
        let shift = 0;
        let result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
        lat += dlat;
        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
        lng += dlng;
        points.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }
    return points;
}
//# sourceMappingURL=maps.service.js.map
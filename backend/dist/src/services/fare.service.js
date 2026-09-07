"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateFare = calculateFare;
exports.getFareConfig = getFareConfig;
exports.getAllFareConfigs = getAllFareConfigs;
exports.calculateSurge = calculateSurge;
const FARE_CONFIG = {
    auto: {
        base: Number(process.env.AUTO_BASE_FARE) || 30,
        perKm: Number(process.env.AUTO_PER_KM) || 8,
        perMin: Number(process.env.AUTO_PER_MIN) || 1.5,
        capacity: 3,
        label: 'Travix Auto',
        icon: '🛺',
        description: 'Affordable • No AC',
    },
    bike: {
        base: Number(process.env.BIKE_BASE_FARE) || 20,
        perKm: Number(process.env.BIKE_PER_KM) || 6,
        perMin: Number(process.env.BIKE_PER_MIN) || 1,
        capacity: 1,
        label: 'Travix Bike',
        icon: '🏍️',
        description: 'Fastest • Beat traffic',
    },
    go: {
        base: Number(process.env.GO_BASE_FARE) || 50,
        perKm: Number(process.env.GO_PER_KM) || 12,
        perMin: Number(process.env.GO_PER_MIN) || 2,
        capacity: 4,
        label: 'Travix Go',
        icon: '🚗',
        description: 'Comfortable • AC',
    },
    comfort: {
        base: Number(process.env.COMFORT_BASE_FARE) || 80,
        perKm: Number(process.env.COMFORT_PER_KM) || 18,
        perMin: Number(process.env.COMFORT_PER_MIN) || 3,
        capacity: 4,
        label: 'Travix Comfort',
        icon: '🚙',
        description: 'Premium • Sedan/SUV',
    },
    group: {
        base: Number(process.env.GO_BASE_FARE) || 50,
        perKm: Number(process.env.GO_PER_KM) || 12,
        perMin: Number(process.env.GO_PER_MIN) || 2,
        capacity: 6,
        label: 'Travix Group',
        icon: '👥',
        description: 'Share & Save • Route-matched',
    },
};
function calculateFare(params) {
    const { rideType, distanceKm, durationMinutes, surgeMultiplier = 1.0, isGroupRide = false, groupSize = 1, } = params;
    const config = FARE_CONFIG[rideType];
    const baseFare = config.base;
    const distanceFare = distanceKm * config.perKm;
    const timeFare = durationMinutes * config.perMin;
    const subtotal = Math.round((baseFare + distanceFare + timeFare) * surgeMultiplier);
    const normalFare = subtotal;
    const groupFare = isGroupRide && groupSize > 1 ? Math.round(subtotal / groupSize) : subtotal;
    const savings = normalFare - groupFare;
    return {
        rideType,
        distanceKm,
        durationMinutes,
        baseFare,
        distanceFare: Math.round(distanceFare),
        timeFare: Math.round(timeFare),
        subtotal,
        surgeMultiplier,
        isGroupRide,
        groupSize,
        normalFare,
        groupFare,
        savings,
    };
}
function getFareConfig(rideType) {
    return FARE_CONFIG[rideType];
}
function getAllFareConfigs() {
    return FARE_CONFIG;
}
// Calculate surge multiplier based on demand (mock implementation)
function calculateSurge(_pickupLat, _pickupLng, _hour) {
    // In production: query demand data from DB, compute surge
    // For dev: slight surge between 8-10am and 5-8pm
    const hour = new Date().getHours();
    if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20)) {
        return 1.2;
    }
    return 1.0;
}
//# sourceMappingURL=fare.service.js.map
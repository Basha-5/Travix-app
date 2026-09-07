package com.travix.app.data.models

import com.google.gson.annotations.SerializedName

data class User(
    val id: String,
    val name: String,
    val email: String?,
    val phone: String,
    val gender: String,
    val role: String,
    @SerializedName("women_safety_mode") val womenSafetyMode: Boolean = false,
    @SerializedName("is_active") val isActive: Boolean = true
)

data class AuthResponse(
    val success: Boolean,
    val message: String?,
    val data: AuthData?
)

data class AuthData(
    val token: String,
    val user: User,
    @SerializedName("is_new_user") val isNewUser: Boolean? = false
)

data class RequestOtpResponse(
    val success: Boolean,
    val message: String,
    @SerializedName("dev_otp") val devOtp: String?
)

data class RideEstimate(
    val type: String,
    val label: String,
    val icon: String,
    @SerializedName("eta_minutes") val etaMinutes: Int,
    @SerializedName("estimated_fare") val estimatedFare: Double,
    @SerializedName("normal_fare") val normalFare: Double?,
    val savings: Double?,
    @SerializedName("distance_km") val distanceKm: Double,
    @SerializedName("duration_minutes") val durationMinutes: Double,
    val capacity: Int,
    val description: String,
    val available: Boolean,
    val badge: String?,
    @SerializedName("surge_multiplier") val surgeMultiplier: Double = 1.0
)

data class EstimateResponse(
    val success: Boolean,
    val data: List<RideEstimate>
)

data class Ride(
    val id: String,
    @SerializedName("rider_id") val riderId: String,
    @SerializedName("driver_id") val driverId: String?,
    @SerializedName("pickup_address") val pickupAddress: String,
    @SerializedName("pickup_lat") val pickupLat: Double,
    @SerializedName("pickup_lng") val pickupLng: Double,
    @SerializedName("destination_address") val destinationAddress: String,
    @SerializedName("destination_lat") val destinationLat: Double,
    @SerializedName("destination_lng") val destinationLng: Double,
    @SerializedName("ride_type") val rideType: String,
    val status: String,
    @SerializedName("estimated_fare") val estimatedFare: Double,
    @SerializedName("final_fare") val finalFare: Double?,
    @SerializedName("ride_pin") val ridePin: String?,
    @SerializedName("is_pin_verified") val isPinVerified: Boolean = false,
    @SerializedName("distance_km") val distanceKm: Double,
    @SerializedName("duration_minutes") val durationMinutes: Double?,
    @SerializedName("is_group_ride") val isGroupRide: Boolean = false,
    val driver_profiles: DriverProfile?
)

data class DriverProfile(
    val id: String,
    @SerializedName("license_number") val licenseNumber: String,
    @SerializedName("vehicle_type") val vehicleType: String,
    @SerializedName("vehicle_model") val vehicleModel: String,
    @SerializedName("vehicle_number") val vehicleNumber: String,
    @SerializedName("vehicle_color") val vehicleColor: String,
    val rating: Double,
    @SerializedName("total_trips") val totalTrips: Int,
    val users: User?
)

data class GroupPreview(
    @SerializedName("group_ride_id") val groupRideId: String,
    @SerializedName("driver_gender") val driverGender: String,
    @SerializedName("driver_vehicle_model") val driverVehicleModel: String,
    @SerializedName("driver_vehicle_number") val driverVehicleNumber: String,
    @SerializedName("driver_vehicle_color") val driverVehicleColor: String,
    @SerializedName("driver_rating") val driverRating: Double,
    @SerializedName("riders_female_count") val ridersFemaleCount: Int,
    @SerializedName("riders_male_count") val ridersMaleCount: Int,
    @SerializedName("riders_other_count") val ridersOtherCount: Int,
    @SerializedName("vehicle_capacity") val vehicleCapacity: Int,
    @SerializedName("normal_fare") val normalFare: Double,
    @SerializedName("group_fare") val groupFare: Double,
    val savings: Double,
    @SerializedName("estimated_extra_minutes") val estimatedExtraMinutes: Int,
    @SerializedName("pickups_before_yours") val pickupsBeforeYours: Int,
    @SerializedName("route_overlap_percentage") val routeOverlapPercentage: Double
)

data class GroupSearchResponse(
    val success: Boolean,
    val data: List<GroupPreview>
)

data class SafetyCheckinResponse(
    val success: Boolean,
    val message: String
)

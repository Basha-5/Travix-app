package com.travix.app.data.api

import com.travix.app.data.models.*
import retrofit2.Response
import retrofit2.http.*

interface TravixApiService {

    @POST("api/auth/request-otp")
    suspend fun requestOtp(@Body body: Map<String, String>): Response<RequestOtpResponse>

    @POST("api/auth/verify-otp")
    suspend fun verifyOtp(@Body body: Map<String, String>): Response<AuthResponse>

    @POST("api/rides/estimate")
    suspend fun estimateRide(@Body body: Map<String, Any>): Response<EstimateResponse>

    @POST("api/rides/book")
    suspend fun bookRide(
        @Header("Authorization") token: String,
        @Body body: Map<String, Any>
    ): Response<Map<String, Any>>

    @GET("api/rides/{id}")
    suspend fun getRide(
        @Header("Authorization") token: String,
        @Path("id") rideId: String
    ): Response<Map<String, Any>>

    @POST("api/group-rides/search")
    suspend fun searchGroupRides(
        @Header("Authorization") token: String,
        @Body body: Map<String, Any>
    ): Response<GroupSearchResponse>

    @POST("api/safety/ride/{rideId}/checkin")
    suspend fun safetyCheckin(
        @Header("Authorization") token: String,
        @Path("rideId") rideId: String,
        @Body body: Map<String, String>
    ): Response<SafetyCheckinResponse>

    @POST("api/safety/ride/{rideId}/sos")
    suspend fun triggerSOS(
        @Header("Authorization") token: String,
        @Path("rideId") rideId: String
    ): Response<Map<String, Any>>
}

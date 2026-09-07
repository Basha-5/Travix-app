"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const supabase_1 = require("../utils/supabase");
const router = (0, express_1.Router)();
// POST /api/payments/create-order
router.post('/create-order', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const { ride_id, amount, method } = req.body;
        const mockOrderId = `pay_order_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
        res.json({
            success: true,
            data: {
                order_id: mockOrderId,
                amount: Number(amount) || 85,
                currency: 'INR',
                ride_id,
                method: method || 'upi',
                created_at: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/payments/confirm
router.post('/confirm', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const { ride_id, order_id, payment_id, method, amount } = req.body;
        const txnId = payment_id || `TXN_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
        const finalAmount = Number(amount) || 85;
        await supabase_1.supabase
            .from('rides')
            .update({ payment_status: 'success', status: 'completed', completed_at: new Date().toISOString(), final_fare: finalAmount })
            .eq('id', ride_id);
        await supabase_1.supabase.from('payments').insert({
            ride_id,
            amount: finalAmount,
            method: method || 'upi',
            status: 'success',
            transaction_id: txnId,
        }).catch(() => { });
        res.json({
            success: true,
            message: 'Payment confirmed successfully',
            data: {
                transaction_id: txnId,
                ride_id,
                amount: finalAmount,
                status: 'success',
                paid_at: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/payments/receipt/:rideId
router.get('/receipt/:rideId', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const { rideId } = req.params;
        const { data: ride } = await supabase_1.supabase
            .from('rides')
            .select(`
        *,
        driver_profiles (
          vehicle_model, vehicle_number, vehicle_color, rating,
          users ( name, phone )
        )
      `)
            .eq('id', rideId)
            .single();
        const fare = ride?.final_fare || ride?.estimated_fare || 85;
        const baseFare = Math.round(fare * 0.35);
        const distanceFare = Math.round(fare * 0.45);
        const taxes = Math.round(fare * 0.12);
        const platformFee = Math.round(fare * 0.08);
        const receipt = {
            receipt_id: `RCP-${rideId.slice(-6).toUpperCase()}`,
            ride_id: rideId,
            date: ride?.completed_at || ride?.created_at || new Date().toISOString(),
            pickup_address: ride?.pickup_address || 'HSR Layout, Bangalore',
            destination_address: ride?.destination_address || 'Koramangala, Bangalore',
            distance_km: ride?.distance_km || 4.2,
            ride_type: ride?.ride_type || 'auto',
            payment_method: ride?.payment_method || 'upi',
            payment_status: ride?.payment_status || 'success',
            driver_name: ride?.driver_profiles?.users?.name || 'Ramesh Kumar',
            vehicle_number: ride?.driver_profiles?.vehicle_number || 'KA-01-AB-1234',
            vehicle_model: ride?.driver_profiles?.vehicle_model || 'Bajaj RE Auto',
            breakdown: {
                base_fare: baseFare,
                distance_fare: distanceFare,
                taxes_and_gst: taxes,
                platform_fee: platformFee,
                total_fare: fare,
            },
        };
        res.json({ success: true, data: receipt });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=payments.routes.js.map
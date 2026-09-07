"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const supabase_1 = require("../utils/supabase");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate, (0, role_middleware_1.requireRole)('admin'));
// GET /api/admin/dashboard
router.get('/dashboard', async (_req, res, next) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [{ count: totalUsers }, { count: activeDrivers }, { count: ridesToday }, { data: revenueData }, { count: activeSafetyAlerts },] = await Promise.all([
            supabase_1.supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'rider'),
            supabase_1.supabase.from('driver_profiles').select('*', { count: 'exact', head: true }).eq('is_online', true),
            supabase_1.supabase.from('rides').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
            supabase_1.supabase.from('rides').select('final_fare, estimated_fare').eq('status', 'completed').gte('completed_at', today.toISOString()),
            supabase_1.supabase.from('safety_events').select('*', { count: 'exact', head: true }).is('resolved_at', null),
        ]);
        const revenueToday = (revenueData || []).reduce((sum, r) => sum + (r.final_fare || r.estimated_fare || 0), 0);
        res.json({
            success: true,
            data: {
                total_users: totalUsers || 0,
                active_drivers: activeDrivers || 0,
                rides_today: ridesToday || 0,
                revenue_today: revenueToday,
                active_safety_alerts: activeSafetyAlerts || 0,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/admin/users
router.get('/users', async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const search = req.query.search;
        let query = supabase_1.supabase.from('users').select('*', { count: 'exact' }).order('created_at', { ascending: false });
        if (search) {
            query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
        }
        const { data, count } = await query.range((page - 1) * limit, page * limit - 1);
        res.json({ success: true, data: data || [], total: count || 0, page, limit });
    }
    catch (error) {
        next(error);
    }
});
// PUT /api/admin/users/:id/suspend
router.put('/users/:id/suspend', async (req, res, next) => {
    try {
        await supabase_1.supabase.from('users').update({ is_active: false }).eq('id', req.params.id);
        res.json({ success: true, message: 'User suspended' });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/admin/drivers
router.get('/drivers', async (req, res, next) => {
    try {
        const status = req.query.status; // 'pending', 'verified', 'all'
        let query = supabase_1.supabase
            .from('driver_profiles')
            .select(`*, users!inner(name, email, phone, gender, is_active)`)
            .order('updated_at', { ascending: false });
        if (status === 'pending')
            query = query.eq('is_verified', false);
        else if (status === 'verified')
            query = query.eq('is_verified', true);
        const { data } = await query;
        res.json({ success: true, data: data || [] });
    }
    catch (error) {
        next(error);
    }
});
// PUT /api/admin/drivers/:id/verify
router.put('/drivers/:id/verify', async (req, res, next) => {
    try {
        const { data: driver } = await supabase_1.supabase
            .from('driver_profiles')
            .update({ is_verified: true })
            .eq('id', req.params.id)
            .select('user_id')
            .single();
        if (driver) {
            // Import inside to avoid circular
            const { sendNotificationToUser } = await Promise.resolve().then(() => __importStar(require('../services/notification.service')));
            await sendNotificationToUser(driver.user_id, {
                title: '✅ Account Verified!',
                body: 'Your driver account has been verified. You can now go online and accept rides.',
                data: { type: 'driver_verified' },
            });
        }
        res.json({ success: true, message: 'Driver verified' });
    }
    catch (error) {
        next(error);
    }
});
// PUT /api/admin/drivers/:id/suspend
router.put('/drivers/:id/suspend', async (req, res, next) => {
    try {
        await supabase_1.supabase.from('driver_profiles').update({ is_verified: false, is_online: false }).eq('id', req.params.id);
        res.json({ success: true, message: 'Driver suspended' });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/admin/safety-alerts
router.get('/safety-alerts', async (_req, res, next) => {
    try {
        const { data } = await supabase_1.supabase
            .from('safety_events')
            .select(`
        *,
        rides (pickup_address, destination_address, driver_id),
        users!safety_events_rider_id_fkey (name, phone)
      `)
            .is('resolved_at', null)
            .order('triggered_at', { ascending: false });
        res.json({ success: true, data: data || [] });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/admin/rides
router.get('/rides', async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const status = req.query.status;
        let query = supabase_1.supabase
            .from('rides')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false });
        if (status)
            query = query.eq('status', status);
        const { data, count } = await query.range((page - 1) * limit, page * limit - 1);
        res.json({ success: true, data: data || [], total: count || 0, page, limit });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/admin/analytics
router.get('/analytics', async (_req, res, next) => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const { data: rides } = await supabase_1.supabase
            .from('rides')
            .select('status, ride_type, is_group_ride, estimated_fare, final_fare, created_at, completed_at')
            .gte('created_at', thirtyDaysAgo.toISOString());
        const { data: safetyEvents } = await supabase_1.supabase
            .from('safety_events')
            .select('event_type, escalation_level, triggered_at, resolved_at')
            .gte('triggered_at', thirtyDaysAgo.toISOString());
        res.json({
            success: true,
            data: {
                rides: rides || [],
                safety_events: safetyEvents || [],
                summary: {
                    total_rides: (rides || []).length,
                    completed_rides: (rides || []).filter((r) => r.status === 'completed').length,
                    group_rides: (rides || []).filter((r) => r.is_group_ride).length,
                    total_revenue: (rides || []).reduce((sum, r) => sum + (r.final_fare || 0), 0),
                    safety_incidents: (safetyEvents || []).length,
                    sos_events: (safetyEvents || []).filter((e) => e.event_type === 'sos').length,
                },
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=admin.routes.js.map
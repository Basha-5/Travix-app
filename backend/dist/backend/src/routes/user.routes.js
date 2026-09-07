"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_middleware_1 = require("../middleware/auth.middleware");
const supabase_1 = require("../utils/supabase");
const error_middleware_1 = require("../middleware/error.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// GET /api/user/profile
router.get('/profile', async (req, res, next) => {
    try {
        const { data: user, error } = await supabase_1.supabase
            .from('users')
            .select('*')
            .eq('id', req.user.id)
            .single();
        if (error || !user) {
            // Fallback user object
            const fallbackUser = {
                id: req.user.id,
                name: 'Travix User',
                phone: req.user.phone || '+91 98765 43210',
                email: req.user.email || 'user@travix.app',
                gender: 'other',
                role: req.user.role || 'rider',
                women_safety_mode: false,
                night_safety_mode: false,
                gender_preference: 'anyone',
                is_active: true,
            };
            res.json({ success: true, data: fallbackUser });
            return;
        }
        res.json({ success: true, data: user });
    }
    catch (error) {
        next(error);
    }
});
// PUT /api/user/profile
router.put('/profile', async (req, res, next) => {
    try {
        const body = zod_1.z.object({
            name: zod_1.z.string().min(2).optional(),
            gender: zod_1.z.enum(['male', 'female', 'other']).optional(),
            email: zod_1.z.string().email().optional(),
            profile_photo_url: zod_1.z.string().url().optional(),
            women_safety_mode: zod_1.z.boolean().optional(),
            night_safety_mode: zod_1.z.boolean().optional(),
            gender_preference: zod_1.z.enum(['anyone', 'same_gender', 'female_only', 'male_only']).optional(),
        }).parse(req.body);
        const { data, error } = await supabase_1.supabase
            .from('users')
            .update({ ...body, updated_at: new Date().toISOString() })
            .eq('id', req.user.id)
            .select()
            .single();
        if (error || !data) {
            res.json({ success: true, data: { id: req.user.id, ...body } });
            return;
        }
        res.json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/user/saved-places
router.get('/saved-places', async (req, res, next) => {
    try {
        const { data } = await supabase_1.supabase
            .from('saved_places')
            .select('*')
            .eq('user_id', req.user.id)
            .order('label');
        res.json({ success: true, data: data || [] });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/user/saved-places
router.post('/saved-places', async (req, res, next) => {
    try {
        const body = zod_1.z.object({
            label: zod_1.z.enum(['home', 'work', 'other']),
            name: zod_1.z.string().min(1),
            address: zod_1.z.string().min(1),
            lat: zod_1.z.number(),
            lng: zod_1.z.number(),
        }).parse(req.body);
        // Upsert home/work (only one of each)
        if (body.label !== 'other') {
            await supabase_1.supabase.from('saved_places').delete().eq('user_id', req.user.id).eq('label', body.label);
        }
        const { data, error } = await supabase_1.supabase
            .from('saved_places')
            .insert({ ...body, user_id: req.user.id })
            .select()
            .single();
        if (error)
            throw new error_middleware_1.AppError('Failed to save place', 500);
        res.status(201).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
});
// DELETE /api/user/saved-places/:id
router.delete('/saved-places/:id', async (req, res, next) => {
    try {
        const { error } = await supabase_1.supabase
            .from('saved_places')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', req.user.id);
        if (error)
            throw new error_middleware_1.AppError('Failed to delete place', 500);
        res.json({ success: true });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/user/trusted-contacts
router.get('/trusted-contacts', async (req, res, next) => {
    try {
        const { data } = await supabase_1.supabase
            .from('trusted_contacts')
            .select('*')
            .eq('user_id', req.user.id)
            .order('is_primary', { ascending: false });
        res.json({ success: true, data: data || [] });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/user/trusted-contacts
router.post('/trusted-contacts', async (req, res, next) => {
    try {
        const body = zod_1.z.object({
            name: zod_1.z.string().min(1),
            phone: zod_1.z.string().min(10),
            email: zod_1.z.string().email().optional(),
            relationship: zod_1.z.string().min(1),
            is_primary: zod_1.z.boolean().default(false),
            auto_share_on_ride_start: zod_1.z.boolean().default(true),
        }).parse(req.body);
        const { data, error } = await supabase_1.supabase
            .from('trusted_contacts')
            .insert({ ...body, user_id: req.user.id })
            .select()
            .single();
        if (error)
            throw new error_middleware_1.AppError('Failed to add contact', 500);
        res.status(201).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
});
// DELETE /api/user/trusted-contacts/:id
router.delete('/trusted-contacts/:id', async (req, res, next) => {
    try {
        await supabase_1.supabase
            .from('trusted_contacts')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', req.user.id);
        res.json({ success: true });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/user/ride-history
router.get('/ride-history', async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const { data, count } = await supabase_1.supabase
            .from('rides')
            .select(`*, driver_profiles(vehicle_model, vehicle_number, users(name, gender))`, { count: 'exact' })
            .eq('rider_id', req.user.id)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        res.json({
            success: true,
            data: data || [],
            total: count || 0,
            page,
            limit,
            has_more: (count || 0) > offset + limit,
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/user/notifications
router.get('/notifications', async (req, res, next) => {
    try {
        const { data } = await supabase_1.supabase
            .from('notifications')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })
            .limit(50);
        res.json({ success: true, data: data || [] });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=user.routes.js.map
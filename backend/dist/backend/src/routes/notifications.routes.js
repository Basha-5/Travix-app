"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const supabase_1 = require("../utils/supabase");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// PUT /api/notifications/:id/read
router.put('/:id/read', async (req, res, next) => {
    try {
        await supabase_1.supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', req.params.id)
            .eq('user_id', req.user.id);
        res.json({ success: true });
    }
    catch (error) {
        next(error);
    }
});
// PUT /api/notifications/read-all
router.put('/read-all', async (req, res, next) => {
    try {
        await supabase_1.supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', req.user.id)
            .eq('is_read', false);
        res.json({ success: true });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/notifications/register-device (FCM token registration)
router.post('/register-device', async (req, res, next) => {
    try {
        const { fcm_token, platform } = req.body;
        await supabase_1.supabase.from('user_devices').upsert({
            user_id: req.user.id,
            fcm_token,
            platform: platform || 'web',
            updated_at: new Date().toISOString(),
        });
        res.json({ success: true });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=notifications.routes.js.map
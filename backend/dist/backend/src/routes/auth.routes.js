"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const supabase_1 = require("../utils/supabase");
const error_middleware_1 = require("../middleware/error.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const email_service_1 = require("../services/email.service");
const router = (0, express_1.Router)();
// In-memory OTP stores
const phoneOtpStore = new Map();
const emailOtpStore = new Map();
// ─── EMAIL-ONLY AUTHENTICATION ─────────────────────────────────────────────
// POST /api/auth/request-email-otp (Send 4-digit token to user email)
router.post('/request-email-otp', async (req, res, next) => {
    try {
        const { email } = zod_1.z.object({ email: zod_1.z.string().email() }).parse(req.body);
        // Generate real random 4-digit token code (1000-9999)
        const otp = String(Math.floor(1000 + Math.random() * 9000));
        const expiresAt = new Date(Date.now() + Number(process.env.OTP_EXPIRY_MINUTES || 5) * 60 * 1000);
        const hashedOtp = await bcryptjs_1.default.hash(otp, 10);
        emailOtpStore.set(email.toLowerCase(), { otp: hashedOtp, expiresAt });
        console.log(`[AUTH-EMAIL] Dispatched email token to ${email}`);
        // Send token to user's real email
        const template = email_service_1.emailTemplates.otpCode(otp);
        const sent = await (0, email_service_1.sendEmail)({ to: email, ...template });
        console.log(`[AUTH-EMAIL] Token generated for ${email} (delivered: ${sent})`);
        res.json({
            success: true,
            email_sent: sent,
            message: sent
                ? `Authentication token sent to ${email}. Please check your email inbox.`
                : `Email delivery is currently blocked by your network/ISP. Use the verification token shown below.`,
            ...((!sent || process.env.OTP_DEV_MODE === 'true') && { dev_otp: otp }),
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/auth/verify-email-otp (Verify email token & sign in / sign up)
router.post('/verify-email-otp', async (req, res, next) => {
    try {
        const { email, otp } = zod_1.z.object({
            email: zod_1.z.string().email(),
            otp: zod_1.z.string().length(4),
        }).parse(req.body);
        const cleanEmail = email.toLowerCase();
        const stored = emailOtpStore.get(cleanEmail);
        if (!stored)
            throw new error_middleware_1.AppError('Token not found or expired. Please request a new code.', 400);
        if (new Date() > stored.expiresAt) {
            emailOtpStore.delete(cleanEmail);
            throw new error_middleware_1.AppError('Token expired. Please request a new code.', 400);
        }
        const isValid = await bcryptjs_1.default.compare(otp, stored.otp);
        if (!isValid)
            throw new error_middleware_1.AppError('Invalid authentication token', 400);
        emailOtpStore.delete(cleanEmail);
        // Look up user by email
        let { data: user } = await supabase_1.supabase.from('users').select('*').eq('email', cleanEmail).single();
        const isNewUser = !user;
        if (isNewUser) {
            // Create initial user shell (profile setup completed in next step)
            const placeholderPhone = `+91${Date.now().toString().slice(-10)}`;
            const { data: newUser, error } = await supabase_1.supabase
                .from('users')
                .insert({
                email: cleanEmail,
                name: 'New Traveler',
                phone: placeholderPhone,
                role: 'rider',
                gender: 'other',
                is_active: true,
            })
                .select('*')
                .single();
            if (error || !newUser) {
                user = {
                    id: `usr_${Date.now()}`,
                    email: cleanEmail,
                    name: '',
                    phone: placeholderPhone,
                    role: 'rider',
                    gender: 'other',
                    is_active: true,
                };
            }
            else {
                user = newUser;
            }
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET || 'secret', { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') });
        res.json({
            success: true,
            data: { token, user, is_new_user: isNewUser },
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/auth/complete-signup (Save profile details after new user sign up)
router.post('/complete-signup', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const { name, gender, phone } = zod_1.z.object({
            name: zod_1.z.string().min(2),
            gender: zod_1.z.enum(['male', 'female', 'other']),
            phone: zod_1.z.string().min(10).optional(),
        }).parse(req.body);
        const updateData = {
            name: name.trim(),
            gender,
            updated_at: new Date().toISOString(),
        };
        if (phone)
            updateData.phone = phone.trim();
        const { data: updatedUser } = await supabase_1.supabase
            .from('users')
            .update(updateData)
            .eq('id', req.user.id)
            .select()
            .single();
        const user = updatedUser || { id: req.user.id, email: req.user.email, ...updateData };
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role || 'rider', email: user.email }, process.env.JWT_SECRET || 'secret', { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') });
        res.json({
            success: true,
            message: 'Profile details saved successfully',
            data: { token, user },
        });
    }
    catch (error) {
        next(error);
    }
});
// ─── LEGACY PHONE OTP & EMAIL ADMIN ───────────────────────────────────────
// POST /api/auth/request-otp (Legacy phone/email OTP)
router.post('/request-otp', async (req, res, next) => {
    try {
        const { phone, email } = zod_1.z.object({
            phone: zod_1.z.string().min(10),
            email: zod_1.z.string().email().optional(),
        }).parse(req.body);
        const otp = process.env.OTP_DEV_MODE === 'true' ? '1234' : String(Math.floor(1000 + Math.random() * 9000));
        const expiresAt = new Date(Date.now() + Number(process.env.OTP_EXPIRY_MINUTES || 5) * 60 * 1000);
        const hashedOtp = await bcryptjs_1.default.hash(otp, 10);
        phoneOtpStore.set(phone, { otp: hashedOtp, expiresAt });
        const targetEmail = email || process.env.SMTP_USER;
        if (targetEmail) {
            const template = email_service_1.emailTemplates.otpCode(otp);
            (0, email_service_1.sendEmail)({ to: targetEmail, ...template }).catch((err) => console.error('[AUTH] Email dispatch error:', err));
        }
        res.json({
            success: true,
            message: 'OTP sent successfully',
            ...(process.env.OTP_DEV_MODE === 'true' && { dev_otp: otp }),
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res, next) => {
    try {
        const { phone, otp } = zod_1.z.object({
            phone: zod_1.z.string().min(10),
            otp: zod_1.z.string().length(4),
        }).parse(req.body);
        const stored = phoneOtpStore.get(phone);
        if (!stored)
            throw new error_middleware_1.AppError('OTP not found or expired. Please request a new one.', 400);
        if (new Date() > stored.expiresAt) {
            phoneOtpStore.delete(phone);
            throw new error_middleware_1.AppError('OTP expired. Please request a new one.', 400);
        }
        const isValid = await bcryptjs_1.default.compare(otp, stored.otp);
        if (!isValid)
            throw new error_middleware_1.AppError('Invalid OTP', 400);
        phoneOtpStore.delete(phone);
        let { data: user } = await supabase_1.supabase.from('users').select('*').eq('phone', phone).single();
        const isNewUser = !user;
        if (isNewUser) {
            const { data: newUser } = await supabase_1.supabase
                .from('users')
                .insert({ phone, role: 'rider', is_active: true, gender: 'other', name: `User${Date.now()}` })
                .select('*')
                .single();
            user = newUser || { id: `usr_${Date.now()}`, phone, role: 'rider', gender: 'other', is_active: true };
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role, phone: user.phone }, process.env.JWT_SECRET || 'secret', { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') });
        res.json({
            success: true,
            data: { token, user, is_new_user: isNewUser },
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/auth/login-email (for admin panel)
router.post('/login-email', async (req, res, next) => {
    try {
        const { email, password } = zod_1.z.object({
            email: zod_1.z.string().email(),
            password: zod_1.z.string().min(6),
        }).parse(req.body);
        const { data: user } = await supabase_1.supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .eq('role', 'admin')
            .single();
        if (!user)
            throw new error_middleware_1.AppError('Invalid credentials', 401);
        const { data: adminAuth } = await supabase_1.supabase
            .from('admin_auth')
            .select('password_hash')
            .eq('user_id', user.id)
            .single();
        if (!adminAuth)
            throw new error_middleware_1.AppError('Invalid credentials', 401);
        const isValid = await bcryptjs_1.default.compare(password, adminAuth.password_hash);
        if (!isValid)
            throw new error_middleware_1.AppError('Invalid credentials', 401);
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET || 'secret', { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') });
        res.json({ success: true, data: { token, user } });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/auth/me
router.get('/me', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const { data: user, error } = await supabase_1.supabase
            .from('users')
            .select('*')
            .eq('id', req.user.id)
            .single();
        if (error || !user)
            throw new error_middleware_1.AppError('User not found', 404);
        res.json({
            success: true,
            data: { user },
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/auth/refresh
router.post('/refresh', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const token = jsonwebtoken_1.default.sign({ id: req.user.id, role: req.user.role, phone: req.user.phone, email: req.user.email }, process.env.JWT_SECRET || 'secret', { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') });
        res.json({
            success: true,
            data: { token },
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/auth/logout
router.post('/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        (0, auth_middleware_1.revokeToken)(token);
    }
    res.json({ success: true, message: 'Logged out successfully' });
});
exports.default = router;
//# sourceMappingURL=auth.routes.js.map
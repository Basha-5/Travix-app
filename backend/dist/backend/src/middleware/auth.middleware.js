"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = exports.revokeToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const supabase_1 = require("../utils/supabase");
// In-memory revoked token set (use Redis in production)
const revokedTokens = new Set();
const revokeToken = (token) => {
    revokedTokens.add(token);
};
exports.revokeToken = revokeToken;
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }
        const token = authHeader.split(' ')[1];
        if (revokedTokens.has(token)) {
            res.status(401).json({ success: false, error: 'Token has been revoked' });
            return;
        }
        let userId;
        let userRole = 'rider';
        let userEmail;
        let userPhone;
        // 1. Try verifying with custom JWT secret
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'secret');
            userId = decoded.id;
            userRole = decoded.role || 'rider';
            userEmail = decoded.email;
            userPhone = decoded.phone;
        }
        catch {
            // 2. Fallback: Try verifying with Supabase Auth token
            const { data: supabaseUser, error: supabaseError } = await supabase_1.supabase.auth.getUser(token);
            if (!supabaseError && supabaseUser?.user) {
                userId = supabaseUser.user.id;
                userEmail = supabaseUser.user.email;
                userPhone = supabaseUser.user.phone;
            }
        }
        if (!userId) {
            res.status(401).json({ success: false, error: 'Invalid or expired token' });
            return;
        }
        // Verify user exists in database and check active status
        const { data: user, error } = await supabase_1.supabase
            .from('users')
            .select('id, role, is_active, phone, email')
            .eq('id', userId)
            .single();
        if (error || !user) {
            res.status(401).json({ success: false, error: 'User account not found' });
            return;
        }
        if (!user.is_active) {
            res.status(403).json({ success: false, error: 'Account suspended' });
            return;
        }
        req.user = {
            id: user.id,
            role: user.role || userRole,
            email: user.email || userEmail,
            phone: user.phone || userPhone,
        };
        next();
    }
    catch (error) {
        res.status(401).json({ success: false, error: 'Token authentication failed' });
    }
};
exports.authenticate = authenticate;
//# sourceMappingURL=auth.middleware.js.map
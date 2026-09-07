"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSupabaseConfigured = exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'placeholder-key';
// Service role client (backend only — has full DB access, bypasses RLS)
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});
// In-memory store for dev/demo mode when Supabase is not configured
const isSupabaseConfigured = () => {
    return (process.env.SUPABASE_URL !== undefined &&
        process.env.SUPABASE_URL !== 'https://placeholder.supabase.co' &&
        process.env.SUPABASE_SERVICE_KEY !== undefined &&
        process.env.SUPABASE_SERVICE_KEY !== 'placeholder-key');
};
exports.isSupabaseConfigured = isSupabaseConfigured;
//# sourceMappingURL=supabase.js.map
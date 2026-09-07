"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Route imports
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const rides_routes_1 = __importDefault(require("./routes/rides.routes"));
const group_rides_routes_1 = __importDefault(require("./routes/group-rides.routes"));
const safety_routes_1 = __importDefault(require("./routes/safety.routes"));
const driver_routes_1 = __importDefault(require("./routes/driver.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const payments_routes_1 = __importDefault(require("./routes/payments.routes"));
const notifications_routes_1 = __importDefault(require("./routes/notifications.routes"));
// Middleware
const error_middleware_1 = require("./middleware/error.middleware");
const app = (0, express_1.default)();
// Security & parsing middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, morgan_1.default)('dev'));
// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'Travix API', timestamp: new Date().toISOString() });
});
// API Routes
app.use('/api/auth', auth_routes_1.default);
app.use('/api/user', user_routes_1.default);
app.use('/api/rides', rides_routes_1.default);
app.use('/api/group-rides', group_rides_routes_1.default);
app.use('/api/safety', safety_routes_1.default);
app.use('/api/driver', driver_routes_1.default);
app.use('/api/admin', admin_routes_1.default);
app.use('/api/payments', payments_routes_1.default);
app.use('/api/notifications', notifications_routes_1.default);
// Error handling (must be last)
app.use(error_middleware_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map
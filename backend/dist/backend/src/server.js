"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const safety_monitor_job_1 = require("./jobs/safety-monitor.job");
const PORT = process.env.PORT || 3001;
const server = app_1.default.listen(PORT, () => {
    console.log(`\n🚗 Travix API Server running on http://localhost:${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/health`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);
    // Start safety monitor background job
    (0, safety_monitor_job_1.startSafetyMonitorJob)();
});
// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});
exports.default = server;
//# sourceMappingURL=server.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startSafetyMonitorJob = startSafetyMonitorJob;
const node_cron_1 = __importDefault(require("node-cron"));
const safety_engine_service_1 = require("../services/safety-engine.service");
let jobRunning = false;
function startSafetyMonitorJob() {
    const intervalSeconds = Number(process.env.SAFETY_JOB_INTERVAL_SECONDS) || 60;
    const cronExpression = `*/${intervalSeconds} * * * * *`; // every N seconds
    // Use every 60 seconds by default
    node_cron_1.default.schedule('* * * * *', async () => {
        if (jobRunning) {
            console.log('[SAFETY JOB] Previous run still active, skipping...');
            return;
        }
        jobRunning = true;
        const startTime = Date.now();
        try {
            await (0, safety_engine_service_1.checkActiveRides)();
            const duration = Date.now() - startTime;
            console.log(`[SAFETY JOB] Completed in ${duration}ms at ${new Date().toISOString()}`);
        }
        catch (error) {
            console.error('[SAFETY JOB] Error:', error);
        }
        finally {
            jobRunning = false;
        }
    });
    console.log('🛡️ Safety monitor job started (runs every 60 seconds)');
}
//# sourceMappingURL=safety-monitor.job.js.map
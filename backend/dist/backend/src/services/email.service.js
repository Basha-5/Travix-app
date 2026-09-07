"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailTemplates = void 0;
exports.sendEmail = sendEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const axios_1 = __importDefault(require("axios"));
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER || 'bashaips91619@gmail.com';
const SMTP_PASS = process.env.SMTP_PASS || 'ajaq exwc sdvp ccow';
const SMTP_FROM = process.env.SMTP_FROM || 'Travix App <bashaips91619@gmail.com>';
const transporter = nodemailer_1.default.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
    },
});
async function sendEmail(options) {
    // 1. Try Brevo HTTPS REST API if key is provided (never blocked by ISP port filters)
    if (process.env.BREVO_API_KEY) {
        try {
            await axios_1.default.post('https://api.brevo.com/v3/smtp/email', {
                sender: { name: 'Travix App', email: SMTP_USER },
                to: [{ email: options.to }],
                subject: options.subject,
                htmlContent: options.html,
                textContent: options.text,
            }, {
                headers: {
                    'api-key': process.env.BREVO_API_KEY,
                    'Content-Type': 'application/json',
                },
                timeout: 8000,
            });
            console.log(`✉️ [BREVO-HTTPS] Email sent successfully to ${options.to}`);
            return true;
        }
        catch (err) {
            console.error(`❌ [BREVO-HTTPS] Dispatch failed:`, err.response?.data || err.message);
        }
    }
    // 2. Try Resend HTTPS REST API if key is provided
    if (process.env.RESEND_API_KEY) {
        try {
            await axios_1.default.post('https://api.resend.com/emails', {
                from: process.env.RESEND_FROM || 'Travix <onboarding@resend.dev>',
                to: [options.to],
                subject: options.subject,
                html: options.html,
                text: options.text,
            }, {
                headers: {
                    Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                timeout: 8000,
            });
            console.log(`✉️ [RESEND-HTTPS] Email sent successfully to ${options.to}`);
            return true;
        }
        catch (err) {
            console.error(`❌ [RESEND-HTTPS] Dispatch failed:`, err.response?.data || err.message);
        }
    }
    // 3. Fallback to Gmail SMTP (with timeout protection against blocked ports)
    try {
        const info = await transporter.sendMail({
            from: SMTP_FROM,
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
        });
        console.log(`✉️ [SMTP] Email sent to ${options.to} (Message ID: ${info.messageId})`);
        return true;
    }
    catch (error) {
        console.error(`❌ [SMTP] Failed to send email to ${options.to}:`, error.message);
        return false;
    }
}
// Predefined Email Templates
exports.emailTemplates = {
    otpCode: (otp) => ({
        subject: '🔐 Your Travix Security Code',
        html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f0f4f8; border-radius: 12px;">
        <h2 style="color: #1A7A6E; margin-bottom: 8px;">🚗 Travix Verification Code</h2>
        <p style="font-size: 15px; color: #4a5568;">Your 4-digit security code to sign in to Travix is:</p>
        <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1A7A6E; background: #ffffff; padding: 16px 24px; border-radius: 12px; display: inline-block; border: 2px solid #1A7A6E; margin: 16px 0;">
          ${otp}
        </div>
        <p style="font-size: 13px; color: #718096; margin-top: 12px;">This code will expire in 5 minutes. Do not share this code with anyone.</p>
      </div>
    `,
    }),
    emergencyAlert: (riderName, vehicleNumber, driverName, location, trackingUrl) => ({
        subject: `🚨 EMERGENCY ALERT: ${riderName} needs assistance`,
        html: `
      <div style="font-family: Arial, sans-serif; padding: 24px; background-color: #fff5f5; border-radius: 16px; border: 2px solid #e53e3e;">
        <h1 style="color: #c53030; margin-bottom: 12px;">🆘 Travix Emergency Safety Alert</h1>
        <p style="font-size: 16px; color: #2d3748; line-height: 1.5;">
          <strong>${riderName}</strong> has triggered an SOS Emergency Alert during their Travix ride.
        </p>
        
        <div style="background: white; border-radius: 12px; padding: 16px; margin: 16px 0; border: 1px solid #fed7d7;">
          <h3 style="color: #9b2c2c; margin-top: 0;">Ride Details:</h3>
          <p style="margin: 6px 0; color: #4a5568;">🚗 <strong>Vehicle:</strong> ${vehicleNumber}</p>
          <p style="margin: 6px 0; color: #4a5568;">👤 <strong>Driver:</strong> ${driverName}</p>
          <p style="margin: 6px 0; color: #4a5568;">📍 <strong>Last Known Location:</strong> ${location}</p>
        </div>

        <a href="${trackingUrl}" style="display: inline-block; padding: 14px 28px; background: #e53e3e; color: white; text-decoration: none; font-weight: bold; border-radius: 100px; font-size: 15px; margin-top: 12px;">
          Track Live GPS Location →
        </a>

        <p style="font-size: 12px; color: #718096; margin-top: 20px;">
          If you cannot reach ${riderName}, please contact Emergency Services at <strong>112</strong> immediately.
        </p>
      </div>
    `,
    }),
    rideReceipt: (riderName, fare, pickup, destination, rideId) => ({
        subject: `🧾 Your Travix Trip Receipt — ₹${fare}`,
        html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
        <h2 style="color: #1A7A6E;">🚗 Travix Trip Receipt</h2>
        <p>Hi ${riderName}, thanks for riding with Travix!</p>
        
        <div style="background: #f0fdfb; padding: 16px; border-radius: 12px; margin: 16px 0;">
          <div style="font-size: 28px; font-weight: 800; color: #1A7A6E;">Total Paid: ₹${fare}</div>
          <div style="font-size: 12px; color: #718096; margin-top: 4px;">Trip ID: #${rideId.substring(0, 8).toUpperCase()}</div>
        </div>

        <p style="margin: 8px 0;">🟢 <strong>Pickup:</strong> ${pickup}</p>
        <p style="margin: 8px 0;">📍 <strong>Destination:</strong> ${destination}</p>
      </div>
    `,
    }),
};
//# sourceMappingURL=email.service.js.map
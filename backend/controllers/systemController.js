import pool from '../config/db.js';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getSystemStatus = async (req, res) => {
  try {
    // 1. Check database connectivity
    let dbStatus = 'offline';
    let dbMessage = '';
    try {
      await pool.query('SELECT 1');
      dbStatus = 'online';
      dbMessage = 'Connected';
    } catch (dbErr) {
      dbMessage = dbErr.message;
    }

    // 2. Check WhatsApp configuration
    const waConfigured = !!(
      process.env.WHATSAPP_PHONE_NUMBER_ID &&
      process.env.WHATSAPP_ACCESS_TOKEN &&
      process.env.WHATSAPP_ACCESS_TOKEN.trim().length > 0
    );

    // 3. Read app version from package.json
    let appVersion = '1.0.0';
    try {
      const pkgPath = path.join(__dirname, '..', 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      appVersion = pkg.version || '1.0.0';
    } catch (e) {
      // fallback
    }

    // 4. Get some basic DB stats
    let tableCount = 0;
    try {
      const [tables] = await pool.query('SHOW TABLES');
      tableCount = tables.length;
    } catch (e) {
      // ignore
    }

    res.json({
      api: { status: 'online', message: 'Backend running' },
      database: { status: dbStatus, message: dbMessage, tables: tableCount },
      whatsapp: {
        status: waConfigured ? 'configured' : 'not_configured',
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ? '••••' + process.env.WHATSAPP_PHONE_NUMBER_ID.slice(-4) : 'Not Set',
        hasAccessToken: !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_ACCESS_TOKEN.trim().length > 0)
      },
      app: { version: appVersion },
      uptime: Math.floor(process.uptime()),
      nodeVersion: process.version
    });
  } catch (error) {
    console.error('System status error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both current and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const adminPassword = (process.env.ADMIN_PASSWORD || 'admin123').trim();

    if (currentPassword !== adminPassword) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    // Update the .env file
    const envPath = path.join(__dirname, '..', '.env');
    let envContent = fs.readFileSync(envPath, 'utf-8');

    // Replace the ADMIN_PASSWORD line
    if (envContent.includes('ADMIN_PASSWORD=')) {
      envContent = envContent.replace(
        /ADMIN_PASSWORD=.*/,
        `ADMIN_PASSWORD=${newPassword}`
      );
    } else {
      envContent += `\nADMIN_PASSWORD=${newPassword}`;
    }

    fs.writeFileSync(envPath, envContent, 'utf-8');

    // Update in-memory so the server doesn't require a restart
    process.env.ADMIN_PASSWORD = newPassword;

    console.log('Admin password changed successfully (value not logged).');
    res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password.' });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const adminEmail = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.trim() : null;
    if (!adminEmail || email.toLowerCase().trim() !== adminEmail.toLowerCase()) {
      // For security, do not reveal if the email exists or not, just return success or generic error
      return res.status(400).json({ error: 'Invalid admin email provided.' });
    }

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return res.status(500).json({ error: 'System error: password not configured.' });
    }

    // Configure nodemailer transport
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_PORT == 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Generate a single-use JWT signed with the CURRENT password
    const payload = { email: adminEmail };
    // Token expires in 15 minutes
    const token = jwt.sign(payload, adminPassword, { expiresIn: '15m' });
    
    const resetLink = `http://localhost:5173/reset-password?token=${token}`;

    const mailOptions = {
      from: `"Shastika CRM" <${process.env.SMTP_USER}>`,
      to: adminEmail,
      subject: 'Secure Admin Password Reset',
      html: `
        <h3>Secure Password Reset Request</h3>
        <p>You requested to recover your admin dashboard password.</p>
        <p>Click the secure link below to set a new password. This link is valid for 15 minutes and can only be used once.</p>
        <p><a href="${resetLink}" style="padding: 10px 20px; background-color: #10b981; color: white; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Reset Password</a></p>
        <p style="margin-top: 20px; font-size: 12px; color: #64748b;">If you did not request this, you can safely ignore this email.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log('Secure recovery email sent to admin.');
    
    res.json({ message: 'If the email matches our records, a secure recovery email has been sent.' });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process forgot password request.' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return res.status(500).json({ error: 'System error: password not configured.' });
    }

    // Verify token using the current password as the secret
    let decoded;
    try {
      decoded = jwt.verify(token, adminPassword);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired reset token. Please request a new one.' });
    }

    const adminEmail = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.trim().toLowerCase() : null;
    if (decoded.email !== adminEmail) {
      return res.status(403).json({ error: 'Token does not match the configured admin email.' });
    }

    // Update the .env file with the new password
    const envPath = path.join(__dirname, '..', '.env');
    let envContent = fs.readFileSync(envPath, 'utf-8');

    if (envContent.includes('ADMIN_PASSWORD=')) {
      envContent = envContent.replace(
        /ADMIN_PASSWORD=.*/,
        `ADMIN_PASSWORD=${newPassword}`
      );
    } else {
      envContent += `\nADMIN_PASSWORD=${newPassword}`;
    }

    fs.writeFileSync(envPath, envContent, 'utf-8');

    // Update in-memory so the server doesn't require a restart immediately
    process.env.ADMIN_PASSWORD = newPassword;

    console.log('Admin password reset successfully via token.');
    res.json({ message: 'Password has been successfully reset.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
};

import pool from '../config/db.js';
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
      const { rows: tables } = await pool.query('SHOW TABLES');
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

export const getSidebarStats = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // AI Bot status (global auto_reply_enabled)
    const { rows: botSettings } = await pool.query("SELECT setting_value FROM bot_settings WHERE setting_key = 'auto_reply_enabled'");
    const autoReplyEnabled = botSettings.length > 0 ? botSettings[0].setting_value === 'true' : true;

    // WhatsApp connection status (is any connected?)
    const { rows: waConns } = await pool.query("SELECT connection_status FROM whatsapp_connections WHERE connection_status = 'Connected' LIMIT 1");
    const whatsappConnected = waConns.length > 0;

    // Auto Reply Rules (any active?)
    const { rows: activeRules } = await pool.query('SELECT 1 FROM auto_reply_rules WHERE is_active = true LIMIT 1');
    const hasActiveRules = activeRules.length > 0;

    // Today's Messages (received + sent)
    const { rows: todayMessages } = await pool.query('SELECT COUNT(*) as count FROM messages WHERE DATE(timestamp) = $1', [today]);
    
    // Today's AI Replies
    const { rows: todayAiReplies } = await pool.query("SELECT COUNT(*) as count FROM messages WHERE sender = 'ai' AND DATE(timestamp) = $1", [today]);

    // Today's New Customers
    const { rows: todayCustomers } = await pool.query('SELECT COUNT(*) as count FROM customers WHERE DATE(created_at) = $1', [today]);

    res.json({
      botActive: autoReplyEnabled,
      whatsappConnected: whatsappConnected,
      aiRepliesOn: autoReplyEnabled,
      autoReplyRulesOn: hasActiveRules,
      today: {
        messages: todayMessages[0].count,
        aiReplies: todayAiReplies[0].count,
        newCustomers: todayCustomers[0].count
      }
    });
  } catch (error) {
    console.error('Sidebar stats error:', error);
    res.status(500).json({ error: 'Failed to retrieve sidebar stats.' });
  }
};

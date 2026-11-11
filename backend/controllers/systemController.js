import pool from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

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
      dbMessage = 'Connected to PostgreSQL';
    } catch (dbErr) {
      dbMessage = dbErr.message;
    }

    // 2. Check WhatsApp configuration in DB or Env
    let phoneIdDisplay = 'Not Set';
    let waConfigured = false;
    let hasAccessToken = false;

    try {
      const { rows: waRows } = await pool.query(
        'SELECT phone_number_id, access_token, connection_status FROM whatsapp_connections ORDER BY created_at ASC LIMIT 1'
      );
      if (waRows.length > 0) {
        waConfigured = true;
        hasAccessToken = !!(waRows[0].access_token && waRows[0].access_token.length > 10);
        phoneIdDisplay = waRows[0].phone_number_id ? '••••' + waRows[0].phone_number_id.slice(-4) : 'Configured';
      } else if (process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN) {
        waConfigured = true;
        hasAccessToken = true;
        phoneIdDisplay = '••••' + process.env.WHATSAPP_PHONE_NUMBER_ID.slice(-4);
      }
    } catch (e) {
      // fallback
    }

    // 3. Read app version from package.json
    let appVersion = '1.0.0';
    try {
      const pkgPath = path.join(__dirname, '..', 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      appVersion = pkg.version || '1.0.0';
    } catch (e) {
      // fallback
    }

    // 4. Basic DB stats
    let tableCount = 0;
    try {
      const { rows: tables } = await pool.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
      );
      tableCount = tables.length;
    } catch (e) {
      // ignore
    }

    res.json({
      api: { status: 'online', message: 'Backend running' },
      database: { status: dbStatus, message: dbMessage, tables: tableCount },
      whatsapp: {
        status: waConfigured ? 'configured' : 'not_configured',
        phoneNumberId: phoneIdDisplay,
        hasAccessToken: hasAccessToken
      },
      app: { version: appVersion },
      uptime: Math.floor(process.uptime()),
      nodeVersion: process.version
    });
  } catch (error) {
    console.error('System status error:', error.message);
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

    // Identify user to update (from authenticated token or default admin)
    const userId = req.user?.id;
    let userRow = null;

    if (userId) {
      const { rows } = await pool.query('SELECT id, username, password_hash FROM employees WHERE id = $1', [userId]);
      if (rows.length > 0) userRow = rows[0];
    }

    if (!userRow) {
      const { rows } = await pool.query("SELECT id, username, password_hash FROM employees WHERE username = 'admin'");
      if (rows.length > 0) userRow = rows[0];
    }

    if (!userRow) {
      return res.status(404).json({ error: 'Employee account not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, userRow.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE employees SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newHash, userRow.id]
    );

    console.log(`[Security] Password updated successfully for employee: ${userRow.username}`);
    res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error.message);
    res.status(500).json({ error: 'Failed to change password.' });
  }
};

export const getSidebarStats = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // AI Bot status (global auto_reply_enabled)
    const { rows: botSettings } = await pool.query(
      "SELECT setting_value FROM bot_settings WHERE setting_key = 'auto_reply_enabled'"
    );
    const autoReplyEnabled = botSettings.length > 0 ? botSettings[0].setting_value === 'true' : true;

    // WhatsApp connection status
    const { rows: waConns } = await pool.query(
      "SELECT connection_status FROM whatsapp_connections WHERE connection_status = 'Connected' LIMIT 1"
    );
    const whatsappConnected = waConns.length > 0;

    // Auto Reply Rules
    const { rows: activeRules } = await pool.query(
      'SELECT 1 FROM auto_reply_rules WHERE is_active = true LIMIT 1'
    );
    const hasActiveRules = activeRules.length > 0;

    // Today's Messages (received + sent)
    const { rows: todayMessages } = await pool.query(
      'SELECT COUNT(*) as count FROM messages WHERE timestamp::date = $1',
      [today]
    );
    
    // Today's AI Replies
    const { rows: todayAiReplies } = await pool.query(
      "SELECT COUNT(*) as count FROM messages WHERE sender = 'ai' AND timestamp::date = $1",
      [today]
    );

    // Today's New Customers
    const { rows: todayCustomers } = await pool.query(
      'SELECT COUNT(*) as count FROM customers WHERE created_at::date = $1',
      [today]
    );

    res.json({
      botActive: autoReplyEnabled,
      whatsappConnected: whatsappConnected,
      aiRepliesOn: autoReplyEnabled,
      autoReplyRulesOn: hasActiveRules,
      today: {
        messages: parseInt(todayMessages[0]?.count || 0, 10),
        aiReplies: parseInt(todayAiReplies[0]?.count || 0, 10),
        newCustomers: parseInt(todayCustomers[0]?.count || 0, 10)
      }
    });
  } catch (error) {
    console.error('Sidebar stats error:', error.message);
    res.status(500).json({ error: 'Failed to retrieve sidebar stats.' });
  }
};

import express from 'express';
import * as customerController from '../controllers/customerController.js';
import * as productController from '../controllers/productController.js';
import * as holidayController from '../controllers/holidayController.js';
import * as ruleController from '../controllers/ruleController.js';
import * as settingController from '../controllers/settingController.js';
import * as messageController from '../controllers/messageController.js';
import * as analyticsController from '../controllers/analyticsController.js';
import * as systemController from '../controllers/systemController.js';
import * as whatsappController from '../controllers/whatsappController.js';
import * as employeeController from '../controllers/employeeController.js';
import * as webhookController from '../controllers/webhookController.js';
import * as notificationController from '../controllers/notificationController.js';
import { authenticate, authorizeAdmin } from '../authMiddleware.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

const router = express.Router();

// In-Memory Login Rate Limiter: max 5 failed attempts per 15 minutes per IP and username
export const failedLoginAttempts = new Map();
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

export const loginRateLimiter = (req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const username = String(req.body?.username || '').trim().toLowerCase();
  const key = `${ip}_${username}`;
  const now = Date.now();

  const record = failedLoginAttempts.get(key);
  if (record) {
    if (now - record.firstAttempt > LOGIN_LOCKOUT_MS) {
      failedLoginAttempts.delete(key);
    } else if (record.count >= MAX_FAILED_LOGIN_ATTEMPTS) {
      const remainingMinutes = Math.ceil((LOGIN_LOCKOUT_MS - (now - record.firstAttempt)) / 60000);
      return res.status(429).json({ error: `Too many failed login attempts. Please try again after ${remainingMinutes} minutes.` });
    }
  }
  next();
};

export const recordFailedLogin = (ip, username) => {
  const key = `${ip}_${String(username || '').trim().toLowerCase()}`;
  const now = Date.now();
  const record = failedLoginAttempts.get(key) || { count: 0, firstAttempt: now };
  if (now - record.firstAttempt > LOGIN_LOCKOUT_MS) {
    record.count = 1;
    record.firstAttempt = now;
  } else {
    record.count += 1;
  }
  failedLoginAttempts.set(key, record);
};

export const resetFailedLogin = (ip, username) => {
  const key = `${ip}_${String(username || '').trim().toLowerCase()}`;
  failedLoginAttempts.delete(key);
};

// 1. Public Authentication Route
router.post('/login', loginRateLimiter, async (req, res) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const genericError = 'Invalid username or password';

  try {
    const { rows } = await pool.query('SELECT * FROM employees WHERE LOWER(username) = LOWER($1)', [username.trim()]);
    if (rows.length === 0) {
      recordFailedLogin(ip, username);
      return res.status(401).json({ error: genericError });
    }

    const user = rows[0];
    if (user.status !== 'Active') {
      recordFailedLogin(ip, username);
      return res.status(401).json({ error: genericError });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      recordFailedLogin(ip, username);
      return res.status(401).json({ error: genericError });
    }

    // Reset failed count on successful authentication
    resetFailedLogin(ip, username);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name },
      process.env.JWT_SECRET || 'shastika_default_jwt_secret_2025',
      { expiresIn: '24h' }
    );

    console.log(`[Auth] User login successful: ${user.username} (${user.role})`);
    res.json({ token, role: user.role, name: user.name });
  } catch (error) {
    console.error('[Auth Error]:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Public WhatsApp Webhook Alternative Endpoints (Mounted under /api)
router.get('/whatsapp/webhook', webhookController.verifyWebhook);
router.post('/whatsapp/webhook', webhookController.handleIncomingMessage);

// ============================================
// Protected API Routes (Token Authentication Required)
// ============================================
router.use(authenticate);

// Employees (Admin Only)
router.get('/employees', authorizeAdmin, employeeController.getEmployees);
router.post('/employees', authorizeAdmin, employeeController.createEmployee);
router.put('/employees/:id', authorizeAdmin, employeeController.updateEmployee);
router.put('/employees/:id/status', authorizeAdmin, employeeController.updateEmployeeStatus);
router.delete('/employees/:id', authorizeAdmin, employeeController.deleteEmployee);

// BDEs (Accessible by any authenticated user for assignment)
router.get('/bdes', employeeController.getActiveBDEs);

// Customers
router.get('/customers', customerController.getCustomers);
router.get('/customers/test-data-preview', authorizeAdmin, customerController.getTestDataPreview);
router.post('/customers/cleanup-test-data', authorizeAdmin, customerController.cleanupTestData);
router.get('/customers/:id', customerController.getCustomerById);
router.post('/customers', customerController.createCustomer);
router.put('/customers/:id', customerController.updateCustomer);
router.put('/customers/:id/assign', authorizeAdmin, customerController.assignBDE);
router.delete('/customers/:id', authorizeAdmin, customerController.deleteCustomer);

// Products
router.get('/products', productController.getProducts);
router.get('/products/export', authorizeAdmin, productController.exportProductsCSV);
router.post('/products/import-preview', authorizeAdmin, productController.previewImportCSV);
router.post('/products/import', authorizeAdmin, productController.importProductsCSV);
router.get('/products/:id', productController.getProductById);
router.post('/products', authorizeAdmin, productController.createProduct);
router.put('/products/:id', authorizeAdmin, productController.updateProduct);
router.delete('/products/:id', authorizeAdmin, productController.deleteProduct);

// Holidays
router.get('/holidays', holidayController.getHolidays);
router.post('/holidays', authorizeAdmin, holidayController.createHoliday);
router.put('/holidays/:id', authorizeAdmin, holidayController.updateHoliday);
router.delete('/holidays/:id', authorizeAdmin, holidayController.deleteHoliday);

// Auto Reply Rules
router.get('/auto-reply/rules', ruleController.getRules);
router.post('/auto-reply/rules', authorizeAdmin, ruleController.createRule);
router.put('/auto-reply/rules/:id', authorizeAdmin, ruleController.updateRule);
router.delete('/auto-reply/rules/:id', authorizeAdmin, ruleController.deleteRule);

// Settings (Admin Only)
router.get('/settings', authorizeAdmin, settingController.getSettings);
router.put('/settings', authorizeAdmin, settingController.updateSettings);

// Analytics (Admin Only)
router.get('/analytics', authorizeAdmin, analyticsController.getAnalytics);

// System
router.get('/system/status', authorizeAdmin, systemController.getSystemStatus);
router.get('/system/health-details', authorizeAdmin, systemController.getHealthDetails);
router.post('/system/password', systemController.changePassword);
router.get('/system/sidebar-stats', systemController.getSidebarStats);

// Conversations and Messages
router.get('/conversations', messageController.getConversations);
router.get('/messages/:conversationId', messageController.getMessages);
router.post('/whatsapp/send', messageController.sendMessage);
router.get('/whatsapp/templates', messageController.getApprovedTemplates);
router.post('/whatsapp/send-template', messageController.sendTemplateMessage);
router.put('/whatsapp/takeover', messageController.toggleTakeover);

// Notifications & Human Handover Alerts
router.get('/notifications/handover', notificationController.getHandoverNotifications);
router.post('/notifications/dismiss', notificationController.dismissHandoverNotification);
router.post('/notifications/dismiss-token-alert', authorizeAdmin, notificationController.dismissTokenAlert);
router.get('/notifications/alert-number', notificationController.getAlertNumber);
router.post('/notifications/alert-number', notificationController.updateAlertNumber);

// WhatsApp Configuration (Admin Only)
router.get('/whatsapp/config', authorizeAdmin, whatsappController.getConfig);
router.post('/whatsapp/config', authorizeAdmin, whatsappController.addConfig);
router.put('/whatsapp/config/:id', authorizeAdmin, whatsappController.updateConfig);
router.delete('/whatsapp/config/:id', authorizeAdmin, whatsappController.deleteConfig);
router.patch('/whatsapp/bot-status/:id', authorizeAdmin, whatsappController.toggleBotStatus);
router.patch('/whatsapp/default/:id', authorizeAdmin, whatsappController.setDefaultConnection);
router.post('/whatsapp/test', authorizeAdmin, whatsappController.testConnection);

export default router;

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
import { authenticate, authorizeAdmin } from '../authMiddleware.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};

  try {
    const { rows } = await pool.query('SELECT * FROM employees WHERE username = $1', [username]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];
    if (user.status !== 'Active') {
      return res.status(403).json({ error: 'Account is inactive or on leave' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '24h' }
    );

    console.log(`User login successful: ${username} (${user.role})`);
    res.json({ token, role: user.role, name: user.name });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Protect all routes below this middleware
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
router.get('/customers/:id', customerController.getCustomerById);
router.post('/customers', customerController.createCustomer);
router.put('/customers/:id', customerController.updateCustomer);
router.put('/customers/:id/assign', customerController.assignBDE);
router.delete('/customers/:id', customerController.deleteCustomer);

// Products
router.get('/products', productController.getProducts);
router.get('/products/:id', productController.getProductById);
router.post('/products', productController.createProduct);
router.put('/products/:id', productController.updateProduct);
router.delete('/products/:id', productController.deleteProduct);

// Holidays
router.get('/holidays', holidayController.getHolidays);
router.post('/holidays', holidayController.createHoliday);
router.put('/holidays/:id', holidayController.updateHoliday);
router.delete('/holidays/:id', holidayController.deleteHoliday);

// Auto Reply Rules
router.get('/auto-reply/rules', ruleController.getRules);
router.post('/auto-reply/rules', ruleController.createRule);
router.put('/auto-reply/rules/:id', ruleController.updateRule);
router.delete('/auto-reply/rules/:id', ruleController.deleteRule);

// Settings
router.get('/settings', settingController.getSettings);
router.put('/settings', settingController.updateSettings);

// Analytics
router.get('/analytics', analyticsController.getAnalytics);

// System
router.get('/system/status', systemController.getSystemStatus);
router.post('/system/password', systemController.changePassword);
router.get('/system/sidebar-stats', systemController.getSidebarStats);

// Conversations and Messages
router.get('/conversations', messageController.getConversations);
router.get('/messages/:conversationId', messageController.getMessages);
router.post('/whatsapp/send', messageController.sendMessage);
router.put('/whatsapp/takeover', messageController.toggleTakeover);

// WhatsApp Configuration
router.get('/whatsapp/config', whatsappController.getConfig);
router.post('/whatsapp/config', whatsappController.addConfig);
router.put('/whatsapp/config/:id', whatsappController.updateConfig);
router.delete('/whatsapp/config/:id', whatsappController.deleteConfig);
router.patch('/whatsapp/bot-status/:id', whatsappController.toggleBotStatus);
router.post('/whatsapp/test', whatsappController.testConnection);

export default router;

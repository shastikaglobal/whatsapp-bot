import express from 'express';
import * as customerController from '../controllers/customerController.js';
import * as productController from '../controllers/productController.js';
import * as holidayController from '../controllers/holidayController.js';
import * as ruleController from '../controllers/ruleController.js';
import * as settingController from '../controllers/settingController.js';
import * as messageController from '../controllers/messageController.js';
import * as analyticsController from '../controllers/analyticsController.js';
import * as systemController from '../controllers/systemController.js';
import { authenticate } from '../authMiddleware.js';

const router = express.Router();

router.post('/login', (req, res) => {
  const { password } = req.body || {};
  const adminPassword = (process.env.ADMIN_PASSWORD || 'admin123').trim();
  const isConfigured = !!process.env.ADMIN_PASSWORD;
  
  console.log('Login attempt received');
  console.log(`Password configuration loaded: ${isConfigured ? 'yes' : 'no'}`);

  if (password === adminPassword) {
    res.json({ token: adminPassword });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// Protect all routes below this middleware
router.use(authenticate);

// Customers
router.get('/customers', customerController.getCustomers);
router.get('/customers/:id', customerController.getCustomerById);
router.post('/customers', customerController.createCustomer);
router.put('/customers/:id', customerController.updateCustomer);
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

// Conversations and Messages
router.get('/conversations', messageController.getConversations);
router.get('/messages/:conversationId', messageController.getMessages);
router.post('/whatsapp/send', messageController.sendMessage);
router.put('/whatsapp/takeover', messageController.toggleTakeover);

export default router;

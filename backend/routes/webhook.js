import express from 'express';
import * as webhookController from '../controllers/webhookController.js';

const router = express.Router();

// Webhook Verification (GET)
router.get('/', webhookController.verifyWebhook);
router.get('/whatsapp', webhookController.verifyWebhook);
router.get('/webhook', webhookController.verifyWebhook);

// Incoming Webhook Events (POST)
router.post('/', webhookController.handleIncomingMessage);
router.post('/whatsapp', webhookController.handleIncomingMessage);
router.post('/webhook', webhookController.handleIncomingMessage);

export default router;

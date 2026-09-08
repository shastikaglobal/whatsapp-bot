import express from 'express';
import * as webhookController from '../controllers/webhookController.js';

const router = express.Router();

// Webhook Verification (GET)
router.get('/whatsapp', webhookController.verifyWebhook);

// Incoming Webhook Events (POST)
router.post('/whatsapp', webhookController.handleIncomingMessage);

export default router;

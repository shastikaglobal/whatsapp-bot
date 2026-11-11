import pool from '../config/db.js';
import { sendWhatsAppMessage } from '../services/whatsappService.js';
import { generateAiReply } from '../services/aiService.js';
import crypto from 'crypto';

export const verifyWebhook = async (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
      // Check verify token against env or bot_settings
      let expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;
      if (!expectedToken) {
        const { rows } = await pool.query(
          "SELECT setting_value FROM bot_settings WHERE setting_key = 'whatsapp_verify_token'"
        );
        if (rows.length > 0) expectedToken = rows[0].setting_value;
      }

      if (mode === 'subscribe' && token === expectedToken) {
        console.log('[Webhook] Verification successful');
        return res.status(200).send(challenge);
      } else {
        console.warn('[Webhook] Verification token mismatch');
        return res.sendStatus(403);
      }
    }
    return res.sendStatus(400);
  } catch (err) {
    console.error('[Webhook] Verification error:', err.message);
    return res.sendStatus(500);
  }
};

export const handleIncomingMessage = async (req, res) => {
  try {
    // 0. Verify Signature if META_APP_SECRET is configured
    const appSecret = process.env.META_APP_SECRET;
    if (appSecret && req.rawBody) {
      const signatureHeader = req.headers['x-hub-signature-256'];
      if (!signatureHeader) {
        console.warn('[Webhook Security] Missing X-Hub-Signature-256 header');
        return res.sendStatus(401);
      }
      const hmac = crypto.createHmac('sha256', appSecret);
      const digest = 'sha256=' + hmac.update(req.rawBody).digest('hex');
      const sigBuffer = Buffer.from(signatureHeader, 'utf8');
      const digestBuffer = Buffer.from(digest, 'utf8');
      if (sigBuffer.length !== digestBuffer.length || !crypto.timingSafeEqual(sigBuffer, digestBuffer)) {
        console.warn('[Webhook Security] Invalid X-Hub-Signature-256 signature');
        return res.sendStatus(401);
      }
    }

    const body = req.body;
    if (!body || !body.object) {
      return res.sendStatus(404);
    }

    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value) {
      return res.sendStatus(200);
    }

    // 1. Handle Status Updates Separately (delivered, read, sent, failed)
    if (value.statuses && Array.isArray(value.statuses) && value.statuses.length > 0) {
      for (const statusUpdate of value.statuses) {
        const statusMsgId = statusUpdate.id;
        const newStatus = statusUpdate.status;
        console.log(`[Webhook Status] Message ${statusMsgId} -> ${newStatus}`);
        
        try {
          await pool.query(
            'UPDATE messages SET status = $1 WHERE id = $2',
            [newStatus, statusMsgId]
          );
        } catch (dbErr) {
          console.error('[Webhook Status DB Error]:', dbErr.message);
        }

        if (newStatus === 'failed') {
          console.warn(`[Webhook Delivery Failed] Message ${statusMsgId} failed. Errors:`, statusUpdate.errors || 'N/A');
        }
      }
      // Acknowledge status updates and exit without triggering auto-replies
      return res.sendStatus(200);
    }

    // 2. Handle Incoming Customer Messages
    if (value.messages && Array.isArray(value.messages) && value.messages.length > 0) {
      const receivingPhoneNumberId = value.metadata?.phone_number_id;
      if (!receivingPhoneNumberId) {
        console.warn('[Webhook] Missing metadata.phone_number_id in payload');
        return res.sendStatus(200);
      }

      // Check multi-number connection configuration
      let connection = null;
      const { rows: connRows } = await pool.query(
        'SELECT id, display_name, bot_enabled, access_token FROM whatsapp_connections WHERE phone_number_id = $1',
        [receivingPhoneNumberId]
      );

      if (connRows.length > 0) {
        connection = connRows[0];
      } else if (process.env.WHATSAPP_PHONE_NUMBER_ID && receivingPhoneNumberId === process.env.WHATSAPP_PHONE_NUMBER_ID) {
        connection = {
          id: 'env_default',
          display_name: 'Environment Default',
          bot_enabled: true,
          access_token: process.env.WHATSAPP_ACCESS_TOKEN
        };
      } else {
        console.warn(`[Webhook] Unconfigured receiving phone_number_id: ${receivingPhoneNumberId}`);
        return res.sendStatus(200);
      }

      const msg = value.messages[0];
      const msgId = msg.id;

      // 3. PREVENT DUPLICATE MESSAGE PROCESSING
      const { rows: existingMsg } = await pool.query(
        'SELECT 1 FROM messages WHERE id = $1',
        [msgId]
      );
      if (existingMsg.length > 0) {
        console.log(`[Webhook] Duplicate message ID ${msgId} already processed. Skipping.`);
        return res.sendStatus(200);
      }

      // Extract sender phone and name safely
      const contactObj = value.contacts?.[0];
      const senderPhone = msg.from || contactObj?.wa_id;
      const senderName = contactObj?.profile?.name || senderPhone || 'Customer';

      if (!senderPhone) {
        console.warn(`[Webhook] Could not determine sender phone for message ID: ${msgId}`);
        return res.sendStatus(200);
      }

      // Extract text content from message
      let msgText = '';
      if (msg.type === 'text' && msg.text?.body) {
        msgText = msg.text.body;
      } else if (msg.type === 'interactive') {
        msgText = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '';
      } else if (msg.type === 'button') {
        msgText = msg.button?.text || '';
      }

      const customerId = `cust_${senderPhone}`;

      // Ensure Customer Record Exists
      const { rows: existingCust } = await pool.query(
        'SELECT assigned_bde_id FROM customers WHERE id = $1',
        [customerId]
      );
      let assignedBdeId = existingCust.length > 0 ? existingCust[0].assigned_bde_id : null;
      let requiresAdminAttention = false;

      if (assignedBdeId) {
        const { rows: bdeRows } = await pool.query(
          'SELECT status FROM employees WHERE id = $1',
          [assignedBdeId]
        );
        if (bdeRows.length > 0 && bdeRows[0].status === 'On Leave') {
          requiresAdminAttention = true;
          console.log(`[Leave Routing] Customer ${customerId} assigned to BDE ${assignedBdeId} on leave. Admin flagged.`);
        }
      }

      await pool.query(
        `INSERT INTO customers (id, name, phone, lastMessage)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET 
           name = CASE WHEN customers.name IS NULL OR customers.name = customers.phone THEN EXCLUDED.name ELSE customers.name END,
           lastMessage = EXCLUDED.lastMessage,
           updated_at = CURRENT_TIMESTAMP`,
        [customerId, senderName, senderPhone, msgText || `[${msg.type || 'Media'} message]`]
      );

      // Ensure Conversation Record Exists (with multi-number phone_number_id)
      const { rows: convRows } = await pool.query(
        'SELECT id, status FROM conversations WHERE customer_id = $1 ORDER BY updated_at DESC LIMIT 1',
        [customerId]
      );

      let convStatus = 'open';
      if (convRows.length === 0) {
        await pool.query(
          'INSERT INTO conversations (customer_id, status, phone_number_id, requires_admin_attention) VALUES ($1, $2, $3, $4)',
          [customerId, 'open', receivingPhoneNumberId, requiresAdminAttention]
        );
      } else {
        convStatus = convRows[0].status;
        await pool.query(
          'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP, phone_number_id = $2, requires_admin_attention = $3 WHERE customer_id = $1',
          [customerId, receivingPhoneNumberId, requiresAdminAttention]
        );
      }

      // Save Incoming Message to PostgreSQL
      await pool.query(
        'INSERT INTO messages (id, customer_id, sender, content, status, phone_number_id) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
        [msgId, customerId, 'customer', msgText || `[${msg.type || 'media'}]`, 'delivered', receivingPhoneNumberId]
      );

      // Check whether Auto-Reply is Allowed
      // 1. Is bot enabled for this specific receiving number?
      if (!connection.bot_enabled) {
        console.log(`[Webhook] Bot disabled for receiving number ${receivingPhoneNumberId}. Skipping auto-reply.`);
        return res.sendStatus(200);
      }

      // 2. Is auto-reply globally enabled?
      const { rows: settingsRows } = await pool.query(
        "SELECT setting_value FROM bot_settings WHERE setting_key = 'auto_reply_enabled'"
      );
      const autoReplyEnabled = settingsRows.length > 0 ? settingsRows[0].setting_value === 'true' : true;
      if (!autoReplyEnabled) {
        console.log('[Webhook] Global auto-reply is turned OFF. Skipping auto-reply.');
        return res.sendStatus(200);
      }

      // 3. Is conversation paused / taken over by human?
      if (convStatus === 'handover') {
        console.log(`[Webhook] Customer ${customerId} conversation is in human takeover mode. Skipping auto-reply.`);
        return res.sendStatus(200);
      }

      // 4. Does incoming message have readable text?
      if (!msgText || !msgText.trim()) {
        console.log(`[Webhook] Incoming message is non-text (${msg.type}). Skipping auto-reply.`);
        return res.sendStatus(200);
      }

      // Process Auto-Reply
      let replyText = null;
      let intent = null;
      let isImportant = false;

      // 4.1 Keyword Rules Check (Longest keywords prioritized for specificity)
      const { rows: rules } = await pool.query(
        'SELECT keyword, reply_text FROM auto_reply_rules WHERE is_active = true ORDER BY LENGTH(keyword) DESC'
      );
      const normalizedIncoming = msgText.toLowerCase().trim();
      for (const rule of rules) {
        const normalizedKeyword = rule.keyword.toLowerCase().trim();
        if (normalizedIncoming === normalizedKeyword || normalizedIncoming.includes(normalizedKeyword)) {
          replyText = rule.reply_text;
          console.log(`[Webhook] Keyword rule matched: "${rule.keyword}"`);
          break;
        }
      }

      // 4.2 Gemini AI Fallback if no keyword rule matched
      if (!replyText) {
        console.log(`[Webhook] No keyword rule matched for: "${msgText}". Invoking AI service...`);
        const aiResponse = await generateAiReply(customerId, msgText);
        replyText = aiResponse.reply_text;
        intent = aiResponse.intent;
        isImportant = aiResponse.is_important;

        if (intent) {
          await pool.query(
            'UPDATE customers SET intent = $1, is_important = $2 WHERE id = $3',
            [intent, isImportant, customerId]
          );
        }
      }

      // 4.3 Dispatch Outgoing Reply via WhatsApp Cloud API
      if (replyText) {
        const sendResult = await sendWhatsAppMessage(
          senderPhone,
          replyText,
          receivingPhoneNumberId,
          connection.access_token
        );

        if (sendResult.success) {
          const botMsgId = sendResult.messages?.[0]?.id || `bot_${crypto.randomUUID()}`;
          await pool.query(
            'INSERT INTO messages (id, customer_id, sender, content, status, phone_number_id) VALUES ($1, $2, $3, $4, $5, $6)',
            [botMsgId, customerId, 'ai', replyText, 'sent', receivingPhoneNumberId]
          );
          console.log(`[Webhook] AI auto-reply sent successfully to ${senderPhone}`);
        } else {
          // Never simulate success when Meta API fails
          console.error(`[Webhook] Outgoing auto-reply failed to send to ${senderPhone}: ${sendResult.message}`);
        }
      }

      return res.sendStatus(200);
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error('[Webhook Fatal Error]:', error);
    return res.sendStatus(500);
  }
};

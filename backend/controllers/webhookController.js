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

      if (mode === 'subscribe' && expectedToken && String(token).trim() === String(expectedToken).trim()) {
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
    // 0. Verify Signature if META_APP_SECRET is configured in env or DB
    let appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
      try {
        const { rows: secretRows } = await pool.query(
          "SELECT setting_value FROM bot_settings WHERE setting_key = 'meta_app_secret'"
        );
        if (secretRows.length > 0 && secretRows[0].setting_value?.trim()) {
          appSecret = secretRows[0].setting_value.trim();
        }
      } catch (e) { /* ignore */ }
    }

    if (appSecret && req.rawBody) {
      const signatureHeader = req.headers['x-hub-signature-256'];
      if (!signatureHeader) {
        console.warn('[Webhook Security] Missing X-Hub-Signature-256 header');
        return res.sendStatus(401);
      }
      const hmac = crypto.createHmac('sha256', appSecret);
      const digest = 'sha256=' + hmac.update(req.rawBody).digest('hex');
      const sigBuffer = Buffer.from(signatureHeader.trim(), 'utf8');
      const digestBuffer = Buffer.from(digest, 'utf8');
      if (sigBuffer.length !== digestBuffer.length || !crypto.timingSafeEqual(sigBuffer, digestBuffer)) {
        console.warn('[Webhook Security] Invalid X-Hub-Signature-256 signature');
        return res.sendStatus(401);
      }
    }

    const body = req.body;
    if (!body || !body.object) {
      return res.sendStatus(200);
    }

    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value) {
      return res.sendStatus(200);
    }

    // Verify webhook subscription field (messages or other supported events)
    if (change?.field && change.field !== 'messages') {
      console.log(`[Webhook] Acknowledging subscription event for field: ${change.field}`);
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
      
      // If there are no messages in the same payload, exit
      if (!value.messages || !Array.isArray(value.messages) || value.messages.length === 0) {
        return res.sendStatus(200);
      }
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
        'SELECT id, display_name, bot_enabled, access_token FROM whatsapp_connections WHERE TRIM(phone_number_id) = $1',
        [String(receivingPhoneNumberId).trim()]
      );

      if (connRows.length > 0) {
        connection = connRows[0];
      } else if (process.env.WHATSAPP_PHONE_NUMBER_ID && String(receivingPhoneNumberId).trim() === String(process.env.WHATSAPP_PHONE_NUMBER_ID).trim()) {
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

      // Extract sender phone and name safely
      const contactObj = value.contacts?.[0];
      const senderPhone = String(msg.from || contactObj?.wa_id || '').replace(/[^0-9]/g, '');
      const senderName = contactObj?.profile?.name || senderPhone || 'Customer';

      if (!senderPhone) {
        console.warn(`[Webhook] Could not determine sender phone for message ID: ${msgId}`);
        return res.sendStatus(200);
      }

      // Extract text content or caption from message
      let msgText = '';
      if (msg.type === 'text' && msg.text?.body) {
        msgText = msg.text.body;
      } else if (msg.type === 'interactive') {
        msgText = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '';
      } else if (msg.type === 'button') {
        msgText = msg.button?.text || '';
      } else if (msg[msg.type]?.caption) {
        msgText = msg[msg.type].caption;
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
        [customerId, senderName, senderPhone, msgText || `[${msg.type || 'media'} message]`]
      );

      // Ensure Conversation Record Exists (isolated per customer and receiving phone_number_id)
      const { rows: convRows } = await pool.query(
        'SELECT id, status FROM conversations WHERE customer_id = $1 AND (phone_number_id = $2 OR phone_number_id IS NULL) ORDER BY updated_at DESC LIMIT 1',
        [customerId, receivingPhoneNumberId]
      );

      let convStatus = 'open';
      let convId = null;

      if (convRows.length === 0) {
        const { rows: newConv } = await pool.query(
          'INSERT INTO conversations (customer_id, status, phone_number_id, requires_admin_attention) VALUES ($1, $2, $3, $4) RETURNING id',
          [customerId, 'open', receivingPhoneNumberId, requiresAdminAttention]
        );
        convId = newConv[0]?.id;
      } else {
        convId = convRows[0].id;
        convStatus = convRows[0].status;
        await pool.query(
          'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP, phone_number_id = $2, requires_admin_attention = $3 WHERE id = $1',
          [convId, receivingPhoneNumberId, requiresAdminAttention]
        );
      }

      // 3. ATOMIC PREVENT DUPLICATE MESSAGE PROCESSING
      // Save Incoming Message to PostgreSQL - if it already exists, rowCount === 0
      const insertMsgResult = await pool.query(
        `INSERT INTO messages (id, customer_id, sender, content, status, phone_number_id)
         VALUES ($1, $2, 'customer', $3, 'delivered', $4)
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [msgId, customerId, msgText || `[${msg.type || 'media'}]`, receivingPhoneNumberId]
      );

      if (insertMsgResult.rowCount === 0) {
        console.log(`[Webhook] Duplicate message ID ${msgId} already processed. Skipping auto-reply.`);
        return res.sendStatus(200);
      }

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

      // 4.1 Holiday Check: If today is an active holiday
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const { rows: holidayRows } = await pool.query(
          'SELECT name FROM holidays WHERE date = $1 AND enabled = true',
          [todayStr]
        );
        if (holidayRows.length > 0) {
          const { rows: holidaySetting } = await pool.query(
            "SELECT setting_value FROM bot_settings WHERE setting_key = 'holiday_reply'"
          );
          if (holidaySetting.length > 0 && holidaySetting[0].setting_value?.trim()) {
            replyText = holidaySetting[0].setting_value.trim();
            console.log(`[Webhook] Active holiday today ("${holidayRows[0].name}"). Using holiday auto-reply.`);
          }
        }
      } catch (holidayErr) {
        console.error('[Webhook Holiday Check Error]:', holidayErr.message);
      }

      // 4.2 Keyword Rules Check (Longest keywords prioritized for specificity)
      if (!replyText) {
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
      }

      // 4.3 Gemini AI Fallback if no rule matched
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

      // 4.4 Dispatch Outgoing Reply via WhatsApp Cloud API
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
          await pool.query(
            'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [convId]
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
    console.error('[Webhook Fatal Error]:', error.message);
    return res.sendStatus(500);
  }
};

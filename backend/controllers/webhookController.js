import pool from '../config/db.js';
import { sendWhatsAppMessage } from '../services/whatsappService.js';
import { generateAiReply } from '../services/aiService.js';
import crypto from 'crypto';

// Pure greeting regex (English, Tamil, transliterated)
export const PURE_GREETING_REGEX = /^(hi+|hello+|hey+|hlo+|vanakkam|namaste|good\s+morning|good\s+afternoon|good\s+evening|வணக்கம்)[\s!.]*$/i;

// Short acknowledgement and gratitude regexes
export const ACKNOWLEDGEMENT_REGEX = /^(ok+|okay|k|noted|sure|alright|fine|சரி)[\s.!]*$/i;
export const THANKS_REGEX = /^(thanks+|thank\s+you|thx|tq|நன்றி)[\s.!]*$/i;

/**
 * Builds a regex with word boundaries, plurals, and common typos.
 * Supports Unicode boundaries for multilingual matching.
 */
export function buildKeywordRegex(keyword) {
  if (!keyword || typeof keyword !== 'string') return null;
  const clean = keyword.trim().toLowerCase();
  if (!clean) return null;

  // Dictionary of known export products with common typos, stems, and plurals
  const dictionary = {
    coconut: ['coconut', 'coconuts', 'cocunut', 'cocunuts', 'coconat', 'kokonut'],
    banana: ['banana', 'bananas', 'bannana', 'bannanas'],
    watermelon: ['watermelon', 'watermelons', 'water melon', 'water melons'],
    pumpkin: ['pumpkin', 'pumpkins', 'pumkin', 'pumkins'],
    cucumber: ['cucumber', 'cucumbers', 'cucamber', 'cucambers']
  };

  let variants = null;
  for (const [key, list] of Object.entries(dictionary)) {
    if (clean === key || list.includes(clean)) {
      variants = list;
      break;
    }
  }

  if (variants) {
    const escaped = variants.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'));
    return new RegExp(`(?:^|[\\s,.:;!?/()"-])(${escaped.join('|')})(?=$|[\\s,.:;!?/()"-])`, 'giu');
  }

  // Generic keyword support: handle singular and plural (s / es)
  let escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  if (escaped.endsWith('es')) {
    const base = escaped.slice(0, -2);
    return new RegExp(`(?:^|[\\s,.:;!?/()"-])(${base}(?:es)?)(?=$|[\\s,.:;!?/()"-])`, 'giu');
  } else if (escaped.endsWith('s')) {
    const base = escaped.slice(0, -1);
    return new RegExp(`(?:^|[\\s,.:;!?/()"-])(${base}(?:s)?)(?=$|[\\s,.:;!?/()"-])`, 'giu');
  }
  return new RegExp(`(?:^|[\\s,.:;!?/()"-])(${escaped}(?:s|es)?)(?=$|[\\s,.:;!?/()"-])`, 'giu');
}

/**
 * Finds matching rule among active rules.
 * If multiple keywords match, selects the rule whose match appears LAST in the text.
 */
export function matchAutoReplyRule(text, rules) {
  if (!text || !rules || rules.length === 0) return null;

  let bestRule = null;
  let maxLastIndex = -1;

  for (const rule of rules) {
    const regex = buildKeywordRegex(rule.keyword);
    if (!regex) continue;

    let match;
    let ruleLastIndex = -1;
    while ((match = regex.exec(text)) !== null) {
      // Calculate true keyword start position
      const leadOffset = match[0].length - match[1].length;
      ruleLastIndex = match.index + leadOffset;
    }

    if (ruleLastIndex !== -1) {
      if (ruleLastIndex > maxLastIndex) {
        maxLastIndex = ruleLastIndex;
        bestRule = rule;
      }
    }
  }

  return bestRule;
}

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

      // 4.2 Check 24-Hour Conversation Window
      const { rows: priorMsgRows } = await pool.query(
        `SELECT id FROM messages 
         WHERE customer_id = $1 
           AND id != $2 
           AND timestamp >= NOW() - INTERVAL '24 hours' 
         LIMIT 1`,
        [customerId, msgId]
      );
      const isNewConversation = priorMsgRows.length === 0;
      const isPureGreeting = PURE_GREETING_REGEX.test(msgText.trim());

      // 4.3 Welcome Message Check:
      // Send Welcome Message ONLY for a pure greeting (hi/hello/hii) or the first message of a new conversation that is greeting-oriented.
      // Never use welcome message as a fallback for unmatched messages.
      if (!replyText && isPureGreeting) {
        const { rows: welcomeSetting } = await pool.query(
          "SELECT setting_value FROM bot_settings WHERE setting_key = 'welcome_message'"
        );
        replyText = welcomeSetting[0]?.setting_value?.trim() ||
          '👋 Welcome to Shastika Global Impex! Thank you for reaching out. How may we assist you today?';
        console.log(`[Webhook] Pure greeting received ("${msgText}"). Sending welcome message.`);
      }

      // 4.4 Natural Acknowledgement & Gratitude Check
      if (!replyText && ACKNOWLEDGEMENT_REGEX.test(msgText.trim())) {
        replyText = 'Understood! Let us know if you have any questions or need a quotation. 👍';
        console.log(`[Webhook] Acknowledgement received ("${msgText}"). Sending natural confirmation.`);
      } else if (!replyText && THANKS_REGEX.test(msgText.trim())) {
        replyText = "You're welcome! Feel free to reach out anytime. 👍";
        console.log(`[Webhook] Gratitude message received ("${msgText}"). Sending polite reply.`);
      }

      // 4.5 RFQ / Detailed Quotation Enquiry Check
      // If customer provides order volume or quotation terms (e.g. tons, CIF, FOB, quote),
      // route to Gemini AI to capture parameters and initiate quotation handover (is_important = true).
      const isDetailedRfq = /(?:quotation|quote|\bcif\b|\bfob\b|\b(?:metric\s+)?tons?\b|\b(?:40ft|20ft|fcl)\b)/i.test(msgText);

      // 4.6 Keyword Rules Check:
      // Matches case-insensitive contains with word boundaries, plurals (s/es), and common typos.
      // If multiple products match, answers for the product the customer mentioned last.
      if (!replyText && !isDetailedRfq) {
        const { rows: rules } = await pool.query(
          'SELECT keyword, reply_text FROM auto_reply_rules WHERE is_active = true'
        );
        const matchedRule = matchAutoReplyRule(msgText, rules);
        if (matchedRule) {
          replyText = matchedRule.reply_text;
          console.log(`[Webhook] Keyword rule matched: "${matchedRule.keyword}" (last mentioned product prioritized)`);
        }
      }

      // 4.7 Gemini AI Fallback for RFQs and Unmatched Messages (NEVER welcome message)
      if (!replyText) {
        console.log(`[Webhook] Unmatched / RFQ message: "${msgText}". Routing to Gemini AI service...`);
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
        if (isImportant) {
          await pool.query(
            'UPDATE conversations SET requires_admin_attention = true WHERE id = $1',
            [convId]
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

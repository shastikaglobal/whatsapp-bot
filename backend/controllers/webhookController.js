import pool from '../config/db.js';
import { sendWhatsAppMessage } from '../services/whatsappService.js';
import { generateAiReply } from '../services/aiService.js';
import crypto from 'crypto';

export const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
};

export const handleIncomingMessage = async (req, res) => {
  try {
    const body = req.body;
    
    // Check if it's a WhatsApp status update or message
    if (body.object) {
      if (
        body.entry &&
        body.entry[0].changes &&
        body.entry[0].changes[0] &&
        body.entry[0].changes[0].value.messages &&
        body.entry[0].changes[0].value.messages[0]
      ) {
        const phoneNumber = body.entry[0].changes[0].value.contacts[0].wa_id;
        const name = body.entry[0].changes[0].value.contacts[0].profile.name;
        const msg = body.entry[0].changes[0].value.messages[0];
        const msgText = msg.text ? msg.text.body : '';
        const msgId = msg.id;

        // 1. Ensure Customer Exists
        const customerId = `cust_${phoneNumber}`;
        await pool.query(
          'INSERT INTO customers (id, name, phone, lastMessage) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = ?, lastMessage = ?',
          [customerId, name, phoneNumber, msgText, name, msgText]
        );

        // 2. Ensure Conversation Exists and check status
        const [convRows] = await pool.query('SELECT status FROM conversations WHERE customer_id = ?', [customerId]);
        let convStatus = 'open';
        
        if (convRows.length === 0) {
          await pool.query(
            'INSERT INTO conversations (customer_id, status) VALUES (?, ?)',
            [customerId, 'open']
          );
        } else {
          convStatus = convRows[0].status;
          await pool.query(
            'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE customer_id = ?',
            [customerId]
          );
        }

        // 3. Save Incoming Message
        await pool.query(
          'INSERT IGNORE INTO messages (id, customer_id, sender, content) VALUES (?, ?, ?, ?)',
          [msgId, customerId, 'customer', msgText]
        );

        // 4. Auto Reply Logic
        const [settingsRows] = await pool.query('SELECT setting_value FROM bot_settings WHERE setting_key = "auto_reply_enabled"');
        const autoReplyEnabled = settingsRows.length > 0 ? settingsRows[0].setting_value === 'true' : true;

        if (autoReplyEnabled && convStatus !== 'handover') {
          let replyText = null;

          // 4.1 Check Custom Auto Reply Rules First
          const [rules] = await pool.query('SELECT keyword, reply_text FROM auto_reply_rules WHERE is_active = true');
          for (let rule of rules) {
            if (msgText.toLowerCase().includes(rule.keyword.toLowerCase())) {
              replyText = rule.reply_text;
              break;
            }
          }

          // 4.2 Generate AI Reply if no rule matched
          if (!replyText) {
             replyText = await generateAiReply(customerId, msgText);
          }

          if (replyText) {
            // Send Reply via WhatsApp
            await sendWhatsAppMessage(phoneNumber, replyText);
            
            // Save Bot Reply
            const botMsgId = `bot_${crypto.randomUUID()}`;
            await pool.query(
              'INSERT INTO messages (id, customer_id, sender, content) VALUES (?, ?, ?, ?)',
              [botMsgId, customerId, 'ai', replyText]
            );
          }
        }
      }
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    console.error('Webhook Error:', error);
    res.sendStatus(500);
  }
};

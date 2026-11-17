import pool from '../config/db.js';
import { sendWhatsAppMessage } from '../services/whatsappService.js';
import crypto from 'crypto';

export const getConversations = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        c.*, 
        cust.name as customer_name, 
        cust.phone as customer_phone,
        cust.intent,
        cust.is_important,
        cust.assigned_bde_id,
        e.name as assigned_bde_name,
        wc.display_name as connection_name,
        wc.whatsapp_phone_number as receiving_phone_number
      FROM conversations c
      JOIN customers cust ON c.customer_id = cust.id
      LEFT JOIN employees e ON cust.assigned_bde_id = e.id
      LEFT JOIN whatsapp_connections wc ON TRIM(c.phone_number_id) = TRIM(wc.phone_number_id)
      ORDER BY c.updated_at DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('getConversations error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    let rows;
    
    if (conversationId && conversationId.startsWith('cust_')) {
      const result = await pool.query(
        'SELECT * FROM messages WHERE customer_id = $1 ORDER BY timestamp ASC',
        [conversationId]
      );
      rows = result.rows;
    } else {
      const convRes = await pool.query(
        'SELECT customer_id, phone_number_id FROM conversations WHERE id = $1',
        [parseInt(conversationId, 10) || 0]
      );
      if (convRes.rows.length > 0) {
        const { customer_id, phone_number_id } = convRes.rows[0];
        if (phone_number_id) {
          const result = await pool.query(
            'SELECT * FROM messages WHERE customer_id = $1 AND (phone_number_id = $2 OR phone_number_id IS NULL) ORDER BY timestamp ASC',
            [customer_id, phone_number_id]
          );
          rows = result.rows;
        } else {
          const result = await pool.query(
            'SELECT * FROM messages WHERE customer_id = $1 ORDER BY timestamp ASC',
            [customer_id]
          );
          rows = result.rows;
        }
      } else {
        const result = await pool.query(
          'SELECT * FROM messages WHERE customer_id = $1 ORDER BY timestamp ASC',
          [conversationId]
        );
        rows = result.rows;
      }
    }
    res.json(rows);
  } catch (error) {
    console.error('getMessages error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { customerId, conversationId, phoneNumberId: explicitPhoneId, content } = req.body;
    
    if (!customerId || !content || !content.trim()) {
      return res.status(400).json({ error: 'Customer ID and message content are required.' });
    }

    // 1. Get customer phone
    const { rows: custRows } = await pool.query('SELECT phone FROM customers WHERE id = $1', [customerId]);
    if (custRows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const phone = custRows[0].phone;

    // 2. Identify receiving phone number ID for this conversation
    let actualPhoneId = explicitPhoneId || null;
    let convId = conversationId || null;

    if (!actualPhoneId && convId) {
      const { rows: cRows } = await pool.query(
        'SELECT id, phone_number_id FROM conversations WHERE id = $1',
        [convId]
      );
      if (cRows.length > 0) {
        actualPhoneId = cRows[0].phone_number_id;
      }
    }

    if (!actualPhoneId) {
      const { rows: convRows } = await pool.query(
        'SELECT id, phone_number_id FROM conversations WHERE customer_id = $1 ORDER BY updated_at DESC LIMIT 1',
        [customerId]
      );
      if (convRows.length > 0) {
        actualPhoneId = convRows[0].phone_number_id;
        convId = convId || convRows[0].id;
      }
    }

    // 3. Resolve connection credentials for this phone_number_id
    let accessToken = null;
    if (actualPhoneId) {
      const { rows: connRows } = await pool.query(
        'SELECT phone_number_id, access_token FROM whatsapp_connections WHERE TRIM(phone_number_id) = $1',
        [String(actualPhoneId).trim()]
      );
      if (connRows.length > 0) {
        accessToken = connRows[0].access_token;
      }
    }

    // Fallback to active connection if not set on conversation
    if (!accessToken) {
      const { rows: defaultRows } = await pool.query(
        'SELECT phone_number_id, access_token FROM whatsapp_connections WHERE bot_enabled = true ORDER BY created_at ASC LIMIT 1'
      );
      if (defaultRows.length > 0) {
        actualPhoneId = actualPhoneId || defaultRows[0].phone_number_id;
        accessToken = defaultRows[0].access_token;
      } else if (process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN) {
        actualPhoneId = actualPhoneId || process.env.WHATSAPP_PHONE_NUMBER_ID;
        accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
      }
    }

    // 4. Send via Meta WhatsApp Cloud API
    const sendResult = await sendWhatsAppMessage(phone, content, actualPhoneId, accessToken);
    
    // Handle Meta API errors: NEVER simulate success when call fails
    if (!sendResult || sendResult.error) {
      const errMsg = sendResult?.message || 'Meta Cloud API rejected the outgoing message';
      console.error(`[Manual Send Failed] Customer: ${customerId}, Error: ${errMsg}`);
      return res.status(400).json({ 
        success: false, 
        error: errMsg,
        details: sendResult?.details || null
      });
    }

    // 5. Save to DB ONLY on real Meta API success
    const metaMsgId = sendResult.messages?.[0]?.id || `msg_${crypto.randomUUID()}`;
    await pool.query(
      'INSERT INTO messages (id, customer_id, sender, content, status, phone_number_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [metaMsgId, customerId, 'human', content, 'sent', actualPhoneId]
    );

    // 6. Update conversation timestamp
    if (convId) {
      await pool.query(
        'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [convId]
      );
    } else {
      await pool.query(
        'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE customer_id = $1',
        [customerId]
      );
    }

    res.json({ success: true, message: 'Message sent successfully', messageId: metaMsgId });
  } catch (error) {
    console.error('Send message error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

export const toggleTakeover = async (req, res) => {
  try {
    const { customerId, status } = req.body; // 'handover', 'open', 'resolved'
    if (!customerId || !status) {
      return res.status(400).json({ error: 'Customer ID and status are required' });
    }

    await pool.query(
      'UPDATE conversations SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE customer_id = $2',
      [status, customerId]
    );
    res.json({ success: true, status });
  } catch (error) {
    console.error('toggleTakeover error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

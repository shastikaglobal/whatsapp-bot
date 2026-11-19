import pool from '../config/db.js';
import { sendWhatsAppMessage } from '../services/whatsappService.js';
import crypto from 'crypto';

export const getConversations = async (req, res) => {
  try {
    const isBde = String(req.user?.role || '').toLowerCase() === 'bde';
    let query = `
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
    `;
    const params = [];

    // BDE can see only conversations for customers assigned to them or unassigned
    if (isBde && req.user?.id) {
      query += ` WHERE (cust.assigned_bde_id = $1 OR cust.assigned_bde_id IS NULL) `;
      params.push(req.user.id);
    }

    query += ` ORDER BY c.updated_at DESC`;

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('getConversations error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const isBde = String(req.user?.role || '').toLowerCase() === 'bde';
    let rows;

    // Resolve target customerId to verify BDE access
    let targetCustomerId = null;
    let targetConv = null;

    if (conversationId && conversationId.startsWith('cust_')) {
      targetCustomerId = conversationId;
    } else {
      const convRes = await pool.query(
        'SELECT customer_id, phone_number_id FROM conversations WHERE id = $1',
        [parseInt(conversationId, 10) || 0]
      );
      if (convRes.rows.length > 0) {
        targetConv = convRes.rows[0];
        targetCustomerId = targetConv.customer_id;
      } else {
        targetCustomerId = conversationId;
      }
    }

    // Access control: BDE cannot read messages of a customer assigned to a different BDE
    if (isBde && req.user?.id && targetCustomerId) {
      const { rows: custRows } = await pool.query(
        'SELECT assigned_bde_id FROM customers WHERE id = $1',
        [targetCustomerId]
      );
      if (custRows.length > 0 && custRows[0].assigned_bde_id && Number(custRows[0].assigned_bde_id) !== Number(req.user.id)) {
        return res.status(403).json({ error: 'Access denied: Customer assigned to another BDE' });
      }
    }

    if (targetConv) {
      const { customer_id, phone_number_id } = targetConv;
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
        [targetCustomerId || conversationId]
      );
      rows = result.rows;
    }
    res.json(rows);
  } catch (error) {
    console.error('getMessages error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Resolves the appropriate WhatsApp connection credentials for an outgoing message.
 * Prioritizes:
 *  1. Explicitly provided phoneNumberId (if valid and not placeholder)
 *  2. Conversation's assigned phone_number_id
 *  3. Customer's previous messages' phone_number_id
 *  4. Default connection (is_default = true) or active verified connection
 * NEVER uses connections with placeholder tokens (YOUR_NEW...) or unverified status.
 */
export const resolveWhatsAppConnection = async (explicitPhoneId, convId, customerId, db = pool) => {
  let actualPhoneId = explicitPhoneId ? String(explicitPhoneId).trim() : null;
  let resolvedConvId = convId || null;

  // 1. If not provided, check conversation by convId
  if (!actualPhoneId && resolvedConvId) {
    const { rows: cRows } = await db.query(
      'SELECT id, phone_number_id FROM conversations WHERE id = $1',
      [resolvedConvId]
    );
    if (cRows.length > 0 && cRows[0].phone_number_id) {
      actualPhoneId = String(cRows[0].phone_number_id).trim();
    }
  }

  // 2. Check customer's latest conversation
  if (!actualPhoneId && customerId) {
    const { rows: convRows } = await db.query(
      "SELECT id, phone_number_id FROM conversations WHERE customer_id = $1 AND phone_number_id IS NOT NULL AND TRIM(phone_number_id) != '' ORDER BY updated_at DESC LIMIT 1",
      [customerId]
    );
    if (convRows.length > 0 && convRows[0].phone_number_id) {
      actualPhoneId = String(convRows[0].phone_number_id).trim();
      resolvedConvId = resolvedConvId || convRows[0].id;
    }
  }

  // 3. Check customer's latest message with phone_number_id
  if (!actualPhoneId && customerId) {
    const { rows: msgRows } = await db.query(
      "SELECT phone_number_id FROM messages WHERE customer_id = $1 AND phone_number_id IS NOT NULL AND TRIM(phone_number_id) != '' ORDER BY timestamp DESC LIMIT 1",
      [customerId]
    );
    if (msgRows.length > 0 && msgRows[0].phone_number_id) {
      actualPhoneId = String(msgRows[0].phone_number_id).trim();
    }
  }

  // 4. Resolve connection credentials for actualPhoneId
  // Exclude placeholder tokens (e.g. YOUR_NEW_TOKEN_HERE) and unverified status
  let connection = null;
  if (actualPhoneId) {
    const { rows: connRows } = await db.query(
      `SELECT id, display_name, phone_number_id, whatsapp_phone_number, access_token, is_default, status 
       FROM whatsapp_connections 
       WHERE TRIM(phone_number_id) = $1 
         AND access_token NOT LIKE 'YOUR_NEW%'
         AND (status IS NULL OR LOWER(status) != 'unverified')`,
      [actualPhoneId]
    );
    if (connRows.length > 0) {
      connection = connRows[0];
    }
  }

  // 5. Fallback: Use default connection (is_default = true) or first active verified connection
  // NEVER use connections with placeholder tokens (YOUR_NEW...) or unverified status
  if (!connection) {
    const { rows: defaultRows } = await db.query(
      `SELECT id, display_name, phone_number_id, whatsapp_phone_number, access_token, is_default, status 
       FROM whatsapp_connections 
       WHERE access_token NOT LIKE 'YOUR_NEW%' 
         AND (status IS NULL OR LOWER(status) != 'unverified')
       ORDER BY CASE WHEN is_default = true THEN 0 ELSE 1 END, created_at ASC 
       LIMIT 1`
    );
    if (defaultRows.length > 0) {
      connection = defaultRows[0];
      actualPhoneId = connection.phone_number_id;
    } else if (process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN) {
      actualPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      connection = {
        phone_number_id: actualPhoneId,
        access_token: process.env.WHATSAPP_ACCESS_TOKEN,
        display_name: 'Environment Default'
      };
    }
  }

  return {
    phoneNumberId: actualPhoneId,
    accessToken: connection?.access_token || null,
    convId: resolvedConvId,
    connection
  };
};

export const sendMessage = async (req, res) => {
  try {
    const { customerId, conversationId, phoneNumberId: explicitPhoneId, content } = req.body;

    if (!customerId || !content || !content.trim()) {
      return res.status(400).json({ error: 'Customer ID and message content are required.' });
    }

    const isBde = String(req.user?.role || '').toLowerCase() === 'bde';

    // 1. Get customer phone and check BDE access control
    const { rows: custRows } = await pool.query('SELECT phone, assigned_bde_id FROM customers WHERE id = $1', [customerId]);
    if (custRows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    if (isBde && req.user?.id && custRows[0].assigned_bde_id && Number(custRows[0].assigned_bde_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Access denied: Customer assigned to another BDE' });
    }

    const phone = custRows[0].phone;

    // 2. Resolve WhatsApp connection (same connection as conversation/messages, or default verified connection)
    const { phoneNumberId: actualPhoneId, accessToken, convId: resolvedConvId } = await resolveWhatsAppConnection(
      explicitPhoneId,
      conversationId,
      customerId
    );
    const convId = resolvedConvId || conversationId || null;

    // 3. Send via Meta WhatsApp Cloud API
    const sendResult = await sendWhatsAppMessage(phone, content, actualPhoneId, accessToken);

    const senderTag = req.user?.name || (String(req.user?.role || '').toLowerCase() === 'admin' ? 'Admin' : 'BDE');

    // Handle Meta API errors: Save message as 'failed' with failure reason and return error
    if (!sendResult || sendResult.error) {
      const errorCode = sendResult?.code || 'ERROR';
      const errMsg = sendResult?.message || 'Meta Cloud API rejected the outgoing message';
      const failureReason = sendResult?.code ? `${sendResult.code}: ${sendResult.message}` : errMsg;

      const failedMsgId = `failed_${crypto.randomUUID()}`;

      try {
        await pool.query(
          `INSERT INTO messages (id, customer_id, sender, content, status, phone_number_id, failure_reason)
           VALUES ($1, $2, $3, $4, 'failed', $5, $6)`,
          [failedMsgId, customerId, senderTag, content, actualPhoneId, failureReason]
        );
      } catch (insertErr) {
        await pool.query(
          `INSERT INTO messages (id, customer_id, sender, content, status, phone_number_id)
           VALUES ($1, $2, $3, $4, 'failed', $5)`,
          [failedMsgId, customerId, senderTag, content, actualPhoneId]
        );
      }

      // Update conversation timestamp so failed send is tracked
      if (convId) {
        await pool.query('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [convId]);
      } else {
        await pool.query('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE customer_id = $1', [customerId]);
      }

      console.error(`[Manual Send Failed] Customer: ${customerId}, PhoneID: ${actualPhoneId}, Code: ${errorCode}, Reason: ${errMsg}`);
      return res.status(400).json({
        success: false,
        error: errMsg,
        code: errorCode,
        messageId: failedMsgId,
        failure_reason: failureReason,
        details: sendResult?.details || null
      });
    }

    // 4. Save to DB on real Meta API success
    const metaMsgId = sendResult.messages?.[0]?.id || `msg_${crypto.randomUUID()}`;
    await pool.query(
      'INSERT INTO messages (id, customer_id, sender, content, status, phone_number_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [metaMsgId, customerId, senderTag, content, 'sent', actualPhoneId]
    );

    // If customer is unassigned and replied by a BDE, automatically assign to this BDE
    if (String(req.user?.role || '').toLowerCase() === 'bde' && req.user?.id) {
      await pool.query(
        'UPDATE customers SET assigned_bde_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND assigned_bde_id IS NULL',
        [req.user.id, customerId]
      );
    }

    // 5. Update conversation timestamp
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

    console.log(`[Manual Send Succeeded] Message ${metaMsgId} dispatched to ${phone} via PhoneID ${actualPhoneId}`);
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

    const isBde = String(req.user?.role || '').toLowerCase() === 'bde';

    // Verify customer exists and check BDE access control
    const { rows: custRows } = await pool.query('SELECT id, assigned_bde_id FROM customers WHERE id = $1', [customerId]);
    if (custRows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    if (isBde && req.user?.id && custRows[0].assigned_bde_id && Number(custRows[0].assigned_bde_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Access denied: Customer assigned to another BDE' });
    }

    // When resuming bot ('open') or marking 'resolved', clear requires_admin_attention
    // When activating takeover ('handover'), flag requires_admin_attention
    const requiresAttention = status === 'handover';

    await pool.query(
      `UPDATE conversations SET 
         status = $1, 
         requires_admin_attention = $2, 
         handover_started_at = CASE WHEN $1 = 'handover' THEN CURRENT_TIMESTAMP ELSE NULL END,
         updated_at = CURRENT_TIMESTAMP 
       WHERE customer_id = $3`,
      [status, requiresAttention, customerId]
    );
    res.json({ success: true, status });
  } catch (error) {
    console.error('toggleTakeover error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

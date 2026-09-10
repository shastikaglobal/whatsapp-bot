import pool from '../config/db.js';
import { sendWhatsAppMessage } from '../services/whatsappService.js';
import crypto from 'crypto';

export const getConversations = async (req, res) => {
  try {
    const { rows: rows } = await pool.query(`
      SELECT c.*, cust.name as customer_name, cust.phone as customer_phone 
      FROM conversations c
      JOIN customers cust ON c.customer_id = cust.id
      ORDER BY c.updated_at DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { rows: rows } = await pool.query('SELECT * FROM messages WHERE customer_id = $1 ORDER BY timestamp ASC', [conversationId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { customerId, content } = req.body;
    
    // Get customer phone
    const { rows: custRows } = await pool.query('SELECT phone FROM customers WHERE id = $1', [customerId]);
    if (custRows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    
    const phone = custRows[0].phone;
    
    // Send via WhatsApp API
    await sendWhatsAppMessage(phone, content);
    
    // Save to DB
    const msgId = `msg_${crypto.randomUUID()}`;
    await pool.query(
      'INSERT INTO messages (id, customer_id, sender, content) VALUES ($1, $2, $3, $4)',
      [msgId, customerId, 'human', content]
    );
    
    // We update conversation
    await pool.query('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE customer_id = $1', [customerId]);
    
    res.json({ success: true, message: 'Message sent' });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const toggleTakeover = async (req, res) => {
  try {
    const { customerId, status } = req.body; // 'handover' or 'open'
    await pool.query('UPDATE conversations SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE customer_id = $2', [status, customerId]);
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

import pool from '../config/db.js';

/**
 * Returns pending human handover requests for real-time notifications.
 * Filtered by BDE assignment if the user is a BDE.
 */
export const getHandoverNotifications = async (req, res) => {
  try {
    const isBde = String(req.user?.role || '').toLowerCase() === 'bde';
    let query = `
      SELECT 
        c.id as conversation_id,
        c.customer_id,
        c.status as conversation_status,
        c.requires_admin_attention,
        c.updated_at,
        cust.name as customer_name,
        cust.phone as customer_phone,
        cust.intent,
        cust.is_important,
        cust.assigned_bde_id,
        e.name as assigned_bde_name,
        (
          SELECT m.content 
          FROM messages m 
          WHERE m.customer_id = cust.id 
          ORDER BY m.timestamp DESC 
          LIMIT 1
        ) as last_message,
        (
          SELECT m.timestamp 
          FROM messages m 
          WHERE m.customer_id = cust.id 
          ORDER BY m.timestamp DESC 
          LIMIT 1
        ) as last_message_time
      FROM conversations c
      JOIN customers cust ON c.customer_id = cust.id
      LEFT JOIN employees e ON cust.assigned_bde_id = e.id
      WHERE (c.status = 'handover' OR c.requires_admin_attention = true OR cust.intent = 'Human Request')
    `;
    const params = [];

    // BDE can only see requests assigned to them or unassigned
    if (isBde && req.user?.id) {
      query += ` AND (cust.assigned_bde_id = $1 OR cust.assigned_bde_id IS NULL) `;
      params.push(req.user.id);
    }

    query += ` ORDER BY c.updated_at DESC LIMIT 30`;

    const { rows } = await pool.query(query, params);

    // Also get handover_notify_numbers from bot_settings
    const { rows: settingRows } = await pool.query(
      "SELECT setting_value FROM bot_settings WHERE setting_key = 'handover_notify_numbers'"
    );
    const alertNumbers = settingRows[0]?.setting_value || '';

    res.json({
      count: rows.length,
      notifications: rows,
      alertNumbers
    });
  } catch (error) {
    console.error('[Notification Controller] getHandoverNotifications error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Dismisses a notification or clears admin attention for a customer
 */
export const dismissHandoverNotification = async (req, res) => {
  try {
    const { customerId } = req.body;
    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    await pool.query(
      'UPDATE conversations SET requires_admin_attention = false WHERE customer_id = $1',
      [customerId]
    );

    res.json({ success: true, message: 'Notification dismissed' });
  } catch (error) {
    console.error('[Notification Controller] dismissHandoverNotification error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Fetches the WhatsApp alert phone numbers configured for human handover
 */
export const getAlertNumber = async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT setting_value FROM bot_settings WHERE setting_key = 'handover_notify_numbers'"
    );
    res.json({ alertNumbers: rows[0]?.setting_value || '' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Updates the WhatsApp alert phone numbers for human handover
 */
export const updateAlertNumber = async (req, res) => {
  try {
    const { alertNumbers } = req.body;
    const cleanNumbers = (alertNumbers || '').trim();

    await pool.query(
      `INSERT INTO bot_settings (setting_key, setting_value, description)
       VALUES ('handover_notify_numbers', $1, 'Comma-separated WhatsApp phone numbers for human handover alerts')
       ON CONFLICT (setting_key) DO UPDATE SET setting_value = $1`,
      [cleanNumbers]
    );

    res.json({ success: true, alertNumbers: cleanNumbers, message: 'Alert numbers updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

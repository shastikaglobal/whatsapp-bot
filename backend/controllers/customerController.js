import pool from '../config/db.js';

export const getCustomers = async (req, res) => {
  try {
    const isBde = String(req.user?.role || '').toLowerCase() === 'bde';
    let query = `
      SELECT c.*, c.lastmessage as "lastMessage", e.name as assigned_bde_name,
             conv.status as conv_status, conv.requires_admin_attention as conv_requires_attention
      FROM customers c
      LEFT JOIN employees e ON c.assigned_bde_id = e.id
      LEFT JOIN LATERAL (
        SELECT status, requires_admin_attention
        FROM conversations
        WHERE customer_id = c.id
        ORDER BY updated_at DESC
        LIMIT 1
      ) conv ON true
    `;
    const params = [];

    // BDE can see only customers assigned to them or unassigned
    if (isBde && req.user?.id) {
      query += ` WHERE (c.assigned_bde_id = $1 OR c.assigned_bde_id IS NULL) `;
      params.push(req.user.id);
    }

    query += ` ORDER BY c.created_at DESC`;

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error("GET CUSTOMERS ERROR:", error);
    res.status(500).json({ error: error.message || String(error) });
  }
};

export const getCustomerById = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Customer not found' });
    
    const isBde = String(req.user?.role || '').toLowerCase() === 'bde';
    if (isBde && req.user?.id && rows[0].assigned_bde_id && Number(rows[0].assigned_bde_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Access denied: Customer assigned to another BDE' });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createCustomer = async (req, res) => {
  const { id, name, phone, country, language, lastMessage, status, email, notes } = req.body;
  try {
    await pool.query(
      'INSERT INTO customers (id, name, phone, country, language, lastMessage, status, email, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [id, name, phone, country, language, lastMessage, status, email, notes]
    );

    // Create an empty conversation so the customer shows up in the WhatsApp Inbox
    // (id is SERIAL, so we let PostgreSQL generate it automatically)
    await pool.query(
      'INSERT INTO conversations (customer_id, status) VALUES ($1, $2)',
      [id, 'open']
    );

    res.status(201).json({ message: 'Customer created successfully', id });
  } catch (error) {
    console.error("CREATE CUSTOMER ERROR:", error);
    
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Customer with this phone number already exists.' });
    }

    res.status(500).json({ error: error.message, code: error.code });
  }
};

export const updateCustomer = async (req, res) => {
  const { name, phone, country, language, lastMessage, status, email, notes } = req.body;
  try {
    const isBde = String(req.user?.role || '').toLowerCase() === 'bde';
    if (isBde && req.user?.id) {
      const { rows } = await pool.query('SELECT assigned_bde_id FROM customers WHERE id = $1', [req.params.id]);
      if (rows.length > 0 && rows[0].assigned_bde_id && Number(rows[0].assigned_bde_id) !== Number(req.user.id)) {
        return res.status(403).json({ error: 'Access denied: Customer assigned to another BDE' });
      }
    }
    await pool.query(
      'UPDATE customers SET name = $1, phone = $2, country = $3, language = $4, lastMessage = $5, status = $6, email = $7, notes = $8 WHERE id = $9',
      [name, phone, country, language, lastMessage, status, email, notes, req.params.id]
    );
    res.json({ message: 'Customer updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteCustomer = async (req, res) => {
  try {
    await pool.query('DELETE FROM customers WHERE id = $1', [req.params.id]);
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const assignBDE = async (req, res) => {
  const { id } = req.params;
  const { assigned_bde_id } = req.body;
  try {
    await pool.query(
      'UPDATE customers SET assigned_bde_id = $1 WHERE id = $2',
      [assigned_bde_id, id]
    );
    res.json({ message: 'BDE assigned successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getTestDataPreview = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT 
         c.id, 
         c.name, 
         c.phone, 
         c.created_at,
         COUNT(m.id) AS message_count
       FROM customers c
       LEFT JOIN messages m ON m.customer_id = c.id
       WHERE c.id LIKE 'cust_test%'
          OR c.id LIKE 'cust_live%'
          OR c.id LIKE 'cust_sender_tag_test%'
          OR c.id LIKE 'cust_test_rr%'
          OR c.name IN ('Live Tester', 'Live Verification Customer', 'English Test User', 'Customer of BDE Alpha', 'Customer of BDE Beta')
       GROUP BY c.id, c.name, c.phone, c.created_at
       ORDER BY c.created_at DESC`
    );

    res.json({
      success: true,
      count: rows.length,
      testCustomers: rows
    });
  } catch (error) {
    console.error('getTestDataPreview error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

export const cleanupTestData = async (req, res) => {
  try {
    const { customerIds } = req.body || {};

    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return res.status(400).json({ error: 'No customer IDs provided for cleanup.' });
    }

    // Safety filter: Only allow deleting IDs that strictly match known test criteria
    const { rows: verifiedRows } = await pool.query(
      `SELECT id FROM customers 
       WHERE id = ANY($1) 
         AND (
           id LIKE 'cust_test%'
           OR id LIKE 'cust_live%'
           OR id LIKE 'cust_sender_tag_test%'
           OR id LIKE 'cust_test_rr%'
           OR name IN ('Live Tester', 'Live Verification Customer', 'English Test User', 'Customer of BDE Alpha', 'Customer of BDE Beta')
         )`,
      [customerIds]
    );

    const verifiedIds = verifiedRows.map(r => r.id);
    const deletedCount = verifiedIds.length;

    if (deletedCount > 0) {
      await pool.query('DELETE FROM messages WHERE customer_id = ANY($1)', [verifiedIds]);
      await pool.query('DELETE FROM conversations WHERE customer_id = ANY($1)', [verifiedIds]);
      await pool.query('DELETE FROM customers WHERE id = ANY($1)', [verifiedIds]);
    }

    await pool.query(
      "DELETE FROM messages WHERE content LIKE '%[Live Hardening Verification]%' OR content LIKE '%ping probe%'"
    );

    console.log(`[Admin Action] Test data cleanup completed. Confirmed and deleted ${deletedCount} test customer(s).`);
    res.json({
      success: true,
      deletedCustomers: deletedCount,
      message: `Successfully cleaned up ${deletedCount} confirmed test customer(s) and their message history.`
    });
  } catch (error) {
    console.error('cleanupTestData error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

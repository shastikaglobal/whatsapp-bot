import pool from '../config/db.js';

export const getCustomers = async (req, res) => {
  try {
    const { rows: rows } = await pool.query(`
      SELECT c.*, e.name as assigned_bde_name
      FROM customers c
      LEFT JOIN employees e ON c.assigned_bde_id = e.id
      ORDER BY c.created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error("GET CUSTOMERS ERROR:", error);
    res.status(500).json({ error: error.message || String(error) });
  }
};

export const getCustomerById = async (req, res) => {
  try {
    const { rows: rows } = await pool.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Customer not found' });
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

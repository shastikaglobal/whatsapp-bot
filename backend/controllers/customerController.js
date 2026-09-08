import pool from '../config/db.js';

export const getCustomers = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM customers ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error("GET CUSTOMERS ERROR:", error);
    res.status(500).json({ error: error.message || String(error) });
  }
};

export const getCustomerById = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Customer not found' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createCustomer = async (req, res) => {
  const { id, name, phone, country, language, lastMessage, status } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO customers (id, name, phone, country, language, lastMessage, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, phone, country, language, lastMessage, status]
    );
    res.status(201).json({ message: 'Customer created successfully', id });
  } catch (error) {
    console.error("CREATE CUSTOMER ERROR:", error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Customer with this phone number already exists.' });
    }

    res.status(500).json({ error: error.message, code: error.code });
  }
};

export const updateCustomer = async (req, res) => {
  const { name, phone, country, language, lastMessage, status } = req.body;
  try {
    await pool.query(
      'UPDATE customers SET name = ?, phone = ?, country = ?, language = ?, lastMessage = ?, status = ? WHERE id = ?',
      [name, phone, country, language, lastMessage, status, req.params.id]
    );
    res.json({ message: 'Customer updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteCustomer = async (req, res) => {
  try {
    await pool.query('DELETE FROM customers WHERE id = ?', [req.params.id]);
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

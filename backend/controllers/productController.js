import pool from '../config/db.js';

export const getProducts = async (req, res) => {
  try {
    const { rows: rows } = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getProductById = async (req, res) => {
  try {
    const { rows: rows } = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Product not found' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createProduct = async (req, res) => {
  const { id, name, category, description, price, moq, availability, shippingInfo } = req.body;
  try {
    await pool.query(
      'INSERT INTO products (id, name, category, description, price, moq, availability, shippingInfo) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [id, name, category, description, price, moq, availability, shippingInfo]
    );
    res.status(201).json({ message: 'Product created successfully', id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateProduct = async (req, res) => {
  const { name, category, description, price, moq, availability, shippingInfo } = req.body;
  try {
    await pool.query(
      'UPDATE products SET name = $1, category = $2, description = $3, price = $4, moq = $5, availability = $6, shippingInfo = $7 WHERE id = $8',
      [name, category, description, price, moq, availability, shippingInfo, req.params.id]
    );
    res.json({ message: 'Product updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

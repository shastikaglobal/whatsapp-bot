import pool from '../config/db.js';

export const getRules = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM auto_reply_rules ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createRule = async (req, res) => {
  const { keyword, reply_text, is_active } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO auto_reply_rules (keyword, reply_text, is_active) VALUES (?, ?, ?)',
      [keyword, reply_text, is_active !== undefined ? is_active : true]
    );
    res.status(201).json({ message: 'Rule created successfully', id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateRule = async (req, res) => {
  const { keyword, reply_text, is_active } = req.body;
  try {
    await pool.query(
      'UPDATE auto_reply_rules SET keyword = ?, reply_text = ?, is_active = ? WHERE id = ?',
      [keyword, reply_text, is_active, req.params.id]
    );
    res.json({ message: 'Rule updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteRule = async (req, res) => {
  try {
    await pool.query('DELETE FROM auto_reply_rules WHERE id = ?', [req.params.id]);
    res.json({ message: 'Rule deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

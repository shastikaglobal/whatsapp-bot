import pool from '../config/db.js';

export const getRules = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM auto_reply_rules ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error('getRules error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

export const createRule = async (req, res) => {
  const { keyword, reply_text, is_active } = req.body;
  if (!keyword || !reply_text) {
    return res.status(400).json({ error: 'Keyword and reply text are required.' });
  }

  try {
    const { rows } = await pool.query(
      'INSERT INTO auto_reply_rules (keyword, reply_text, is_active) VALUES ($1, $2, $3) RETURNING id',
      [keyword.trim(), reply_text.trim(), is_active !== undefined ? is_active : true]
    );
    res.status(201).json({ message: 'Rule created successfully', id: rows[0].id });
  } catch (error) {
    console.error('createRule error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

export const updateRule = async (req, res) => {
  const { keyword, reply_text, is_active } = req.body;
  if (!keyword || !reply_text) {
    return res.status(400).json({ error: 'Keyword and reply text are required.' });
  }

  try {
    const result = await pool.query(
      'UPDATE auto_reply_rules SET keyword = $1, reply_text = $2, is_active = $3 WHERE id = $4',
      [keyword.trim(), reply_text.trim(), is_active, req.params.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    res.json({ message: 'Rule updated successfully' });
  } catch (error) {
    console.error('updateRule error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

export const deleteRule = async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM auto_reply_rules WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    res.json({ message: 'Rule deleted successfully' });
  } catch (error) {
    console.error('deleteRule error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

import pool from '../config/db.js';

export const getHolidays = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM holidays ORDER BY date ASC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createHoliday = async (req, res) => {
  const { id, name, date, enabled } = req.body;
  try {
    await pool.query(
      'INSERT INTO holidays (id, name, date, enabled) VALUES (?, ?, ?, ?)',
      [id, name, date, enabled]
    );
    res.status(201).json({ message: 'Holiday created successfully', id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateHoliday = async (req, res) => {
  const { name, date, enabled } = req.body;
  try {
    await pool.query(
      'UPDATE holidays SET name = ?, date = ?, enabled = ? WHERE id = ?',
      [name, date, enabled, req.params.id]
    );
    res.json({ message: 'Holiday updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteHoliday = async (req, res) => {
  try {
    await pool.query('DELETE FROM holidays WHERE id = ?', [req.params.id]);
    res.json({ message: 'Holiday deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

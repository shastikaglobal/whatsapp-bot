import pool from '../config/db.js';
import bcrypt from 'bcrypt';

export const getEmployees = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, username, role, status, created_at FROM employees ORDER BY id ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
};

export const getActiveBDEs = async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, role, status FROM employees WHERE role = 'BDE' AND status = 'Active' ORDER BY name ASC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch BDEs' });
  }
};

export const createEmployee = async (req, res) => {
  const { name, username, password, role, status } = req.body;
  try {
    const password_hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO employees (name, username, password_hash, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, username, role, status',
      [name, username, password_hash, role, status || 'Active']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Failed to create employee' });
  }
};

export const updateEmployee = async (req, res) => {
  const { id } = req.params;
  const { name, username, password, role, status } = req.body;
  try {
    let query = 'UPDATE employees SET name = $1, username = $2, role = $3, status = $4';
    const params = [name, username, role, status];
    
    if (password) {
      const password_hash = await bcrypt.hash(password, 10);
      query += ', password_hash = $5 WHERE id = $6 RETURNING id, name, username, role, status';
      params.push(password_hash, id);
    } else {
      query += ' WHERE id = $5 RETURNING id, name, username, role, status';
      params.push(id);
    }
    
    const { rows } = await pool.query(query, params);
    if (rows.length === 0) return res.status(404).json({ error: 'Employee not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update employee' });
  }
};

export const updateEmployeeStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE employees SET status = $1 WHERE id = $2 RETURNING id, name, username, role, status',
      [status, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Employee not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update employee status' });
  }
};

export const deleteEmployee = async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM employees WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Employee not found' });
    res.json({ message: 'Employee deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
};

import pool from './config/db.js';
import bcrypt from 'bcrypt';

async function resetPass() {
  try {
    const hash = await bcrypt.hash('Shastika@2025', 10);
    await pool.query('UPDATE employees SET password_hash = $1 WHERE username = $2', [hash, 'admin']);
    console.log('Password reset to Shastika@2025');
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

resetPass();

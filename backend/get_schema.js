import pool from './config/db.js';
async function run() {
  const [rows] = await pool.query('DESCRIBE customers');
  console.log("CUSTOMERS:", rows);
  const [rows2] = await pool.query('DESCRIBE conversations');
  console.log("CONVERSATIONS:", rows2);
  process.exit(0);
}
run();

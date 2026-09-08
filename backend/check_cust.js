import pool from './config/db.js';
async function run() {
  const [rows] = await pool.query('SELECT * FROM customers WHERE phone = "1234567890"');
  console.log("CUSTOMERS:", rows);
  process.exit(0);
}
run();

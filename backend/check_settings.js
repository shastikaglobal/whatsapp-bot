import pool from './config/db.js';
async function run() {
  const [rows] = await pool.query('SELECT * FROM bot_settings');
  console.log(rows);
  process.exit(0);
}
run();

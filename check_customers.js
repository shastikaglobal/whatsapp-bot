import pool from './backend/config/db.js';
pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'customers'").then(res => {
  console.log(res.rows);
  process.exit();
}).catch(console.error);

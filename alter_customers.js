import pool from './backend/config/db.js';
pool.query(`
  ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS notes TEXT
`).then(() => {
  console.log("Columns added successfully");
  process.exit();
}).catch(console.error);

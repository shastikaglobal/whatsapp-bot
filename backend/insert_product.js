import pool from './config/db.js';

async function check() {
  await pool.query(
    'INSERT IGNORE INTO products (id, name, category, description, price, moq, availability, shippingInfo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ['prod_coco_01', 'Tender Coconut', 'Agricultural', 'Fresh export-quality tender coconuts', 1.50, 1000, 'In Stock', 'FOB']
  );
  console.log("Inserted coconut");
  process.exit(0);
}
check();

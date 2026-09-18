import pool from './config/db.js';
import bcrypt from 'bcrypt';

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('1. Creating employees table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        username VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('Admin', 'BDE')),
        status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'On Leave')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;
      CREATE TRIGGER update_employees_updated_at
          BEFORE UPDATE ON employees
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
    `);

    console.log('2. Adding columns to customers...');
    await client.query(`
      ALTER TABLE customers 
      ADD COLUMN IF NOT EXISTS assigned_bde_id INT REFERENCES employees(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS intent VARCHAR(100),
      ADD COLUMN IF NOT EXISTS is_important BOOLEAN DEFAULT FALSE;
    `);

    console.log('3. Adding requires_admin_attention to conversations...');
    await client.query(`
      ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS requires_admin_attention BOOLEAN DEFAULT FALSE;
    `);

    console.log('4. Seeding default Admin user...');
    const adminRes = await client.query('SELECT * FROM employees WHERE username = $1', ['admin']);
    if (adminRes.rows.length === 0) {
      const defaultPassword = process.env.ADMIN_PASSWORD || 'Shastika@2025';
      const passwordHash = await bcrypt.hash(defaultPassword, 10);
      await client.query(`
        INSERT INTO employees (name, username, password_hash, role, status)
        VALUES ($1, $2, $3, $4, $5)
      `, ['Administrator', 'admin', passwordHash, 'Admin', 'Active']);
      console.log('Admin user seeded successfully.');
    } else {
      console.log('Admin user already exists.');
    }

    await client.query('COMMIT');
    console.log('Migration completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
  } finally {
    client.release();
    pool.end();
  }
}

runMigration();

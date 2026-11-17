import pool from './config/db.js';

export async function runBdeMigration() {
  try {
    console.log('[Migration] Applying BDE role & sender column widening...');
    await pool.query('ALTER TABLE messages ALTER COLUMN sender TYPE VARCHAR(100)');
    await pool.query('ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_check');
    await pool.query('ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check');
    await pool.query("ALTER TABLE employees ADD CONSTRAINT employees_role_check CHECK (LOWER(role) IN ('admin', 'bde'))");
    console.log('[Migration] Migration applied successfully.');
  } catch (err) {
    console.error('[Migration Error]:', err.message);
  }
}

if (process.argv[1]?.endsWith('apply_bde_migration.js')) {
  runBdeMigration().then(() => pool.end());
}

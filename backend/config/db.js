import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;

// Prevent MySQL default port from breaking the connection
let dbPort = parseInt(process.env.DB_PORT, 10) || 5432;
if (dbPort === 3306) {
  console.warn('⚠️ WARNING: DB_PORT is set to 3306 (MySQL default). Overriding to 5432 for PostgreSQL.');
  dbPort = 5432;
}

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'shastika_whatsapp_bot',
  port: dbPort,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('Unexpected database connection error:', err.message);
});

// Safe, non-destructive schema migration for products.moq and products.updated_at
pool.query(`
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'moq' AND data_type = 'integer'
    ) THEN
      ALTER TABLE products ALTER COLUMN moq TYPE VARCHAR(100) USING moq::text;
    END IF;
  END $$;
  ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
`).catch(err => {
  console.warn('[DB Schema Migration Notice]:', err.message);
});

// Safe, idempotent schema migration for conversations.handover_started_at
pool.query(`
  ALTER TABLE conversations ADD COLUMN IF NOT EXISTS handover_started_at TIMESTAMP WITH TIME ZONE;
  UPDATE conversations SET handover_started_at = updated_at WHERE status = 'handover' AND handover_started_at IS NULL;
`).catch(err => {
  console.warn('[DB Schema Migration Notice]:', err.message);
});

// Safe, idempotent schema migration for messages.failure_reason and fast index
pool.query(`
  ALTER TABLE messages ADD COLUMN IF NOT EXISTS failure_reason TEXT;
  CREATE INDEX IF NOT EXISTS idx_messages_customer_timestamp ON messages (customer_id, timestamp ASC);
`).catch(err => {
  console.warn('[DB Schema Migration Notice]:', err.message);
});

// Safe, idempotent schema migration for whatsapp_connections (is_default, status, waba_id)
pool.query(`
  ALTER TABLE whatsapp_connections ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
  ALTER TABLE whatsapp_connections ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active';
  ALTER TABLE whatsapp_connections ADD COLUMN IF NOT EXISTS waba_id VARCHAR(100);
  UPDATE whatsapp_connections 
  SET is_default = true 
  WHERE (whatsapp_phone_number LIKE '%9789090920%' OR phone_number_id = '1429324643600789')
    AND NOT EXISTS (SELECT 1 FROM whatsapp_connections WHERE is_default = true);
  UPDATE whatsapp_connections 
  SET status = 'Unverified', connection_status = 'Unverified'
  WHERE access_token LIKE 'YOUR_NEW%' OR access_token = '' OR access_token IS NULL;
`).catch(err => {
  console.warn('[DB Schema Migration Notice]:', err.message);
});

export default pool;

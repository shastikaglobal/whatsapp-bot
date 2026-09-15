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

export default pool;

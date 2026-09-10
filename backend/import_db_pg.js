import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const { Pool } = pg;

async function run() {
    try {
        const pool = new Pool({
            host: process.env.DB_HOST || '127.0.0.1',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'shastika_whatsapp_bot',
            port: parseInt(process.env.DB_PORT, 10) || 5432
        });

        const sql = fs.readFileSync(path.join(__dirname, 'database_pg.sql'), 'utf-8');
        await pool.query(sql);
        console.log('PostgreSQL Database initialized successfully.');
        await pool.end();
        process.exit(0);
    } catch (err) {
        console.error('Failed to initialize PostgreSQL database:', err);
        process.exit(1);
    }
}
run();

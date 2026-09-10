import pool from './backend/config/db.js';

async function run() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_connections (
                id VARCHAR(50) PRIMARY KEY,
                display_name VARCHAR(255) NOT NULL,
                whatsapp_phone_number VARCHAR(50) NOT NULL,
                phone_number_id VARCHAR(50) NOT NULL UNIQUE,
                meta_app_id VARCHAR(100),
                access_token TEXT NOT NULL,
                bot_enabled BOOLEAN DEFAULT TRUE,
                connection_status VARCHAR(50) DEFAULT 'Connected',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('Table created successfully');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();

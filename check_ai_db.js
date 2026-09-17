import pool from './backend/config/db.js';
async function run() {
    const c = await pool.query('SELECT * FROM whatsapp_connections');
    console.log("whatsapp_connections:", c.rows);
    const s = await pool.query('SELECT * FROM bot_settings');
    console.log("bot_settings:", s.rows);
    process.exit();
}
run();

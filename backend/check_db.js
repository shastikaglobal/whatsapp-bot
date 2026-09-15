import pool from './config/db.js';

async function check() {
  const { rows: convs } = await pool.query('SELECT * FROM conversations');
  console.log("Conversations:", convs);
  
  const { rows: settings } = await pool.query("SELECT * FROM bot_settings WHERE setting_key = 'auto_reply_enabled'");
  console.log("Auto Reply Enabled Setting:", settings);
  
  process.exit(0);
}
check();

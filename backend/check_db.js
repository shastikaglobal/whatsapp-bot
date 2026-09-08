import pool from './config/db.js';

async function check() {
  const [convs] = await pool.query('SELECT * FROM conversations');
  console.log("Conversations:", convs);
  
  const [settings] = await pool.query('SELECT * FROM bot_settings WHERE setting_key = "auto_reply_enabled"');
  console.log("Auto Reply Enabled Setting:", settings);
  
  process.exit(0);
}
check();

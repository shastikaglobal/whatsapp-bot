import pool from './config/db.js';

async function seedSettings() {
  try {
    const res = await pool.query(
      `INSERT INTO bot_settings (setting_key, setting_value, description)
       VALUES ('handover_notify_numbers', '', 'Comma-separated WhatsApp phone numbers to notify on customer human handover request')
       ON CONFLICT (setting_key) DO NOTHING
       RETURNING *`
    );
    console.log('[Seed] Setting handover_notify_numbers:', res.rows.length > 0 ? 'Inserted' : 'Already exists');
  } catch (err) {
    console.error('[Seed Error]:', err.message);
  } finally {
    await pool.end();
  }
}

seedSettings();


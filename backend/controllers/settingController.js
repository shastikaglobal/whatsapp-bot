import pool from '../config/db.js';

export const getSettings = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT setting_key, setting_value, description FROM bot_settings');
    // Convert to a simple key-value object for easier frontend consumption
    const settings = {};
    const sensitiveKeys = ['ai_api_key', 'whatsapp_access_token'];

    rows.forEach(row => {
      let val = row.setting_value;
      if (sensitiveKeys.includes(row.setting_key) && val && val.length > 8) {
        val = val.substring(0, 4) + '...[HIDDEN]...' + val.substring(val.length - 4);
      }
      settings[row.setting_key] = val;
    });
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateSettings = async (req, res) => {
  const settings = req.body;
  const sensitiveKeys = ['ai_api_key', 'whatsapp_access_token'];

  try {
    // Loop through the provided settings and update them
    for (const [key, value] of Object.entries(settings)) {
      // Do not update the DB if the frontend sent back the masked string
      if (sensitiveKeys.includes(key) && typeof value === 'string' && value.includes('...[HIDDEN]...')) {
        continue;
      }
      await pool.query(
        'INSERT INTO bot_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
        [key, value, value]
      );
    }
    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

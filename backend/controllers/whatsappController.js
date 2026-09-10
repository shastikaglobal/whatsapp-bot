import pool from '../config/db.js';
import axios from 'axios';
import crypto from 'crypto';

export const getConfig = async (req, res) => {
  try {
    const { rows: rows } = await pool.query('SELECT * FROM whatsapp_connections ORDER BY created_at DESC');
    
    // Mask the access token for security
    const configs = rows.map(row => {
      let maskedToken = row.access_token;
      if (maskedToken && maskedToken.length > 10) {
        maskedToken = maskedToken.substring(0, 4) + '...[HIDDEN]...' + maskedToken.substring(maskedToken.length - 4);
      }
      return { ...row, access_token: maskedToken };
    });

    res.json(configs);
  } catch (error) {
    console.error('Failed to get WhatsApp configs:', error);
    res.status(500).json({ error: 'Failed to retrieve WhatsApp configurations.' });
  }
};

export const addConfig = async (req, res) => {
  try {
    const { display_name, meta_app_id, whatsapp_phone_number_id, whatsapp_phone_number, whatsapp_access_token } = req.body;

    if (!display_name || !whatsapp_phone_number_id || !whatsapp_phone_number || !whatsapp_access_token) {
        return res.status(400).json({ error: 'Required fields are missing.' });
    }

    const id = `conn_${crypto.randomUUID()}`;

    await pool.query(
      'INSERT INTO whatsapp_connections (id, display_name, meta_app_id, phone_number_id, whatsapp_phone_number, access_token) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, display_name, meta_app_id, whatsapp_phone_number_id, whatsapp_phone_number, whatsapp_access_token]
    );

    res.json({ message: 'WhatsApp connection added successfully.', id });
  } catch (error) {
    console.error('Failed to add WhatsApp config:', error);
    if (error.code === '23505') {
        res.status(400).json({ error: 'This Phone Number ID is already configured.' });
    } else {
        res.status(500).json({ error: 'Failed to add WhatsApp configuration.' });
    }
  }
};

export const updateConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const { display_name, meta_app_id, whatsapp_phone_number_id, whatsapp_phone_number, whatsapp_access_token } = req.body;

    if (!display_name || !whatsapp_phone_number_id || !whatsapp_phone_number) {
        return res.status(400).json({ error: 'Required fields are missing.' });
    }

    let query = 'UPDATE whatsapp_connections SET display_name = $1, meta_app_id = $2, phone_number_id = $3, whatsapp_phone_number = $4';
    let params = [display_name, meta_app_id, whatsapp_phone_number_id, whatsapp_phone_number];

    if (whatsapp_access_token && !whatsapp_access_token.includes('...[HIDDEN]...')) {
        query += ', access_token = $5';
        params.push(whatsapp_access_token);
    }

    query += ` WHERE id = $${params.length + 1}`;
    params.push(id);

    const result = await pool.query(query, params);

    if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Connection not found.' });
    }

    res.json({ message: 'WhatsApp connection updated successfully.' });
  } catch (error) {
    console.error('Failed to update WhatsApp config:', error);
    if (error.code === '23505') {
        res.status(400).json({ error: 'This Phone Number ID is already configured on another connection.' });
    } else {
        res.status(500).json({ error: 'Failed to update WhatsApp configuration.' });
    }
  }
};

export const deleteConfig = async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query('DELETE FROM whatsapp_connections WHERE id = $1', [id]);
      res.json({ message: 'Connection deleted successfully' });
    } catch (error) {
      console.error('Failed to delete connection:', error);
      res.status(500).json({ error: error.message });
    }
  };

export const toggleBotStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { bot_enabled } = req.body;

        await pool.query('UPDATE whatsapp_connections SET bot_enabled = $1 WHERE id = $2', [bot_enabled, id]);
        res.json({ message: 'Bot status updated successfully' });
    } catch (error) {
        console.error('Failed to update bot status:', error);
        res.status(500).json({ error: error.message });
    }
};

export const testConnection = async (req, res) => {
  try {
    let { id, whatsapp_phone_number_id, whatsapp_access_token } = req.body;

    if (id && (!whatsapp_access_token || whatsapp_access_token.includes('...[HIDDEN]...'))) {
        const { rows: rows } = await pool.query('SELECT access_token, phone_number_id FROM whatsapp_connections WHERE id = $1', [id]);
        if (rows.length > 0) {
            whatsapp_access_token = rows[0].access_token;
            if (!whatsapp_phone_number_id) {
                whatsapp_phone_number_id = rows[0].phone_number_id;
            }
        }
    }

    if (!whatsapp_phone_number_id || !whatsapp_access_token) {
      return res.status(400).json({ error: 'Phone Number ID and Access Token are required to test connection.' });
    }

    // Call Meta Graph API to verify credentials
    const response = await axios.get(`https://graph.facebook.com/v19.0/${whatsapp_phone_number_id}`, {
      headers: {
        'Authorization': `Bearer ${whatsapp_access_token}`
      }
    });

    if (response.data && response.data.id) {
        // Update connection status if we tested an existing ID
        if (id) {
            await pool.query("UPDATE whatsapp_connections SET connection_status = 'Connected' WHERE id = $1", [id]);
        }
        res.json({ success: true, message: 'Connection successful. Meta API verified.' });
    } else {
        if (id) {
            await pool.query("UPDATE whatsapp_connections SET connection_status = 'Error' WHERE id = $1", [id]);
        }
        res.status(400).json({ error: 'Invalid response from Meta API.' });
    }
  } catch (error) {
    console.error('WhatsApp connection test failed:', error.response?.data || error.message);
    const errorMessage = error.response?.data?.error?.message || 'Failed to connect to Meta API. Please check your credentials.';
    if (req.body.id) {
        await pool.query("UPDATE whatsapp_connections SET connection_status = 'Error' WHERE id = $1", [req.body.id]);
    }
    res.status(400).json({ error: errorMessage });
  }
};

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
    let { display_name, meta_app_id, phone_number_id, whatsapp_phone_number, access_token, bot_enabled } = req.body;

    if (!display_name || !phone_number_id || !whatsapp_phone_number || !access_token) {
        return res.status(400).json({ error: 'Required fields are missing.' });
    }

    if (bot_enabled === undefined) {
        bot_enabled = true;
    }

    const id = `conn_${crypto.randomUUID()}`;

    await pool.query(
      'INSERT INTO whatsapp_connections (id, display_name, meta_app_id, phone_number_id, whatsapp_phone_number, access_token, bot_enabled) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, display_name, meta_app_id, phone_number_id, whatsapp_phone_number, access_token, bot_enabled]
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
    const { display_name, meta_app_id, phone_number_id, whatsapp_phone_number, access_token, bot_enabled } = req.body;

    if (!display_name || !phone_number_id || !whatsapp_phone_number) {
        return res.status(400).json({ error: 'Required fields are missing.' });
    }

    let query = 'UPDATE whatsapp_connections SET display_name = $1, meta_app_id = $2, phone_number_id = $3, whatsapp_phone_number = $4';
    let params = [display_name, meta_app_id, phone_number_id, whatsapp_phone_number];

    if (bot_enabled !== undefined) {
        query += `, bot_enabled = $${params.length + 1}`;
        params.push(bot_enabled);
    }

    if (access_token && !access_token.includes('...[HIDDEN]...')) {
        query += `, access_token = $${params.length + 1}`;
        params.push(access_token);
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

    console.log('[DEBUG] testConnection request body fields:', Object.keys(req.body));
    console.log('[DEBUG] testConnection connection ID:', id);

    if (id && (!whatsapp_access_token || whatsapp_access_token.includes('...[HIDDEN]...'))) {
        const { rows: rows } = await pool.query('SELECT access_token, phone_number_id FROM whatsapp_connections WHERE id = $1', [id]);
        console.log('[DEBUG] testConnection DB lookup success:', rows.length > 0);
        if (rows.length > 0) {
            whatsapp_access_token = rows[0].access_token;
            if (!whatsapp_phone_number_id) {
                whatsapp_phone_number_id = rows[0].phone_number_id;
            }
        }
    }

    console.log('[DEBUG] testConnection Phone Number ID exists:', !!whatsapp_phone_number_id);
    console.log('[DEBUG] testConnection access token exists:', !!whatsapp_access_token);

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
    
    let errorMessage = 'Failed to connect to Meta API. Please check your credentials.';
    if (error.response?.data?.error?.message) {
        const metaError = error.response.data.error.message;
        if (metaError.includes('Cannot parse access token') || metaError.includes('Invalid OAuth access token')) {
            errorMessage = 'Invalid Access Token: Please use a real Meta API access token instead of fake/placeholder credentials.';
        } else {
            errorMessage = `Meta API Error: ${metaError}`;
        }
    }

    if (req.body.id) {
        await pool.query("UPDATE whatsapp_connections SET connection_status = 'Error' WHERE id = $1", [req.body.id]);
    }
    
    // Instead of throwing a hard 400 error which shows up as a console error,
    // we return a 200 with success: false for authentication failures, which the frontend handles.
    res.status(200).json({ success: false, error: errorMessage });
  }
};

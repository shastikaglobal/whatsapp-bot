import pool from '../config/db.js';
import axios from 'axios';
import crypto from 'crypto';

const GRAPH_API_VERSION = 'v21.0';

export const getConfig = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM whatsapp_connections ORDER BY created_at DESC');

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
    console.error('Failed to get WhatsApp configs:', error.message);
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
      [id, display_name.trim(), meta_app_id?.trim() || null, phone_number_id.trim(), whatsapp_phone_number.trim(), access_token.trim(), bot_enabled]
    );

    res.json({ message: 'WhatsApp connection added successfully.', id });
  } catch (error) {
    console.error('Failed to add WhatsApp config:', error.message);
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
    let params = [display_name.trim(), meta_app_id?.trim() || null, phone_number_id.trim(), whatsapp_phone_number.trim()];

    if (bot_enabled !== undefined) {
      query += `, bot_enabled = $${params.length + 1}`;
      params.push(bot_enabled);
    }

    if (access_token && !access_token.includes('...[HIDDEN]...')) {
      query += `, access_token = $${params.length + 1}`;
      params.push(access_token.trim());
    }

    query += ` WHERE id = $${params.length + 1}`;
    params.push(id);

    const result = await pool.query(query, params);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Connection not found.' });
    }

    res.json({ message: 'WhatsApp connection updated successfully.' });
  } catch (error) {
    console.error('Failed to update WhatsApp config:', error.message);
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
    const result = await pool.query('DELETE FROM whatsapp_connections WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Connection not found.' });
    }
    res.json({ message: 'Connection deleted successfully' });
  } catch (error) {
    console.error('Failed to delete connection:', error.message);
    res.status(500).json({ error: error.message });
  }
};

export const toggleBotStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { bot_enabled } = req.body;

    const result = await pool.query('UPDATE whatsapp_connections SET bot_enabled = $1 WHERE id = $2', [bot_enabled, id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Connection not found.' });
    }
    res.json({ message: 'Bot status updated successfully' });
  } catch (error) {
    console.error('Failed to update bot status:', error.message);
    res.status(500).json({ error: error.message });
  }
};

export const testConnection = async (req, res) => {
  try {
    let { id, whatsapp_phone_number_id, whatsapp_access_token } = req.body;

    if (id && (!whatsapp_access_token || whatsapp_access_token.includes('...[HIDDEN]...'))) {
      const { rows } = await pool.query('SELECT access_token, phone_number_id FROM whatsapp_connections WHERE id = $1', [id]);
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

    // Call Meta Graph API to verify credentials and verification status
    const response = await axios.get(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${whatsapp_phone_number_id}`,
      {
        headers: {
          'Authorization': `Bearer ${whatsapp_access_token}`
        },
        timeout: 12000
      }
    );

    if (response.data && response.data.id) {
      const isVerified = response.data.code_verification_status === 'VERIFIED';
      const statusString = isVerified ? 'Connected' : 'Unverified';

      if (id) {
        await pool.query('UPDATE whatsapp_connections SET connection_status = $1 WHERE id = $2', [statusString, id]);
      }

      if (isVerified) {
        return res.json({
          success: true,
          message: 'Connection verified with Meta Cloud API. Number is live.',
          details: {
            display_phone_number: response.data.display_phone_number,
            verified_name: response.data.verified_name,
            code_verification_status: response.data.code_verification_status
          }
        });
      } else {
        return res.json({
          success: false,
          error: `Meta API credentials are valid, but number registration status is ${response.data.code_verification_status || 'NOT_VERIFIED'}. Phone number is active in WhatsApp Business app and not yet registered on Cloud API.`,
          details: {
            display_phone_number: response.data.display_phone_number,
            verified_name: response.data.verified_name,
            code_verification_status: response.data.code_verification_status
          }
        });
      }
    } else {
      if (id) {
        await pool.query("UPDATE whatsapp_connections SET connection_status = 'Error' WHERE id = $1", [id]);
      }
      return res.status(400).json({ error: 'Invalid response from Meta API.' });
    }
  } catch (error) {
    const metaError = error.response?.data?.error?.message;
    console.error('[WhatsApp testConnection error]:', metaError || error.message);

    let errorMessage = 'Failed to connect to Meta API. Please check your credentials.';
    if (metaError) {
      if (metaError.includes('Cannot parse access token') || metaError.includes('Invalid OAuth access token')) {
        errorMessage = 'Invalid Access Token: Please check your Meta API access token.';
      } else {
        errorMessage = `Meta API Error: ${metaError}`;
      }
    }

    if (req.body.id) {
      try {
        await pool.query("UPDATE whatsapp_connections SET connection_status = 'Error' WHERE id = $1", [req.body.id]);
      } catch (e) { }
    }

    return res.status(200).json({ success: false, error: errorMessage });
  }
};

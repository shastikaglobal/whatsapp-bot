import pool from '../config/db.js';
import axios from 'axios';
import crypto from 'crypto';
import { resetTokenAlertThrottle } from '../services/whatsappService.js';

const GRAPH_API_VERSION = 'v21.0';

export const maskToken = (token) => {
  if (!token || typeof token !== 'string') return '';
  const trimmed = token.trim();
  if (trimmed.length <= 8) return '****';
  return `${trimmed.substring(0, 4)}...${trimmed.substring(trimmed.length - 4)}`;
};

export const getConfig = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM whatsapp_connections ORDER BY is_default DESC, created_at DESC');

    // Mask the access token for security (first 4 and last 4 characters)
    const configs = rows.map(row => ({
      ...row,
      access_token: maskToken(row.access_token)
    }));

    res.json(configs);
  } catch (error) {
    console.error('Failed to get WhatsApp configs:', error.message);
    res.status(500).json({ error: 'Failed to retrieve WhatsApp configurations.' });
  }
};

export const addConfig = async (req, res) => {
  try {
    let { display_name, meta_app_id, phone_number_id, whatsapp_phone_number, access_token, bot_enabled, waba_id } = req.body;

    if (!display_name || !phone_number_id || !whatsapp_phone_number || !access_token) {
      return res.status(400).json({ error: 'Required fields are missing.' });
    }

    if (bot_enabled === undefined) {
      bot_enabled = true;
    }

    const id = `conn_${crypto.randomUUID()}`;

    await pool.query(
      'INSERT INTO whatsapp_connections (id, display_name, meta_app_id, phone_number_id, whatsapp_phone_number, access_token, bot_enabled, waba_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [id, display_name.trim(), meta_app_id?.trim() || null, phone_number_id.trim(), whatsapp_phone_number.trim(), access_token.trim(), bot_enabled, waba_id?.trim() || null]
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
    const { display_name, meta_app_id, phone_number_id, whatsapp_phone_number, access_token, bot_enabled, waba_id } = req.body;

    if (!display_name || !phone_number_id || !whatsapp_phone_number) {
      return res.status(400).json({ error: 'Required fields are missing.' });
    }

    let query = 'UPDATE whatsapp_connections SET display_name = $1, meta_app_id = $2, phone_number_id = $3, whatsapp_phone_number = $4';
    let params = [display_name.trim(), meta_app_id?.trim() || null, phone_number_id.trim(), whatsapp_phone_number.trim()];

    if (waba_id !== undefined) {
      query += `, waba_id = $${params.length + 1}`;
      params.push(waba_id ? waba_id.trim() : null);
    }

    if (bot_enabled !== undefined) {
      query += `, bot_enabled = $${params.length + 1}`;
      params.push(bot_enabled);
    }

    // Only accept and update access_token when admin provides a real new unmasked token
    let tokenUpdated = false;
    if (access_token && typeof access_token === 'string') {
      const trimmedToken = access_token.trim();
      const isMasked = trimmedToken.includes('...') || trimmedToken.includes('[HIDDEN]') || trimmedToken.includes('****');
      if (!isMasked && trimmedToken.length > 15 && !trimmedToken.startsWith('YOUR_NEW')) {
        query += `, access_token = $${params.length + 1}, status = 'Active', connection_status = 'Connected'`;
        params.push(trimmedToken);
        tokenUpdated = true;
      }
    }

    query += ` WHERE id = $${params.length + 1}`;
    params.push(id);

    const result = await pool.query(query, params);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Connection not found.' });
    }

    // If new token was saved, clear any active Error 190 alert and reset alert throttle
    if (tokenUpdated) {
      await pool.query("DELETE FROM bot_settings WHERE setting_key = 'meta_token_alert_190'");
      resetTokenAlertThrottle();
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

export const setDefaultConnection = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT id, phone_number_id, access_token, status FROM whatsapp_connections WHERE id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Connection not found.' });
    }

    if (rows[0].access_token?.startsWith('YOUR_NEW') || rows[0].status === 'Unverified') {
      return res.status(400).json({ error: 'Cannot set an unverified connection with placeholder credentials as default.' });
    }

    await pool.query('UPDATE whatsapp_connections SET is_default = false');
    await pool.query('UPDATE whatsapp_connections SET is_default = true WHERE id = $1', [id]);

    res.json({ success: true, message: 'Connection set as default successfully.' });
  } catch (error) {
    console.error('Failed to set default connection:', error.message);
    res.status(500).json({ error: 'Failed to set default connection.' });
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

    if (id && (!whatsapp_access_token || whatsapp_access_token.includes('...'))) {
      const { rows } = await pool.query('SELECT access_token, phone_number_id FROM whatsapp_connections WHERE id = $1', [id]);
      if (rows.length > 0) {
        whatsapp_access_token = rows[0].access_token;
        if (!whatsapp_phone_number_id) {
          whatsapp_phone_number_id = rows[0].phone_number_id;
        }
      }
    }

    if (!whatsapp_phone_number_id || !whatsapp_access_token) {
      return res.status(400).json({ success: false, error: 'Phone Number ID and Access Token are required to test connection.' });
    }

    if (whatsapp_access_token.startsWith('YOUR_NEW') || whatsapp_access_token.includes('placeholder')) {
      if (id) {
        await pool.query("UPDATE whatsapp_connections SET connection_status = 'Unverified', status = 'Unverified' WHERE id = $1", [id]);
      }
      return res.status(200).json({
        success: false,
        error: 'Connection is unverified. Token contains placeholder text (YOUR_NEW...). Please update with a valid Meta access token.',
        details: { status: 'Unverified', reason: 'Placeholder Token' }
      });
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
      const connectionStatus = isVerified ? 'Active' : 'Unverified';

      if (id) {
        await pool.query('UPDATE whatsapp_connections SET connection_status = $1, status = $2 WHERE id = $3', [statusString, connectionStatus, id]);
      }

      if (isVerified) {
        await pool.query("DELETE FROM bot_settings WHERE setting_key = 'meta_token_alert_190'");
        resetTokenAlertThrottle();
        return res.json({
          success: true,
          message: 'Connection verified with Meta Cloud API. Number is live.',
          details: {
            display_phone_number: response.data.display_phone_number,
            verified_name: response.data.verified_name,
            code_verification_status: response.data.code_verification_status,
            quality_rating: response.data.quality_rating || 'UNKNOWN'
          }
        });
      } else {
        return res.json({
          success: false,
          error: `Meta API credentials are valid, but number registration status is ${response.data.code_verification_status || 'NOT_VERIFIED'}.`,
          details: {
            display_phone_number: response.data.display_phone_number,
            verified_name: response.data.verified_name,
            code_verification_status: response.data.code_verification_status,
            quality_rating: response.data.quality_rating || 'UNKNOWN'
          }
        });
      }
    } else {
      if (id) {
        await pool.query("UPDATE whatsapp_connections SET connection_status = 'Error', status = 'Error' WHERE id = $1", [id]);
      }
      return res.status(400).json({ success: false, error: 'Invalid response from Meta API.' });
    }
  } catch (error) {
    const metaError = error.response?.data?.error?.message;
    const errorCode = error.response?.data?.error?.code;
    console.error('[WhatsApp testConnection error]:', metaError || error.message);

    let errorMessage = 'Failed to connect to Meta API. Please check your credentials.';
    if (metaError) {
      if (metaError.includes('Cannot parse access token') || metaError.includes('Invalid OAuth access token')) {
        errorMessage = 'Invalid Access Token: Please check your Meta API access token.';
      } else {
        errorMessage = `Meta API Error (${errorCode || 'N/A'}): ${metaError}`;
      }
    }

    if (req.body.id) {
      try {
        await pool.query("UPDATE whatsapp_connections SET connection_status = 'Error', status = 'Error' WHERE id = $1", [req.body.id]);
      } catch (e) { }
    }

    return res.status(200).json({ success: false, error: errorMessage, code: errorCode || null });
  }
};

import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v21.0';

// Token Error 190 Throttle: at most once per hour
let lastTokenAlertWriteTime = 0;
const ONE_HOUR_MS = 60 * 60 * 1000;

export const resetTokenAlertThrottle = () => {
  lastTokenAlertWriteTime = 0;
};

const recordTokenAlert190 = async (phoneNumberId, errorMsg) => {
  console.error('[WhatsApp Security Alert] Meta Access Token has expired or is invalid (Code 190).');
  const now = Date.now();
  if (lastTokenAlertWriteTime > 0 && now - lastTokenAlertWriteTime < ONE_HOUR_MS) {
    // Throttled: do not spam DB alert write within 1 hour
    return;
  }
  lastTokenAlertWriteTime = now;
  try {
    const { default: pool } = await import('../config/db.js');
    if (phoneNumberId) {
      await pool.query(
        "UPDATE whatsapp_connections SET connection_status = 'Token Expired', status = 'Token Expired', updated_at = CURRENT_TIMESTAMP WHERE TRIM(phone_number_id) = $1",
        [String(phoneNumberId).trim()]
      );
    }
    await pool.query(
      "INSERT INTO bot_settings (setting_key, setting_value) VALUES ('meta_token_alert_190', $1) ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value",
      [`Active Error 190: WhatsApp access token expired or invalid (${new Date().toLocaleString()}). Please reconnect in WhatsApp Settings.`]
    );
  } catch (dbErr) {
    console.error('Failed to update token expired alert in DB:', dbErr.message);
  }
};

export const getBaseUrl = (phoneNumberId) => {
  return `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;
};

export const getHeaders = (accessToken) => {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };
};

export const sendWhatsAppMessage = async (to, text, phoneNumberId = null, accessToken = null) => {
  try {
    // If not provided, fallback to matching database connection or default
    if (!phoneNumberId || !accessToken) {
      const { default: pool } = await import('../config/db.js');
      if (phoneNumberId) {
        const { rows } = await pool.query(
          'SELECT phone_number_id, access_token FROM whatsapp_connections WHERE phone_number_id = $1 LIMIT 1',
          [phoneNumberId]
        );
        if (rows.length > 0) {
          accessToken = rows[0].access_token;
        }
      }

      if (!phoneNumberId || !accessToken) {
        const { rows } = await pool.query(
          `SELECT phone_number_id, access_token FROM whatsapp_connections 
           WHERE access_token NOT LIKE 'YOUR_NEW%' 
             AND (status IS NULL OR LOWER(status) != 'unverified')
           ORDER BY CASE WHEN is_default = true THEN 0 ELSE 1 END, created_at ASC 
           LIMIT 1`
        );
        if (rows.length > 0) {
          phoneNumberId = phoneNumberId || rows[0].phone_number_id;
          accessToken = accessToken || rows[0].access_token;
        } else if (process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN) {
          phoneNumberId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
          accessToken = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
        }
      }
    }

    if (!phoneNumberId || !accessToken) {
      return {
        error: true,
        message: 'No WhatsApp credentials configured (Phone Number ID or Access Token missing).'
      };
    }

    // Sanitize destination number (strip +, spaces, hyphens)
    const cleanTo = String(to).replace(/[^0-9]/g, '');
    if (!cleanTo || cleanTo.length < 7) {
      return {
        error: true,
        message: `Invalid recipient phone number: ${to}`
      };
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'text',
      text: {
        preview_url: false,
        body: text
      }
    };

    const response = await axios.post(
      getBaseUrl(phoneNumberId),
      payload,
      {
        headers: getHeaders(accessToken),
        timeout: 15000
      }
    );

    return {
      success: true,
      data: response.data,
      messages: response.data?.messages || []
    };
  } catch (error) {
    const metaError = error.response?.data?.error;
    const errorCode = metaError?.code || error.code || null;
    const errorMsg = metaError?.message || error.message || 'Unknown error occurred';

    // Log safely without exposing access tokens
    console.error(`[WhatsApp API Error] Code ${errorCode || 'N/A'}: ${errorMsg}`);

    // Item 8: Token Error 190 Admin Alert - Flag connection as Token Expired (throttled to 1/hour)
    if (errorCode === 190 || (typeof errorMsg === 'string' && (errorMsg.includes('Error validating access token') || errorMsg.includes('Session has expired')))) {
      await recordTokenAlert190(phoneNumberId, errorMsg);
    }

    return {
      error: true,
      code: errorCode,
      message: `Meta API Error: ${errorMsg}`,
      details: metaError || null
    };
  }
};

/**
 * Sends a WhatsApp pre-approved template message via Meta Cloud API.
 * Required when the 24-hour messaging window is closed.
 */
export const sendWhatsAppTemplate = async (
  to,
  templateName,
  languageCode = 'en_US',
  components = [],
  phoneNumberId = null,
  accessToken = null
) => {
  try {
    // If not provided, fallback to matching database connection or default
    if (!phoneNumberId || !accessToken) {
      const { default: pool } = await import('../config/db.js');
      if (phoneNumberId) {
        const { rows } = await pool.query(
          'SELECT phone_number_id, access_token FROM whatsapp_connections WHERE phone_number_id = $1 LIMIT 1',
          [phoneNumberId]
        );
        if (rows.length > 0) {
          accessToken = rows[0].access_token;
        }
      }

      if (!phoneNumberId || !accessToken) {
        const { rows } = await pool.query(
          `SELECT phone_number_id, access_token FROM whatsapp_connections 
           WHERE access_token NOT LIKE 'YOUR_NEW%' 
             AND (status IS NULL OR LOWER(status) != 'unverified')
           ORDER BY CASE WHEN is_default = true THEN 0 ELSE 1 END, created_at ASC 
           LIMIT 1`
        );
        if (rows.length > 0) {
          phoneNumberId = phoneNumberId || rows[0].phone_number_id;
          accessToken = accessToken || rows[0].access_token;
        } else if (process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN) {
          phoneNumberId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
          accessToken = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
        }
      }
    }

    if (!phoneNumberId || !accessToken) {
      return {
        error: true,
        message: 'No WhatsApp credentials configured (Phone Number ID or Access Token missing).'
      };
    }

    const cleanTo = String(to).replace(/[^0-9]/g, '');
    if (!cleanTo || cleanTo.length < 7) {
      return {
        error: true,
        message: `Invalid recipient phone number: ${to}`
      };
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode || 'en_US'
        },
        ...(components && Array.isArray(components) && components.length > 0 ? { components } : {})
      }
    };

    const response = await axios.post(
      getBaseUrl(phoneNumberId),
      payload,
      {
        headers: getHeaders(accessToken),
        timeout: 15000
      }
    );

    return {
      success: true,
      data: response.data,
      messages: response.data?.messages || []
    };
  } catch (error) {
    const metaError = error.response?.data?.error;
    const errorCode = metaError?.code || error.code || null;
    const errorMsg = metaError?.message || error.message || 'Unknown error occurred';

    console.error(`[WhatsApp API Template Error] Code ${errorCode || 'N/A'}: ${errorMsg}`);

    if (errorCode === 190 || (typeof errorMsg === 'string' && (errorMsg.includes('Error validating access token') || errorMsg.includes('Session has expired')))) {
      await recordTokenAlert190(phoneNumberId, errorMsg);
    }

    return {
      error: true,
      code: errorCode,
      message: `Meta API Error: ${errorMsg}`,
      details: metaError || null
    };
  }
};

import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const GRAPH_API_VERSION = 'v21.0';

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
          'SELECT phone_number_id, access_token FROM whatsapp_connections WHERE bot_enabled = true ORDER BY created_at ASC LIMIT 1'
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
    const errorCode = metaError?.code;
    const errorMsg = metaError?.message || error.message;

    // Log safely without exposing access tokens
    console.error(`[WhatsApp API Error] Code ${errorCode || 'N/A'}: ${errorMsg}`);

    return {
      error: true,
      code: errorCode,
      message: `Meta API Error: ${errorMsg}`,
      details: metaError || null
    };
  }
};

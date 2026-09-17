import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const getBaseUrl = (phoneNumberId) => {
  return `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
};

const getHeaders = (accessToken) => {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };
};

export const sendWhatsAppMessage = async (to, text, phoneNumberId = null, accessToken = null) => {
  try {
    // If not provided, fallback to default connection
    if (!phoneNumberId || !accessToken) {
        const { default: pool } = await import('../config/db.js');
        const { rows: rows } = await pool.query('SELECT phone_number_id, access_token FROM whatsapp_connections LIMIT 1');
        if (rows.length > 0) {
            phoneNumberId = rows[0].phone_number_id;
            accessToken = rows[0].access_token;
        } else if (process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN) {
            phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
            accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        }
    }

    if (!phoneNumberId || !accessToken) {
      throw new Error('No WhatsApp credentials available in Database or Environment Variables');
    }
    
    const response = await axios.post(
      getBaseUrl(phoneNumberId),
      {
        messaging_product: 'whatsapp',
        to: to,
        text: { body: text }
      },
      { headers: getHeaders(accessToken) }
    );
    return response.data;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error.response ? error.response.data : error.message);
    // Return error object instead of throwing to allow local testing to continue
    return { error: true, message: error.message };
  }
};

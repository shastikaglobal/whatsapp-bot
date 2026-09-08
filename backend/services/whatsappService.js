import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const getBaseUrl = () => {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  return `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
};

const getHeaders = () => {
  return {
    'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  };
};

export const sendWhatsAppMessage = async (to, text) => {
  try {
    if (!process.env.WHATSAPP_PHONE_NUMBER_ID || !process.env.WHATSAPP_ACCESS_TOKEN) {
      console.log(`[SIMULATED WhatsApp] To ${to}: ${text}`);
      return { simulated: true };
    }
    const response = await axios.post(
      getBaseUrl(),
      {
        messaging_product: 'whatsapp',
        to: to,
        text: { body: text }
      },
      { headers: getHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error.response ? error.response.data : error.message);
    // Return error object instead of throwing to allow local testing to continue
    return { error: true, message: error.message };
  }
};

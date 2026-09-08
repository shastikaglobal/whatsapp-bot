import axios from 'axios';
import pool from '../config/db.js';

export const generateAiReply = async (customerId, incomingMessage) => {
  let url = '';
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not configured. Falling back to default message.');
      return 'I am currently unable to process your request as my AI is not fully configured.';
    }

    // 1. Fetch recent conversation history for context
    const [messages] = await pool.query(
      'SELECT sender, content FROM messages WHERE customer_id = ? ORDER BY timestamp ASC LIMIT 10',
      [customerId]
    );

    let historyText = '';
    messages.forEach(m => {
      const role = m.sender === 'ai' ? 'Bot' : 'Customer';
      historyText += `${role}: ${m.content}\n`;
    });

    // 2. Fetch available products from DB for context
    const [products] = await pool.query('SELECT name, category, description, price, moq, availability, shippingInfo FROM products');
    
    let productContext = 'Available Products:\n';
    if (products.length === 0) {
      productContext += 'No products available currently.\n';
    } else {
      products.forEach(p => {
        productContext += `- Name: ${p.name}\n  Category: ${p.category}\n  Price: ${p.price}\n  Description: ${p.description}\n  MOQ: ${p.moq}\n  Availability: ${p.availability}\n  Shipping Info: ${p.shippingInfo}\n\n`;
      });
    }

    // 3. Fetch Bot Settings (e.g. Business Name, Fallback message)
    const [settings] = await pool.query('SELECT setting_key, setting_value FROM bot_settings');
    let botContext = '';
    
    const aiModel = settings.find(s => s.setting_key === 'ai_model')?.setting_value || 'gemini-3.6-flash';
    const responseStyle = settings.find(s => s.setting_key === 'ai_response_style')?.setting_value || 'Professional';
    const systemPromptBase = settings.find(s => s.setting_key === 'ai_system_prompt')?.setting_value || 'You are a helpful and polite WhatsApp customer support AI for a business. Your goal is to answer customer questions accurately based ONLY on the provided context below.';
    
    settings.forEach(s => {
      if (!s.setting_key.startsWith('ai_')) {
        botContext += `${s.setting_key}: ${s.setting_value}\n`;
      }
    });

    // 4. Construct System Prompt
    const systemPrompt = `${systemPromptBase}

Required Tone/Style: ${responseStyle}

BUSINESS CONTEXT:
${botContext}

PRODUCT INFORMATION:
${productContext}

RULES:
1. ONLY offer products listed in the PRODUCT INFORMATION section.
2. If a customer asks for a product not in the list, politely inform them it is unavailable and offer human assistance.
3. Keep answers extremely concise and friendly, suitable for WhatsApp.
4. Do not hallucinate prices or details not in the database.

LANGUAGE REQUIREMENT (CRITICAL):
Detect the language used by the customer message and respond in the EXACT same language. 
Never unnecessarily switch to English. 
- If the customer uses Tamil, respond in Tamil. 
- If the customer uses Tanglish, respond naturally in Tanglish (e.g. "Aama, available-aa irukku"). 
- If the customer uses Hindi, respond in Hindi.
- If the customer uses another language, respond in that language. 
Preserve the customer's conversational style.

CONVERSATION HISTORY:
${historyText}

Current Customer Message: ${incomingMessage}
Your Reply:`;

    console.log("=== DEBUG SYSTEM PROMPT ===");
    console.log(systemPrompt);
    console.log("===========================");

    // 5. Call Gemini REST API (gemini-3.6-flash for latest API key compatibility)
    url = `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent`;
    
    const response = await axios.post(url, {
      contents: [{
        parts: [{ text: systemPrompt }]
      }]
    }, {
      headers: { 
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      }
    });

    const aiReply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log("===========================");
    return response.data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('=== AI Generation Error ===');
    console.error('HTTP Status:', error.response?.status);
    console.error('Endpoint/Model:', url);
    console.error('Response Data:', JSON.stringify(error.response?.data, null, 2));
    console.error('Message:', error.message);
    console.error('===========================');
    return 'I am sorry, I am experiencing technical difficulties right now.';
  }
};

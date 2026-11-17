import axios from 'axios';
import pool from '../config/db.js';

export const generateAiReply = async (customerId, incomingMessage) => {
  let url = '';
  try {
    // 1. Fetch Bot Settings & Products
    const { rows: settings } = await pool.query('SELECT setting_key, setting_value FROM bot_settings');

    let apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const dbApiKey = settings.find(s => s.setting_key === 'ai_api_key')?.setting_value;
      if (dbApiKey && !dbApiKey.includes('...[HIDDEN]...')) {
        apiKey = dbApiKey;
      }
    }

    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not configured. Falling back to default message.');
      return {
        reply_text: 'Thank you for your message. Our team has received your enquiry and will respond shortly.',
        intent: 'General',
        is_important: false
      };
    }

    // 2. Fetch recent conversation history for context
    const { rows: messages } = await pool.query(
      'SELECT sender, content FROM messages WHERE customer_id = $1 ORDER BY timestamp ASC LIMIT 10',
      [customerId]
    );

    let historyText = '';
    messages.forEach(m => {
      const role = m.sender === 'ai' ? 'Bot' : 'Customer';
      historyText += `${role}: ${m.content}\n`;
    });

    // 3. Fetch available products from DB for context
    const { rows: products } = await pool.query(
      'SELECT name, category, description, price, moq, availability, shippinginfo as "shippingInfo" FROM products'
    );

    let productContext = 'Available Products:\n';
    if (products.length === 0) {
      productContext += 'No products listed currently. Offer human support for details.\n';
    } else {
      products.forEach(p => {
        productContext += `- Name: ${p.name}\n  Category: ${p.category}\n  Price: ${p.price}\n  Description: ${p.description}\n  MOQ: ${p.moq}\n  Availability: ${p.availability}\n  Shipping Info: ${p.shippingInfo}\n\n`;
      });
    }

    // 4. Resolve AI Model & Prompts
    // Precedence: 1. bot_settings "ai_model", 2. process.env.GEMINI_MODEL, 3. default "gemini-3.5-flash-lite"
    const DEFAULT_AI_MODEL = 'gemini-3.5-flash-lite';
    const dbModel = settings.find(s => s.setting_key === 'ai_model')?.setting_value?.trim();
    let aiModel = dbModel || process.env.GEMINI_MODEL?.trim() || DEFAULT_AI_MODEL;

    // Filter out retired or deprecated models (1.5, 2.0, gemini-pro)
    if (aiModel.includes('1.5') || aiModel.includes('2.0') || aiModel.includes('gemini-pro')) {
      console.warn(`[AI Service] Configured model "${aiModel}" is retired or deprecated. Falling back to default "${DEFAULT_AI_MODEL}".`);
      aiModel = DEFAULT_AI_MODEL;
    }

    const responseStyle = settings.find(s => s.setting_key === 'ai_response_style')?.setting_value || 'Professional';
    const systemPromptBase = settings.find(s => s.setting_key === 'ai_system_prompt')?.setting_value ||
      'You are a helpful and polite WhatsApp customer support AI for Shastika Global Impex. Your goal is to answer customer questions accurately based ONLY on the provided context below.';

    let botContext = '';
    settings.forEach(s => {
      if (!s.setting_key.startsWith('ai_')) {
        botContext += `${s.setting_key}: ${s.setting_value}\n`;
      }
    });

    // 5. Construct System Prompt
    const systemPrompt = `${systemPromptBase}

Required Tone/Style: ${responseStyle}

BUSINESS CONTEXT:
${botContext}

PRODUCT INFORMATION:
${productContext}

RULES:
1. ONLY offer products listed in the PRODUCT INFORMATION section.
2. If a customer asks for a product not in the list, politely inform them it is unavailable and offer human assistance.
3. Keep answers concise, polite, and friendly, suitable for WhatsApp messaging.
4. Do not invent or hallucinate prices or details not in the database.

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

OUTPUT FORMAT:
You MUST output exactly and ONLY a valid JSON object with the following structure. Do not use markdown code blocks or additional text.
{
  "intent": "string (One of: Order, Product Enquiry, Price Enquiry, Quotation, Complaint, Follow-up, General)",
  "is_important": "boolean (true if intent is Order, Quotation, or Complaint, false otherwise)",
  "reply_text": "string (Your actual reply to the customer)"
}

Current Customer Message: ${incomingMessage}`;

    // 6. Call Gemini REST API with 20000ms timeout
    url = `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent`;

    const response = await axios.post(url, {
      contents: [{
        parts: [{ text: systemPrompt }]
      }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      timeout: 20000
    });

    // Handle empty or blocked responses safely
    const candidates = response.data?.candidates;
    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      console.warn('[AI Service] No candidates returned (safety block or empty). Prompt feedback:', JSON.stringify(response.data?.promptFeedback || null));
      return {
        reply_text: 'Thank you for reaching out to Shastika Global Impex. Our team has received your message and will assist you shortly.',
        intent: 'General',
        is_important: false
      };
    }

    const rawReply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawReply || !rawReply.trim()) {
      console.warn('[AI Service] Candidate parts text is empty. Prompt feedback:', JSON.stringify(response.data?.promptFeedback || null));
      return {
        reply_text: 'Thank you for contacting Shastika Global Impex! How can we assist you today?',
        intent: 'General',
        is_important: false
      };
    }

    // Clean up potential markdown formatting (```json ... ```)
    let jsonStr = rawReply.replace(/```json/gi, '').replace(/```/g, '').trim();

    try {
      const parsed = JSON.parse(jsonStr);
      return {
        reply_text: parsed.reply_text || "Thank you for contacting Shastika Global Impex! How can we assist you today?",
        intent: parsed.intent || "General",
        is_important: !!parsed.is_important
      };
    } catch (e) {
      console.warn('AI returned non-JSON text, extracting plain reply:', jsonStr);
      return {
        reply_text: jsonStr.replace(/^[{\s\S]*"reply_text":\s*"([^"]+)"[\s\S]*$/, '$1') || jsonStr,
        intent: "General",
        is_important: false
      };
    }
  } catch (error) {
    console.error('=== AI Generation Error ===');
    console.error('HTTP Status:', error.response?.status || 'N/A');
    console.error('Endpoint/Model:', url);
    console.error('Response Data:', JSON.stringify(error.response?.data, null, 2));
    console.error('Message:', error.message);
    console.error('===========================');
    return {
      reply_text: 'Thank you for reaching out to Shastika Global Impex. Our team has received your message and will assist you shortly.',
      intent: 'General',
      is_important: false
    };
  }
};

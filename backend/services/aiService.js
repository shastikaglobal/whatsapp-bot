import axios from 'axios';
import pool from '../config/db.js';

export const generateAiReply = async (customerId, incomingMessage, detectedLanguage = 'english') => {
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

    // 2. Fetch recent conversation history (last 10 messages in chronological order)
    const { rows: messages } = await pool.query(
      `SELECT sender, content FROM (
         SELECT sender, content, timestamp 
         FROM messages 
         WHERE customer_id = $1 
         ORDER BY timestamp DESC 
         LIMIT 10
       ) sub ORDER BY timestamp ASC`,
      [customerId]
    );

    let historyText = '';
    if (messages.length === 0) {
      historyText = '(No previous messages in this conversation)\n';
    } else {
      messages.forEach(m => {
        const role = m.sender === 'ai' ? 'Sales Assistant' : 'Customer';
        historyText += `${role}: ${m.content}\n`;
      });
    }

    // 3. Fetch available products from DB for context
    const { rows: products } = await pool.query(
      'SELECT name, category, description, price, moq, availability, shippinginfo as "shippingInfo" FROM products ORDER BY name ASC'
    );

    let productContext = '';
    if (products.length === 0) {
      productContext = `PRODUCTS SECTION:
(No products are currently listed in the database)
Our company core export produce includes fresh Cavendish bananas, mature semi-husked coconuts, watermelons, pumpkins, and cucumbers.
CRITICAL: Since exact prices, MOQs, stock counts, and shipping transit days are NOT in the database, you must NEVER invent or guess them. State that our export sales team will confirm pricing, MOQ, and shipping details.`;
    } else {
      productContext = 'PRODUCTS SECTION (Facts from Database):\n';
      products.forEach(p => {
        productContext += `- Product: ${p.name}\n` +
          (p.category ? `  Category: ${p.category}\n` : '') +
          (p.description ? `  Description: ${p.description}\n` : '') +
          (p.price !== null && p.price !== undefined ? `  Price: ₹${p.price}\n` : '  Price: Price on request / team will confirm\n') +
          (p.moq ? `  MOQ: ${p.moq}\n` : '  MOQ: Team will confirm\n') +
          (p.availability ? `  Availability: ${p.availability}\n` : '') +
          (p.shippingInfo ? `  Shipping Info: ${p.shippingInfo}\n` : '') +
          '\n';
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

    // Filter out sensitive and greeting settings so they don't pollute prompt or cause greeting loops
    const ignoredSettingKeys = [
      'welcome_message',
      'first_time_greeting',
      'outside_hours_reply',
      'holiday_reply',
      'whatsapp_verify_token',
      'meta_app_secret',
      'meta_app_id',
      'ai_api_key',
      'ai_model',
      'ai_system_prompt',
      'ai_response_style'
    ];
    let botContext = '';
    settings.forEach(s => {
      if (!ignoredSettingKeys.includes(s.setting_key) && !s.setting_key.startsWith('ai_')) {
        botContext += `${s.setting_key}: ${s.setting_value}\n`;
      }
    });

    // 5. Construct System Prompt
    const systemPrompt = `You are the sales assistant of Shastika Global Impex Private Limited (Tamil Nadu, India), exporting fresh agricultural produce.

RULES OF ENGAGEMENT:
1. ONGOING CONVERSATION: Use the last 10 messages below as context. NEVER repeat the welcome message or re-introduce yourself. You are in the middle of a continuous conversation.
2. LANGUAGE REQUIREMENT:
   - DEFAULT LANGUAGE IS ENGLISH.
   - Reply in the language of the customer's CURRENT message.
   - If the customer complains they cannot understand, switch to English.
   - Detected Language for the current message: ${(detectedLanguage || 'english').toUpperCase()}.
   - Rules per language:
     * English -> Clear, polite, professional English. (DEFAULT)
     * Tamil -> Polite, natural Tamil script (தமிழ்) ONLY if the customer's current message contains Tamil script.
     * Tanglish -> Natural Tanglish ONLY if the customer's CURRENT message clearly contains Tanglish words.
     * NEVER reply in Tanglish if the customer wrote in English.
     * Other languages -> Respond in that language.
3. CONCISENESS: Keep your reply short and professional, strictly maximum 3 to 4 lines, and at most ONE emoji.
4. STRICT PRODUCT TRUTH: ONLY use facts from the PRODUCTS SECTION below. Never invent prices, MOQ, certificates, or delivery dates. If unknown or not in the list, state that our sales team will confirm.
5. COLLECT MISSING DETAILS ONE AT A TIME: In a natural sales conversation, collect missing details one at a time:
   - Product
   - Quantity
   - Packing requirement
   - Destination country / discharge port
   - Incoterm (FOB or CIF)
   Do NOT ask for details the customer has already given in this or earlier messages.
6. QUOTATION HANDOVER: Once product, quantity, and destination are known:
   - State that our sales team will prepare and send an official quotation.
   - Set "is_important": true and "intent": "Quotation".
7. SHORT ACKNOWLEDGEMENTS: For short messages like "ok", "thanks", "k", "okay", "thank you":
   - Reply with a short natural acknowledgement (e.g. "Understood! 👍" or "You're welcome! Feel free to ask if you have more questions."), or nothing if the conversation is complete.
   - NEVER reply with "You're welcome!" when the user simply says "ok" or "k".
8. UNRELATED QUERIES: If the customer asks about something unrelated to Shastika Global Impex or fresh agro exports (e.g. general knowledge, trivia, non-business questions), politely bring the conversation back to our fresh produce export products.
9. HUMAN / BDE / MANAGER / CALL REQUEST:
   - If the customer asks for a human, an employee, a BDE, a manager, a person, or asks for a phone call (e.g. "is there anyone else", "talk to your employee", "connect me with your bde", "can I speak to a person", "call me"):
   - NEVER claim that you can handle everything or refuse the request.
   - Reply honestly and politely in the customer's CURRENT language passing their request to our sales team:
     * English (DEFAULT): "Sure, I am passing your request to our sales team (BDE). They will contact you shortly. Meanwhile, may I have your name, product, and quantity so they can assist you faster? 🤝"
     * Tamil (ONLY if written in Tamil script): "நிச்சயமாக, உங்கள் கோரிக்கையை எங்கள் விற்பனைக் குழுவிற்கு (BDE) அனுப்பியுள்ளேன். அவர்கள் விரைவில் உங்களைத் தொடர்பு கொள்வார்கள். அதற்குள் உங்கள் பெயர், தேவையான பொருள் மற்றும் அளவைத் தெரிவிக்க முடியுமா? 🤝"
     * Tanglish (ONLY if written in Tanglish): "Sure, unga request ah engaloda sales team-ku (BDE) forward pannirukken. Seekiram ungalai contact pannuvanga. Meanwhile unga name, required product and quantity solla mudiyuma? 🤝"
   - Set "intent": "Human Request" and "is_important": true.
10. BOT IDENTITY:
   - Do NOT tell customers that you are an AI or bot unless they explicitly ask.
   - NEVER claim to be a human either. Act simply as the professional sales assistant of Shastika Global Impex.

${botContext ? `COMPANY CONTEXT:\n${botContext}\n` : ''}${productContext}

CONVERSATION HISTORY (Last 10 messages):
${historyText}

Current Customer Message: "${incomingMessage}"

OUTPUT FORMAT:
Respond with ONLY a valid JSON object in this exact schema (no markdown fences, no surrounding text):
{
  "reply_text": "string (maximum 3-4 lines, at most 1 emoji)",
  "intent": "string (One of: Quotation, Product Enquiry, Price Enquiry, Order, Follow-up, Human Request, General)",
  "is_important": boolean
}`;

    // 6. Call Gemini REST API with 20000ms timeout
    url = `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent`;

    const response = await axios.post(url, {
      contents: [{
        parts: [{ text: systemPrompt }]
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 800,
        temperature: 0.3
      }
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
      const match = jsonStr.match(/"reply_text"\s*:\s*"((?:[^"\\]|\\.)*)"/) || jsonStr.match(/"reply_text"\s*:\s*"([^"\r\n]+)/);
      let extractedText = match ? match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim() : jsonStr;
      return {
        reply_text: extractedText,
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

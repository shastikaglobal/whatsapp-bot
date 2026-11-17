import pool from './config/db.js';
import { matchAutoReplyRule, PURE_GREETING_REGEX, ACKNOWLEDGEMENT_REGEX, THANKS_REGEX } from './controllers/webhookController.js';
import { generateAiReply } from './services/aiService.js';

/**
 * Simulates the bot's auto-reply decision engine.
 */
async function simulateIncomingMessage(customerId, msgText, isNewConversation = false) {
  const trimmed = msgText.trim();
  let replyText = null;
  let ruleMatched = null;
  let aiMetadata = null;

  // 1. Pure greeting check (or first message of new conversation if greeting)
  if (PURE_GREETING_REGEX.test(trimmed)) {
    const { rows: welcomeRows } = await pool.query(
      "SELECT setting_value FROM bot_settings WHERE setting_key = 'welcome_message'"
    );
    replyText = welcomeRows[0]?.setting_value?.trim() ||
      '👋 Welcome to Shastika Global Impex! Thank you for reaching out. How may we assist you today?';
    return {
      type: 'WELCOME_MESSAGE',
      reply: replyText
    };
  }

  // 2. Natural Acknowledgements & Thanks
  if (ACKNOWLEDGEMENT_REGEX.test(trimmed)) {
    return {
      type: 'ACKNOWLEDGEMENT',
      reply: 'Understood! Let us know if you have any questions or need a quotation. 👍'
    };
  }
  if (THANKS_REGEX.test(trimmed)) {
    return {
      type: 'GRATITUDE',
      reply: "You're welcome! Feel free to reach out anytime. 👍"
    };
  }

  // 3. RFQ / Quotation Check
  const isDetailedRfq = /(?:quotation|quote|\bcif\b|\bfob\b|\b(?:metric\s+)?tons?\b|\b(?:40ft|20ft|fcl)\b)/i.test(trimmed);

  // 4. Keyword Rules check (word boundary + plurals + typos + last mentioned priority)
  if (!isDetailedRfq) {
    const { rows: rules } = await pool.query(
      'SELECT keyword, reply_text FROM auto_reply_rules WHERE is_active = true'
    );
    const matched = matchAutoReplyRule(trimmed, rules);
    if (matched) {
      return {
        type: 'KEYWORD_RULE',
        keyword: matched.keyword,
        reply: matched.reply_text
      };
    }
  }

  // 5. Gemini AI Fallback for RFQs and Unmatched messages (NEVER welcome message)
  const aiResponse = await generateAiReply(customerId, trimmed);
  return {
    type: 'GEMINI_AI',
    reply: aiResponse.reply_text,
    intent: aiResponse.intent,
    is_important: aiResponse.is_important
  };
}

async function runTests() {
  console.log('================================================================');
  console.log('🤖 SHASTIKA BOT CONVERSATION QUALITY & ROUTING TEST SUITE');
  console.log('================================================================\n');

  const testCases = [
    {
      id: 1,
      title: 'Welcome Message on Pure Greeting ("Hi")',
      message: 'Hi',
      isNew: true,
      expected: 'WELCOME_MESSAGE'
    },
    {
      id: 2,
      title: 'Pumpkin query mid-conversation ("And another thing I want pumpkin")',
      message: 'And another thing I want pumpkin',
      isNew: false,
      expected: 'KEYWORD_RULE (pumpkin)'
    },
    {
      id: 3,
      title: 'Multiple products in one message ("I want coconuts and bananas, but mainly bananas")',
      message: 'I want coconuts and bananas, but mainly bananas',
      isNew: false,
      expected: 'KEYWORD_RULE (banana - mentioned last)'
    },
    {
      id: 4,
      title: 'Typos and Plurals ("Do you export pumkins and watermelons?")',
      message: 'Do you export pumkins and watermelons?',
      isNew: false,
      expected: 'KEYWORD_RULE (watermelon - mentioned last)'
    },
    {
      id: 5,
      title: 'Short Acknowledgement ("Ok")',
      message: 'Ok',
      isNew: false,
      expected: 'ACKNOWLEDGEMENT (short natural confirmation, NOT "You\'re welcome!")'
    },
    {
      id: 6,
      title: 'Tamil Language Enquiry ("உங்களிடம் என்னென்ன வேளாண் பொருட்கள் ஏற்றுமதிக்கு உள்ளன?")',
      message: 'உங்களிடம் என்னென்ன வேளாண் பொருட்கள் ஏற்றுமதிக்கு உள்ளன?',
      isNew: false,
      expected: 'GEMINI_AI (replies in natural Tamil, max 3-4 lines, at most 1 emoji)'
    },
    {
      id: 7,
      title: 'Unrelated Question ("What is the capital of France?")',
      message: 'What is the capital of France?',
      isNew: false,
      expected: 'GEMINI_AI (polite redirection back to Shastika export produce)'
    },
    {
      id: 8,
      title: 'Quotation handover condition with full details ("We need 20 tons of fresh pumpkins in mesh bags to Jebel Ali Port, CIF")',
      message: 'We need 20 tons of fresh pumpkins in mesh bags to Jebel Ali Port, CIF. Please send quotation.',
      isNew: false,
      expected: 'GEMINI_AI (is_important: true, intent: Quotation, promises sales team quote)'
    }
  ];

  const testCustomerId = 'cust_test_quality_eval';

  // Seed sample conversation history for test customer so AI has context
  await pool.query('DELETE FROM messages WHERE customer_id = $1', [testCustomerId]);
  await pool.query('DELETE FROM customers WHERE id = $1', [testCustomerId]);
  await pool.query(
    "INSERT INTO customers (id, name, phone, lastMessage) VALUES ($1, 'Test Buyer', '919876543210', 'Enquiry')",
    [testCustomerId]
  );
  await pool.query(
    "INSERT INTO messages (id, customer_id, sender, content) VALUES ('msg_prev_1', $1, 'customer', 'Hello, we are agricultural importers in UAE.')",
    [testCustomerId]
  );
  await pool.query(
    "INSERT INTO messages (id, customer_id, sender, content) VALUES ('msg_prev_2', $1, 'ai', 'Welcome to Shastika Global Impex! We export fresh coconuts, bananas, watermelons, pumpkins, and cucumbers.')",
    [testCustomerId]
  );

  for (const tc of testCases) {
    console.log(`----------------------------------------------------------------`);
    console.log(`[Test Case ${tc.id}] ${tc.title}`);
    console.log(`Incoming Customer Message: "${tc.message}"`);
    console.log(`Expected Handling: ${tc.expected}`);

    const result = await simulateIncomingMessage(testCustomerId, tc.message, tc.isNew);

    console.log(`Handler Triggered: [${result.type}] ${result.keyword ? `(keyword: ${result.keyword})` : ''}`);
    if (result.intent) console.log(`Detected Intent: ${result.intent} | is_important: ${result.is_important}`);
    console.log(`🤖 Bot Reply:\n${result.reply}`);
    console.log();
  }

  // Cleanup test data
  await pool.query('DELETE FROM messages WHERE customer_id = $1', [testCustomerId]);
  await pool.query('DELETE FROM customers WHERE id = $1', [testCustomerId]);
  await pool.end();

  console.log('================================================================');
  console.log('✅ ALL 8 CONVERSATIONAL TEST CASES EXECUTED SUCCESSFULLY');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});

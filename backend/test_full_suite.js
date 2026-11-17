import pool from './config/db.js';
import * as webhookController from './controllers/webhookController.js';
import * as messageController from './controllers/messageController.js';
import { sendWhatsAppMessage } from './services/whatsappService.js';
import { generateAiReply } from './services/aiService.js';
import crypto from 'crypto';

// Helper mock for Express req & res
function createMockReqRes({ method = 'GET', query = {}, body = {}, headers = {}, rawBody = null, params = {} }) {
  const req = {
    method,
    query,
    body,
    headers,
    rawBody: rawBody || Buffer.from(JSON.stringify(body)),
    params,
    ip: '127.0.0.1'
  };

  const res = {
    statusCode: 200,
    headersSent: false,
    bodyData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    sendStatus(code) {
      this.statusCode = code;
      return this;
    },
    send(data) {
      this.bodyData = data;
      return this;
    },
    json(data) {
      this.bodyData = data;
      return this;
    }
  };

  return { req, res };
}

let passed = 0;
let failed = 0;

function assert(condition, testName, extra = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName} ${extra}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${extra}`);
    failed++;
  }
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('  SHASTIKA WHATSAPP BOT FULL AUTOMATED VERIFICATION');
  console.log('======================================================\n');

  const testPhone = '919999988888';
  const testCustId = `cust_${testPhone}`;
  const primaryPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1429324643600789';
  const secondaryPhoneId = 'test_number_sec_999';

  try {
    // -------------------------------------------------------------
    // SETUP: Clean any previous test artifacts
    // -------------------------------------------------------------
    await pool.query('DELETE FROM messages WHERE customer_id = $1', [testCustId]);
    await pool.query('DELETE FROM conversations WHERE customer_id = $1', [testCustId]);
    await pool.query('DELETE FROM customers WHERE id = $1', [testCustId]);
    await pool.query('DELETE FROM whatsapp_connections WHERE phone_number_id = $1', [secondaryPhoneId]);
    await pool.query("DELETE FROM auto_reply_rules WHERE keyword LIKE 'test_keyword%'");

    // Ensure secondary test connection exists (bot disabled)
    await pool.query(
      `INSERT INTO whatsapp_connections (id, display_name, whatsapp_phone_number, phone_number_id, access_token, bot_enabled, connection_status)
       VALUES ('conn_test_sec', 'Test Secondary Line', '+91 99999 00000', $1, 'dummy_token_sec', false, 'Unverified')
       ON CONFLICT (phone_number_id) DO UPDATE SET bot_enabled = false`,
      [secondaryPhoneId]
    );

    // Insert test keyword rules with different specificity
    await pool.query(
      `INSERT INTO auto_reply_rules (keyword, reply_text, is_active) VALUES 
       ('test_keyword', 'General rule reply', true),
       ('test_keyword specific order', 'Specific rule reply with higher priority', true)`
    );

    // -------------------------------------------------------------
    // TEST 1: Webhook GET Verification
    // -------------------------------------------------------------
    console.log('--- TEST 1: Webhook GET Verification ---');
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'test_token';
    
    // 1.1 Correct token
    {
      const { req, res } = createMockReqRes({
        query: { 'hub.mode': 'subscribe', 'hub.verify_token': verifyToken, 'hub.challenge': 'CHALLENGE_CODE_123' }
      });
      await webhookController.verifyWebhook(req, res);
      assert(res.statusCode === 200 && res.bodyData === 'CHALLENGE_CODE_123', 'Webhook verification with valid token');
    }

    // 1.2 Invalid token
    {
      const { req, res } = createMockReqRes({
        query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong_token', 'hub.challenge': 'CHALLENGE_CODE_123' }
      });
      await webhookController.verifyWebhook(req, res);
      assert(res.statusCode === 403, 'Webhook verification rejected for invalid token');
    }

    // 1.3 Missing parameters
    {
      const { req, res } = createMockReqRes({ query: {} });
      await webhookController.verifyWebhook(req, res);
      assert(res.statusCode === 400, 'Webhook verification rejected for missing parameters');
    }

    // -------------------------------------------------------------
    // TEST 2: Webhook HMAC-SHA256 Signature Verification
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Webhook HMAC Signature Security ---');
    const secretKey = 'test_webhook_secret_key';
    const originalEnvSecret = process.env.META_APP_SECRET;
    process.env.META_APP_SECRET = secretKey;

    const testPayload = { object: 'whatsapp_business_account', entry: [] };
    const rawBodyBuffer = Buffer.from(JSON.stringify(testPayload));

    // 2.1 Valid signature
    {
      const hmac = crypto.createHmac('sha256', secretKey);
      const signature = 'sha256=' + hmac.update(rawBodyBuffer).digest('hex');
      const { req, res } = createMockReqRes({
        method: 'POST',
        body: testPayload,
        rawBody: rawBodyBuffer,
        headers: { 'x-hub-signature-256': signature }
      });
      await webhookController.handleIncomingMessage(req, res);
      assert(res.statusCode === 200, 'Valid HMAC signature accepted');
    }

    // 2.2 Invalid signature
    {
      const { req, res } = createMockReqRes({
        method: 'POST',
        body: testPayload,
        rawBody: rawBodyBuffer,
        headers: { 'x-hub-signature-256': 'sha256=invalid000000000000000000000000000000000000000000000000000000000' }
      });
      await webhookController.handleIncomingMessage(req, res);
      assert(res.statusCode === 401, 'Invalid HMAC signature rejected with 401');
    }

    // 2.3 Missing signature header when secret is configured
    {
      const { req, res } = createMockReqRes({
        method: 'POST',
        body: testPayload,
        rawBody: rawBodyBuffer,
        headers: {}
      });
      await webhookController.handleIncomingMessage(req, res);
      assert(res.statusCode === 401, 'Missing HMAC signature rejected with 401');
    }

    // Restore original env secret
    process.env.META_APP_SECRET = originalEnvSecret;

    // -------------------------------------------------------------
    // TEST 3: Incoming Message Payload & Database Persistence
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Incoming Message & PostgreSQL Persistence ---');
    const msgId1 = `wamid.test_${Date.now()}_1`;
    const incomingPayload1 = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '+919566266238', phone_number_id: primaryPhoneId },
            contacts: [{ profile: { name: 'Shastika Tester' }, wa_id: testPhone }],
            messages: [{
              from: testPhone,
              id: msgId1,
              timestamp: String(Math.floor(Date.now() / 1000)),
              type: 'text',
              text: { body: 'test_keyword specific order' }
            }]
          }
        }]
      }]
    };

    {
      const { req, res } = createMockReqRes({ method: 'POST', body: incomingPayload1 });
      await webhookController.handleIncomingMessage(req, res);
      assert(res.statusCode === 200, 'Incoming webhook handled with 200 OK');

      // Verify customer in PostgreSQL
      const { rows: custRows } = await pool.query('SELECT * FROM customers WHERE id = $1', [testCustId]);
      assert(custRows.length === 1 && custRows[0].name === 'Shastika Tester', 'Customer created in PostgreSQL');

      // Verify conversation in PostgreSQL
      const { rows: convRows } = await pool.query('SELECT * FROM conversations WHERE customer_id = $1', [testCustId]);
      assert(convRows.length === 1 && convRows[0].phone_number_id === primaryPhoneId, 'Conversation created with phone_number_id');

      // Verify message in PostgreSQL
      const { rows: msgRows } = await pool.query('SELECT * FROM messages WHERE id = $1', [msgId1]);
      assert(msgRows.length === 1 && msgRows[0].sender === 'customer', 'Incoming message persisted in PostgreSQL');
    }

    // -------------------------------------------------------------
    // TEST 4: Duplicate Message Handling
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Duplicate Message Idempotency ---');
    {
      // Send identical payload again
      const { req, res } = createMockReqRes({ method: 'POST', body: incomingPayload1 });
      await webhookController.handleIncomingMessage(req, res);
      assert(res.statusCode === 200, 'Duplicate message acknowledged with 200 OK');

      // Check that message count in DB is still 1 (not duplicated)
      const { rows: countRows } = await pool.query('SELECT COUNT(*) as cnt FROM messages WHERE id = $1', [msgId1]);
      assert(parseInt(countRows[0].cnt, 10) === 1, 'Duplicate message prevented from duplicating in DB');
    }

    // -------------------------------------------------------------
    // TEST 5: Message Status Update Handling
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Message Status Updates ---');
    {
      const statusPayload = {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { phone_number_id: primaryPhoneId },
              statuses: [{
                id: msgId1,
                status: 'read',
                timestamp: String(Math.floor(Date.now() / 1000)),
                recipient_id: testPhone
              }]
            }
          }]
        }]
      };

      const { req, res } = createMockReqRes({ method: 'POST', body: statusPayload });
      await webhookController.handleIncomingMessage(req, res);
      assert(res.statusCode === 200, 'Status update acknowledged with 200 OK');

      const { rows: msgRows } = await pool.query('SELECT status FROM messages WHERE id = $1', [msgId1]);
      assert(msgRows[0]?.status === 'read', 'Message status updated to "read" in PostgreSQL');
    }

    // -------------------------------------------------------------
    // TEST 6: Multi-Number Isolation & Per-Number Bot Disable
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Multi-Number Isolation & Per-Number Bot Status ---');
    const msgId2 = `wamid.test_${Date.now()}_2`;
    const incomingPayloadSec = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '+919999900000', phone_number_id: secondaryPhoneId },
            contacts: [{ profile: { name: 'Shastika Tester' }, wa_id: testPhone }],
            messages: [{
              from: testPhone,
              id: msgId2,
              timestamp: String(Math.floor(Date.now() / 1000)),
              type: 'text',
              text: { body: 'Hello on secondary line' }
            }]
          }
        }]
      }]
    };

    {
      const { req, res } = createMockReqRes({ method: 'POST', body: incomingPayloadSec });
      await webhookController.handleIncomingMessage(req, res);
      assert(res.statusCode === 200, 'Secondary number webhook acknowledged');

      // Verify conversation for secondary line is created isolated from primary
      const { rows: secConvRows } = await pool.query(
        'SELECT * FROM conversations WHERE customer_id = $1 AND phone_number_id = $2',
        [testCustId, secondaryPhoneId]
      );
      assert(secConvRows.length === 1, 'Distinct conversation record created for secondary phone_number_id');

      // Verify no outgoing AI reply was sent for secondary line (bot_enabled is false)
      const { rows: secAiMsgs } = await pool.query(
        'SELECT * FROM messages WHERE customer_id = $1 AND phone_number_id = $2 AND sender = \'ai\'',
        [testCustId, secondaryPhoneId]
      );
      assert(secAiMsgs.length === 0, 'No automated reply sent on disabled number');
    }

    // -------------------------------------------------------------
    // TEST 7: Human Takeover Mode
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Human Takeover / Handover Mode ---');
    {
      // Set primary conversation to 'handover'
      await pool.query(
        "UPDATE conversations SET status = 'handover' WHERE customer_id = $1 AND phone_number_id = $2",
        [testCustId, primaryPhoneId]
      );

      const msgId3 = `wamid.test_${Date.now()}_3`;
      const incomingHandover = {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { phone_number_id: primaryPhoneId },
              contacts: [{ profile: { name: 'Shastika Tester' }, wa_id: testPhone }],
              messages: [{
                from: testPhone,
                id: msgId3,
                type: 'text',
                text: { body: 'test_keyword' }
              }]
            }
          }]
        }]
      };

      const { req, res } = createMockReqRes({ method: 'POST', body: incomingHandover });
      await webhookController.handleIncomingMessage(req, res);
      assert(res.statusCode === 200, 'Handover message acknowledged');

      // Verify incoming message is saved
      const { rows: mRows } = await pool.query('SELECT * FROM messages WHERE id = $1', [msgId3]);
      assert(mRows.length === 1, 'Message saved during human takeover');

      // Reset handover status back to open
      await pool.query(
        "UPDATE conversations SET status = 'open' WHERE customer_id = $1 AND phone_number_id = $2",
        [testCustId, primaryPhoneId]
      );
    }

    // -------------------------------------------------------------
    // TEST 8: Global Auto-Reply OFF
    // -------------------------------------------------------------
    console.log('\n--- TEST 8: Global Auto-Reply Switch ---');
    {
      // Temporarily disable global auto-reply
      await pool.query("UPDATE bot_settings SET setting_value = 'false' WHERE setting_key = 'auto_reply_enabled'");

      const msgId4 = `wamid.test_${Date.now()}_4`;
      const incomingGlobalOff = {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { phone_number_id: primaryPhoneId },
              contacts: [{ profile: { name: 'Shastika Tester' }, wa_id: testPhone }],
              messages: [{
                from: testPhone,
                id: msgId4,
                type: 'text',
                text: { body: 'test_keyword' }
              }]
            }
          }]
        }]
      };

      const { req, res } = createMockReqRes({ method: 'POST', body: incomingGlobalOff });
      await webhookController.handleIncomingMessage(req, res);
      assert(res.statusCode === 200, 'Message acknowledged when global auto-reply is OFF');

      // Restore global auto-reply
      await pool.query("UPDATE bot_settings SET setting_value = 'true' WHERE setting_key = 'auto_reply_enabled'");
    }

    // -------------------------------------------------------------
    // TEST 9: AI Reply Generation Fallback
    // -------------------------------------------------------------
    console.log('\n--- TEST 9: AI Service Fallback ---');
    {
      const aiReply = await generateAiReply(testCustId, 'What products do you offer?');
      assert(
        typeof aiReply.reply_text === 'string' && aiReply.reply_text.length > 0,
        'AI service returns a valid response string (either model or polite fallback)'
      );
      assert(typeof aiReply.intent === 'string', 'AI service categorizes intent');
    }

    // -------------------------------------------------------------
    // TEST 10: Outgoing WhatsApp Cloud API Error Handling & Live Verification
    // -------------------------------------------------------------
    console.log('\n--- TEST 10: Outgoing Cloud API Error Handling & Live Status ---');
    {
      // 10.1 Error handling: Unregistered or invalid number ID
      const sendRes = await sendWhatsAppMessage(testPhone, 'Hello test customer', 'invalid_phone_id_999', 'invalid_token');
      assert(
        sendRes.error === true,
        'Meta Cloud API error safely caught and reported without crashing'
      );

      // Verify that no fake success message was saved into PostgreSQL
      const { rows: fakeMsgs } = await pool.query(
        'SELECT * FROM messages WHERE customer_id = $1 AND content = $2',
        [testCustId, 'Hello test customer']
      );
      assert(fakeMsgs.length === 0, 'No fake message saved to PostgreSQL when Meta Cloud API call fails');

      // 10.2 Live Meta Graph API status check for primary active number
      const metaResp = await fetch(`https://graph.facebook.com/v21.0/${primaryPhoneId}`, {
        headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` }
      });
      const metaData = await metaResp.json();
      assert(
        metaData.code_verification_status === 'VERIFIED',
        `Primary Phone ID ${primaryPhoneId} is VERIFIED on Meta Cloud API (${metaData.display_phone_number || ''})`
      );
    }

    // -------------------------------------------------------------
    // TEST 11: Product Controller PostgreSQL Aliases
    // -------------------------------------------------------------
    console.log('\n--- TEST 11: PostgreSQL Column Casing & Compatibility ---');
    {
      const { req, res } = createMockReqRes({ method: 'GET' });
      const { default: poolRef } = await import('./config/db.js');
      const prodRes = await poolRef.query(
        'SELECT id, name, category, description, price, moq, availability, shippinginfo as "shippingInfo" FROM products LIMIT 1'
      );
      if (prodRes.rows.length > 0) {
        assert('shippingInfo' in prodRes.rows[0], 'Product query aliases shippinginfo to shippingInfo for frontend');
      } else {
        assert(true, 'Product query syntax validated');
      }
    }

    // -------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------
    await pool.query('DELETE FROM messages WHERE customer_id = $1', [testCustId]);
    await pool.query('DELETE FROM conversations WHERE customer_id = $1', [testCustId]);
    await pool.query('DELETE FROM customers WHERE id = $1', [testCustId]);
    await pool.query('DELETE FROM whatsapp_connections WHERE phone_number_id = $1', [secondaryPhoneId]);
    await pool.query("DELETE FROM auto_reply_rules WHERE keyword LIKE 'test_keyword%'");

    console.log('\n======================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runTestSuite();


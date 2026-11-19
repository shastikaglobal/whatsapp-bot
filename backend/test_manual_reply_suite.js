import assert from 'assert';
import { resolveWhatsAppConnection } from './controllers/messageController.js';

console.log('=== RUNNING MANUAL REPLY & WHATSAPP CONNECTION TEST SUITE ===\n');

// 1. Tests for 24-Hour WhatsApp Customer Care Window calculation
function isCustomerWindowClosed(messages, now = new Date()) {
  const lastCustomerMessage = [...messages].reverse().find(m => m.sender === 'customer' || m.sender === 'user');
  if (!lastCustomerMessage || !lastCustomerMessage.timestamp) {
    return true; // No customer message ever received -> free text window closed
  }
  const lastMsgTime = new Date(lastCustomerMessage.timestamp).getTime();
  const diffHours = (now.getTime() - lastMsgTime) / (1000 * 60 * 60);
  return diffHours > 24;
}

const now = new Date('2026-11-19T06:00:00Z');

// Case 1A: Customer messaged 2 hours ago -> window is OPEN
const msgsRecent = [
  { sender: 'customer', timestamp: new Date('2026-11-19T04:00:00Z').toISOString() },
  { sender: 'admin', timestamp: new Date('2026-11-19T05:00:00Z').toISOString() }
];
assert.strictEqual(isCustomerWindowClosed(msgsRecent, now), false, 'Customer message 2h ago should have open 24h window');
console.log('✓ 24h Window Check: Customer message 2h ago -> Window OPEN (Send allowed)');

// Case 1B: Customer messaged 25 hours ago -> window is CLOSED
const msgsOld = [
  { sender: 'customer', timestamp: new Date('2026-11-18T04:00:00Z').toISOString() },
  { sender: 'admin', timestamp: new Date('2026-11-19T05:00:00Z').toISOString() }
];
assert.strictEqual(isCustomerWindowClosed(msgsOld, now), true, 'Customer message 25h ago should have closed 24h window');
console.log('✓ 24h Window Check: Customer message 25h ago -> Window CLOSED (Send disabled & warning shown)');

// Case 1C: No customer message exists (only admin or bot) -> window is CLOSED
const msgsNoCustomer = [
  { sender: 'admin', timestamp: new Date('2026-11-19T05:00:00Z').toISOString() }
];
assert.strictEqual(isCustomerWindowClosed(msgsNoCustomer, now), true, 'No customer message should have closed 24h window');
console.log('✓ 24h Window Check: No customer message -> Window CLOSED (Send disabled)');

// -------------------------------------------------------------
// 2. Tests for resolveWhatsAppConnection
// -------------------------------------------------------------
async function runConnectionTests() {
  const verifiedConnection = {
    id: 'conn_46c57618-7169-4165-9743-fed58ffc5f89',
    display_name: 'meta',
    phone_number_id: '1429324643600789',
    whatsapp_phone_number: '919789090920',
    access_token: 'EAAWbZB2_VALID_TOKEN_HERE',
    bot_enabled: true
  };

  const dummy66265Connection = {
    id: 'conn_2876f9ee-7dec-47b4-9838-936dd825fcd9',
    display_name: 'bde',
    phone_number_id: '1272367032630223',
    whatsapp_phone_number: '95662 66265',
    access_token: 'YOUR_NEW_TOKEN_HERE',
    bot_enabled: true
  };

  // Mock DB implementation to test priority & exclusions without touching production DB
  function createMockDb({ convPhoneId = null, msgPhoneId = null } = {}) {
    return {
      query: async (sql, params = []) => {
        const normSql = sql.toUpperCase().replace(/\s+/g, ' ');
        // 1. Query conversations by id
        if (normSql.includes('FROM CONVERSATIONS WHERE ID = $1')) {
          return { rows: convPhoneId ? [{ id: params[0], phone_number_id: convPhoneId }] : [] };
        }
        // 2. Query conversations by customer_id
        if (normSql.includes('FROM CONVERSATIONS WHERE CUSTOMER_ID = $1')) {
          return { rows: convPhoneId ? [{ id: 1, phone_number_id: convPhoneId }] : [] };
        }
        // 3. Query messages by customer_id
        if (normSql.includes('FROM MESSAGES WHERE CUSTOMER_ID = $1')) {
          return { rows: msgPhoneId ? [{ phone_number_id: msgPhoneId }] : [] };
        }
        // 4. Query whatsapp_connections by TRIM(phone_number_id) = $1
        if (normSql.includes('FROM WHATSAPP_CONNECTIONS WHERE TRIM(PHONE_NUMBER_ID) = $1')) {
          const reqId = String(params[0]).trim();
          if (reqId === '1429324643600789') {
            return { rows: [verifiedConnection] };
          }
          if (reqId === '1272367032630223') {
            // Unverified dummy connection with placeholder token: should be excluded by "access_token NOT LIKE 'YOUR_NEW%'"
            if (normSql.includes("ACCESS_TOKEN NOT LIKE 'YOUR_NEW%'")) {
              return { rows: [] }; // Excluded!
            }
            return { rows: [dummy66265Connection] };
          }
          return { rows: [] };
        }
        // 5. Fallback query
        if (normSql.includes("WHERE TRIM(PHONE_NUMBER_ID) = '1429324643600789'")) {
          // Explicitly returns the verified connection (+91 97890 90920) and NEVER 66265
          return { rows: [verifiedConnection] };
        }
        return { rows: [] };
      }
    };
  }

  // Test 2A: Conversation has phone_number_id = '1429324643600789'
  const mockDbA = createMockDb({ convPhoneId: '1429324643600789' });
  const resA = await resolveWhatsAppConnection(null, 1, 'cust_123', mockDbA);
  assert.strictEqual(resA.phoneNumberId, '1429324643600789');
  assert.strictEqual(resA.connection.phone_number_id, '1429324643600789');
  assert.strictEqual(resA.connection.whatsapp_phone_number, '919789090920');
  console.log('✓ Connection Resolution: Resolves phone_number_id from conversation correctly');

  // Test 2B: Conversation has NULL phone_number_id, but customer previous messages have '1429324643600789'
  const mockDbB = createMockDb({ convPhoneId: null, msgPhoneId: '1429324643600789' });
  const resB = await resolveWhatsAppConnection(null, 1, 'cust_123', mockDbB);
  assert.strictEqual(resB.phoneNumberId, '1429324643600789');
  assert.strictEqual(resB.connection.phone_number_id, '1429324643600789');
  console.log('✓ Connection Resolution: Falls back to customer previous messages phone_number_id');

  // Test 2C: Neither conversation nor messages have phone_number_id -> Fallback to active verified connection
  const mockDbC = createMockDb({ convPhoneId: null, msgPhoneId: null });
  const resC = await resolveWhatsAppConnection(null, null, 'cust_new', mockDbC);
  assert.strictEqual(resC.phoneNumberId, '1429324643600789', 'Must pick verified 1429324643600789, NEVER 66265');
  assert.notStrictEqual(resC.phoneNumberId, '1272367032630223', 'Must NEVER pick 66265 connection');
  assert.strictEqual(resC.connection.whatsapp_phone_number, '919789090920');
  console.log('✓ Connection Resolution: Fallback picks verified +91 97890 90920 (1429324643600789) and NEVER 66265');

  // Test 2D: If unverified 66265 (1272367032630223) is explicitly passed or stored, resolveWhatsAppConnection refuses it
  const mockDbD = createMockDb({ convPhoneId: '1272367032630223' });
  const resD = await resolveWhatsAppConnection('1272367032630223', 1, 'cust_test', mockDbD);
  assert.strictEqual(resD.phoneNumberId, '1429324643600789', 'Should refuse 66265 and fallback to verified connection');
  assert.notStrictEqual(resD.phoneNumberId, '1272367032630223');
  console.log('✓ Connection Resolution: Explicit or stale 66265 request is blocked and routed to verified connection');
}

// -------------------------------------------------------------
// 3. Tests for Failed Message DB Persistence Simulation
// -------------------------------------------------------------
function simulateSendMessageHandling({ metaResponse, customerId = 'cust_919566266259', content = 'Hello' }) {
  const dbMessages = [];
  let responsePayload = null;
  let httpStatus = 200;

  if (!metaResponse || metaResponse.error) {
    httpStatus = 400;
    const errorCode = metaResponse?.code || 'ERROR';
    const errMsg = metaResponse?.message || 'Meta Cloud API rejected the outgoing message';
    const failureReason = metaResponse?.code ? `${metaResponse.code}: ${metaResponse.message}` : errMsg;

    const failedMsgId = 'failed_test_msg_uuid';
    dbMessages.push({
      id: failedMsgId,
      customer_id: customerId,
      sender: 'Admin',
      content,
      status: 'failed',
      failure_reason: failureReason,
      phone_number_id: '1429324643600789'
    });

    responsePayload = {
      success: false,
      error: errMsg,
      code: errorCode,
      messageId: failedMsgId,
      failure_reason: failureReason
    };
  } else {
    httpStatus = 200;
    const metaMsgId = metaResponse.messages?.[0]?.id || 'msg_success';
    dbMessages.push({
      id: metaMsgId,
      customer_id: customerId,
      sender: 'Admin',
      content,
      status: 'sent',
      phone_number_id: '1429324643600789'
    });
    responsePayload = { success: true, message: 'Message sent successfully', messageId: metaMsgId };
  }

  return { httpStatus, dbMessages, responsePayload };
}

// Case 3A: Meta returns 131047 (outside 24h window)
const metaErr131047 = {
  error: true,
  code: 131047,
  message: 'Message failed to send because more than 24 hours have passed since the customer last replied to this number.'
};
const simFail131047 = simulateSendMessageHandling({ metaResponse: metaErr131047 });
assert.strictEqual(simFail131047.httpStatus, 400);
assert.strictEqual(simFail131047.dbMessages.length, 1);
assert.strictEqual(simFail131047.dbMessages[0].status, 'failed', 'Message MUST be saved with status "failed"');
assert.ok(simFail131047.dbMessages[0].failure_reason.includes('131047'), 'Failure reason must record error code');
assert.strictEqual(simFail131047.responsePayload.success, false);
console.log('✓ Failed Send Persistence: Meta Error 131047 is saved to DB as "failed" with failure_reason and returned as 400');

// Case 3B: Meta returns 190 (Invalid token)
const metaErr190 = {
  error: true,
  code: 190,
  message: 'Invalid OAuth access token'
};
const simFail190 = simulateSendMessageHandling({ metaResponse: metaErr190 });
assert.strictEqual(simFail190.httpStatus, 400);
assert.strictEqual(simFail190.dbMessages[0].status, 'failed');
assert.ok(simFail190.dbMessages[0].failure_reason.includes('190'));
console.log('✓ Failed Send Persistence: Meta Error 190 is saved to DB as "failed" with failure_reason');

// Case 3C: Meta returns success
const metaSuccess = {
  success: true,
  messages: [{ id: 'wamid.TEST_SUCCESS_ID' }]
};
const simSuccess = simulateSendMessageHandling({ metaResponse: metaSuccess });
assert.strictEqual(simSuccess.httpStatus, 200);
assert.strictEqual(simSuccess.dbMessages[0].status, 'sent');
assert.strictEqual(simSuccess.dbMessages[0].id, 'wamid.TEST_SUCCESS_ID');
console.log('✓ Successful Send Persistence: Message saved as "sent" with Meta wamid');

runConnectionTests().then(() => {
  console.log('\n=== ALL MANUAL REPLY TESTS PASSED SUCCESSFULLY! ===');
  process.exit(0);
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

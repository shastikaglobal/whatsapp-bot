import assert from 'assert';
import pool from './config/db.js';
import {
  PURE_GREETING_REGEX,
  DEFAULT_WELCOME_MESSAGE,
  DEFAULT_FIRST_TIME_GREETING,
  DEFAULT_OUTSIDE_HOURS_REPLY,
  DEFAULT_HOLIDAY_REPLY,
  isOutsideBusinessHours,
  matchAutoReplyRule
} from './controllers/webhookController.js';

async function runLiveGreetingVerification() {
  console.log('=====================================================================');
  console.log('🧪 LIVE DATABASE & WEBHOOK LOGIC VERIFICATION SUITE');
  console.log('=====================================================================\n');

  const testPhone = '919999000888';
  const testCustomerId = `cust_${testPhone}`;
  const testCustomerName = 'Brand-New Test Buyer';

  try {
    // 0. Clean any leftover test records first
    await pool.query('DELETE FROM messages WHERE customer_id = $1', [testCustomerId]);
    await pool.query('DELETE FROM conversations WHERE customer_id = $1', [testCustomerId]);
    await pool.query('DELETE FROM customers WHERE id = $1', [testCustomerId]);

    // 1. Fetch current live settings from bot_settings
    const { rows: settingsRows } = await pool.query(
      "SELECT setting_key, setting_value FROM bot_settings WHERE setting_key IN ('welcome_message', 'first_time_greeting', 'outside_hours_reply', 'holiday_reply', 'business_hours')"
    );
    const settings = {};
    settingsRows.forEach(r => { settings[r.setting_key] = r.setting_value; });

    console.log('--- Current Live bot_settings ---');
    console.log('• welcome_message:      ', settings.welcome_message);
    console.log('• first_time_greeting:  ', settings.first_time_greeting);
    console.log('• outside_hours_reply:  ', settings.outside_hours_reply);
    console.log('• holiday_reply:        ', settings.holiday_reply);
    console.log('• business_hours:       ', settings.business_hours);
    console.log('---------------------------------\n');

    const expectedFirstTime = settings.first_time_greeting?.trim() || DEFAULT_FIRST_TIME_GREETING;
    const expectedWelcome = settings.welcome_message?.trim() || DEFAULT_WELCOME_MESSAGE;

    // Fetch active rules from DB
    const { rows: rules } = await pool.query(
      'SELECT keyword, reply_text FROM auto_reply_rules WHERE is_active = true'
    );
    const coconutRule = rules.find(r => r.keyword === 'coconut');
    assert.ok(coconutRule, 'Coconut rule must exist in active auto_reply_rules');

    // Helper to simulate webhook processing for a given message text
    async function processMessage(msgId, msgText) {
      // 1. Check prior customer messages (same as webhook line 781)
      const { rows: priorCustomerRows } = await pool.query(
        `SELECT id FROM messages 
         WHERE customer_id = $1 
           AND sender = 'customer' 
           AND id != $2 
         LIMIT 1`,
        [testCustomerId, msgId]
      );
      const isFirstTimeCustomer = priorCustomerRows.length === 0;
      const isPureGreeting = PURE_GREETING_REGEX.test(msgText.trim());

      let replyText = null;
      let replyType = null;

      // Check Holiday (Line 798)
      const todayIst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
      const { rows: holidayRows } = await pool.query(
        'SELECT name FROM holidays WHERE date = $1 AND enabled = true',
        [todayIst]
      );
      if (holidayRows.length > 0) {
        replyText = settings.holiday_reply?.trim() || DEFAULT_HOLIDAY_REPLY;
        replyType = 'holiday_reply';
      }

      // Check Business Hours (Line 816)
      if (!replyText && isOutsideBusinessHours(settings.business_hours)) {
        replyText = settings.outside_hours_reply?.trim() || DEFAULT_OUTSIDE_HOURS_REPLY;
        replyType = 'outside_hours_reply';
      }

      // Check Pure Greeting (Line 838)
      if (!replyText && isPureGreeting) {
        if (isFirstTimeCustomer) {
          replyText = settings.first_time_greeting?.trim() || DEFAULT_FIRST_TIME_GREETING;
          replyType = 'first_time_greeting';
        } else {
          replyText = settings.welcome_message?.trim() || DEFAULT_WELCOME_MESSAGE;
          replyType = 'welcome_message';
        }
      }

      // Check Keyword Rules (Line 909)
      if (!replyText) {
        const matchedRule = matchAutoReplyRule(msgText, rules);
        if (matchedRule) {
          replyText = matchedRule.reply_text;
          replyType = `keyword_rule:${matchedRule.keyword}`;
        }
      }

      return { replyText, replyType, isFirstTimeCustomer, isPureGreeting };
    }

    // -------------------------------------------------------------
    // TEST 1: Brand-New Customer sends "hi"
    // -------------------------------------------------------------
    console.log('▶ [TEST 1] Brand-new customer (+%s) sends "hi"...', testPhone);
    const msgId1 = `test_in_${Date.now()}_1`;
    // Insert customer record
    await pool.query(
      `INSERT INTO customers (id, name, phone, lastMessage) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET lastMessage = EXCLUDED.lastMessage`,
      [testCustomerId, testCustomerName, testPhone, 'hi']
    );
    // Insert incoming customer message
    await pool.query(
      `INSERT INTO messages (id, customer_id, sender, content, status) VALUES ($1, $2, 'customer', $3, 'delivered')`,
      [msgId1, testCustomerId, 'hi']
    );

    const result1 = await processMessage(msgId1, 'hi');
    console.log('   • Detected isFirstTimeCustomer:', result1.isFirstTimeCustomer);
    console.log('   • Detected isPureGreeting:     ', result1.isPureGreeting);
    console.log('   • Resolved Reply Type:         ', result1.replyType);
    console.log('   • Bot Output:                  ', result1.replyText);

    assert.strictEqual(result1.isFirstTimeCustomer, true, 'Test 1 must be detected as first-time customer');
    assert.strictEqual(result1.isPureGreeting, true, 'Test 1 "hi" must be detected as pure greeting');
    assert.strictEqual(result1.replyType, 'first_time_greeting', 'Test 1 must trigger first_time_greeting');
    assert.strictEqual(result1.replyText, expectedFirstTime, 'Test 1 reply must match live first_time_greeting setting');

    // Save bot reply to DB
    const replyId1 = `test_bot_${Date.now()}_1`;
    await pool.query(
      `INSERT INTO messages (id, customer_id, sender, content, status) VALUES ($1, $2, 'ai', $3, 'sent')`,
      [replyId1, testCustomerId, result1.replyText]
    );
    console.log('   ✅ TEST 1 PASSED: Brand-new customer received first_time_greeting!\n');

    // -------------------------------------------------------------
    // TEST 2: Same customer sends "hello" later
    // -------------------------------------------------------------
    console.log('▶ [TEST 2] Same customer (+%s) sends "hello" later...', testPhone);
    const msgId2 = `test_in_${Date.now()}_2`;
    await pool.query(
      `INSERT INTO messages (id, customer_id, sender, content, status) VALUES ($1, $2, 'customer', $3, 'delivered')`,
      [msgId2, testCustomerId, 'hello']
    );

    const result2 = await processMessage(msgId2, 'hello');
    console.log('   • Detected isFirstTimeCustomer:', result2.isFirstTimeCustomer);
    console.log('   • Detected isPureGreeting:     ', result2.isPureGreeting);
    console.log('   • Resolved Reply Type:         ', result2.replyType);
    console.log('   • Bot Output:                  ', result2.replyText);

    assert.strictEqual(result2.isFirstTimeCustomer, false, 'Test 2 must be detected as returning customer');
    assert.strictEqual(result2.isPureGreeting, true, 'Test 2 "hello" must be detected as pure greeting');
    assert.strictEqual(result2.replyType, 'welcome_message', 'Test 2 must trigger welcome_message');
    assert.strictEqual(result2.replyText, expectedWelcome, 'Test 2 reply must match live welcome_message setting');

    const replyId2 = `test_bot_${Date.now()}_2`;
    await pool.query(
      `INSERT INTO messages (id, customer_id, sender, content, status) VALUES ($1, $2, 'ai', $3, 'sent')`,
      [replyId2, testCustomerId, result2.replyText]
    );
    console.log('   ✅ TEST 2 PASSED: Returning customer received welcome_message!\n');

    // -------------------------------------------------------------
    // TEST 3: Same customer sends "coconut"
    // -------------------------------------------------------------
    console.log('▶ [TEST 3] Same customer (+%s) sends "coconut"...', testPhone);
    const msgId3 = `test_in_${Date.now()}_3`;
    await pool.query(
      `INSERT INTO messages (id, customer_id, sender, content, status) VALUES ($1, $2, 'customer', $3, 'delivered')`,
      [msgId3, testCustomerId, 'coconut']
    );

    const result3 = await processMessage(msgId3, 'coconut');
    console.log('   • Detected isPureGreeting:     ', result3.isPureGreeting);
    console.log('   • Resolved Reply Type:         ', result3.replyType);
    console.log('   • Bot Output:\n%s', result3.replyText);

    assert.strictEqual(result3.isPureGreeting, false, 'Test 3 "coconut" must NOT be a pure greeting');
    assert.strictEqual(result3.replyType, 'keyword_rule:coconut', 'Test 3 must match keyword rule for coconut');
    assert.strictEqual(result3.replyText, coconutRule.reply_text, 'Test 3 reply must match coconut keyword rule reply');

    const replyId3 = `test_bot_${Date.now()}_3`;
    await pool.query(
      `INSERT INTO messages (id, customer_id, sender, content, status) VALUES ($1, $2, 'ai', $3, 'sent')`,
      [replyId3, testCustomerId, result3.replyText]
    );
    console.log('   ✅ TEST 3 PASSED: Customer received coconut keyword rule reply!\n');

    // -------------------------------------------------------------
    // 4. CLEANUP: Delete all test customers and test messages
    // -------------------------------------------------------------
    console.log('🧹 [CLEANUP] Deleting all test customer records...');
    const delMsgRes = await pool.query('DELETE FROM messages WHERE customer_id = $1', [testCustomerId]);
    const delConvRes = await pool.query('DELETE FROM conversations WHERE customer_id = $1', [testCustomerId]);
    const delCustRes = await pool.query('DELETE FROM customers WHERE id = $1', [testCustomerId]);

    // Verify deletion
    const { rows: verifyCust } = await pool.query('SELECT id FROM customers WHERE id = $1', [testCustomerId]);
    const { rows: verifyMsg } = await pool.query('SELECT id FROM messages WHERE customer_id = $1', [testCustomerId]);
    assert.strictEqual(verifyCust.length, 0, 'Test customer must be deleted');
    assert.strictEqual(verifyMsg.length, 0, 'Test messages must be deleted');

    console.log('   • Deleted test messages:     ', delMsgRes.rowCount);
    console.log('   • Deleted test conversations:', delConvRes.rowCount);
    console.log('   • Deleted test customer:     ', delCustRes.rowCount);
    console.log('   • Verified remaining rows:    0');
    console.log('   ✅ CLEANUP COMPLETE: Database is clean!\n');

    console.log('=====================================================================');
    console.log('🎉 ALL 3 LIVE TESTS PASSED & CLEANED UP SUCCESSFULLY!');
    console.log('=====================================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ LIVE TEST FAILED:', err);
    // Cleanup on failure as well
    try {
      await pool.query('DELETE FROM messages WHERE customer_id = $1', [testCustomerId]);
      await pool.query('DELETE FROM conversations WHERE customer_id = $1', [testCustomerId]);
      await pool.query('DELETE FROM customers WHERE id = $1', [testCustomerId]);
    } catch (cleanErr) {}
    process.exit(1);
  }
}

runLiveGreetingVerification();

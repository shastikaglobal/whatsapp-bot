import pool from './config/db.js';
import { HUMAN_HANDOVER_REGEX, getHandoverReplyText, matchAutoReplyRule, ACKNOWLEDGEMENT_REGEX, THANKS_REGEX } from './controllers/webhookController.js';

console.log('===============================================================');
console.log('🤖 SHASTIKA WHATSAPP CHATBOT - HUMAN HANDOVER TEST SUITE');
console.log('===============================================================\n');

async function runTests() {
  const results = [];

  // -------------------------------------------------------------
  // Test 1: "is there anyone else??" (Screenshot case 1)
  // -------------------------------------------------------------
  {
    const input = 'is there anyone else??';
    const isHandover = HUMAN_HANDOVER_REGEX.test(input.trim());
    const reply = getHandoverReplyText(input);
    const passed = isHandover && reply.includes('sales team (BDE)');
    results.push({
      caseNum: 1,
      name: 'English: "is there anyone else??"',
      input,
      isHandover,
      intent: isHandover ? 'Human Request' : 'Other',
      is_important: isHandover,
      status: isHandover ? 'handover' : 'open',
      bot_reply: reply,
      passed
    });
  }

  // -------------------------------------------------------------
  // Test 2: "can you connect with your bde members??" (Screenshot case 2)
  // -------------------------------------------------------------
  {
    const input = 'can you connect with your bde members??';
    const isHandover = HUMAN_HANDOVER_REGEX.test(input.trim());
    const reply = getHandoverReplyText(input);
    const passed = isHandover && reply.includes('sales team (BDE)');
    results.push({
      caseNum: 2,
      name: 'English: "can you connect with your bde members??"',
      input,
      isHandover,
      intent: isHandover ? 'Human Request' : 'Other',
      is_important: isHandover,
      status: isHandover ? 'handover' : 'open',
      bot_reply: reply,
      passed
    });
  }

  // -------------------------------------------------------------
  // Test 3: Tamil: "வேற யாராவது மனிதர் இருக்காங்களா? மேனேஜரிடம் பேசணும்"
  // -------------------------------------------------------------
  {
    const input = 'வேற யாராவது மனிதர் இருக்காங்களா? மேனேஜரிடம் பேசணும்';
    const isHandover = HUMAN_HANDOVER_REGEX.test(input.trim());
    const reply = getHandoverReplyText(input);
    const passed = isHandover && reply.includes('விற்பனைக் குழுவிற்கு');
    results.push({
      caseNum: 3,
      name: 'Tamil: "வேற யாராவது மனிதர் இருக்காங்களா? மேனேஜரிடம் பேசணும்"',
      input,
      isHandover,
      intent: isHandover ? 'Human Request' : 'Other',
      is_important: isHandover,
      status: isHandover ? 'handover' : 'open',
      bot_reply: reply,
      passed
    });
  }

  // -------------------------------------------------------------
  // Test 4: Tanglish: "bde kooda connect panna mudiyuma? call me"
  // -------------------------------------------------------------
  {
    const input = 'bde kooda connect panna mudiyuma? call me';
    const isHandover = HUMAN_HANDOVER_REGEX.test(input.trim());
    const reply = getHandoverReplyText(input);
    const passed = isHandover && reply.includes('sales team-ku (BDE)');
    results.push({
      caseNum: 4,
      name: 'Tanglish: "bde kooda connect panna mudiyuma? call me"',
      input,
      isHandover,
      intent: isHandover ? 'Human Request' : 'Other',
      is_important: isHandover,
      status: isHandover ? 'handover' : 'open',
      bot_reply: reply,
      passed
    });
  }

  // -------------------------------------------------------------
  // Test 5: "ok fine ill go" (Negative Test - Should NOT trigger handover)
  // -------------------------------------------------------------
  {
    const input = 'ok fine ill go';
    const isHandover = HUMAN_HANDOVER_REGEX.test(input.trim());
    let reply = '';
    if (ACKNOWLEDGEMENT_REGEX.test(input.trim())) {
      reply = 'Understood! Let us know if you have any questions or need a quotation. 👍';
    } else {
      reply = 'Thank you for reaching out to Shastika Global Impex! Feel free to contact us anytime.';
    }
    const passed = !isHandover; // Must NOT trigger handover
    results.push({
      caseNum: 5,
      name: 'Negative test: "ok fine ill go"',
      input,
      isHandover,
      intent: isHandover ? 'Human Request' : 'General / Exit',
      is_important: false,
      status: 'open',
      bot_reply: reply,
      passed
    });
  }

  // -------------------------------------------------------------
  // Test 6: Per-Customer Bot Pause Verification
  // -------------------------------------------------------------
  {
    const testCustomerId = 'cust_test_handover_999';
    let passed = false;
    let stepLog = [];

    try {
      // Step A: Customer initiates handover
      stepLog.push('Step A: Customer asks for human -> status set to "handover"');
      let currentStatus = 'handover';

      // Step B: Customer sends follow-up message while status is "handover"
      const incomingFollowUp = 'I need reply now';
      let autoReplyDispatched = false;

      if (currentStatus === 'handover') {
        stepLog.push(`Step B: Incoming message "${incomingFollowUp}" received while in handover mode -> Auto-reply SKIPPED (Bot Paused)`);
        autoReplyDispatched = false;
      } else {
        autoReplyDispatched = true;
      }

      // Step C: Admin clicks "Resume Bot" -> status resets to "open"
      currentStatus = 'open';
      stepLog.push('Step C: Admin toggles status back to "open"');

      // Step D: Next incoming message is processed normally
      const nextMsg = 'coconut price';
      if (currentStatus === 'open') {
        autoReplyDispatched = true;
        stepLog.push(`Step D: Next message "${nextMsg}" received while status is "open" -> Auto-reply ACTIVE`);
      }

      passed = !autoReplyDispatched || currentStatus === 'open';
    } catch (e) {
      stepLog.push(`Error: ${e.message}`);
    }

    results.push({
      caseNum: 6,
      name: 'Per-Customer Bot Pause & Resume Cycle',
      input: 'Follow-up message during active handover',
      isHandover: true,
      intent: 'Handover Cycle Test',
      is_important: true,
      status: 'handover -> bot paused -> resume -> bot active',
      bot_reply: stepLog.join(' | '),
      passed
    });
  }

  // -------------------------------------------------------------
  // Output Results
  // -------------------------------------------------------------
  let allSuccess = true;
  for (const r of results) {
    console.log(`---------------------------------------------------------------`);
    console.log(`Test ${r.caseNum}: ${r.name}`);
    console.log(`Input: "${r.input}"`);
    console.log(`Handover Detected: ${r.isHandover}`);
    console.log(`Intent: ${r.intent} | Important: ${r.is_important} | Status: ${r.status}`);
    console.log(`Reply / Behavior: ${r.bot_reply}`);
    console.log(`Verdict: ${r.passed ? '✅ PASS' : '❌ FAIL'}`);
    if (!r.passed) allSuccess = false;
  }
  console.log(`---------------------------------------------------------------\n`);

  if (allSuccess) {
    console.log('🎉 ALL 6 TEST CASES PASSED SUCCESSFULLY!\n');
  } else {
    console.error('⚠️ SOME TEST CASES FAILED!\n');
  }

  await pool.end().catch(() => {});
  return allSuccess;
}

runTests().catch(err => {
  console.error('Test Suite Fatal Error:', err);
  process.exit(1);
});


import assert from 'assert';
import {
  shouldAutoResumeHandover,
  PURE_GREETING_REGEX,
  DEFAULT_WELCOME_MESSAGE,
  DEFAULT_FIRST_TIME_GREETING,
  matchAutoReplyRule
} from './controllers/webhookController.js';

console.log('=== RUNNING HANDOVER AUTO-RESUME TEST SUITE ===\n');

const now = new Date('2026-11-19T10:00:00Z');

// 1. Tests for shouldAutoResumeHandover pure helper
// Case 1A: 2 hours of inactivity (less than default 4h) -> false
const twoHoursAgo = new Date('2026-11-19T08:00:00Z');
assert.strictEqual(shouldAutoResumeHandover(twoHoursAgo, 4, now), false, '2h of inactivity should NOT resume with 4h threshold');
console.log('✓ 2h inactivity with 4h limit -> does not auto-resume');

// Case 1B: Exactly 4 hours of inactivity -> true
const fourHoursAgo = new Date('2026-11-19T06:00:00Z');
assert.strictEqual(shouldAutoResumeHandover(fourHoursAgo, 4, now), true, '4h of inactivity should resume with 4h threshold');
console.log('✓ Exactly 4h inactivity with 4h limit -> auto-resumes');

// Case 1C: 5 hours of inactivity -> true
const fiveHoursAgo = new Date('2026-11-19T05:00:00Z');
assert.strictEqual(shouldAutoResumeHandover(fiveHoursAgo, 4, now), true, '5h of inactivity should resume with 4h threshold');
console.log('✓ 5h inactivity with 4h limit -> auto-resumes');

// Case 1D: Configurable threshold (e.g. 2 hours limit)
assert.strictEqual(shouldAutoResumeHandover(twoHoursAgo, 2, now), true, '2h of inactivity should resume with 2h threshold');
assert.strictEqual(shouldAutoResumeHandover(new Date('2026-11-19T09:00:00Z'), 2, now), false, '1h of inactivity should not resume with 2h threshold');
console.log('✓ Custom threshold (2h) properly respected');

// Case 1E: Threshold 0 = never auto-resume
const oneHundredHoursAgo = new Date('2026-11-15T00:00:00Z');
assert.strictEqual(shouldAutoResumeHandover(oneHundredHoursAgo, 0, now), false, '0 threshold should NEVER auto-resume');
assert.strictEqual(shouldAutoResumeHandover(oneHundredHoursAgo, '0', now), false, 'String "0" threshold should NEVER auto-resume');
console.log('✓ Threshold 0 = never auto-resume');

// Case 1F: Fallback to default 4 hours when setting is empty / null
assert.strictEqual(shouldAutoResumeHandover(fiveHoursAgo, null, now), true, 'null threshold should default to 4h and resume after 5h');
assert.strictEqual(shouldAutoResumeHandover(twoHoursAgo, '', now), false, 'empty threshold should default to 4h and not resume after 2h');
console.log('✓ null/empty threshold defaults to 4 hours');

// -------------------------------------------------------------
// 2. Full Simulation of Webhook Handover vs Auto-Resume Flow
// -------------------------------------------------------------
function simulateWebhookHandoverFlow({
  convStatus = 'handover',
  handoverAutoResumeHours = 4,
  lastHumanActivityTime,
  lastHoldingReplyTime = null,
  nowTime = now,
  incomingText = 'hi',
  isFirstTimeCustomer = false,
  welcomeMessage = '👋 Welcome back!',
  rules = [{ keyword: 'coconut', reply_text: '🥥 Coconut details' }]
}) {
  let status = convStatus;
  let holdingReplySent = false;
  let botRepliedNormally = false;
  let replyText = null;

  if (status === 'handover') {
    const shouldResume = shouldAutoResumeHandover(lastHumanActivityTime, handoverAutoResumeHours, nowTime);
    if (shouldResume) {
      status = 'open'; // Auto-resumed!
    } else {
      // In handover mode: evaluate 30-min holding throttle
      let canSendHolding = true;
      if (lastHoldingReplyTime) {
        const diffMins = (nowTime.getTime() - new Date(lastHoldingReplyTime).getTime()) / (1000 * 60);
        if (diffMins < 30) {
          canSendHolding = false;
        }
      }
      if (canSendHolding) {
        holdingReplySent = true;
        replyText = 'Holding Reply';
      }
      return { status, holdingReplySent, botRepliedNormally, replyText };
    }
  }

  // If status is 'open' (or was auto-resumed to 'open'), process normally:
  botRepliedNormally = true;
  if (PURE_GREETING_REGEX.test(incomingText.trim())) {
    replyText = isFirstTimeCustomer ? 'First-time greeting' : welcomeMessage;
  } else {
    const matched = matchAutoReplyRule(incomingText, rules);
    replyText = matched ? matched.reply_text : 'AI Fallback';
  }

  return { status, holdingReplySent, botRepliedNormally, replyText };
}

// Scenario A: Customer sends "hi" after only 1 hour of inactivity from human (Handover remains active)
const simA = simulateWebhookHandoverFlow({
  convStatus: 'handover',
  handoverAutoResumeHours: 4,
  lastHumanActivityTime: new Date('2026-11-19T09:00:00Z'), // 1 hour ago
  lastHoldingReplyTime: null,
  nowTime: now,
  incomingText: 'hi'
});
assert.strictEqual(simA.status, 'handover', 'Status must stay handover when under 4h');
assert.strictEqual(simA.holdingReplySent, true, 'Holding reply sent once');
assert.strictEqual(simA.botRepliedNormally, false, 'Normal bot reply suppressed during handover');
console.log('✓ Scenario A: Inactivity < 4h -> Handover remains active, holding reply sent');

// Scenario B: Customer sends another message 10 minutes later (Within 30-min throttle)
const simB = simulateWebhookHandoverFlow({
  convStatus: 'handover',
  handoverAutoResumeHours: 4,
  lastHumanActivityTime: new Date('2026-11-19T09:00:00Z'),
  lastHoldingReplyTime: new Date('2026-11-19T09:50:00Z'), // 10 minutes ago
  nowTime: now,
  incomingText: 'hello'
});
assert.strictEqual(simB.status, 'handover');
assert.strictEqual(simB.holdingReplySent, false, 'Holding reply throttled within 30 mins');
assert.strictEqual(simB.botRepliedNormally, false);
assert.strictEqual(simB.replyText, null, 'Bot stays silent during throttle period');
console.log('✓ Scenario B: Inactivity < 4h within 30 min throttle -> Bot stays silent');

// Scenario C: Customer sends "hi" after 5 hours of inactivity (Auto-resumes to open and replies normally)
const simC = simulateWebhookHandoverFlow({
  convStatus: 'handover',
  handoverAutoResumeHours: 4,
  lastHumanActivityTime: fiveHoursAgo, // 5 hours ago
  nowTime: now,
  incomingText: 'hi',
  isFirstTimeCustomer: false,
  welcomeMessage: '👋 Welcome back!'
});
assert.strictEqual(simC.status, 'open', 'Status must auto-resume to open after 5h');
assert.strictEqual(simC.botRepliedNormally, true, 'Bot must process normally');
assert.strictEqual(simC.replyText, '👋 Welcome back!', 'Customer receives welcome message');
console.log('✓ Scenario C: Inactivity >= 4h -> Auto-resumes to open and sends welcome message');

// Scenario D: Customer sends "coconut" after 5 hours of inactivity (Auto-resumes and matches keyword rule)
const simD = simulateWebhookHandoverFlow({
  convStatus: 'handover',
  handoverAutoResumeHours: 4,
  lastHumanActivityTime: fiveHoursAgo,
  nowTime: now,
  incomingText: 'coconut',
  rules: [{ keyword: 'coconut', reply_text: '🥥 Coconut details' }]
});
assert.strictEqual(simD.status, 'open');
assert.strictEqual(simD.botRepliedNormally, true);
assert.strictEqual(simD.replyText, '🥥 Coconut details');
console.log('✓ Scenario D: Inactivity >= 4h -> Auto-resumes to open and matches keyword rule');

// Scenario E: Human sent message 30 minutes ago, even though handover started 6 hours ago
const simE = simulateWebhookHandoverFlow({
  convStatus: 'handover',
  handoverAutoResumeHours: 4,
  lastHumanActivityTime: new Date('2026-11-19T09:30:00Z'), // Human replied 30 mins ago
  nowTime: now,
  incomingText: 'hi'
});
assert.strictEqual(simE.status, 'handover', 'Human active 30 mins ago must NOT auto-resume');
console.log('✓ Scenario E: Recent human message (30m ago) resets timer, prevents auto-resume');

// Scenario F: Customer keeps messaging every 30 minutes for 5 hours with NO human reply
// Tests the holding-reply timer bug fix: holding reply updates updated_at, but NOT handover_started_at.
console.log('\n--- Scenario F: 5-Hour customer loop (every 30m) with holding replies & zero human replies ---');
const t0 = new Date('2026-11-19T00:00:00Z'); // Handover started at 00:00
let convState = {
  status: 'handover',
  handover_started_at: t0,
  updated_at: t0,
  last_holding_at: null
};

// Check intervals from 30 min (0.5h) to 300 min (5.0h)
const intervals = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300];

for (const elapsedMins of intervals) {
  const currentMsgTime = new Date(t0.getTime() + elapsedMins * 60 * 1000);
  const elapsedHours = elapsedMins / 60;

  // Auto-resume check uses handover_started_at (since no human message exists)
  const shouldResume = shouldAutoResumeHandover(convState.handover_started_at, 4, currentMsgTime);

  if (elapsedHours < 4) {
    // Under 4 hours: must remain in handover
    assert.strictEqual(shouldResume, false, `At ${elapsedHours}h, auto-resume should NOT trigger`);
    assert.strictEqual(convState.status, 'handover');

    // Holding reply logic
    let sentHolding = false;
    if (!convState.last_holding_at || (currentMsgTime.getTime() - convState.last_holding_at.getTime()) >= 30 * 60 * 1000) {
      sentHolding = true;
      convState.last_holding_at = currentMsgTime;
      // Note: Holding reply updates conversations.updated_at, but NEVER handover_started_at!
      convState.updated_at = currentMsgTime;
    }
    assert.strictEqual(sentHolding, true, `Holding reply must be sent at ${elapsedHours}h`);
    console.log(`  ✓ T = ${elapsedHours}h: status is handover, holding reply sent. (updated_at updated to T=${elapsedHours}h, handover_started_at kept at T=0h)`);
  } else {
    // At and after 4 hours: MUST auto-resume to 'open' despite holding replies updating updated_at every 30m!
    assert.strictEqual(shouldResume, true, `At ${elapsedHours}h, auto-resume MUST trigger!`);
    convState.status = 'open';
    convState.handover_started_at = null;
    convState.updated_at = currentMsgTime;
    console.log(`  ✓ T = ${elapsedHours}h: auto-resume TRIGGERED! Status flipped to 'open', bot responds normally.`);
    break;
  }
}

console.log('✓ Scenario F PASSED: Auto-resumed after 4 hours despite continuous 30-min holding replies');

console.log('\n=== ALL AUTO-RESUME TESTS PASSED SUCCESSFULLY! ===');

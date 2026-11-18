import assert from 'assert';
import {
  PURE_GREETING_REGEX,
  DEFAULT_WELCOME_MESSAGE,
  DEFAULT_FIRST_TIME_GREETING,
  DEFAULT_OUTSIDE_HOURS_REPLY,
  DEFAULT_HOLIDAY_REPLY,
  parseTimeString,
  isOutsideBusinessHours,
  matchAutoReplyRule
} from './controllers/webhookController.js';

console.log('=== RUNNING GREETING MESSAGES SUITE ===\n');

// 1. Test parseTimeString
assert.strictEqual(parseTimeString('9AM'), 540);
assert.strictEqual(parseTimeString('9am'), 540);
assert.strictEqual(parseTimeString('09:00'), 540);
assert.strictEqual(parseTimeString('5PM'), 1020);
assert.strictEqual(parseTimeString('18:00'), 1080);
assert.strictEqual(parseTimeString('12PM'), 720); // noon
assert.strictEqual(parseTimeString('12AM'), 0); // midnight
assert.strictEqual(parseTimeString('9:30 AM'), 570);
assert.strictEqual(parseTimeString('6:45 PM'), 1125);
assert.strictEqual(parseTimeString('invalid'), null);
console.log('✓ parseTimeString tests passed');

// 2. Test isOutsideBusinessHours
assert.strictEqual(isOutsideBusinessHours('24 hours'), false, '24 hours should never be outside hours');
assert.strictEqual(isOutsideBusinessHours('24/7'), false, '24/7 should never be outside hours');
assert.strictEqual(isOutsideBusinessHours(''), false, 'Empty should default to open');
assert.strictEqual(isOutsideBusinessHours(null), false, 'Null should default to open');

// Daytime test (2:00 PM IST = 14:00 = 840 mins)
const dayDate = new Date('2026-11-19T08:30:00Z'); // 14:00 IST
assert.strictEqual(isOutsideBusinessHours('9AM - 5PM', dayDate), false, '2 PM IST should be inside 9AM - 5PM');
assert.strictEqual(isOutsideBusinessHours('09:00 - 18:00', dayDate), false, '2 PM IST should be inside 09:00 - 18:00');

// Nighttime test (10:00 PM IST = 22:00 = 1320 mins)
const nightDate = new Date('2026-11-19T16:30:00Z'); // 22:00 IST
assert.strictEqual(isOutsideBusinessHours('9AM - 5PM', nightDate), true, '10 PM IST should be outside 9AM - 5PM');
assert.strictEqual(isOutsideBusinessHours('09:00 - 18:00', nightDate), true, '10 PM IST should be outside 09:00 - 18:00');

// Early morning test (4:00 AM IST = 04:00 = 240 mins)
const earlyDate = new Date('2026-11-18T22:30:00Z'); // 04:00 IST
assert.strictEqual(isOutsideBusinessHours('9AM - 6PM', earlyDate), true, '4 AM IST should be outside 9AM - 6PM');

// Weekend test (Sunday = 2026-11-22)
const sundayDate = new Date('2026-11-22T08:30:00Z'); // Sunday 14:00 IST
assert.strictEqual(isOutsideBusinessHours('Mon-Fri 9AM - 5PM', sundayDate), true, 'Sunday should be outside Mon-Fri hours');
assert.strictEqual(isOutsideBusinessHours('Mon-Sat 9AM - 5PM', sundayDate), true, 'Sunday should be outside Mon-Sat hours');

console.log('✓ isOutsideBusinessHours tests passed');

// 3. Test PURE_GREETING_REGEX
assert.ok(PURE_GREETING_REGEX.test('hi'));
assert.ok(PURE_GREETING_REGEX.test('Hi!'));
assert.ok(PURE_GREETING_REGEX.test('hello'));
assert.ok(PURE_GREETING_REGEX.test('hey'));
assert.ok(PURE_GREETING_REGEX.test('vanakkam'));
assert.ok(PURE_GREETING_REGEX.test('வணக்கம்'));
assert.ok(PURE_GREETING_REGEX.test('good morning'));
assert.ok(!PURE_GREETING_REGEX.test('hi i want coconut'), 'Greeting with product enquiry must NOT be pure greeting');
assert.ok(!PURE_GREETING_REGEX.test('talk to bde'), 'Handover request must NOT be pure greeting');
console.log('✓ PURE_GREETING_REGEX tests passed');

// 4. Test Simulation of Message Hierarchy
function simulateAutoReply({
  msgText,
  isHoliday = false,
  holidayName = 'Diwali',
  holidayReplySetting = '',
  businessHoursSetting = '24 hours',
  outsideHoursReplySetting = '',
  currentTime = new Date('2026-11-19T08:30:00Z'), // 2 PM IST
  isFirstTimeCustomer = true,
  firstTimeGreetingSetting = '',
  welcomeMessageSetting = '',
  rules = [
    { keyword: 'hi', reply_text: 'Rule HI' },
    { keyword: 'hello', reply_text: 'Rule HELLO' },
    { keyword: 'coconut', reply_text: 'Rule COCONUT' }
  ]
}) {
  let replyText = null;

  // 1. Holiday Check
  if (isHoliday) {
    replyText = holidayReplySetting?.trim() || DEFAULT_HOLIDAY_REPLY;
    return { type: 'holiday_reply', replyText };
  }

  // 2. Business Hours Check
  if (isOutsideBusinessHours(businessHoursSetting, currentTime)) {
    replyText = outsideHoursReplySetting?.trim() || DEFAULT_OUTSIDE_HOURS_REPLY;
    return { type: 'outside_hours_reply', replyText };
  }

  // 3. First-Time vs Returning Customer Greeting Check
  const isPureGreeting = PURE_GREETING_REGEX.test(msgText.trim());
  if (isPureGreeting) {
    if (isFirstTimeCustomer) {
      replyText = firstTimeGreetingSetting?.trim() || DEFAULT_FIRST_TIME_GREETING;
      return { type: 'first_time_greeting', replyText };
    } else {
      replyText = welcomeMessageSetting?.trim() || DEFAULT_WELCOME_MESSAGE;
      return { type: 'welcome_message', replyText };
    }
  }

  // 7. Keyword Rules Check
  const matched = matchAutoReplyRule(msgText, rules);
  if (matched) {
    return { type: 'keyword_rule', replyText: matched.reply_text };
  }

  return { type: 'ai_fallback', replyText: 'AI Reply' };
}

// Case 1: First-Time Customer sends "hi" during business hours on normal day
const r1 = simulateAutoReply({
  msgText: 'hi',
  isFirstTimeCustomer: true,
  firstTimeGreetingSetting: 'Custom First Time Greeting 🎉'
});
assert.strictEqual(r1.type, 'first_time_greeting');
assert.strictEqual(r1.replyText, 'Custom First Time Greeting 🎉');
console.log('✓ Case 1: Brand-new customer first greeting -> first_time_greeting');

// Case 2: Returning Customer sends "hi" during business hours on normal day
const r2 = simulateAutoReply({
  msgText: 'hi',
  isFirstTimeCustomer: false,
  welcomeMessageSetting: 'Custom Welcome Back Message 👋'
});
assert.strictEqual(r2.type, 'welcome_message');
assert.strictEqual(r2.replyText, 'Custom Welcome Back Message 👋');
console.log('✓ Case 2: Returning customer greeting -> welcome_message');

// Case 3: Message arriving outside business hours (e.g. at night)
const r3 = simulateAutoReply({
  msgText: 'hi',
  businessHoursSetting: '9AM - 5PM',
  currentTime: new Date('2026-11-19T18:00:00Z'), // 11:30 PM IST
  outsideHoursReplySetting: 'Custom Outside Hours Reply 🕐'
});
assert.strictEqual(r3.type, 'outside_hours_reply');
assert.strictEqual(r3.replyText, 'Custom Outside Hours Reply 🕐');
console.log('✓ Case 3: Outside business hours -> outside_hours_reply');

// Case 4: Message arriving on a holiday
const r4 = simulateAutoReply({
  msgText: 'hi',
  isHoliday: true,
  holidayReplySetting: 'Custom Holiday Reply 🎄'
});
assert.strictEqual(r4.type, 'holiday_reply');
assert.strictEqual(r4.replyText, 'Custom Holiday Reply 🎄');
console.log('✓ Case 4: Holiday -> holiday_reply');

// Case 5: Empty settings fall back to non-empty defaults
const r5_firstTime = simulateAutoReply({
  msgText: 'hi',
  isFirstTimeCustomer: true,
  firstTimeGreetingSetting: ''
});
assert.strictEqual(r5_firstTime.replyText, DEFAULT_FIRST_TIME_GREETING);
assert.ok(r5_firstTime.replyText.length > 10);

const r5_welcome = simulateAutoReply({
  msgText: 'hi',
  isFirstTimeCustomer: false,
  welcomeMessageSetting: '   '
});
assert.strictEqual(r5_welcome.replyText, DEFAULT_WELCOME_MESSAGE);
assert.ok(r5_welcome.replyText.length > 10);

const r5_outside = simulateAutoReply({
  msgText: 'hi',
  businessHoursSetting: '9AM - 5PM',
  currentTime: new Date('2026-11-19T18:00:00Z'),
  outsideHoursReplySetting: ''
});
assert.strictEqual(r5_outside.replyText, DEFAULT_OUTSIDE_HOURS_REPLY);
assert.ok(r5_outside.replyText.length > 10);

const r5_holiday = simulateAutoReply({
  msgText: 'hi',
  isHoliday: true,
  holidayReplySetting: ''
});
assert.strictEqual(r5_holiday.replyText, DEFAULT_HOLIDAY_REPLY);
assert.ok(r5_holiday.replyText.length > 10);
console.log('✓ Case 5: Empty settings cleanly fall back to defaults (never empty)');

// Case 6: Keyword rule for "hi" does NOT override first_time_greeting or welcome_message
const r6 = simulateAutoReply({
  msgText: 'hi',
  isFirstTimeCustomer: true,
  firstTimeGreetingSetting: 'First time!',
  rules: [{ keyword: 'hi', reply_text: 'OVERRIDDEN HI RULE' }]
});
assert.strictEqual(r6.type, 'first_time_greeting');
assert.strictEqual(r6.replyText, 'First time!');

// Product inquiry with "hi" part still matches product keyword
const r6_product = simulateAutoReply({
  msgText: 'hi coconut price',
  isFirstTimeCustomer: true,
  rules: [
    { keyword: 'hi', reply_text: 'Rule HI' },
    { keyword: 'coconut', reply_text: 'Coconut details' }
  ]
});
assert.strictEqual(r6_product.type, 'keyword_rule');
assert.strictEqual(r6_product.replyText, 'Coconut details');
console.log('✓ Case 6: Seeded "hi" keyword rule does not override greetings');

console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');

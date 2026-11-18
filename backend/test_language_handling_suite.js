import { 
  detectMessageLanguage, 
  countDistinctTanglishTokens,
  resolveConversationLanguage, 
  getHandoverReplyText, 
  getHoldingReplyText,
  HUMAN_HANDOVER_REGEX,
  LANGUAGE_COMPLAINT_ENGLISH_REGEX 
} from './controllers/webhookController.js';

console.log('===============================================================');
console.log('🌐 SHASTIKA CHATBOT - LANGUAGE HANDLING & HOLDING TEST SUITE');
console.log('===============================================================\n');

function runTests() {
  const results = [];

  // -------------------------------------------------------------
  // Test 1: Pure English Handover Request ("i wanna talk your bde employee")
  // -------------------------------------------------------------
  {
    const input = 'i wanna talk your bde employee';
    const isHandover = HUMAN_HANDOVER_REGEX.test(input);
    const lang = detectMessageLanguage(input);
    const reply = getHandoverReplyText(input, lang);
    const passed = isHandover && lang === 'english' && reply.includes('sales team (BDE)') && !reply.includes('unga request');
    results.push({
      testNum: 1,
      name: 'Pure English handover: "i wanna talk your bde employee"',
      input,
      detectedLang: lang,
      isHandover,
      passed,
      replyPreview: reply.substring(0, 50) + '...'
    });
  }

  // -------------------------------------------------------------
  // Test 2: Tamil Script Handover Request ("வணக்கம், மேனேஜரிடம் பேச முடியுமா?")
  // -------------------------------------------------------------
  {
    const input = 'வணக்கம், மேனேஜரிடம் பேச முடியுமா?';
    const isHandover = HUMAN_HANDOVER_REGEX.test(input);
    const lang = detectMessageLanguage(input);
    const reply = getHandoverReplyText(input, lang);
    const passed = isHandover && lang === 'tamil' && reply.includes('விற்பனைக் குழுவிற்கு');
    results.push({
      testNum: 2,
      name: 'Tamil script handover: "வணக்கம், மேனேஜரிடம் பேச முடியுமா?"',
      input,
      detectedLang: lang,
      isHandover,
      passed,
      replyPreview: reply.substring(0, 50) + '...'
    });
  }

  // -------------------------------------------------------------
  // Test 3: Real Tanglish ("bde kooda pesanum")
  // -------------------------------------------------------------
  {
    const input = 'bde kooda pesanum';
    const tokenCount = countDistinctTanglishTokens(input);
    const lang = detectMessageLanguage(input);
    const reply = getHandoverReplyText(input, lang);
    const passed = tokenCount >= 2 && lang === 'tanglish' && reply.includes('sales team-ku (BDE)');
    results.push({
      testNum: 3,
      name: 'Real Tanglish with >= 2 tokens: "bde kooda pesanum"',
      input,
      distinctTokens: tokenCount,
      detectedLang: lang,
      passed,
      replyPreview: reply.substring(0, 50) + '...'
    });
  }

  // -------------------------------------------------------------
  // Test 4: English with Accidental Substrings ("younger passenger wants coconut quote from lounge")
  // ("younger" has "unga", "passenger" has "enga", "lounge" has "unga")
  // -------------------------------------------------------------
  {
    const input = 'younger passenger wants coconut quote from lounge';
    const tokenCount = countDistinctTanglishTokens(input);
    const lang = detectMessageLanguage(input);
    const passed = tokenCount === 0 && lang === 'english';
    results.push({
      testNum: 4,
      name: 'English with accidental substrings: "younger passenger..."',
      input,
      distinctTokens: tokenCount,
      detectedLang: lang,
      passed,
      replyPreview: 'Resolved as English (no false-positive Tanglish tokens)'
    });
  }

  // -------------------------------------------------------------
  // Test 5: Single Tanglish Token with English ("vanakkam, please share coconut quote")
  // -------------------------------------------------------------
  {
    const input = 'vanakkam, please share coconut quote';
    const tokenCount = countDistinctTanglishTokens(input);
    const lang = detectMessageLanguage(input);
    const passed = tokenCount === 1 && lang === 'english';
    results.push({
      testNum: 5,
      name: 'Single Tanglish token with English -> Defaults to English',
      input,
      distinctTokens: tokenCount,
      detectedLang: lang,
      passed,
      replyPreview: 'English (requires at least 2 distinct tokens for Tanglish)'
    });
  }

  // -------------------------------------------------------------
  // Test 6: "i cant understand the language" while in handover
  // -------------------------------------------------------------
  {
    const input = 'i cant understand the language';
    const isComplaint = LANGUAGE_COMPLAINT_ENGLISH_REGEX.test(input);
    const resolvedLang = resolveConversationLanguage(input, ['bde kooda pesanum'], 'tanglish');
    const holdingReply = getHoldingReplyText(resolvedLang, isComplaint);
    const passed = isComplaint && resolvedLang === 'english' && holdingReply.includes('in English') && !holdingReply.includes('unga request');
    results.push({
      testNum: 6,
      name: 'Customer complaint: "i cant understand the language" in handover',
      input,
      isComplaint,
      resolvedLang,
      passed,
      replyPreview: holdingReply
    });
  }

  // -------------------------------------------------------------
  // Test 7: Mixed Conversation that Starts in English
  // (Past messages had Tanglish, but current message is clear English)
  // -------------------------------------------------------------
  {
    const pastMsgs = ['bde kooda pesanum', 'seri unga name sollu'];
    const currentMsg = 'Can you please give me the export quotation for 25 metric tons?';
    const resolvedLang = resolveConversationLanguage(currentMsg, pastMsgs, 'tanglish');
    const passed = resolvedLang === 'english';
    results.push({
      testNum: 7,
      name: 'Mixed convo: Tanglish history, but current message is clear English',
      currentMsg,
      resolvedLang,
      passed,
      replyPreview: 'Switched to English because current message is clearly English'
    });
  }

  // -------------------------------------------------------------
  // Test 8: Short Acknowledgement ("ok") Respects Prior Conversation Language
  // -------------------------------------------------------------
  {
    const pastTamil = ['வணக்கம், கொப்பரை விலை என்ன?'];
    const resolvedTamilAck = resolveConversationLanguage('ok', pastTamil);
    const pastEnglish = ['What is the coconut price?'];
    const resolvedEnglishAck = resolveConversationLanguage('ok', pastEnglish);
    const passed = resolvedTamilAck === 'tamil' && resolvedEnglishAck === 'english';
    results.push({
      testNum: 8,
      name: 'Short neutral ack ("ok") preserves prior conversation language',
      tamilAck: resolvedTamilAck,
      englishAck: resolvedEnglishAck,
      passed,
      replyPreview: `Tamil prior -> ${resolvedTamilAck}, English prior -> ${resolvedEnglishAck}`
    });
  }

  // -------------------------------------------------------------
  // Test 9: Standard Handover Holding Reply Format
  // -------------------------------------------------------------
  {
    const enHolding = getHoldingReplyText('english');
    const taHolding = getHoldingReplyText('tamil');
    const tgHolding = getHoldingReplyText('tanglish');
    const passed = enHolding.includes('sales team has your request') && 
                   taHolding.includes('விற்பனைக் குழு') && 
                   tgHolding.includes('sales team unga request-ai');
    results.push({
      testNum: 9,
      name: 'Handover holding replies for all 3 languages (1 per 30 mins)',
      passed,
      replyPreview: enHolding
    });
  }

  console.table(results.map(r => ({
    '#': r.testNum,
    'Test Name': r.name,
    'Status': r.passed ? '✅ PASS' : '❌ FAIL',
    'Preview / Notes': r.replyPreview
  })));

  const allPassed = results.every(r => r.passed);
  console.log(`\nOVERALL STATUS: ${allPassed ? '✅ ALL 9 LANGUAGE TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  process.exit(allPassed ? 0 : 1);
}

runTests();

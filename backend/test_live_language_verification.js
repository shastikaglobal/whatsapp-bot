import axios from 'axios';
import pool from './config/db.js';

async function runLiveTest() {
  const testPhone = '919566266399';
  const testCustomerId = 'cust_' + testPhone;
  const msgId1 = 'wamid.test_' + Date.now() + '_1';
  const testMessage1 = 'i wanna talk your bde employee';

  console.log(`\n--- Test Step 1: Sending English handover message: "${testMessage1}" ---`);

  // Ensure fresh conversation state
  await pool.query('DELETE FROM messages WHERE customer_id = $1', [testCustomerId]);
  await pool.query('DELETE FROM conversations WHERE customer_id = $1', [testCustomerId]);
  await pool.query('DELETE FROM customers WHERE id = $1', [testCustomerId]);

  const payload1 = {
    object: 'whatsapp_business_account',
    entry: [{
      id: '123456789',
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '919789090920',
            phone_number_id: '1429324643600789'
          },
          contacts: [{
            profile: { name: 'English Test User' },
            wa_id: testPhone
          }],
          messages: [{
            from: testPhone,
            id: msgId1,
            timestamp: String(Math.floor(Date.now() / 1000)),
            text: { body: testMessage1 },
            type: 'text'
          }]
        }
      }]
    }]
  };

  const res1 = await axios.post('http://127.0.0.1:3000/api/webhook/whatsapp', payload1);
  console.log('Step 1 Webhook Status:', res1.status);
  await new Promise(r => setTimeout(r, 1500));

  const { rows: cust1 } = await pool.query('SELECT id, language, intent, is_important FROM customers WHERE id = $1', [testCustomerId]);
  console.log('Step 1 Customer State:', cust1[0]);

  const { rows: conv1 } = await pool.query('SELECT status, requires_admin_attention FROM conversations WHERE customer_id = $1', [testCustomerId]);
  console.log('Step 1 Conversation State:', conv1[0]);

  const { rows: msgs1 } = await pool.query('SELECT sender, content FROM messages WHERE customer_id = $1 ORDER BY timestamp ASC', [testCustomerId]);
  console.log('Step 1 Messages in DB:');
  msgs1.forEach(m => console.log(`  [${m.sender}] ${m.content}`));

  console.log('\n--- Test Step 2: Customer says "i cant understand the language" while in handover ---');
  const msgId2 = 'wamid.test_' + Date.now() + '_2';
  const testMessage2 = 'i cant understand the language';

  const payload2 = {
    object: 'whatsapp_business_account',
    entry: [{
      id: '123456789',
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '919789090920',
            phone_number_id: '1429324643600789'
          },
          contacts: [{
            profile: { name: 'English Test User' },
            wa_id: testPhone
          }],
          messages: [{
            from: testPhone,
            id: msgId2,
            timestamp: String(Math.floor(Date.now() / 1000)),
            text: { body: testMessage2 },
            type: 'text'
          }]
        }
      }]
    }]
  };

  const res2 = await axios.post('http://127.0.0.1:3000/api/webhook/whatsapp', payload2);
  console.log('Step 2 Webhook Status:', res2.status);
  await new Promise(r => setTimeout(r, 1500));

  const { rows: msgs2 } = await pool.query('SELECT sender, content FROM messages WHERE customer_id = $1 ORDER BY timestamp ASC', [testCustomerId]);
  console.log('Step 2 Messages in DB (Holding reply should be in English):');
  msgs2.forEach(m => console.log(`  [${m.sender}] ${m.content}`));

  console.log('\n--- Test Step 3: Rapid follow-up within 30 minutes (Throttle check) ---');
  const msgId3 = 'wamid.test_' + Date.now() + '_3';
  const testMessage3 = 'anyone there?';
  const payload3 = JSON.parse(JSON.stringify(payload2));
  payload3.entry[0].changes[0].value.messages[0].id = msgId3;
  payload3.entry[0].changes[0].value.messages[0].text.body = testMessage3;

  const res3 = await axios.post('http://127.0.0.1:3000/api/webhook/whatsapp', payload3);
  console.log('Step 3 Webhook Status:', res3.status);
  await new Promise(r => setTimeout(r, 1500));

  const { rows: msgs3 } = await pool.query('SELECT sender, content FROM messages WHERE customer_id = $1 ORDER BY timestamp ASC', [testCustomerId]);
  console.log('Step 3 Messages in DB (Should NOT send another holding reply within 30 mins):');
  msgs3.forEach(m => console.log(`  [${m.sender}] ${m.content}`));

  const step1Pass = conv1[0]?.status === 'handover' && 
                    cust1[0]?.language === 'english' && 
                    msgs1.some(m => m.sender === 'ai' && m.content.includes('sales team (BDE)') && !m.content.includes('unga request'));

  const step2Pass = msgs2.some(m => m.sender === 'holding' && m.content.includes('in English'));

  // Step 3 should still have only 1 holding message (throttled)
  const holdingCount = msgs3.filter(m => m.sender === 'holding').length;
  const step3Pass = holdingCount === 1;

  console.log('\n===============================================================');
  console.log(`LIVE VERIFICATION RESULT: ${step1Pass && step2Pass && step3Pass ? '✅ ALL LIVE TESTS PASSED' : '❌ LIVE TEST FAILED'}`);
  console.log('===============================================================');
  process.exit(step1Pass && step2Pass && step3Pass ? 0 : 1);
}

runLiveTest();

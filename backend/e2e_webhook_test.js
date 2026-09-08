import axios from 'axios';
import pool from './config/db.js';

const sendWebhook = async (name, phone, message) => {
  const msgId = 'wamid.' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  try {
    await axios.post('http://localhost:3000/webhook/whatsapp', {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            contacts: [{ profile: { name }, wa_id: phone }],
            messages: [{
              from: phone,
              id: msgId,
              text: { body: message },
              type: 'text'
            }]
          }
        }]
      }]
    });
    return true;
  } catch (error) {
    console.error(`Webhook Error for ${name}:`, error.message);
    return false;
  }
};

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function runE2ETest() {
  console.log("=== STARTING END-TO-END AUTOMATIC AI TEST ===");
  
  const test = { name: "Tanglish Customer", phone: "9990000010", msg: "tender coconut irukka?" };

  // Clear previous test data for this user
  await pool.query('DELETE FROM messages WHERE customer_id = ?', [`cust_${test.phone}`]);
  
  console.log(`\n-> [INCOMING] ${test.name} (${test.phone}): "${test.msg}"`);
  await sendWebhook(test.name, test.phone, test.msg);
  
  console.log("   [WAITING FOR AI GENERATION AND DB INSERTION...]");
  await delay(5000); 
  
  // Fetch from DB to prove it worked automatically
  const [messages] = await pool.query('SELECT sender, content FROM messages WHERE customer_id = ? ORDER BY timestamp ASC', [`cust_${test.phone}`]);
  
  if (messages.length === 0) {
    console.log(`   [ERROR] No messages found in DB for ${test.name}`);
  } else {
    messages.forEach(m => {
      if (m.sender === 'ai') {
        console.log(`   [BOT AUTOMATIC REPLY] "${m.content}"`);
      }
    });
  }

  console.log("\n=== TEST COMPLETE ===");
  process.exit(0);
}

runE2ETest();

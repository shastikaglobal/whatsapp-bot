import axios from 'axios';
import pool from './config/db.js';

const WEBHOOK_URL = 'http://localhost:3000/webhook/whatsapp';

const simulateWebhook = async (phone, name, text) => {
  const msgId = `wamid.${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const payload = {
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        value: {
          contacts: [{ profile: { name: name }, wa_id: phone }],
          messages: [{
            from: phone,
            id: msgId,
            text: { body: text },
            type: 'text'
          }]
        }
      }]
    }]
  };
  await axios.post(WEBHOOK_URL, payload);
};

const delay = ms => new Promise(res => setTimeout(res, ms));

async function runVerification() {
  const phone = "919876543210";
  const name = "Test Customer";
  const customerId = `cust_${phone}`;

  try {
    console.log("--- Resetting Database ---");
    await pool.query('DELETE FROM messages WHERE customer_id = ?', [customerId]);
    await pool.query('DELETE FROM conversations WHERE customer_id = ?', [customerId]);
    await pool.query('DELETE FROM customers WHERE id = ?', [customerId]);

    console.log("\n--- Testing UPDATE Settings API ---");
    await axios.put('http://localhost:3000/api/settings', {
      ai_model: 'gemini-flash-latest',
      ai_response_style: 'Super Enthusiastic Salesperson',
      ai_system_prompt: 'You are an incredibly energetic salesperson! Always use exclamation marks and be super excited about Shastika Global Impex!'
    });
    console.log("Settings Updated.");

    console.log("\n--- Sending Simulated Message ---");
    console.log(`Customer (${name}): Hi, do you have tender coconut? What is the price?`);
    await simulateWebhook(phone, name, 'Hi, do you have tender coconut? What is the price?');
    await delay(6000); // Wait for Gemini and DB

    let [convs] = await pool.query('SELECT status FROM conversations WHERE customer_id = ?', [customerId]);
    console.log(`Conversation in DB: ${convs.length > 0 ? convs[0].status : 'NOT FOUND'}`);

    let [msgs] = await pool.query('SELECT sender, content FROM messages WHERE customer_id = ? ORDER BY timestamp ASC', [customerId]);
    console.log("Messages in DB:");
    msgs.forEach(m => console.log(`[${m.sender}] ${m.content}`));

    console.log("\n--- Testing Take Over (Pause AI) ---");
    await axios.put(`http://localhost:3000/api/whatsapp/takeover`, { customerId, status: 'handover' });
    console.log("Customer: Can I speak to a human?");
    await simulateWebhook(phone, name, 'Can I speak to a human?');
    await delay(3000);

    [convs] = await pool.query('SELECT status FROM conversations WHERE customer_id = ?', [customerId]);
    console.log(`Conversation in DB after Take Over: ${convs.length > 0 ? convs[0].status : 'NOT FOUND'}`);

    [msgs] = await pool.query('SELECT sender, content FROM messages WHERE customer_id = ? ORDER BY timestamp ASC', [customerId]);
    console.log("Messages in DB (Should have no new AI reply):");
    msgs.forEach(m => console.log(`[${m.sender}] ${m.content}`));

    console.log("\n--- Testing Resume AI ---");
    await axios.put(`http://localhost:3000/api/whatsapp/takeover`, { customerId, status: 'open' });
    console.log("Customer: Thanks, I want coconut.");
    await simulateWebhook(phone, name, 'Thanks, I want coconut.');
    await delay(6000);

    [msgs] = await pool.query('SELECT sender, content FROM messages WHERE customer_id = ? ORDER BY timestamp ASC', [customerId]);
    console.log("Messages in DB (Should have new AI reply):");
    msgs.forEach(m => console.log(`[${m.sender}] ${m.content}`));

    console.log("\n--- Cleanup ---");
    await pool.query('DELETE FROM messages WHERE customer_id = ?', [customerId]);
    await pool.query('DELETE FROM conversations WHERE customer_id = ?', [customerId]);
    await pool.query('DELETE FROM customers WHERE id = ?', [customerId]);

  } catch (error) {
    console.error("Test Error:", error);
  } finally {
    process.exit(0);
  }
}

runVerification();

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

async function runTests() {
  const phone = "1234567890";
  const customerId = `cust_${phone}`;

  try {
    console.log("--- 1. Resetting Database ---");
    await pool.query('DELETE FROM messages');
    await pool.query('DELETE FROM conversations');
    await pool.query('DELETE FROM customers');
    
    // Seed products
    await pool.query('DELETE FROM products WHERE id IN ("test_p1", "test_p2")');
    await pool.query('INSERT INTO products (id, name, category, description, price, moq, availability, shippingInfo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
      'test_p1', 'Tender Coconut', 'Fruits', 'Fresh organic tender coconuts from Kerala.', 2.50, 100, 'In Stock', 'Ships worldwide within 5 days'
    ]);

    console.log("\n--- 2. Sending Simulated Message (AI Enabled) ---");
    console.log("Customer: What products do you have?");
    await simulateWebhook(phone, 'John Doe', 'What products do you have?');
    await delay(6000); // Wait for Gemini and DB

    let [msgs] = await pool.query('SELECT sender, content FROM messages WHERE customer_id = ? ORDER BY timestamp ASC', [customerId]);
    console.log("Messages in DB:");
    msgs.forEach(m => console.log(`[${m.sender}] ${m.content}`));

    console.log("\n--- 3. Testing Take Over (Pause AI) ---");
    await pool.query('UPDATE conversations SET status = "handover" WHERE customer_id = ?', [customerId]);
    console.log("Customer: Are you human?");
    await simulateWebhook(phone, 'John Doe', 'Are you human?');
    await delay(3000); // Shorter wait since AI shouldn't run

    [msgs] = await pool.query('SELECT sender, content FROM messages WHERE customer_id = ? ORDER BY timestamp ASC', [customerId]);
    console.log("Messages in DB (should have no AI reply for the last msg):");
    msgs.forEach(m => console.log(`[${m.sender}] ${m.content}`));

    console.log("\n--- 4. Testing Resume AI ---");
    await pool.query('UPDATE conversations SET status = "open" WHERE customer_id = ?', [customerId]);
    console.log("Customer: Do you have tender coconut?");
    await simulateWebhook(phone, 'John Doe', 'Do you have tender coconut?');
    await delay(6000); // Wait for Gemini and DB

    [msgs] = await pool.query('SELECT sender, content FROM messages WHERE customer_id = ? ORDER BY timestamp ASC', [customerId]);
    console.log("Messages in DB (should have new AI reply):");
    msgs.forEach(m => console.log(`[${m.sender}] ${m.content}`));

    console.log("\n--- 5. Cleanup ---");
    await pool.query('DELETE FROM messages WHERE customer_id = ?', [customerId]);
    await pool.query('DELETE FROM conversations WHERE customer_id = ?', [customerId]);
    await pool.query('DELETE FROM customers WHERE id = ?', [customerId]);
    await pool.query('DELETE FROM products WHERE id IN ("test_p1", "test_p2")');

  } catch (error) {
    console.error("Test Error:", error);
  } finally {
    process.exit(0);
  }
}

runTests();

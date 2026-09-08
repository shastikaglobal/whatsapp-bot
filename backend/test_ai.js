import { generateAiReply } from './services/aiService.js';
import pool from './config/db.js';

async function run() {
  console.log("Testing AI generation...");
  const reply = await generateAiReply('cust_919876543210', 'Hi');
  console.log("AI Reply:", reply);
  process.exit(0);
}
run();

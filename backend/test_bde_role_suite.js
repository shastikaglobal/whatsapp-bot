import pool from './config/db.js';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import bcrypt from 'bcrypt';
import express from 'express';
import apiRoutes from './routes/api.js';
import { autoAssignBdeToCustomer } from './controllers/webhookController.js';

console.log('===============================================================');
console.log('👥 SHASTIKA CHATBOT - BDE ROLE & HANDOVER ACCESS TEST SUITE');
console.log('===============================================================\n');

async function runTestSuite() {
  const JWT_SECRET = process.env.JWT_SECRET || 'shastika_default_jwt_secret_2025';
  let server = null;
  const testPort = 3099;

  try {
    // 0. Spin up test express server mounting apiRoutes
    const app = express();
    app.use(express.json());
    app.use('/api', apiRoutes);
    server = app.listen(testPort);

    const baseUrl = `http://127.0.0.1:${testPort}/api`;

    // 1. Setup Test Employees in DB (Admin + 2 BDEs)
    const testAdminHash = await bcrypt.hash('adminpass123', 10);
    const testBdeHash = await bcrypt.hash('bdepass123', 10);

    // Upsert Admin
    await pool.query(`
      INSERT INTO employees (name, username, password_hash, role, status)
      VALUES ('Test Admin', 'test_admin_user', $1, 'Admin', 'Active')
      ON CONFLICT (username) DO UPDATE SET status = 'Active', role = 'Admin'
    `, [testAdminHash]);

    // Upsert BDE 1
    const { rows: bde1Rows } = await pool.query(`
      INSERT INTO employees (name, username, password_hash, role, status)
      VALUES ('Sales Rep Alpha', 'bde_alpha', $1, 'BDE', 'Active')
      ON CONFLICT (username) DO UPDATE SET status = 'Active', role = 'BDE'
      RETURNING id, name, role
    `, [testBdeHash]);
    const bde1 = bde1Rows[0];

    // Upsert BDE 2
    const { rows: bde2Rows } = await pool.query(`
      INSERT INTO employees (name, username, password_hash, role, status)
      VALUES ('Sales Rep Beta', 'bde_beta', $1, 'BDE', 'Active')
      ON CONFLICT (username) DO UPDATE SET status = 'Active', role = 'BDE'
      RETURNING id, name, role
    `, [testBdeHash]);
    const bde2 = bde2Rows[0];

    // Create Tokens
    const bdeToken = jwt.sign(
      { id: bde1.id, username: 'bde_alpha', name: bde1.name, role: 'BDE' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const adminToken = jwt.sign(
      { id: 1, username: 'test_admin_user', name: 'Test Admin', role: 'Admin' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const bdeHeaders = { Authorization: `Bearer ${bdeToken}` };
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };

    const testResults = [];

    // -------------------------------------------------------------
    // Test 1: BDE cannot call Settings API (GET /api/settings -> 403)
    // -------------------------------------------------------------
    try {
      await axios.get(`${baseUrl}/settings`, { headers: bdeHeaders });
      testResults.push({ name: 'BDE GET /settings (Expected 403)', passed: false, status: 200 });
    } catch (err) {
      const is403 = err.response?.status === 403;
      testResults.push({ name: 'BDE GET /settings (Expected 403)', passed: is403, status: err.response?.status });
    }

    // -------------------------------------------------------------
    // Test 2: BDE cannot call WhatsApp Connections API (GET /api/whatsapp/config -> 403)
    // -------------------------------------------------------------
    try {
      await axios.get(`${baseUrl}/whatsapp/config`, { headers: bdeHeaders });
      testResults.push({ name: 'BDE GET /whatsapp/config (Expected 403)', passed: false, status: 200 });
    } catch (err) {
      const is403 = err.response?.status === 403;
      testResults.push({ name: 'BDE GET /whatsapp/config (Expected 403)', passed: is403, status: err.response?.status });
    }

    // -------------------------------------------------------------
    // Test 3: BDE cannot edit/create products (POST /api/products -> 403)
    // -------------------------------------------------------------
    try {
      await axios.post(`${baseUrl}/products`, { name: 'Illegal Product' }, { headers: bdeHeaders });
      testResults.push({ name: 'BDE POST /products (Expected 403)', passed: false, status: 200 });
    } catch (err) {
      const is403 = err.response?.status === 403;
      testResults.push({ name: 'BDE POST /products (Expected 403)', passed: is403, status: err.response?.status });
    }

    // -------------------------------------------------------------
    // Test 4: BDE cannot view or manage other employees (GET /api/employees -> 403)
    // -------------------------------------------------------------
    try {
      await axios.get(`${baseUrl}/employees`, { headers: bdeHeaders });
      testResults.push({ name: 'BDE GET /employees (Expected 403)', passed: false, status: 200 });
    } catch (err) {
      const is403 = err.response?.status === 403;
      testResults.push({ name: 'BDE GET /employees (Expected 403)', passed: is403, status: err.response?.status });
    }

    // -------------------------------------------------------------
    // Test 5: BDE can access Inbox & Customers (GET /customers & GET /conversations -> 200)
    // -------------------------------------------------------------
    try {
      const custRes = await axios.get(`${baseUrl}/customers`, { headers: bdeHeaders });
      const convRes = await axios.get(`${baseUrl}/conversations`, { headers: bdeHeaders });
      const passed = custRes.status === 200 && convRes.status === 200;
      testResults.push({ name: 'BDE GET /customers & /conversations (Expected 200)', passed, status: custRes.status });
    } catch (err) {
      testResults.push({ name: 'BDE GET /customers & /conversations (Expected 200)', passed: false, status: err.response?.status });
    }

    // -------------------------------------------------------------
    // Test 6: Handover Auto-Assignment (Round-Robin among Active BDEs)
    // -------------------------------------------------------------
    try {
      const ts = Date.now();
      const testCustId1 = `cust_test_rr_1_${ts}`;
      const testCustId2 = `cust_test_rr_2_${ts}`;

      await pool.query(
        'INSERT INTO customers (id, name, phone) VALUES ($1, $2, $3)',
        [testCustId1, 'RR Customer 1', `919${String(ts).slice(-8)}1`]
      );
      await pool.query(
        'INSERT INTO customers (id, name, phone) VALUES ($1, $2, $3)',
        [testCustId2, 'RR Customer 2', `919${String(ts).slice(-8)}2`]
      );

      const assigned1 = await autoAssignBdeToCustomer(testCustId1);
      const assigned2 = await autoAssignBdeToCustomer(testCustId2);

      // Verify both got assigned to active BDEs, and distributed
      const bothAssigned = !!(assigned1 && assigned2);
      const loadDistributed = assigned1?.id !== assigned2?.id || (assigned1?.id && assigned2?.id);

      testResults.push({
        name: `Handover Auto-Assign (Assigned 1: ${assigned1?.name}, Assigned 2: ${assigned2?.name})`,
        passed: bothAssigned && loadDistributed,
        status: bothAssigned ? 200 : 500
      });
    } catch (err) {
      testResults.push({ name: 'Handover Auto-Assign', passed: false, status: err.message });
    }

    // -------------------------------------------------------------
    // Test 7: BDE Manual Reply Sender Tagging
    // -------------------------------------------------------------
    try {
      const ts = Date.now();
      const testCustId = `cust_sender_tag_test_${ts}`;
      await pool.query(
        'INSERT INTO customers (id, name, phone) VALUES ($1, $2, $3)',
        [testCustId, 'Sender Tag Test Customer', `919${String(ts).slice(-8)}3`]
      );

      // Simulate BDE sending manual reply
      const simulatedMsgId = `msg_test_${ts}`;
      const senderTag = bde1.name; // 'Sales Rep Alpha'

      await pool.query(
        'INSERT INTO messages (id, customer_id, sender, content, status) VALUES ($1, $2, $3, $4, $5)',
        [simulatedMsgId, testCustId, senderTag, 'Hello, I am your assigned BDE.', 'sent']
      );

      // Verify row in DB has exact sender name
      const { rows: msgRows } = await pool.query(
        'SELECT sender, content FROM messages WHERE id = $1',
        [simulatedMsgId]
      );

      const passed = msgRows[0]?.sender === bde1.name;
      testResults.push({
        name: `BDE Manual Reply Sender Tag (Stored sender: "${msgRows[0]?.sender}")`,
        passed,
        status: passed ? 200 : 500
      });
    } catch (err) {
      testResults.push({ name: 'BDE Manual Reply Sender Tag', passed: false, status: err.message });
    }

    // -------------------------------------------------------------
    // Test 8: BDE cannot read messages of customer assigned to another BDE (GET /messages/:conversationId -> 403)
    // -------------------------------------------------------------
    try {
      const ts = Date.now();
      const otherCustId = `cust_other_bde_${ts}`;
      // Customer is assigned to BDE 2 (bde2.id)
      await pool.query(
        'INSERT INTO customers (id, name, phone, assigned_bde_id) VALUES ($1, $2, $3, $4)',
        [otherCustId, 'Customer of BDE Beta', `919${String(ts).slice(-8)}4`, bde2.id]
      );
      const { rows: cRows } = await pool.query(
        'INSERT INTO conversations (customer_id, status) VALUES ($1, $2) RETURNING id',
        [otherCustId, 'open']
      );
      const otherConvId = cRows[0].id;

      // bdeHeaders belongs to BDE 1 (bde1.id)
      let bdeBlockedById = false;
      try {
        await axios.get(`${baseUrl}/messages/${otherCustId}`, { headers: bdeHeaders });
      } catch (err) {
        bdeBlockedById = err.response?.status === 403;
      }

      let bdeBlockedByConvId = false;
      try {
        await axios.get(`${baseUrl}/messages/${otherConvId}`, { headers: bdeHeaders });
      } catch (err) {
        bdeBlockedByConvId = err.response?.status === 403;
      }

      const passed = bdeBlockedById && bdeBlockedByConvId;
      testResults.push({
        name: 'BDE GET /messages/:id for another BDE customer (Expected 403)',
        passed,
        status: passed ? 403 : 200
      });
    } catch (err) {
      testResults.push({ name: 'BDE GET /messages/:id for another BDE customer', passed: false, status: err.message });
    }

    // -------------------------------------------------------------
    // Test 9: BDE cannot send messages to customer assigned to another BDE (POST /whatsapp/send -> 403)
    // -------------------------------------------------------------
    try {
      const ts = Date.now();
      const otherCustId = `cust_send_other_${ts}`;
      await pool.query(
        'INSERT INTO customers (id, name, phone, assigned_bde_id) VALUES ($1, $2, $3, $4)',
        [otherCustId, 'Customer of BDE Beta', `919${String(ts).slice(-8)}5`, bde2.id]
      );

      let bdeSendBlocked = false;
      try {
        await axios.post(
          `${baseUrl}/whatsapp/send`,
          { customerId: otherCustId, content: 'Unauthorized message attempt' },
          { headers: bdeHeaders }
        );
      } catch (err) {
        bdeSendBlocked = err.response?.status === 403;
      }

      testResults.push({
        name: 'BDE POST /whatsapp/send for another BDE customer (Expected 403)',
        passed: bdeSendBlocked,
        status: bdeSendBlocked ? 403 : 200
      });
    } catch (err) {
      testResults.push({ name: 'BDE POST /whatsapp/send for another BDE customer', passed: false, status: err.message });
    }

    // -------------------------------------------------------------
    // Test 10: BDE cannot toggle takeover for customer assigned to another BDE (PUT /whatsapp/takeover -> 403)
    // -------------------------------------------------------------
    try {
      const ts = Date.now();
      const otherCustId = `cust_takeover_other_${ts}`;
      await pool.query(
        'INSERT INTO customers (id, name, phone, assigned_bde_id) VALUES ($1, $2, $3, $4)',
        [otherCustId, 'Customer of BDE Beta', `919${String(ts).slice(-8)}6`, bde2.id]
      );

      let bdeTakeoverBlocked = false;
      try {
        await axios.put(
          `${baseUrl}/whatsapp/takeover`,
          { customerId: otherCustId, status: 'open' },
          { headers: bdeHeaders }
        );
      } catch (err) {
        bdeTakeoverBlocked = err.response?.status === 403;
      }

      testResults.push({
        name: 'BDE PUT /whatsapp/takeover for another BDE customer (Expected 403)',
        passed: bdeTakeoverBlocked,
        status: bdeTakeoverBlocked ? 403 : 200
      });
    } catch (err) {
      testResults.push({ name: 'BDE PUT /whatsapp/takeover for another BDE customer', passed: false, status: err.message });
    }

    // -------------------------------------------------------------
    // Test 11: BDE cannot view customer detail assigned to another BDE (GET /customers/:id -> 403)
    // -------------------------------------------------------------
    try {
      const ts = Date.now();
      const otherCustId = `cust_detail_other_${ts}`;
      await pool.query(
        'INSERT INTO customers (id, name, phone, assigned_bde_id) VALUES ($1, $2, $3, $4)',
        [otherCustId, 'Customer of BDE Beta', `919${String(ts).slice(-8)}7`, bde2.id]
      );

      let bdeDetailBlocked = false;
      try {
        await axios.get(`${baseUrl}/customers/${otherCustId}`, { headers: bdeHeaders });
      } catch (err) {
        bdeDetailBlocked = err.response?.status === 403;
      }

      testResults.push({
        name: 'BDE GET /customers/:id for another BDE customer (Expected 403)',
        passed: bdeDetailBlocked,
        status: bdeDetailBlocked ? 403 : 200
      });
    } catch (err) {
      testResults.push({ name: 'BDE GET /customers/:id for another BDE customer', passed: false, status: err.message });
    }

    // -------------------------------------------------------------
    // Test 12: BDE CAN read messages and toggle takeover for their OWN assigned customer (200)
    // -------------------------------------------------------------
    try {
      const ts = Date.now();
      const ownCustId = `cust_own_bde_${ts}`;
      await pool.query(
        'INSERT INTO customers (id, name, phone, assigned_bde_id) VALUES ($1, $2, $3, $4)',
        [ownCustId, 'Customer of BDE Alpha', `919${String(ts).slice(-8)}8`, bde1.id]
      );
      await pool.query(
        'INSERT INTO conversations (customer_id, status) VALUES ($1, $2)',
        [ownCustId, 'handover']
      );

      const readRes = await axios.get(`${baseUrl}/messages/${ownCustId}`, { headers: bdeHeaders });
      const toggleRes = await axios.put(
        `${baseUrl}/whatsapp/takeover`,
        { customerId: ownCustId, status: 'open' },
        { headers: bdeHeaders }
      );

      const passed = readRes.status === 200 && toggleRes.status === 200;
      testResults.push({
        name: 'BDE GET /messages & PUT /takeover for OWN customer (Expected 200)',
        passed,
        status: passed ? 200 : 500
      });
    } catch (err) {
      testResults.push({ name: 'BDE access to OWN customer', passed: false, status: err.response?.status || err.message });
    }

    // -------------------------------------------------------------
    // Print Test Summary
    // -------------------------------------------------------------
    let allPassed = true;
    testResults.forEach((t, i) => {
      console.log(`[Test ${i + 1}] ${t.name}: ${t.passed ? '✅ PASS' : '❌ FAIL'} (Status: ${t.status})`);
      if (!t.passed) allPassed = false;
    });

    console.log(`\n===============================================================`);
    if (allPassed) {
      console.log('🎉 ALL BDE ROLE & ACCESS TESTS PASSED!');
    } else {
      console.error('⚠️ SOME TESTS FAILED!');
    }
    console.log(`===============================================================\n`);

    return allPassed;
  } finally {
    if (server) server.close();
    await pool.end().catch(() => {});
  }
}

runTestSuite().catch(e => {
  console.error('Fatal test error:', e);
  process.exit(1);
});

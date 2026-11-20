import express from 'express';
import jwt from 'jsonwebtoken';
import http from 'http';
import axios from 'axios';
import pool from './config/db.js';
import apiRouter from './routes/api.js';

console.log('=== STARTING LOCAL BACKEND SMOKE TEST SUITE ===\n');

const JWT_SECRET = process.env.JWT_SECRET || 'shastika_default_jwt_secret_2025';

// Generate valid test JWTs
const adminToken = jwt.sign({ id: 1, username: 'admin', role: 'admin', name: 'Admin Master' }, JWT_SECRET, { expiresIn: '1h' });
const bdeToken = jwt.sign({ id: 2, username: 'bde_raj', role: 'bde', name: 'Raj Kumar' }, JWT_SECRET, { expiresIn: '1h' });

// Mock DB queries so the local smoke test runs end-to-end through real controllers
const originalQuery = pool.query;

const mockData = {
  connections: [
    { id: 'conn_1', display_name: 'meta', whatsapp_phone_number: '919789090920', phone_number_id: '1429324643600789', access_token: 'EAAMockToken', is_default: true, status: 'Active', waba_id: '123456789' }
  ],
  customers: [
    { id: 'cust_test_101', name: 'Live Tester', phone: '919566266259', assigned_bde_id: null, created_at: new Date() },
    { id: 'cust_bde_202', name: 'BDE Customer', phone: '919876543210', assigned_bde_id: 2, created_at: new Date() },
    { id: 'cust_other_303', name: 'Other Customer', phone: '919123456780', assigned_bde_id: 99, created_at: new Date() }
  ],
  conversations: [
    { id: 1, customer_id: 'cust_test_101', status: 'open', phone_number_id: '1429324643600789', updated_at: new Date() },
    { id: 2, customer_id: 'cust_bde_202', status: 'handover', phone_number_id: '1429324643600789', updated_at: new Date(), handover_started_at: new Date() }
  ],
  products: [
    { id: '1', name: 'Semi Husked Coconut', category: 'Coconut', description: 'Fresh coconuts', price: 25.50, moq: '500 Bags', availability: 'In Stock', shippinginfo: 'Port Chennai', created_at: new Date(), updated_at: new Date() }
  ]
};

pool.query = async (queryText, params = []) => {
  const q = String(queryText).toLowerCase().trim();

  // Health check query
  if (q.includes('select 1')) {
    return { rows: [{ '?column?': 1 }], rowCount: 1 };
  }

  // WABA / Connections
  if (q.includes('from whatsapp_connections')) {
    return { rows: mockData.connections, rowCount: mockData.connections.length };
  }

  // Column inspection for products
  if (q.includes("information_schema.columns") && q.includes("products")) {
    if (q.includes("column_name = 'updated_at'")) {
      return { rows: [{ column_name: 'updated_at' }], rowCount: 1 };
    }
    if (q.includes("column_name = 'id'")) {
      return { rows: [{ data_type: 'integer' }], rowCount: 1 };
    }
  }

  // Customers preview
  if (q.includes('from customers') && q.includes('cust_test%')) {
    return {
      rows: mockData.customers.filter(c => c.name === 'Live Tester'),
      rowCount: 1
    };
  }

  // Customer ID check
  if (q.includes('from customers where id = $1')) {
    const cust = mockData.customers.find(c => c.id === params[0]) || mockData.customers[0];
    return { rows: [cust], rowCount: 1 };
  }

  // Cleanup test data
  if (q.includes('from customers') && q.includes('any($1)')) {
    const ids = params[0] || [];
    return { rows: ids.map(id => ({ id })), rowCount: ids.length };
  }
  if (q.includes('delete from messages where customer_id = any($1)') ||
      q.includes('delete from conversations where customer_id = any($1)') ||
      q.includes('delete from customers where id = any($1)')) {
    return { rowCount: params[0]?.length || 0 };
  }

  // Products queries
  if (q.includes('from products')) {
    return { rows: mockData.products, rowCount: mockData.products.length };
  }
  if (q.includes('insert into products')) {
    return { rowCount: 1 };
  }

  // Conversations queries
  if (q.includes('from conversations')) {
    let list = mockData.conversations.map(c => {
      const cust = mockData.customers.find(cu => cu.id === c.customer_id) || {};
      return {
        ...c,
        customer_name: cust.name,
        customer_phone: cust.phone,
        assigned_bde_id: cust.assigned_bde_id,
        assigned_bde_name: cust.assigned_bde_id === 2 ? 'Raj Kumar' : null,
        unread_count: 0,
        waiting_minutes: 15
      };
    });

    if (q.includes('c.status = $')) {
      const statusParam = params[params.length - 1];
      list = list.filter(c => c.status === statusParam);
    }

    if (q.includes('cust.assigned_bde_id = $') && q.includes('is null')) {
      const bdeId = params[0];
      list = list.filter(c => c.assigned_bde_id === bdeId || c.assigned_bde_id === null);
    }

    return { rows: list, rowCount: list.length };
  }

  // Fallback
  return { rows: [], rowCount: 0 };
};

// Set up express app
const app = express();
app.use(express.json());

// Public health route (mirrors server.js)
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({
      status: 'ok',
      database: 'ok',
      uptime: Math.floor(process.uptime())
    });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      database: 'disconnected',
      uptime: Math.floor(process.uptime())
    });
  }
});

// Mount protected API routes
app.use('/api', apiRouter);

const PORT = 3099;
const server = http.createServer(app);

// Mock Axios calls for Meta API so external network is not required during smoke test
const originalAxiosGet = axios.get;
const originalAxiosPost = axios.post;

axios.get = async (url, config) => {
  if (url.includes('message_templates')) {
    return {
      status: 200,
      data: {
        data: [
          {
            id: 'tpl_101',
            name: 'sample_shipping_update',
            language: 'en_US',
            status: 'APPROVED',
            category: 'UTILITY',
            components: [
              { type: 'BODY', text: 'Hello {{1}}, your container {{2}} has been dispatched.' }
            ]
          }
        ]
      }
    };
  }
  return originalAxiosGet(url, config);
};

axios.post = async (url, data, config) => {
  if (url.includes('messages')) {
    return {
      status: 200,
      data: {
        messaging_product: 'whatsapp',
        contacts: [{ input: '919566266259', wa_id: '919566266259' }],
        messages: [{ id: 'wamid.MockTestSmoke_12345' }]
      }
    };
  }
  return originalAxiosPost(url, data, config);
};

server.listen(PORT, async () => {
  console.log(`[Smoke Test] Express test server listening on http://127.0.0.1:${PORT}`);

  const results = [];
  async function testRoute(name, method, endpoint, token = null, body = null, expectedStatus = [200]) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`http://127.0.0.1:${PORT}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });

      const isExpected = expectedStatus.includes(res.status);
      const symbol = isExpected ? '✓' : '✗';
      results.push({ name, method, endpoint, status: res.status, expected: expectedStatus, pass: isExpected });
      console.log(`${symbol} [HTTP ${res.status}] ${method.padEnd(4)} ${endpoint.padEnd(40)} -> ${name}`);
    } catch (err) {
      results.push({ name, method, endpoint, status: 'ERROR', error: err.message, pass: false });
      console.error(`✗ [ERR]      ${method.padEnd(4)} ${endpoint.padEnd(40)} -> ${err.message}`);
    }
  }

  // 1. Health Endpoints
  await testRoute('Public /api/health (unauthenticated)', 'GET', '/api/health', null, null, [200]);
  await testRoute('Detailed health (Admin)', 'GET', '/api/system/health-details', adminToken, null, [200]);
  await testRoute('Detailed health (BDE - Forbidden)', 'GET', '/api/system/health-details', bdeToken, null, [403]);

  // 2. Templates Endpoints
  await testRoute('Get Approved Templates (Admin)', 'GET', '/api/whatsapp/templates', adminToken, null, [200]);
  await testRoute('Get Approved Templates (BDE)', 'GET', '/api/whatsapp/templates', bdeToken, null, [200]);
  await testRoute('Send Template Message (Admin)', 'POST', '/api/whatsapp/send-template', adminToken, {
    customerId: 'cust_test_101',
    templateName: 'sample_shipping_update',
    languageCode: 'en_US',
    components: [{ type: 'body', parameters: [{ type: 'text', text: 'Ramesh' }, { type: 'text', text: 'CONT-9988' }] }]
  }, [200]);
  await testRoute('Send Template Message (BDE on assigned customer)', 'POST', '/api/whatsapp/send-template', bdeToken, {
    customerId: 'cust_bde_202',
    templateName: 'sample_shipping_update',
    languageCode: 'en_US'
  }, [200]);
  await testRoute('Send Template Message (BDE on other customer - Forbidden)', 'POST', '/api/whatsapp/send-template', bdeToken, {
    customerId: 'cust_other_303',
    templateName: 'sample_shipping_update',
    languageCode: 'en_US'
  }, [403]);

  // 3. Customers Test Data Cleanup Endpoints
  await testRoute('Test Data Preview (Admin)', 'GET', '/api/customers/test-data-preview', adminToken, null, [200]);
  await testRoute('Test Data Preview (BDE - Forbidden)', 'GET', '/api/customers/test-data-preview', bdeToken, null, [403]);
  await testRoute('Cleanup Test Data (Admin)', 'POST', '/api/customers/cleanup-test-data', adminToken, {
    customerIds: ['cust_test_101']
  }, [200]);
  await testRoute('Cleanup Test Data (BDE - Forbidden)', 'POST', '/api/customers/cleanup-test-data', bdeToken, {
    customerIds: ['cust_test_101']
  }, [403]);

  // 4. Products CSV Export / Preview / Import Endpoints
  await testRoute('Products Export CSV (Admin)', 'GET', '/api/products/export', adminToken, null, [200]);
  await testRoute('Products Export CSV (BDE - Forbidden)', 'GET', '/api/products/export', bdeToken, null, [403]);
  await testRoute('Products Import Preview (Admin)', 'POST', '/api/products/import-preview', adminToken, {
    csvText: "name,category,price,moq,availability\nFresh Banana,Banana,15.00,100 Boxes,In Stock"
  }, [200]);
  await testRoute('Products Import Preview (BDE - Forbidden)', 'POST', '/api/products/import-preview', bdeToken, {
    csvText: "name,category,price\nFresh Banana,Banana,15.00"
  }, [403]);
  await testRoute('Products Import CSV (Admin)', 'POST', '/api/products/import', adminToken, {
    confirmedRows: [{ name: 'Fresh Banana', category: 'Banana', price: 15.00, moq: '100 Boxes', availability: 'In Stock' }]
  }, [200]);
  await testRoute('Products Import CSV (BDE - Forbidden)', 'POST', '/api/products/import', bdeToken, {
    confirmedRows: [{ name: 'Fresh Banana' }]
  }, [403]);

  // 5. Conversations List Endpoints (with/without status filter, Admin/BDE)
  await testRoute('Conversations without filter (Admin)', 'GET', '/api/conversations', adminToken, null, [200]);
  await testRoute('Conversations without filter (BDE)', 'GET', '/api/conversations', bdeToken, null, [200]);
  await testRoute('Conversations with status=open (Admin)', 'GET', '/api/conversations?status=open', adminToken, null, [200]);
  await testRoute('Conversations with status=open (BDE)', 'GET', '/api/conversations?status=open', bdeToken, null, [200]);
  await testRoute('Conversations with status=handover (Admin)', 'GET', '/api/conversations?status=handover', adminToken, null, [200]);
  await testRoute('Conversations with status=handover (BDE)', 'GET', '/api/conversations?status=handover', bdeToken, null, [200]);

  // Clean up server
  server.close(() => {
    pool.query = originalQuery;
    axios.get = originalAxiosGet;
    axios.post = originalAxiosPost;

    const total = results.length;
    const passed = results.filter(r => r.pass).length;
    console.log(`\n========================================`);
    console.log(`SMOKE TEST RESULTS: ${passed}/${total} PASSED`);
    console.log(`========================================`);

    if (passed === total) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  });
});

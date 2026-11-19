import fs from 'fs';
import path from 'path';

async function backupLiveDb() {
  try {
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || process.env.BACKUP_AUTH_PASSWORD;

    if (!adminPassword) {
      throw new Error('ADMIN_PASSWORD or BACKUP_AUTH_PASSWORD environment variable is required.');
    }

    const authRes = await fetch('https://shastikachatbot.co.in/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: adminUsername, password: adminPassword })
    });
    const auth = await authRes.json();
    if (!auth.token) {
      throw new Error('Authentication failed: ' + JSON.stringify(auth));
    }

    const headers = { 'Authorization': `Bearer ${auth.token}` };

    const backupData = {
      timestamp: new Date().toISOString(),
      source: 'https://shastikachatbot.co.in',
      tables: {}
    };

    // 1. Fetch Customers
    const custRes = await fetch('https://shastikachatbot.co.in/api/customers', { headers });
    backupData.tables.customers = await custRes.json();

    // 2. Fetch Conversations
    const convRes = await fetch('https://shastikachatbot.co.in/api/conversations', { headers });
    backupData.tables.conversations = await convRes.json();

    // 3. Fetch Messages for each customer
    backupData.tables.messages = [];
    if (Array.isArray(backupData.tables.customers)) {
      for (const cust of backupData.tables.customers) {
        try {
          const msgRes = await fetch(`https://shastikachatbot.co.in/api/messages/${cust.id}`, { headers });
          const msgs = await msgRes.json();
          if (Array.isArray(msgs)) {
            backupData.tables.messages.push(...msgs);
          }
        } catch (e) {
          console.warn(`Could not fetch messages for ${cust.id}:`, e.message);
        }
      }
    }

    // 4. Fetch Auto Reply Rules
    const rulesRes = await fetch('https://shastikachatbot.co.in/api/auto-reply/rules', { headers });
    backupData.tables.auto_reply_rules = await rulesRes.json();

    // 5. Fetch Products
    const prodRes = await fetch('https://shastikachatbot.co.in/api/products', { headers });
    backupData.tables.products = await prodRes.json();

    // 6. Fetch Settings
    const setRes = await fetch('https://shastikachatbot.co.in/api/settings', { headers });
    backupData.tables.bot_settings = await setRes.json();

    // 7. Fetch Holidays
    const holRes = await fetch('https://shastikachatbot.co.in/api/holidays', { headers });
    backupData.tables.holidays = await holRes.json();

    // 8. Fetch WhatsApp Connections
    const waRes = await fetch('https://shastikachatbot.co.in/api/whatsapp/config', { headers });
    backupData.tables.whatsapp_connections = await waRes.json();

    // 9. Fetch Employees
    const empRes = await fetch('https://shastikachatbot.co.in/api/employees', { headers });
    backupData.tables.employees = await empRes.json();

    const backupDir = path.join(process.cwd(), 'backend', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonPath = path.join(backupDir, `live_db_backup_${timestampStr}.json`);
    const sqlPath = path.join(backupDir, `live_db_backup_${timestampStr}.sql`);

    fs.writeFileSync(jsonPath, JSON.stringify(backupData, null, 2), 'utf8');
    console.log(`[Backup Success] JSON backup saved to: ${jsonPath}`);

    // Generate SQL dump script from backupData
    let sqlDump = `-- LIVE DATABASE BACKUP\n-- Source: https://shastikachatbot.co.in\n-- Generated at: ${new Date().toISOString()}\n\n`;

    // bot_settings
    if (backupData.tables.bot_settings && typeof backupData.tables.bot_settings === 'object') {
      sqlDump += `-- Table: bot_settings\n`;
      for (const [k, v] of Object.entries(backupData.tables.bot_settings)) {
        if (v !== null && v !== undefined) {
          const valEsc = String(v).replace(/'/g, "''");
          sqlDump += `INSERT INTO bot_settings (setting_key, setting_value) VALUES ('${k}', '${valEsc}') ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;\n`;
        }
      }
      sqlDump += '\n';
    }

    // auto_reply_rules
    if (Array.isArray(backupData.tables.auto_reply_rules)) {
      sqlDump += `-- Table: auto_reply_rules\n`;
      for (const r of backupData.tables.auto_reply_rules) {
        const kwEsc = String(r.keyword).replace(/'/g, "''");
        const replyEsc = String(r.reply_text).replace(/'/g, "''");
        sqlDump += `INSERT INTO auto_reply_rules (id, keyword, reply_text, is_active) VALUES (${r.id}, '${kwEsc}', '${replyEsc}', ${!!r.is_active}) ON CONFLICT (id) DO NOTHING;\n`;
      }
      sqlDump += '\n';
    }

    // products
    if (Array.isArray(backupData.tables.products)) {
      sqlDump += `-- Table: products\n`;
      for (const p of backupData.tables.products) {
        const idEsc = String(p.id).replace(/'/g, "''");
        const nameEsc = String(p.name).replace(/'/g, "''");
        const catEsc = String(p.category || '').replace(/'/g, "''");
        const descEsc = String(p.description || '').replace(/'/g, "''");
        const price = p.price || 0;
        const moqEsc = String(p.moq || '').replace(/'/g, "''");
        const availEsc = String(p.availability || 'In Stock').replace(/'/g, "''");
        const shipEsc = String(p.shippingInfo || '').replace(/'/g, "''");
        sqlDump += `INSERT INTO products (id, name, category, description, price, moq, availability, shippingInfo) VALUES ('${idEsc}', '${nameEsc}', '${catEsc}', '${descEsc}', ${price}, '${moqEsc}', '${availEsc}', '${shipEsc}') ON CONFLICT (id) DO NOTHING;\n`;
      }
      sqlDump += '\n';
    }

    // customers
    if (Array.isArray(backupData.tables.customers)) {
      sqlDump += `-- Table: customers\n`;
      for (const c of backupData.tables.customers) {
        const idEsc = String(c.id).replace(/'/g, "''");
        const nameEsc = String(c.name || '').replace(/'/g, "''");
        const phoneEsc = String(c.phone || '').replace(/'/g, "''");
        const lastMsgEsc = String(c.lastmessage || c.lastMessage || '').replace(/'/g, "''");
        sqlDump += `INSERT INTO customers (id, name, phone, lastMessage) VALUES ('${idEsc}', '${nameEsc}', '${phoneEsc}', '${lastMsgEsc}') ON CONFLICT (id) DO NOTHING;\n`;
      }
      sqlDump += '\n';
    }

    fs.writeFileSync(sqlPath, sqlDump, 'utf8');
    console.log(`[Backup Success] SQL dump saved to: ${sqlPath}`);
    console.log(`Backup completed successfully.`);
    console.log(`Tables backed up:`);
    console.log(`- auto_reply_rules: ${backupData.tables.auto_reply_rules?.length || 0} rows`);
    console.log(`- products: ${backupData.tables.products?.length || 0} rows`);
    console.log(`- customers: ${backupData.tables.customers?.length || 0} rows`);
    console.log(`- messages: ${backupData.tables.messages?.length || 0} rows`);
    console.log(`- employees: ${backupData.tables.employees?.length || 0} rows`);
    console.log(`- whatsapp_connections: ${backupData.tables.whatsapp_connections?.length || 0} rows`);
    console.log(`- bot_settings: ${Object.keys(backupData.tables.bot_settings || {}).length} settings`);

  } catch (err) {
    console.error('[Backup Error]:', err.message);
  }
}

backupLiveDb();


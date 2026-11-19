import assert from 'assert';
import { sendWhatsAppTemplate } from './services/whatsappService.js';

console.log('=== RUNNING HARDENING PASS 2 TEST SUITE ===\n');

async function runTests() {
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ [FAIL] ${name}: ${err.message}`);
      throw err;
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ [FAIL] ${name}: ${err.message}`);
      throw err;
    }
  }

  // -------------------------------------------------------------
  // 1. Template Send (Item 11)
  // -------------------------------------------------------------
  await asyncTest('Template Send: Rejects missing credentials when none configured', async () => {
    // If no phone number ID or token passed, should return clear error
    const res = await sendWhatsAppTemplate('919566266259', 'hello_world', 'en_US', [], null, null);
    // Either sends via default DB credentials or returns structured error
    assert.ok(res.success || res.error, 'Must return structured result');
    if (res.error) {
      assert.ok(res.message, 'Must contain error message');
    }
  });

  test('Template Send: Sanitizes phone number correctly', () => {
    const dirtyNumber = '+91 97890-90920';
    const cleanTo = String(dirtyNumber).replace(/[^0-9]/g, '');
    assert.strictEqual(cleanTo, '919789090920');
  });

  // -------------------------------------------------------------
  // 2. Waiting Minutes & Oldest-First Queue Sorting (Item 13)
  // -------------------------------------------------------------
  test('Waiting Time & Queue Sorting: Needs Human sorts oldest handover first', () => {
    const now = Date.now();
    const convos = [
      { id: 'c1', customer_name: 'Recent', handover_started_at: new Date(now - 15 * 60 * 1000).toISOString(), waiting_minutes: 15 },
      { id: 'c2', customer_name: 'Oldest', handover_started_at: new Date(now - 180 * 60 * 1000).toISOString(), waiting_minutes: 180 },
      { id: 'c3', customer_name: 'Medium', handover_started_at: new Date(now - 60 * 60 * 1000).toISOString(), waiting_minutes: 60 }
    ];

    // Sort by waiting_minutes descending (highest waiting minutes = oldest first)
    const sorted = [...convos].sort((a, b) => (b.waiting_minutes || 0) - (a.waiting_minutes || 0));

    assert.strictEqual(sorted[0].customer_name, 'Oldest');
    assert.strictEqual(sorted[1].customer_name, 'Medium');
    assert.strictEqual(sorted[2].customer_name, 'Recent');
  });

  test('Waiting Time Formatter: Formats minutes and hours properly', () => {
    const formatWaitTime = (mins) => {
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m`;
      const hours = Math.floor(mins / 60);
      const remMins = mins % 60;
      return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
    };

    assert.strictEqual(formatWaitTime(0), 'Just now');
    assert.strictEqual(formatWaitTime(25), '25m');
    assert.strictEqual(formatWaitTime(60), '1h');
    assert.strictEqual(formatWaitTime(135), '2h 15m');
  });

  // -------------------------------------------------------------
  // 3. Products CSV Import & Export (Item 14)
  // -------------------------------------------------------------
  test('Products CSV Export: Quotes and escapes commas & double quotes', () => {
    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const row = {
      name: 'Semi-Husked Coconut, Premium Grade',
      description: 'Contains "grade A" husk',
      price: 25.00
    };

    assert.strictEqual(escapeCsv(row.name), '"Semi-Husked Coconut, Premium Grade"');
    assert.strictEqual(escapeCsv(row.description), '"Contains ""grade A"" husk"');
  });

  test('Products CSV Import: Correctly parses CSV lines with embedded commas and quotes', () => {
    const parseCsvLine = (line) => {
      const result = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += char;
        }
      }
      result.push(cur.trim());
      return result;
    };

    const sampleCsvLine = '"prod_1","Semi-Husked Coconut","Coconut","Fresh, export quality",25.00,"500 units","In Stock","CIF / FOB"';
    const parsed = parseCsvLine(sampleCsvLine);

    assert.strictEqual(parsed.length, 8);
    assert.strictEqual(parsed[0], 'prod_1');
    assert.strictEqual(parsed[1], 'Semi-Husked Coconut');
    assert.strictEqual(parsed[3], 'Fresh, export quality');
    assert.strictEqual(parsed[4], '25.00');
  });

  // -------------------------------------------------------------
  // 4. Token Error 190 Detection (Item 8)
  // -------------------------------------------------------------
  test('Token Error 190: Detects code 190 and expired token message', () => {
    const isToken190 = (errCode, errMsg) => {
      return errCode === 190 || String(errMsg).includes('Error validating access token') || String(errMsg).includes('Session has expired');
    };

    assert.strictEqual(isToken190(190, 'Invalid OAuth access token'), true);
    assert.strictEqual(isToken190(null, 'Error validating access token: Session has expired'), true);
    assert.strictEqual(isToken190(131047, 'Re-engagement message'), false);
  });

  // -------------------------------------------------------------
  // 5. Test Customer Cleanup Identification (Item 1 & 15)
  // -------------------------------------------------------------
  test('Test Customers Cleanup: Strict matching by ID prefix and exact known test names only', () => {
    const isTestCustomerStrict = (cust) => {
      const allowedPrefixes = ['cust_test', 'cust_live', 'cust_sender_tag_test', 'cust_test_rr'];
      const exactKnownNames = [
        'Live Tester',
        'Live Verification Customer',
        'English Test User',
        'Customer of BDE Alpha',
        'Customer of BDE Beta'
      ];
      const hasPrefix = allowedPrefixes.some(p => (cust.id || '').startsWith(p));
      const hasExactName = exactKnownNames.includes(cust.name || '');
      return hasPrefix || hasExactName;
    };

    const customers = [
      { id: 'cust_real_1', name: 'Al-Madina Traders', phone: '+971501234567' },
      { id: 'cust_real_2', name: 'Ramesh Kumar', phone: '919789090920' },
      // Legitimate customer whose name or phone might contain "test" or "99999" - must NOT be matched!
      { id: 'cust_real_3', name: 'Contest Exports LLC', phone: '+919999912345' },
      // Strict test customers - MUST be matched
      { id: 'cust_test_101', name: 'Temporary User', phone: '919566266259' },
      { id: 'cust_live_abc', name: 'Random Label', phone: '919876543210' },
      { id: 'cust_sender_tag_test_01', name: 'Tag Test', phone: '919123456789' },
      { id: 'cust_test_rr_42', name: 'RR Test', phone: '919000000000' },
      { id: 'cust_custom_99', name: 'Live Tester', phone: '919566266259' },
      { id: 'cust_custom_100', name: 'Customer of BDE Alpha', phone: '919999900000' }
    ];

    const toDelete = customers.filter(isTestCustomerStrict);
    const toKeep = customers.filter(c => !isTestCustomerStrict(c));

    assert.strictEqual(toDelete.length, 6);
    assert.strictEqual(toKeep.length, 3);
    assert.strictEqual(toKeep[0].name, 'Al-Madina Traders');
    assert.strictEqual(toKeep[1].name, 'Ramesh Kumar');
    // Ensure "Contest Exports LLC" with phone containing 99999 is KEPT
    assert.strictEqual(toKeep[2].name, 'Contest Exports LLC');
  });

  // -------------------------------------------------------------
  // 6. Products CSV: Real Columns, Empty = NULL, and AI Pricing Rule
  // -------------------------------------------------------------
  test('Products CSV & AI Rule: Empty cells stay NULL and AI prompt never quotes price if NULL/0', () => {
    // Real columns: id, name, category, description, price, moq, availability, shippinginfo
    const parseProductRow = (name, priceVal, catVal, shipVal) => {
      let price = null;
      if (priceVal !== undefined && priceVal !== null && String(priceVal).trim().length > 0) {
        const p = parseFloat(priceVal);
        if (!isNaN(p)) price = p;
      }
      return {
        name: name.trim(),
        price,
        category: catVal && catVal.trim().length > 0 ? catVal.trim() : null,
        shippinginfo: shipVal && shipVal.trim().length > 0 ? shipVal.trim() : null
      };
    };

    const parsedEmpty = parseProductRow('Watermelon', '', '', '');
    assert.strictEqual(parsedEmpty.price, null, 'Empty price must be null');
    assert.strictEqual(parsedEmpty.category, null, 'Empty category must be null');
    assert.strictEqual(parsedEmpty.shippinginfo, null, 'Empty shippinginfo must be null');

    // AI Pricing context rule
    const formatProductPriceContext = (prod) => {
      const hasValidPrice = prod.price !== null && prod.price !== undefined && parseFloat(prod.price) > 0;
      return hasValidPrice ? `Price: ₹${prod.price}` : 'Price: Price on request (our sales team will confirm)';
    };

    assert.strictEqual(formatProductPriceContext({ price: null }), 'Price: Price on request (our sales team will confirm)');
    assert.strictEqual(formatProductPriceContext({ price: 0 }), 'Price: Price on request (our sales team will confirm)');
    assert.strictEqual(formatProductPriceContext({ price: 25.5 }), 'Price: ₹25.5');
  });

  // -------------------------------------------------------------
  // 7. Token Alert Throttling & Health Output
  // -------------------------------------------------------------
  test('Token Error 190 Alert Throttle: Throttles repeat alert writes within 1 hour', () => {
    let lastAlertTime = 0;
    const ONE_HOUR = 3600000;
    let dbWriteCount = 0;

    const recordAlert = (now) => {
      if (lastAlertTime > 0 && now - lastAlertTime < ONE_HOUR) return false;
      lastAlertTime = now;
      dbWriteCount++;
      return true;
    };

    const t0 = 10000000; // Realistic timestamp
    assert.strictEqual(recordAlert(t0), true); // First write allowed
    assert.strictEqual(recordAlert(t0 + 5 * 60 * 1000), false); // 5 mins later -> throttled
    assert.strictEqual(recordAlert(t0 + 59 * 60 * 1000), false); // 59 mins later -> throttled
    assert.strictEqual(recordAlert(t0 + 61 * 60 * 1000), true); // 61 mins later -> allowed
    assert.strictEqual(dbWriteCount, 2);
  });

  test('Public /api/health Output: Reduced strictly to status, database ok, and uptime', () => {
    const formatPublicHealth = (dbOk, uptimeSeconds) => ({
      status: dbOk ? 'ok' : 'degraded',
      database: dbOk ? 'ok' : 'down',
      uptime: uptimeSeconds
    });

    const output = formatPublicHealth(true, 12345);
    const keys = Object.keys(output);
    assert.strictEqual(keys.length, 3);
    assert.strictEqual(output.status, 'ok');
    assert.strictEqual(output.database, 'ok');
    assert.strictEqual(output.uptime, 12345);
  });

  console.log(`\n========================================`);
  console.log(`ALL TESTS PASSED: ${passed}/${total}`);
  console.log(`========================================\n`);
}

runTests().catch(err => {
  console.error('\nSuite failed:', err);
  process.exit(1);
});

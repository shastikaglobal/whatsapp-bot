import pool from './config/db.js';

async function runTests() {
  try {
    // 1. Delete test records
    console.log("--- TEST 6: Deleting Test Records ---");
    const [delResult] = await pool.query(
      'DELETE FROM customers WHERE name IN ("nethra", "Nethra Test", "Test API Customer")'
    );
    console.log(`Deleted \${delResult.affectedRows} rows.`);

    // Check if they are gone
    const [checkRecords] = await pool.query(
      'SELECT name FROM customers WHERE name IN ("nethra", "Nethra Test", "Test API Customer")'
    );
    if (checkRecords.length === 0) {
      console.log("SUCCESS: Test records successfully deleted.");
    } else {
      console.log("FAILURE: Test records still exist.", checkRecords);
    }

    // 2. Clear out any previous Test User
    await pool.query('DELETE FROM customers WHERE phone = "+919876543210"');

    // 3. Test 3: Insert Test User
    console.log("\n--- TEST 3: Insert Test User ---");
    const testId = `cust_\${Date.now()}`;
    await pool.query(
      'INSERT INTO customers (id, name, phone, country, language, lastMessage, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [testId, 'Test User', '+919876543210', 'India', 'English', '', 'Active']
    );
    
    const [test3Check] = await pool.query('SELECT * FROM customers WHERE phone = "+919876543210"');
    console.log(`SUCCESS: Test User inserted. Row count: \${test3Check.length}`);

    // 4. Test 5: Try Duplicate Phone
    console.log("\n--- TEST 5: Duplicate Phone Check ---");
    try {
      const testId2 = `cust_dup_\${Date.now()}`;
      await pool.query(
        'INSERT INTO customers (id, name, phone, country, language, lastMessage, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [testId2, 'Duplicate Test User', '+919876543210', 'India', 'English', '', 'Active']
      );
      console.log("FAILURE: Duplicate allowed!");
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        console.log("SUCCESS: Duplicate phone blocked with ER_DUP_ENTRY (HTTP 409).");
      } else {
        console.log("FAILURE: Unexpected error:", err);
      }
    }
    
    // Final check for duplicates
    const [finalCheck] = await pool.query('SELECT * FROM customers WHERE phone = "+919876543210"');
    console.log(`Final Database check for phone +919876543210: Row count is \${finalCheck.length} (Expected: 1)`);

    process.exit(0);
  } catch (err) {
    console.error("Test script failed:", err);
    process.exit(1);
  }
}

runTests();

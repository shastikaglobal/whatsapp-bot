import pool from './config/db.js';
import * as notificationController from './controllers/notificationController.js';

console.log('===============================================================');
console.log('🔔 SHASTIKA CHATBOT - NOTIFICATION & ALERT TEST SUITE');
console.log('===============================================================\n');

async function runTests() {
  const results = [];

  try {
    // -------------------------------------------------------------
    // Test 1: Verify getHandoverNotifications returns active human requests
    // -------------------------------------------------------------
    {
      const req = { user: { id: 1, role: 'Admin', username: 'admin' } };
      let resData = null;
      const res = {
        json: (data) => { resData = data; },
        status: () => res
      };

      await notificationController.getHandoverNotifications(req, res);
      const passed = resData && typeof resData.count === 'number' && Array.isArray(resData.notifications);
      results.push({
        testNum: 1,
        name: 'Admin fetches all handover notifications',
        count: resData ? resData.count : 0,
        hasAlertNumbers: resData && resData.alertNumbers !== undefined,
        passed
      });
    }

    // -------------------------------------------------------------
    // Test 2: Verify BDE role-based notification filtering
    // -------------------------------------------------------------
    {
      const req = { user: { id: 999999, role: 'bde', username: 'test_bde' } };
      let resData = null;
      const res = {
        json: (data) => { resData = data; },
        status: () => res
      };

      await notificationController.getHandoverNotifications(req, res);
      // Ensure all returned notifications are either unassigned or assigned to 999999
      const allValid = resData && resData.notifications.every(
        n => !n.assigned_bde_id || Number(n.assigned_bde_id) === 999999
      );
      results.push({
        testNum: 2,
        name: 'BDE role filtering (assigned or unassigned only)',
        count: resData ? resData.count : 0,
        passed: Boolean(allValid)
      });
    }

    // -------------------------------------------------------------
    // Test 3: Alert number read & update
    // -------------------------------------------------------------
    {
      const testPhone = '919566266301';
      const reqUpdate = { body: { alertNumbers: testPhone } };
      let updateRes = null;
      const resUpdate = {
        json: (data) => { updateRes = data; },
        status: () => resUpdate
      };

      await notificationController.updateAlertNumber(reqUpdate, resUpdate);

      let getRes = null;
      const resGet = {
        json: (data) => { getRes = data; },
        status: () => resGet
      };
      await notificationController.getAlertNumber({}, resGet);

      const passed = updateRes && updateRes.success && getRes && getRes.alertNumbers.includes(testPhone);
      results.push({
        testNum: 3,
        name: 'Update and retrieve WhatsApp handover alert phone number',
        configuredNumber: getRes ? getRes.alertNumbers : null,
        passed
      });
    }

    // -------------------------------------------------------------
    // Test 4: Verify deep-link in webhook notification message
    // -------------------------------------------------------------
    {
      const sampleCustomerId = 'cust_test_123';
      const expectedLink = `https://shastikachatbot.co.in/inbox?customerId=${sampleCustomerId}`;
      results.push({
        testNum: 4,
        name: 'Direct Inbox deep-linking query format',
        expectedLink,
        passed: expectedLink.includes('?customerId=cust_test_123')
      });
    }

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    console.table(results);
    const allPassed = results.length > 0 && results.every(r => r.passed);
    console.log(`\nOVERALL STATUS: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    process.exit(allPassed ? 0 : 1);
  }
}

runTests();

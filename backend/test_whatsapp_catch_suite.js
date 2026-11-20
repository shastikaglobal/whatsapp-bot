import axios from 'axios';
import { sendWhatsAppMessage, sendWhatsAppTemplate } from './services/whatsappService.js';

console.log('=== RUNNING REAL WHATSAPP SERVICE ERROR CATCH TEST SUITE ===\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ [PASS] ${message}`);
    passCount++;
  } else {
    console.error(`✗ [FAIL] ${message}`);
    failCount++;
  }
}

async function runTests() {
  const originalPost = axios.post;

  try {
    // ----------------------------------------------------
    // Test 1: Mock Meta 190 Error (Token Expired) on sendWhatsAppMessage
    // ----------------------------------------------------
    const meta190Error = new Error('Request failed with status code 400');
    meta190Error.response = {
      status: 400,
      data: {
        error: {
          message: 'Error validating access token: Session has expired.',
          type: 'OAuthException',
          code: 190,
          error_subcode: 463,
          fbtrace_id: 'AQz...'
        }
      }
    };

    axios.post = async () => {
      throw meta190Error;
    };

    let res190Msg;
    try {
      res190Msg = await sendWhatsAppMessage('919566266259', 'Hello Test', '1429324643600789', 'EAAFakeToken');
    } catch (e) {
      assert(false, `sendWhatsAppMessage threw unexpected exception: ${e.name} - ${e.message}`);
    }

    assert(res190Msg && res190Msg.error === true, 'sendWhatsAppMessage catches Meta 190 error and returns error: true');
    assert(res190Msg.code === 190, `sendWhatsAppMessage returns numeric code 190 (got: ${res190Msg.code})`);
    assert(res190Msg.message.includes('Session has expired'), `sendWhatsAppMessage returns message with error text (got: "${res190Msg.message}")`);
    assert(res190Msg.details && res190Msg.details.code === 190, 'sendWhatsAppMessage includes metaError details object');

    // ----------------------------------------------------
    // Test 2: Mock Meta 190 Error on sendWhatsAppTemplate
    // ----------------------------------------------------
    let res190Tpl;
    try {
      res190Tpl = await sendWhatsAppTemplate('919566266259', 'sample_template', 'en_US', [], '1429324643600789', 'EAAFakeToken');
    } catch (e) {
      assert(false, `sendWhatsAppTemplate threw unexpected exception: ${e.name} - ${e.message}`);
    }

    assert(res190Tpl && res190Tpl.error === true, 'sendWhatsAppTemplate catches Meta 190 error and returns error: true');
    assert(res190Tpl.code === 190, `sendWhatsAppTemplate returns numeric code 190 (got: ${res190Tpl.code})`);
    assert(res190Tpl.message.includes('Session has expired'), `sendWhatsAppTemplate returns message with error text (got: "${res190Tpl.message}")`);

    // ----------------------------------------------------
    // Test 3: Mock Meta 131047 Error (24-hour window closed) on sendWhatsAppMessage
    // ----------------------------------------------------
    const meta131047Error = new Error('Request failed with status code 400');
    meta131047Error.response = {
      status: 400,
      data: {
        error: {
          message: 'Message failed to send because more than 24 hours have passed since the customer last replied to this number.',
          type: 'OAuthException',
          code: 131047,
          error_data: {
            details: 'Re-engagement message'
          },
          fbtrace_id: 'BRe...'
        }
      }
    };

    axios.post = async () => {
      throw meta131047Error;
    };

    let res131047Msg;
    try {
      res131047Msg = await sendWhatsAppMessage('919566266259', 'Free text attempt', '1429324643600789', 'EAAFakeToken');
    } catch (e) {
      assert(false, `sendWhatsAppMessage threw unexpected exception: ${e.name} - ${e.message}`);
    }

    assert(res131047Msg && res131047Msg.error === true, 'sendWhatsAppMessage catches Meta 131047 error and returns error: true');
    assert(res131047Msg.code === 131047, `sendWhatsAppMessage returns numeric code 131047 (got: ${res131047Msg.code})`);
    assert(res131047Msg.message.includes('more than 24 hours have passed'), `sendWhatsAppMessage returns window closed message (got: "${res131047Msg.message}")`);
    assert(res131047Msg.details?.error_data?.details === 'Re-engagement message', 'sendWhatsAppMessage preserves error_data details');

    // ----------------------------------------------------
    // Test 4: Mock Meta 131047 Error on sendWhatsAppTemplate
    // ----------------------------------------------------
    let res131047Tpl;
    try {
      res131047Tpl = await sendWhatsAppTemplate('919566266259', 'sample_template', 'en_US', [], '1429324643600789', 'EAAFakeToken');
    } catch (e) {
      assert(false, `sendWhatsAppTemplate threw unexpected exception: ${e.name} - ${e.message}`);
    }

    assert(res131047Tpl && res131047Tpl.error === true, 'sendWhatsAppTemplate catches Meta 131047 error and returns error: true');
    assert(res131047Tpl.code === 131047, `sendWhatsAppTemplate returns numeric code 131047 (got: ${res131047Tpl.code})`);
    assert(res131047Tpl.message.includes('more than 24 hours have passed'), `sendWhatsAppTemplate returns 131047 message`);

    // ----------------------------------------------------
    // Test 5: Generic Network Error without error.response (ReferenceError safeguard)
    // ----------------------------------------------------
    const netError = new Error('connect ECONNREFUSED 127.0.0.1:443');
    netError.code = 'ECONNREFUSED';
    axios.post = async () => {
      throw netError;
    };

    let resNetMsg;
    try {
      resNetMsg = await sendWhatsAppMessage('919566266259', 'Free text attempt', '1429324643600789', 'EAAFakeToken');
    } catch (e) {
      assert(false, `sendWhatsAppMessage threw unexpected exception on network error: ${e.name} - ${e.message}`);
    }

    assert(resNetMsg && resNetMsg.error === true, 'sendWhatsAppMessage gracefully handles network error with no error.response');
    assert(resNetMsg.code === 'ECONNREFUSED', `sendWhatsAppMessage preserves error.code (got: ${resNetMsg.code})`);
    assert(resNetMsg.message.includes('ECONNREFUSED'), `sendWhatsAppMessage includes error.message (got: "${resNetMsg.message}")`);
    assert(resNetMsg.details === null, 'sendWhatsAppMessage details is null when no response from Meta');

  } finally {
    axios.post = originalPost;
  }

  console.log(`\n========================================`);
  console.log(`RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log(`========================================`);

  if (failCount > 0) process.exit(1);
}

runTests();

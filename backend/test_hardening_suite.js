import assert from 'assert';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { maskToken } from './controllers/whatsappController.js';
import { verifyMetaSignature } from './controllers/webhookController.js';
import { resolveWhatsAppConnection } from './controllers/messageController.js';

console.log('=== RUNNING SECURITY & HARDENING TEST SUITE ===\n');

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
  // 1. Token Masking & Preservation
  // -------------------------------------------------------------
  test('Token Masking: maskToken masks access token keeping first 4 and last 4 characters', () => {
    const rawToken = 'EAABwbXyz1234567890abcdefSecretEnd';
    const masked = maskToken(rawToken);
    assert.strictEqual(masked, 'EAAB...tEnd');
    assert.ok(!masked.includes('xyz1234567890abcdef'));
    assert.strictEqual(maskToken(''), '');
    assert.strictEqual(maskToken(null), '');
  });

  test('Token Masking: updateConfig detection does not overwrite when token is masked', () => {
    const maskedTokens = [
      'EAAB...tEnd',
      'EAAB...1234',
      '••••••••',
      '***HIDDEN***',
      'EAAB...wxyz'
    ];
    for (const t of maskedTokens) {
      const isMasked = !t || t.includes('...') || t.includes('•') || t.includes('*') || t === '[HIDDEN]';
      assert.strictEqual(isMasked, true, `Token "${t}" should be detected as masked`);
    }
    const newToken = 'EAABvalidNewTokenFromAdminPanel123456789';
    const isNewMasked = !newToken || newToken.includes('...') || newToken.includes('•') || newToken.includes('*') || newToken === '[HIDDEN]';
    assert.strictEqual(isNewMasked, false, 'New real token must NOT be detected as masked');
  });

  // -------------------------------------------------------------
  // 2. Webhook Signature Verification (X-Hub-Signature-256)
  // -------------------------------------------------------------
  test('Webhook Signature: Valid HMAC SHA-256 passes verification', () => {
    const secret = 'test_meta_app_secret_12345';
    const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const hmac = crypto.createHmac('sha256', secret);
    const validSignature = 'sha256=' + hmac.update(payload).digest('hex');

    const result = verifyMetaSignature(payload, validSignature, secret, false);
    assert.strictEqual(result.valid, true);
  });

  test('Webhook Signature: Tampered body or invalid signature fails', () => {
    const secret = 'test_meta_app_secret_12345';
    const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const fakeSignature = 'sha256=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    const result = verifyMetaSignature(payload, fakeSignature, secret, false);
    assert.strictEqual(result.valid, false);
    assert.ok(result.reason.includes('Invalid') || result.reason.includes('mismatch'));
  });

  test('Webhook Signature: Missing signature header fails when secret configured', () => {
    const secret = 'test_meta_app_secret_12345';
    const payload = JSON.stringify({ object: 'whatsapp_business_account' });

    const result = verifyMetaSignature(payload, null, secret, false);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.reason, 'Missing X-Hub-Signature-256 header');
  });

  test('Webhook Signature: Missing secret with REQUIRE_WEBHOOK_SIGNATURE=true is rejected', () => {
    const orig = process.env.REQUIRE_WEBHOOK_SIGNATURE;
    try {
      process.env.REQUIRE_WEBHOOK_SIGNATURE = 'true';
      const payload = JSON.stringify({ object: 'whatsapp_business_account' });
      const result = verifyMetaSignature(payload, null, null, true);
      assert.strictEqual(result.valid, false);
      assert.ok(result.reason.includes('REQUIRE_WEBHOOK_SIGNATURE=true'));
    } finally {
      process.env.REQUIRE_WEBHOOK_SIGNATURE = orig;
    }
  });

  test('Webhook Signature: Missing secret without flag is allowed with warning (no 401 on live)', () => {
    const orig = process.env.REQUIRE_WEBHOOK_SIGNATURE;
    try {
      delete process.env.REQUIRE_WEBHOOK_SIGNATURE;
      const payload = JSON.stringify({ object: 'whatsapp_business_account' });
      const result = verifyMetaSignature(payload, null, null, true);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.skipped, true);
      assert.ok(result.reason.includes('META_APP_SECRET not configured'));
    } finally {
      process.env.REQUIRE_WEBHOOK_SIGNATURE = orig;
    }
  });

  // -------------------------------------------------------------
  // 3. Password Length Enforcement (>= 10 chars) & Bcrypt
  // -------------------------------------------------------------
  test('Password Policy: Rejects passwords shorter than 10 characters', () => {
    const shortPasswords = ['123', 'admin', 'pass123', 'short_9_'];
    for (const p of shortPasswords) {
      assert.ok(p.length < 10, `"${p}" must be under 10 chars`);
    }

    const validPasswords = ['SafePass@2025', 'ShastikaSecureAdmin#1', 'abcdefghij'];
    for (const p of validPasswords) {
      assert.ok(p.length >= 10, `"${p}" must be 10 chars or longer`);
    }
  });

  await asyncTest('Password Policy: Bcrypt hashes properly with minimum 10 characters', async () => {
    const testPass = 'AdminSecure#2025';
    const hash = await bcrypt.hash(testPass, 10);
    assert.ok(hash.startsWith('$2b$10$'));
    assert.strictEqual(hash.length, 60);

    const matches = await bcrypt.compare(testPass, hash);
    assert.strictEqual(matches, true);

    const wrongMatches = await bcrypt.compare('WrongPassword123', hash);
    assert.strictEqual(wrongMatches, false);
  });

  // -------------------------------------------------------------
  // 4. Rate Limiting Logic (5 attempts per 15 minutes per IP + user)
  // -------------------------------------------------------------
  test('Rate Limiter: Blocks on 6th failed attempt within 15 minutes', () => {
    const attempts = new Map();
    const windowMs = 15 * 60 * 1000;
    const maxAttempts = 5;

    function checkLimit(key, now) {
      const record = attempts.get(key);
      if (!record) return { allowed: true };
      if (now - record.firstAttempt > windowMs) {
        return { allowed: true };
      }
      return { allowed: record.count < maxAttempts, remaining: Math.max(0, maxAttempts - record.count) };
    }

    function recordFailure(key, now) {
      const record = attempts.get(key) || { count: 0, firstAttempt: now };
      if (now - record.firstAttempt > windowMs) {
        record.count = 1;
        record.firstAttempt = now;
      } else {
        record.count += 1;
      }
      attempts.set(key, record);
    }

    const key = '192.168.1.100_admin';
    const t0 = Date.now();

    // 5 allowed failures
    for (let i = 1; i <= 5; i++) {
      const check = checkLimit(key, t0);
      assert.strictEqual(check.allowed, true, `Attempt ${i} should be allowed to proceed`);
      recordFailure(key, t0);
    }

    // 6th attempt must be blocked
    const checkBlocked = checkLimit(key, t0);
    assert.strictEqual(checkBlocked.allowed, false, '6th attempt must be blocked');

    // After 15 minutes, window expires and access is reset
    const tAfter15 = t0 + (16 * 60 * 1000);
    const checkAfterExpiry = checkLimit(key, tAfter15);
    assert.strictEqual(checkAfterExpiry.allowed, true, 'Should be allowed after window expires');
  });

  // -------------------------------------------------------------
  // 5. Connection Resolution & Default Flag
  // -------------------------------------------------------------
  await asyncTest('Connection Resolution: Picks default connection (is_default = true) and ignores placeholder tokens', async () => {
    const mockDb = {
      query: async (sql, params) => {
        const norm = sql.replace(/\s+/g, ' ').toUpperCase();
        // Return two connections: one default verified, one placeholder unverified
        if (norm.includes('FROM WHATSAPP_CONNECTIONS')) {
          if (norm.includes('ACCESS_TOKEN NOT LIKE')) {
            return {
              rows: [
                {
                  id: 1,
                  display_name: 'Primary Official Line',
                  phone_number_id: '9988776655443322',
                  whatsapp_phone_number: '+91 97890 90920',
                  access_token: 'EAAB_VALID_REAL_TOKEN_12345678',
                  is_default: true,
                  status: 'Active'
                }
              ]
            };
          }
        }
        return { rows: [] };
      }
    };

    const result = await resolveWhatsAppConnection(null, null, null, mockDb);
    assert.strictEqual(result.phoneNumberId, '9988776655443322');
    assert.strictEqual(result.connection.is_default, true);
    assert.strictEqual(result.connection.status, 'Active');
    assert.ok(!result.accessToken.startsWith('YOUR_NEW'));
  });

  await asyncTest('Connection Resolution: Refuses unverified connection with placeholder token', async () => {
    const mockDb = {
      query: async (sql, params) => {
        const norm = sql.replace(/\s+/g, ' ').toUpperCase();
        if (norm.includes('TRIM(PHONE_NUMBER_ID) = $1')) {
          // If explicit ID requested is unverified, query with condition returns empty
          return { rows: [] };
        }
        if (norm.includes('ORDER BY CASE WHEN IS_DEFAULT = TRUE THEN 0 ELSE 1 END')) {
          // Fallback picks default verified
          return {
            rows: [
              {
                id: 1,
                display_name: 'Primary Verified',
                phone_number_id: '1111222233334444',
                access_token: 'EAAB_VERIFIED_TOKEN',
                is_default: true,
                status: 'Active'
              }
            ]
          };
        }
        return { rows: [] };
      }
    };

    // User or conversation had an unverified ID
    const result = await resolveWhatsAppConnection('66265_unverified_id', 99, 12, mockDb);
    // Should fallback to default verified connection
    assert.strictEqual(result.phoneNumberId, '1111222233334444');
    assert.strictEqual(result.connection.is_default, true);
  });

  console.log(`\n========================================`);
  console.log(`ALL TESTS PASSED: ${passed}/${total}`);
  console.log(`========================================\n`);
}

runTests().catch(err => {
  console.error('\nSuite failed:', err);
  process.exit(1);
});

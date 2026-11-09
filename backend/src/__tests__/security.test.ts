import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../middleware/errors';
import { validateSafeUrl } from '../workers/webhookDispatch.worker';
import { verifyStripeSignature } from '../modules/billing/billing.webhook';

describe('Security Negative Tests: Defense in Depth', () => {
  it('should format typed AppError instances with correct HTTP status codes', () => {
    const notFound = AppError.notFound('Resource not found');
    assert.equal(notFound.statusCode, 404);
    assert.equal(notFound.code, 'NOT_FOUND');

    const unauthorized = AppError.unauthorized('Invalid session');
    assert.equal(unauthorized.statusCode, 401);
    assert.equal(unauthorized.code, 'UNAUTHORIZED');

    const forbidden = AppError.forbidden('Insufficient permissions');
    assert.equal(forbidden.statusCode, 403);
    assert.equal(forbidden.code, 'FORBIDDEN');

    const conflict = AppError.conflict('Optimistic concurrency version mismatch');
    assert.equal(conflict.statusCode, 409);
    assert.equal(conflict.code, 'CONFLICT');
  });

  it('should reject webhook signatures that have been tampered with', () => {
    const secret = 'whsec_test_secret_12345';
    const payload = JSON.stringify({ type: 'checkout.session.completed', id: 'evt_999' });
    const timestamp = Date.now().toString();

    // Valid header
    const validSig = 'dummy_valid';
    // Invalid signature header
    const tamperedHeader = `t=${timestamp},v1=invalid_hex_signature`;

    assert.equal(verifyStripeSignature(payload, tamperedHeader, secret), false);
    assert.equal(verifyStripeSignature(payload, undefined, secret), false);
    assert.equal(verifyStripeSignature(payload, tamperedHeader, ''), false);
  });

  it('should block SSRF to internal metadata endpoints and private VPC ranges', async () => {
    const maliciousUrls = [
      'http://169.254.169.254/latest/meta-data/', // AWS EC2 metadata
      'http://metadata.google.internal/computeMetadata/v1/', // GCP metadata
      'http://127.0.0.1:6379', // Local Redis port probe
      'http://localhost:5432', // Local PostgreSQL port probe
      'http://10.0.0.5/internal-api', // Internal VPC network
      'ftp://example.com/file', // Non-HTTP protocol
    ];

    for (const url of maliciousUrls) {
      const isSafe = await validateSafeUrl(url);
      assert.equal(isSafe, false, `Expected ${url} to be blocked by SSRF validator`);
    }
  });
});

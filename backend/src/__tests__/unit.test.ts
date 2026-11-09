import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  scrubPii,
  normalizeFilename,
  normalizeFunctionName,
  computeFingerprint,
} from '../modules/ingestion/fingerprint';
import { validateSafeUrl } from '../workers/webhookDispatch.worker';
import {
  hashPassword,
  verifyPassword,
  hashSha256,
  generateRandomHex64,
  encryptCredential,
  decryptCredential,
} from '../infra/crypto';

describe('Unit Tests: Ingestion Engine & Fingerprinting', () => {
  it('should normalize filenames across diverse paths and bundler formats', () => {
    assert.equal(
      normalizeFilename('webpack:///src/app/main.a1b2c3d4.js?v=99'),
      'src/app/main.js'
    );
    assert.equal(
      normalizeFilename('C:\\Users\\developer\\project\\index.ts'),
      '~/project/index.ts'
    );
    assert.equal(
      normalizeFilename('/home/user/app/services/auth.service.ts'),
      '~/app/services/auth.service.ts'
    );
  });

  it('should normalize function names stripping anonymous/runtime wrappers', () => {
    assert.equal(normalizeFunctionName('<anonymous>'), 'anonymous');
    assert.equal(normalizeFunctionName('Object.handleRequest'), 'handleRequest');
    assert.equal(normalizeFunctionName('async executeTask'), 'executeTask');
  });

  it('should compute deterministic SHA-256 fingerprints for identical stack traces', () => {
    const payloadA = {
      level: 'error' as const,
      exception: {
        type: 'TypeError',
        value: 'Cannot read properties of undefined',
        stacktrace: {
          frames: [
            { filename: '/src/index.ts', functionName: 'bootstrap', in_app: true },
            { filename: '/src/routes.ts', functionName: 'handleRoute', in_app: true },
          ],
        },
      },
    };

    const payloadB = {
      level: 'error' as const,
      exception: {
        type: 'TypeError',
        value: 'Cannot read properties of undefined',
        stacktrace: {
          frames: [
            { filename: 'webpack:///src/index.ts?v=1', functionName: 'bootstrap', in_app: true },
            { filename: 'webpack:///src/routes.ts?v=1', functionName: 'handleRoute', in_app: true },
          ],
        },
      },
    };

    const fpA = computeFingerprint(payloadA as never);
    const fpB = computeFingerprint(payloadB as never);

    assert.equal(fpA.length, 64);
    assert.equal(fpA, fpB);
  });

  it('should deeply scrub sensitive fields and credit card patterns', () => {
    const raw = {
      user: {
        name: 'Alice',
        password: 'SuperSecretPassword123!',
        token: 'eyJh...token',
      },
      headers: {
        authorization: 'Bearer secret_tok',
      },
      note: 'Customer paid with card 4111 1111 1111 1111',
    };

    const scrubbed = scrubPii(raw) as Record<string, unknown>;
    const scrubbedUser = scrubbed.user as Record<string, string>;
    const scrubbedHeaders = scrubbed.headers as Record<string, string>;

    assert.equal(scrubbedUser.password, '[SCRUBBED]');
    assert.equal(scrubbedUser.token, '[SCRUBBED]');
    assert.equal(scrubbedHeaders.authorization, '[SCRUBBED]');
    assert.ok((scrubbed.note as string).includes('[SCRUBBED_CARD]'));
  });
});

describe('Unit Tests: Cryptography & Security Primitives', () => {
  it('should hash and verify passwords using Argon2id', async () => {
    const rawPassword = 'StrongP@ssw0rd!2026';
    const hash = await hashPassword(rawPassword);

    assert.ok(hash.startsWith('$argon2id$'));
    assert.equal(await verifyPassword(hash, rawPassword), true);
    assert.equal(await verifyPassword(hash, 'WrongPassword'), false);
  });

  it('should generate secure 64-character hexadecimal entropy', () => {
    const hex1 = generateRandomHex64();
    const hex2 = generateRandomHex64();

    assert.equal(hex1.length, 64);
    assert.equal(/^[0-9a-f]{64}$/.test(hex1), true);
    assert.notEqual(hex1, hex2);
  });

  it('should encrypt and decrypt credentials with AES-256-GCM', () => {
    const plaintext = 'slack-webhook-super-secret-key-12345';
    const encrypted = encryptCredential(plaintext);

    assert.ok(encrypted.ciphertext);
    assert.ok(encrypted.iv);
    assert.ok(encrypted.tag);

    const decrypted = decryptCredential(encrypted);
    assert.equal(decrypted, plaintext);
  });

  it('should block SSRF attempts targeting private IP ranges and loopbacks', async () => {
    assert.equal(await validateSafeUrl('http://127.0.0.1:8080'), false);
    assert.equal(await validateSafeUrl('http://localhost:3000'), false);
    assert.equal(await validateSafeUrl('http://169.254.169.254/latest/meta-data'), false);
    assert.equal(await validateSafeUrl('http://10.0.0.1/admin'), false);
    assert.equal(await validateSafeUrl('http://192.168.1.1/router'), false);
  });
});

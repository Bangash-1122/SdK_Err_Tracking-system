import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server';
import { IngestEventPayloadSchema } from '../contracts/event';
import { SignupBodySchema, LoginBodySchema } from '../contracts/auth';
import { ListIssuesQuerySchema } from '../contracts/issue';

describe('Integration Tests: Contracts, Schemas & Server Pipeline', () => {
  it('should initialize the complete Express server and middleware chain', () => {
    const app = createServer();
    assert.ok(app);
    assert.equal(typeof app.listen, 'function');
  });

  it('should validate and parse compliant SDK event ingestion payloads', () => {
    const validEvent = {
      level: 'error',
      environment: 'production',
      release: 'v1.4.2',
      message: 'Database query timeout after 5000ms',
      exception: {
        type: 'QueryTimeoutError',
        value: 'Connection pool exhausted',
        stacktrace: {
          frames: [
            {
              filename: 'src/db/pool.ts',
              functionName: 'acquireConnection',
              lineno: 42,
              in_app: true,
            },
          ],
        },
      },
      breadcrumbs: [
        {
          type: 'navigation',
          category: 'ui',
          message: 'User clicked submit order',
          level: 'info',
          timestamp: new Date().toISOString(),
        },
      ],
      user: {
        id: 'usr_123',
        email: 'alice@example.com',
      },
      tags: {
        region: 'us-east-1',
      },
    };

    const parsed = IngestEventPayloadSchema.safeParse(validEvent);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.platform, 'javascript');
      assert.equal(parsed.data.level, 'error');
    }
  });

  it('should reject malformed event payloads missing required structures', () => {
    const invalidEvent = {
      level: 'unsupported_level',
      breadcrumbs: 'not-an-array',
    };

    const parsed = IngestEventPayloadSchema.safeParse(invalidEvent);
    assert.equal(parsed.success, false);
  });

  it('should validate signup schemas and reject short passwords', () => {
    const invalidSignup = {
      email: 'not-an-email',
      password: 'short',
      name: '',
    };

    const result = SignupBodySchema.safeParse(invalidSignup);
    assert.equal(result.success, false);
    if (!result.success) {
      const fields = result.error.errors.map((e) => e.path[0]);
      assert.ok(fields.includes('email'));
      assert.ok(fields.includes('password'));
      assert.ok(fields.includes('name'));
    }

    const validSignup = {
      email: 'founder@errorpulse.io',
      password: 'SecurePassword123!',
      name: 'Sarah Connor',
      organizationName: 'Cyberdyne Systems',
    };

    const validResult = SignupBodySchema.safeParse(validSignup);
    assert.equal(validResult.success, true);
  });

  it('should validate cursor pagination query parameters', () => {
    const validQuery = {
      status: 'unresolved',
      severity: 'critical',
      limit: '50',
      cursor: 'MjAyNi0xMS0wOFQxOTowMDowMC4wMDBaX2V2dF8xMjM=',
    };

    const parsed = ListIssuesQuerySchema.safeParse(validQuery);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.limit, 50);
      assert.equal(parsed.data.status, 'unresolved');
    }
  });
});


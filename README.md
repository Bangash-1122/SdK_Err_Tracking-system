# SDK Error Tracking (ErrorPulse)

An enterprise-grade, high-performance error tracking, crash reporting, and APM (Application Performance Monitoring) backend system.

---

## 🔒 Security Notice

> **IMPORTANT**:
> - Never commit or publish live production credentials, database connection strings, JWT/session secrets, encryption keys, or private API keys to version control.
> - The `.gitignore` file is configured to exclude all `.env` files except `.env.example`.
> - Ingestion keys are exposed to clients only as masked prefixes (e.g., `ep_live_...`). Full 64-character raw hex keys are shown strictly once upon creation or rotation and stored hashed/encrypted.

---

## 🏗️ Architecture Overview

The backend is built as a pure, standalone TypeScript application (`backend/src/`) leveraging:
- **Runtime**: Node.js (>= 20) with TypeScript 5.x
- **Framework**: Express.js
- **Validation & Contracts**: Zod
- **Database ORM**: Drizzle ORM (PostgreSQL)
- **Cache & Task Queues**: Redis + BullMQ
- **Password Hashing**: Argon2
- **Logging**: Pino

Path alias `@/*` is configured to map directly to `./src/*`, allowing clean imports across all modules (e.g., `@/contracts`, `@/db`, `@/services`, `@/controllers`).

---

## 📁 Repository Directory Structure

```text
SDK-ErrorTracking/
├── .gitignore                      # Git ignore rules protecting secrets and build outputs
├── pnpm-workspace.yaml             # Workspace configuration
├── tsconfig.base.json              # Shared strict TypeScript base config
├── README.md                       # Project execution roadmap & stage documentation
└── backend/
    ├── .env                        # Local environment variables (DO NOT COMMIT)
    ├── .env.example                # Sanitized template for environment variables
    ├── drizzle.config.ts           # Drizzle Kit migration & schema configuration
    ├── package.json                # Backend dependencies and scripts
    ├── tsconfig.json               # Backend TypeScript configuration with @/* path alias
    └── src/
        ├── config/                 # Fail-fast environment configuration
        │   └── env.ts              # Zod environment validation & security constraints
        ├── contracts/              # Shared Zod validation schemas & TypeScript DTOs
        │   ├── envelope.ts         # Universal API response envelopes & pagination
        │   ├── auth.ts             # Auth DTOs, signup/login schemas, and RBAC
        │   ├── organization.ts     # Org management, compliance, and membership
        │   ├── project.ts          # Project lifecycle & ingestion key rotation
        │   ├── settings.ts         # Project telemetry, scrubbing, and alert settings
        │   ├── event.ts            # SDK telemetry ingestion, frames, and breadcrumbs
        │   ├── issue.ts            # Issue status, severity, optimistic concurrency, and triage
        │   ├── releases-alerts.ts  # Releases, source maps, alert rules & notification webhooks
        │   ├── analytics-billing.ts# APM, health metrics, subscriptions & audit logs
        │   └── index.ts            # Central barrel export for @/contracts
        ├── db/                     # Database client, schemas, and migrations
        │   ├── index.ts            # Drizzle database client & connection pool
        │   ├── migrations/         # Drizzle SQL migration files
        │   └── schema/             # PostgreSQL table definitions & Drizzle relations
        │       ├── identity.ts     # Users, sessions, and password reset tokens
        │       ├── tenancy.ts      # Organizations, members, settings, and roles
        │       ├── projects.ts     # Projects, ingestion keys, and project settings
        │       ├── telemetry.ts    # Releases, issues, events, and user sessions
        │       ├── automation.ts   # Alert rules, integrations, and notifications
        │       ├── billing.ts      # Subscriptions, usage records, and invoices
        │       ├── operations.ts   # Outbox, webhook inbox, delivery, assets, audit logs
        │       └── index.ts        # Schema barrel export and Drizzle relations
        ├── infra/                  # Core infrastructure services & backing providers
        │   ├── db.ts               # Typed pg.Pool and Drizzle instance
        │   ├── redis.ts            # Shared Redis client, BullMQ factory & cacheWrap
        │   ├── crypto.ts           # Argon2id, SHA-256, hex entropy, and AES-256-GCM
        │   ├── queues.ts           # Priority-isolated BullMQ message queues
        │   ├── objectStorage.ts    # S3/MinIO presigned upload/download generator
        │   └── mailer.ts           # Transactional email sender
        ├── middleware/             # 12-Step security, validation & telemetry pipeline
        │   ├── errors.ts           # AppError class and asyncHandler wrapper
        │   ├── requestId.middleware.ts     # Step 1: Request UUID injection
        │   ├── security.middleware.ts      # Step 2: Helmet headers & strict CORS
        │   ├── logger.middleware.ts        # Step 3: Pino logging with secret redaction
        │   ├── session.middleware.ts       # Steps 5 & 6: HttpOnly sessions & CSRF
        │   ├── tenantRbac.middleware.ts    # Step 7: Tenant scoping & RBAC role guards
        │   ├── rateLimiter.middleware.ts   # Step 8: Atomic Redis token-bucket limiter
        │   ├── validate.middleware.ts      # Step 9: Zod validation (422 response)
        │   ├── notFound.middleware.ts      # Step 11: 404 handler
        │   ├── errorHandler.middleware.ts  # Step 12: Envelope formatted error handler
        │   └── index.ts            # Middleware barrel export
        └── types/                  # Global Express declaration merging
            └── express.d.ts        # Type augmentations (req.id, req.user, req.tenant)
```

---

## 🗺️ Execution Roadmap & Completed Stages

### ✅ Stage 1: Backend Bootstrap & Environment (Files 01 – 04)

Configured a pure, standalone backend environment:

1. **`backend/package.json` (File 01)**
   - Core production dependencies: `express`, `drizzle-orm`, `pg`, `ioredis`, `bullmq`, `argon2`, `helmet`, `cors`, `cookie-parser`, `zod`, `pino`.
   - Tooling & dev dependencies: `drizzle-kit`, `tsx`, `typescript`, `@types/*`, `pino-pretty`.
   - Scripts configured: `dev`, `build`, `start`, `db:generate`, `db:migrate`, `db:push`, `db:studio`.

2. **`backend/tsconfig.json` (File 02)**
   - Strict TypeScript 5.x rules (`strict: true`, `noImplicitAny: true`, `exactOptionalPropertyTypes: false`, `moduleResolution: "bundler"`).
   - Local path mapping configured: `"@/*": ["./src/*"]`.

3. **`backend/drizzle.config.ts` (File 03)**
   - Configured Drizzle Kit targeting PostgreSQL.
   - Schema target: `./src/db/schema/index.ts`.
   - Migrations target: `./src/db/migrations`.
   - Uses `process.env.DATABASE_URL`.

4. **`backend/.env.example` & `backend/.env` (File 04)**
   - Configures `NODE_ENV`, `PORT`, `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`, `CSRF_SECRET`, `ENCRYPTION_KEY_HEX`, `CORS_ORIGINS`, and S3 storage bucket parameters.

---

### ✅ Stage 2: Zod Contracts & DTO Schemas (Files 05 – 14)

Created all 10 schema contract files inside `backend/src/contracts/` to serve as the single source of truth for validation, controllers, and services:

1. **`envelope.ts` (File 05)**
   - `CursorPaginationQuerySchema`: Standardized pagination cursor, limit, and direction.
   - `createApiSuccessEnvelopeSchema<T>` / `ApiSuccessEnvelopeSchema<T>`: Uniform `{ success: true, data: T, meta: { requestId, nextCursor } }`.
   - `ApiErrorEnvelopeSchema`: Uniform `{ success: false, error: { code, message, details }, meta: { requestId } }`.

2. **`auth.ts` (File 06)**
   - `RoleEnum`: RBAC roles (`Owner` | `Administrator` | `Developer` | `Viewer`).
   - `SignupBodySchema`, `LoginBodySchema`, `ForgotPasswordBodySchema`, `ResetPasswordBodySchema`.
   - `AuthPrincipalDtoSchema`: User profile, active organization summary, and role.

3. **`organization.ts` (File 07)**
   - `ComplianceTierEnum`: (`standard`, `hipaa`, `soc2`, `enterprise`).
   - `OrgSettingsSchema`: Compliance tier, MFA requirement flags, and IP allowlist array.
   - `OrganizationDtoSchema`, `InviteMemberBodySchema`, `UpdateMemberRoleBodySchema`.

4. **`project.ts` (File 08)**
   - `CreateProjectBodySchema`: Name, organization ID, and platform identifier.
   - `ProjectDtoSchema`: Project details with masked API key prefix (`apiKeyPrefix`).
   - `RotateKeyResponseSchema`: Masked prefix paired with the one-time raw 64-character hex ingestion key.

5. **`settings.ts` (File 09)**
   - `ProjectSettingsSchema` & `UpdateProjectSettingsBodySchema`: Comprehensive settings covering Sections A, B, C, D, E, G, H, and J:
     - `defaultEnvironment`, `timezone`, `errorSampleRate`
     - `ignoredErrors`, `sensitiveDataScrubbingFields`
     - `telemetryRetentionDays`, `autoResolveInactiveDays`
     - `regressionDetectionEnabled`, `performanceSampleRate`, `slowRequestThresholdMs`.

6. **`event.ts` (File 10)**
   - `StackFrameSchema`: `filename`, `functionName`, `lineno`, `colno`, `in_app`, `context_line`, `pre_context`, `post_context`.
   - `BreadcrumbSchema` / `BreadcrumbsSchema`: Category, level, timestamp, message, data.
   - `IngestEventPayloadSchema`: Complete event ingestion payload with strict string constraints and array bounds (maximum 100 stack frames, maximum 100 breadcrumbs).

7. **`issue.ts` (File 11)**
   - `IssueStatusEnum` (`unresolved`, `resolved`, `ignored`) & `IssueSeverityEnum` (`critical`, `high`, `medium`, `low`, `info`).
   - `ListIssuesQuerySchema`: Query filters for status, severity, environment, search keywords, pagination cursor, and limit.
   - `UpdateIssueStatusBodySchema`: Status change with optimistic concurrency control (`version`).
   - `BulkTriageIssuesBodySchema`: Batch triage on up to 100 issue IDs.
   - `IssueDetailDtoSchema`: Comprehensive issue details, aggregations, and counts.

8. **`releases-alerts.ts` (File 12)**
   - `CreateReleaseBodySchema`: Version release tagging.
   - `PresignSourceMapBodySchema`: Upload URLs for minified stack source maps.
   - `IntegrationConfigSchema`: Discriminated union supporting `GitHub`, `Slack`, `Webhook`, and `Email` configurations.
   - `AlertRuleSchema` & `CreateAlertRuleBodySchema`: Metric conditions (`error_count`, `affected_users`, `slow_requests`, `new_issue`) and alert actions.

9. **`analytics-billing.ts` (File 13)**
   - `AnalyticsQuerySchema`: Date range and interval filtering.
   - `DashboardStatsDtoSchema`: High-level error rates, volume, timeseries, and p95 latency.
   - `ApmPerformanceDtoSchema`: Transactions, call counts, p50/p95/p99 percentiles.
   - `SessionHealthDtoSchema`: Session counts and crash-free percentages.
   - `SubscriptionDtoSchema` & `InvoiceDtoSchema`: Multi-tier billing and invoices.
   - `AuditLogEntryDtoSchema`: Immutable audit trail for security and governance.

10. **`index.ts` (File 14)**
    - Re-exports all schemas, inferred types, and DTOs for direct consumption via `@/contracts`.

---

### ✅ Stage 3: Database Models & Migrations (Files 15 – 23)

Built all PostgreSQL tables and Drizzle ORM schemas inside `backend/src/db/schema/` in strict foreign-key dependency order, complete with relations and migrations:

1. **`identity.ts` (File 15)**
   - `users`: User identity, email (unique), Argon2id `password_hash`, name, avatar.
   - `sessions`: Session token hash PK, `user_id` FK, `active_org_id` FK, `csrf_secret`, expiry, and revocation tracking.
   - `password_reset_tokens`: Reset tokens, `user_id` FK, unique token hash, expiry.

2. **`tenancy.ts` (File 16)**
   - `organizations`: Multi-tenant orgs, unique slug, subscription plan.
   - `org_members`: Membership linking org and user with role enum (`Owner`, `Administrator`, `Developer`, `Viewer`) and unique composite index on `(org_id, user_id)`.
   - `org_settings`: Org settings PK/FK (`compliance_tier`, `mfa_required`, `ip_allowlist` JSONB).

3. **`projects.ts` (File 17)**
   - `projects`: Project registry, `organization_id` FK, slug, platform, event counts, quotas, unique `(organization_id, slug)`.
   - `project_keys`: Ingestion keys, `project_id` FK, `key_prefix`, unique `hashed_key`, active status.
   - `project_settings`: Project-level settings PK/FK covering Sections A–E, G, H, J with integer `version` for optimistic locking.

4. **`telemetry.ts` (File 18)**
   - `releases`: Release versions, commit SHAs, and deployment environments.
   - `issues`: Issue groups, `fingerprint` (unique per project), status, severity, counters, first/last seen timestamps, optimistic lock `version`, and composite cursor pagination index on `(project_id, status, severity, last_seen DESC, id DESC)`.
   - `events`: Individual raw telemetry occurrences, UUID PK, JSONB stacktrace/breadcrumbs/tags/user context, unique `(project_id, id)`.
   - `user_sessions`: Client session health, crash/error status, distinct user IDs, and duration.

5. **`automation.ts` (File 19)**
   - `alert_rules`: Anomaly and threshold rules (`conditions` JSONB, `actions` JSONB).
   - `integrations`: External notification channels (`github`, `slack`, `webhook`, `email`).
   - `notifications`: Dispatched alert log, status (`pending`, `delivered`, `failed`), and error payloads.

6. **`billing.ts` (File 20)**
   - `subscriptions`: Stripe/billing state, tier (`free`, `pro`, `team`, `enterprise`), allowances, and billing cycles.
   - `usage_records`: High-throughput time-bucketed event and session ingestion records.
   - `invoices`: Invoices, unique numbers, status, payment amounts, and receipt URLs.

7. **`operations.ts` (File 21)**
   - `outbox`: Transactional outbox with unique `dedupe_key` for reliable asynchronous event delivery.
   - `webhook_inbox`: Idempotent incoming webhook storage.
   - `delivery_attempts`: Network retry log with status codes and response bodies.
   - `object_assets`: S3/minio asset catalog (minified source maps, attachments, exports).
   - `export_jobs`: Asynchronous telemetry export worker state.
   - `audit_logs`: Immutable, append-only security and administrative audit trail.

8. **`schema/index.ts` (File 22)**
   - Consolidates and exports all 25 tables, enums, and comprehensive bidirectional Drizzle relations.

9. **`db/index.ts` (File 23)**
   - Configures PostgreSQL connection pool (`pg.Pool`) and initializes Drizzle client instance.
   - Verified via `pnpm drizzle-kit generate`, generating initial SQL migration `0000_flowery_silverclaw.sql`.

---

### ✅ Stage 4: Core Infrastructure & 12-Step Middleware (Files 24 – 37)

Implemented core backing services (Database, Redis, Cryptography, Task Queues, S3 Object Storage, Mailer) and the 12-step Express middleware validation and security pipeline:

1. **`config/env.ts` (File 24)**
   - Fail-fast Zod validation of `process.env` executing on startup.
   - Terminates process immediately if critical secrets (`DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`, `ENCRYPTION_KEY_HEX`) are missing, invalid, or insufficiently strong.

2. **`infra/db.ts` (File 25)**
   - Initializes `pg.Pool` with connection/idle timeouts (max 20 clients, 30s idle timeout, 5s connection timeout).
   - Exports the typed Drizzle ORM `db` client bound to local `@/db/schema`.

3. **`infra/redis.ts` (File 26)**
   - Initializes shared `ioredis` client and dedicated BullMQ connection factory.
   - Provides tenant-prefixed cache-aside helper `cacheWrap` featuring distributed stampede locks and TTL jitter (preventing dog-piling and simultaneous expiration).
   - Non-blocking Redis `SCAN` tag invalidation (`invalidateByTag` and `invalidateByPrefix`).

4. **`infra/crypto.ts` (File 27)**
   - Implements **Argon2id** password hashing (`hashPassword`, `verifyPassword`).
   - High-throughput **SHA-256** hashing for API tokens and session IDs (`hashSha256`).
   - Cryptographically secure 64-character hexadecimal entropy generator (`generateRandomHex64`).
   - Authenticated **AES-256-GCM** encryption and decryption (`encryptCredential`, `decryptCredential`) for sensitive third-party integration credentials.

5. **`infra/queues.ts` (File 28)**
   - Priority-isolated BullMQ queues with exponential backoff retry strategies (attempts: 5, exponential delay starting at 1000ms):
     - `q-outbox-relay` (asynchronous event dispatch)
     - `q-alerts` (critical alert threshold evaluations)
     - `q-webhooks` (outbound third-party webhook dispatch)
     - `q-email` (transactional email deliveries)
     - `q-analytics-rollup` (APM and timeseries rollups)
     - `q-retention` (telemetry pruning and TTL enforcement).

6. **`infra/objectStorage.ts` & `infra/mailer.ts` (File 29)**
   - `objectStorage.ts`: AWS S3 & MinIO-compatible client providing presigned upload/download URLs (`generatePresignedUploadUrl`, `generatePresignedDownloadUrl`, `deleteObject`).
   - `mailer.ts`: Transactional email dispatcher with dev/test logging and production transport support.

7. **`middleware/errors.ts` (File 30)**
   - Typed `AppError` class with HTTP status codes, error codes, and field details.
   - `asyncHandler` wrapper eliminating repetitive try/catch logic across controllers.

8. **`middleware/requestId.middleware.ts` (File 31 - Step 1)**
   - Injects unique `req_<uuid>` (or captures client `X-Request-Id`) on every incoming request and binds to `req.id` and the `X-Request-Id` response header.

9. **`middleware/security.middleware.ts` (File 32 - Step 2)**
   - Helmet security headers and strict allowlisted CORS with `credentials: true` (never wildcard `*`).

10. **`middleware/logger.middleware.ts` (File 33 - Step 3)**
    - High-performance Pino JSON logger with child request binding and automatic redaction of passwords, tokens, cookies, and secret headers.

11. **`middleware/session.middleware.ts` (File 34 - Steps 5 & 6)**
    - **Step 5**: Validates HttpOnly session cookies/bearer tokens against PostgreSQL `sessions` and `users` tables, attaching `req.user` and `req.session`.
    - **Step 6**: Verifies `X-CSRF-Token` headers on state-changing methods (`POST`, `PUT`, `PATCH`, `DELETE`) with timing-safe comparison.

12. **`middleware/tenantRbac.middleware.ts` (File 35 - Step 7)**
    - Resolves `X-Organization-Id` and `X-Project-Id`, checks membership in `org_members`, attaches `req.tenant`, and provides `requireRole([...])` role-hierarchy guard.

13. **`middleware/rateLimiter.middleware.ts` (File 36 - Step 8)**
    - Atomic Redis token-bucket rate limiter evaluated via Lua script. Keyed by API key, organization ID, or IP address, setting `Retry-After` headers on HTTP 429.

14. **`middleware/validate.middleware.ts`, `notFound.middleware.ts` & `errorHandler.middleware.ts` (File 37 - Steps 9, 11 & 12)**
    - **Step 9**: `validateRequest` parses params, query, and body against shared Zod schemas, returning HTTP 422 with structured details on failure.
    - **Step 11**: `notFoundMiddleware` catches unmatched routes with HTTP 404.
    - **Step 12**: `errorHandlerMiddleware` catches all exceptions and formats them into the unified `{ success: false, error: { code, message, details }, meta: { requestId } }` API envelope.

---

### ⏳ Upcoming Stages

- **Stage 5+**: Core Ingestion Engine, SDK Processing Pipeline, and API Controllers.

---

## 🚀 Setup & Development

### 1. Prerequisites
- **Node.js**: v20 or higher
- **PNPM**: v9 or higher
- **PostgreSQL**: v15 or higher
- **Redis**: v7 or higher

### 2. Installation
```bash
cd backend
pnpm install
```

### 3. Environment Setup
```bash
cp .env.example .env
# Edit .env with your local database and redis URLs
```

### 4. Running the Development Server
```bash
pnpm dev
```


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
├── .gitignore                          # Git ignore rules protecting secrets (.env) and build outputs
├── pnpm-workspace.yaml                 # PNPM monorepo/workspace definition
├── tsconfig.base.json                  # Shared strict TypeScript base configuration
├── README.md                           # Master architectural guide & stage implementation log
└── backend/
    ├── .env                            # Local environment variables (STRICTLY GIT-IGNORED)
    ├── .env.example                    # Sanitized template for local/production environment variables
    ├── drizzle.config.ts               # Drizzle Kit migration, schema & dialect configuration
    ├── package.json                    # Backend dependencies, operational scripts, and metadata
    ├── tsconfig.json                   # Backend TypeScript config with strict checks & @/* path alias
    └── src/
        ├── config/                     # Fail-fast environment configuration
        │   └── env.ts                  # Zod environment schema & runtime secret validation
        │
        ├── contracts/                  # Type-safe Zod validation schemas & shared TypeScript DTOs
        │   ├── envelope.ts             # Universal API success/error envelopes & cursor pagination
        │   ├── auth.ts                 # Auth credentials, user profiles, session DTOs, and RBAC roles
        │   ├── organization.ts         # Organization settings (Section F: MFA, IP allowlist), invitations
        │   ├── project.ts              # Project creation, platform types, and ingestion key rotation DTOs
        │   ├── settings.ts             # Project settings (Sections A-E, G, H, J: scrubbing, retention)
        │   ├── event.ts                # Telemetry ingestion payloads, stack traces, and breadcrumbs
        │   ├── issue.ts                # Issue triage status, severity enum, and optimistic versioning
        │   ├── releases-alerts.ts      # Release versions, source-map presign, alert rules & integrations
        │   ├── analytics-billing.ts    # Dashboard KPIs, APM performance, subscriptions, invoices, and audit
        │   └── index.ts                # Central barrel export for all contracts
        │
        ├── db/                         # Database connection, schemas, and migration registry
        │   ├── index.ts                # Drizzle database client & connection pool instance
        │   ├── migrations/             # Generated Drizzle PostgreSQL migration files
        │   └── schema/                 # Normalized PostgreSQL tables and Drizzle relations
        │       ├── identity.ts         # users, sessions, password_reset_tokens
        │       ├── tenancy.ts          # organizations, org_members, org_settings
        │       ├── projects.ts         # projects, project_keys, project_settings
        │       ├── telemetry.ts        # releases, issues, events, user_sessions
        │       ├── automation.ts       # alert_rules, integrations, notifications
        │       ├── billing.ts          # subscriptions, usage_records, invoices
        │       ├── operations.ts       # outbox, webhook_inbox, delivery_attempts, object_assets, audit_logs
        │       └── index.ts            # Centralized schema barrel export & ORM relations
        │
        ├── infra/                      # Core infrastructure adapters & backing service clients
        │   ├── db.ts                   # Pooled PostgreSQL connection instance
        │   ├── redis.ts                # Redis client, BullMQ connection factory & stampede-locked cacheWrap
        │   ├── crypto.ts               # Argon2id hashing, SHA-256 tokens, hex entropy & AES-256-GCM
        │   ├── queues.ts               # Priority-isolated BullMQ message queues (outbox, alerts, email, etc.)
        │   ├── objectStorage.ts        # S3/MinIO presigned upload/download URL generator
        │   └── mailer.ts               # Transactional email dispatcher with dev fallback
        │
        ├── middleware/                 # 12-Step security, validation, tenancy & error pipeline
        │   ├── errors.ts               # AppError class with HTTP codes and asyncHandler wrapper
        │   ├── requestId.middleware.ts     # Step 1: Unique request UUID injection (req.id)
        │   ├── security.middleware.ts      # Step 2: Strict Helmet headers & allowlisted CORS
        │   ├── logger.middleware.ts        # Step 3: Structured Pino logging with automatic secret redaction
        │   ├── session.middleware.ts       # Steps 5 & 6: HttpOnly cookie authentication, requireAuth & CSRF
        │   ├── tenantRbac.middleware.ts    # Step 7: Multi-tenant scoping & RBAC role guards (requireRole)
        │   ├── rateLimiter.middleware.ts   # Step 8: Atomic Redis Lua token-bucket rate limiter
        │   ├── validate.middleware.ts      # Step 9: Zod request validation (returns 422 with field details)
        │   ├── notFound.middleware.ts      # Step 11: 404 Route not found fallback handler
        │   ├── errorHandler.middleware.ts  # Step 12: Unified API envelope formatted exception handler
        │   └── index.ts                # Middleware barrel export
        │
        ├── modules/                    # Enterprise domain modules (Repo → Service → Controller → Routes)
        │   ├── health/                 # Module 01: Health & Diagnostics (Files 38 – 40)
        │   │   ├── health.service.ts   # Ping probes for DB/Redis with 2s timeouts and uptime metrics
        │   │   ├── health.controller.ts# Response enveloper for live, readiness, and system status
        │   │   └── health.routes.ts    # /api/v1/health/* endpoints
        │   │
        │   ├── audit/                  # Module 02: Audit Trail (Files 41 – 44)
        │   │   ├── audit.repo.ts       # Cursor-paginated querying of immutable security logs
        │   │   ├── audit.service.ts    # Fault-tolerant record() helper (never breaks business transactions)
        │   │   ├── audit.controller.ts # Enveloped controller for audit events
        │   │   └── audit.routes.ts     # GET /api/v1/audit with RBAC Owner/Admin enforcement
        │   │
        │   ├── auth/                   # Module 03: Authentication (Files 45 – 48)
        │   │   ├── auth.repo.ts        # Atomic signup transaction (User + Org + Owner + Settings + Sub)
        │   │   ├── auth.service.ts     # Argon2id verification, session tokens, password reset flows
        │   │   ├── auth.controller.ts  # Cookie setter (ep_session), CSRF header injector, auth envelopes
        │   │   └── auth.routes.ts      # Rate-limited auth router (/signup, /login, /logout, /me, etc.)
        │   │
        │   ├── organizations/          # Module 04A: Organization Management (Files 49 – 52)
        │   │   ├── orgs.repo.ts        # Profile queries & Section F settings persistence
        │   │   ├── orgs.service.ts     # Org updates, compliance tier, MFA requirement, IP allowlists
        │   │   ├── orgs.controller.ts  # Org controller handling settings and profiles
        │   │   └── orgs.routes.ts      # /api/v1/organizations routes with RBAC guards
        │   │
        │   ├── members/                # Module 04B: Team Members & RBAC (Files 53 – 56)
        │   │   ├── members.repo.ts     # Member lists, role updates, placeholder user provisioning
        │   │   ├── members.service.ts  # Member invitations via email and last-Owner demotion protection
        │   │   ├── members.controller.ts# Member management endpoints
        │   │   └── members.routes.ts   # /api/v1/organizations/:orgId/members routes
        │   │
        │   ├── projects/               # Module 05: Projects & Settings (Files 57 – 60)
        │   │   ├── projects.repo.ts    # Project CRUD, SHA-256 key generation, optimistic settings updates
        │   │   ├── projects.service.ts # Zero-downtime key rotation, cascading deletion, settings A-J
        │   │   ├── projects.controller.ts# Project lifecycle & key rotation handlers
        │   │   └── projects.routes.ts  # /api/v1/projects routes with optimistic concurrency checks
        │   │
        │   ├── ingestion/              # Module 06: SDK Event Ingestion Engine (Files 61 – 65)
        │   │   ├── fingerprint.ts      # In-app frame normalizer, PII scrubber, SHA-256 issue fingerprint
        │   │   ├── ingest.repo.ts      # Atomic transaction: events + issue upsert + regression + outbox
        │   │   ├── ingest.service.ts   # API key verification, Section D ignored errors, Section C sampling
        │   │   ├── ingest.controller.ts# Ingestion credentials extractor & envelope responder
        │   │   └── ingest.routes.ts    # High-throughput POST /api/v1/events and GET /api/v1/sdk-health
        │   │
        │   ├── issues/                 # Module 07: Issues & Triage (Files 66 – 69)
        │   │   ├── issues.repo.ts      # Composite cursor pagination, GIN search, optimistic locking
        │   │   ├── issues.service.ts   # Deep issue details, latest event context, single & bulk triage
        │   │   ├── issues.controller.ts# Issue listing, search, detail, and triage handlers
        │   │   └── issues.routes.ts    # /api/v1/issues and /api/v1/search routes
        │   │
        │   ├── analytics/              # Module 08: Analytics, APM & Sessions (Files 70 – 73)
        │   │   ├── analytics.repo.ts   # Crash histograms, APM percentiles (p50/p95/p99), crash-free rates
        │   │   ├── analytics.service.ts# Redis cacheWrap cache-aside with jitter
        │   │   ├── analytics.controller.ts# Stats, APM, and session metrics controllers
        │   │   └── analytics.routes.ts # /api/v1/analytics/stats, /performance, /sessions routes
        │   │
        │   ├── releases/               # Module 09A: Releases & Sourcemaps (Files 74 – 75)
        │   │   ├── releases.repo.ts    # Release tracking and object_assets sourcemap records
        │   │   ├── releases.service.ts # S3/MinIO presigned upload URL generator for sourcemaps
        │   │   ├── releases.controller.ts# Release creation & sourcemap presign handlers
        │   │   └── releases.routes.ts  # /api/v1/releases routes
        │   │
        │   ├── exports/                # Module 09B: Telemetry Data Exports (Files 76 – 77)
        │   │   ├── exports.repo.ts     # Batch event/issue querying for data export
        │   │   ├── exports.service.ts  # JSON/CSV telemetry formatting & presigned download links
        │   │   ├── exports.controller.ts# Export job creation handler
        │   │   └── exports.routes.ts   # POST /api/v1/exports
        │   │
        │   ├── alerts/                 # Module 10A: Alert Rules (Files 78 – 79)
        │   │   ├── alerts.repo.ts      # Alert rules database persistence
        │   │   ├── alerts.service.ts   # Threshold, operator, metric, and window evaluation logic
        │   │   ├── alerts.controller.ts# Alert rule CRUD controller
        │   │   └── alerts.routes.ts    # /api/v1/alerts routes
        │   │
        │   ├── integrations/           # Module 10B: Third-Party Integrations (Files 80 – 81)
        │   │   ├── integrations.repo.ts# Integration store & delivery attempts registry
        │   │   ├── integrations.service.ts# AES-256-GCM credential encryption, masking, and test delivery
        │   │   ├── integrations.controller.ts# Integration configuration handlers
        │   │   └── integrations.routes.ts# /api/v1/integrations routes
        │   │
        │   ├── notifications/          # Module 10C: Notification Center (Files 81b)
        │   │   ├── notifications.repo.ts# Notification history querying & mark-as-read updates
        │   │   ├── notifications.service.ts# Notification retrieval service
        │   │   ├── notifications.controller.ts# Notification handlers
        │   │   └── notifications.routes.ts# /api/v1/notifications routes
        │   │
        │   ├── billing/                # Module 11A: Subscriptions, Quotas & Invoices (Files 82 – 84)
        │   │   ├── billing.repo.ts     # Subscription tracking, server-calculated quota usage, invoices
        │   │   ├── billing.service.ts  # Checkout sessions, plan upgrades, invoice downloads
        │   │   ├── billing.webhook.ts  # Raw-body HMAC-SHA256 signature verification into webhook_inbox
        │   │   ├── billing.controller.ts# Billing controllers
        │   │   └── billing.routes.ts   # /api/v1/billing routes & payment webhooks
        │   │
        │   └── realtime/               # Module 11B: Real-time Telemetry Streaming (Files 85)
        │       ├── realtime.controller.ts# Tenant-scoped Server-Sent Events (SSE) streaming with heartbeat
        │       └── realtime.routes.ts  # GET /api/v1/realtime/issues
        │
        ├── workers/                    # Background Worker Processors (Files 86 – 89)
        │   ├── outboxRelay.worker.ts   # Polls outbox (FOR UPDATE SKIP LOCKED) & publishes to Redis/BullMQ
        │   ├── alertsEvaluation.worker.ts# Evaluates alert thresholds, quiet periods & triggers notifications
        │   ├── webhookDispatch.worker.ts # SSRF-protected signed outbound HTTP webhooks (HMAC-SHA256)
        │   ├── emailDelivery.worker.ts # Transactional alert email dispatcher with retry logic
        │   ├── analyticsRollup.worker.ts# APM telemetry rollups & asynchronous export jobs
        │   └── retentionCleanup.worker.ts# Auto-resolves inactive issues & prunes expired telemetry
        │
        ├── __tests__/                  # Automated Test Suite (Files 92 – 93)
        │   ├── unit.test.ts            # Fingerprinting, normalization, PII scrubbing, crypto & SSRF tests
        │   ├── integration.test.ts     # Express server pipeline, Zod schema validation & pagination
        │   └── security.test.ts        # Tampered signatures, negative security attacks & SSRF defense
        │
        ├── types/                      # Global TypeScript declaration merging
        │   └── express.d.ts            # Type augmentations for Express (req.id, req.user, req.tenant, req.session)
        │
        ├── index.ts                    # Application re-export entry point
        ├── server.ts                   # Primary API Server Entry Point (File 91)
        └── worker.ts                   # Standalone Background Worker Process Entry Point (File 90)
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

### ✅ Stage 5: Domain Modules 01 to 06 (Files 38 – 65)

Implemented domain modules adhering strictly to the architecture pattern (**Repository -> Service -> Controller -> Routes**), with complete TypeScript typing and 0 `any` references:

1. **Module 01: Health & Diagnostics (Files 38 – 40)**
   - `modules/health/health.service.ts`: Diagnostic checks with 2000ms timeouts against PostgreSQL pool (`SELECT 1`) and Redis client (`PING`), evaluating memory and process uptime.
   - `modules/health/health.controller.ts`: Envelopes responses for live checks, readiness probes, full system status, and cache diagnostics.
   - `modules/health/health.routes.ts`: Exposes `/api/v1/health/live`, `/api/v1/health/ready`, `/api/v1/health/status`, and Admin-only `/api/v1/health/cache-diagnostics`.

2. **Module 02: Audit Trail (Files 41 – 44)**
   - `modules/audit/audit.repo.ts`: Immutable security audit log repository querying `audit_logs` with cursor pagination.
   - `modules/audit/audit.service.ts`: Non-blocking, fault-tolerant `auditService.record(...)` method ensuring primary flows never crash due to audit persistence failures.
   - `modules/audit/audit.controller.ts` & `audit.routes.ts`: Exposes `GET /api/v1/audit` protected by `requireAuth` and `requireRole(['Owner', 'Administrator'])`.

3. **Module 03: Authentication (Files 45 – 48)**
   - `modules/auth/auth.repo.ts`: Atomic `createSignupTransaction` (creates User, initial Organization, assigns Owner role, creates Settings and Subscription in a single transaction).
   - `modules/auth/auth.service.ts`: Implements `/signup`, `/login` with Argon2id password verification, `/logout` with session revocation, `/me`, `/forgot-password` with 1-hour reset token and email dispatch, and `/reset-password`.
   - `modules/auth/auth.controller.ts`: Issues secure `ep_session` HttpOnly cookies and `X-CSRF-Token` headers.
   - `modules/auth/auth.routes.ts`: Rate-limited authentication router (10 attempts/min) with Zod validation.

4. **Module 04: Organizations & Members (Files 49 – 56)**
   - `modules/organizations/`: Manages organization profile and Section F security settings (compliance tier, MFA enforcement, IP allowlisting).
   - `modules/members/`: Manages team member invitations via email, role promotions/demotions, and member removal with **last-Owner protection** preventing orphaned organizations.

5. **Module 05: Projects, Keys & Settings (Files 57 – 60)**
   - `modules/projects/`: Full project lifecycle management.
   - **Ingestion Key Generation**: Secure 64-character hex ingestion keys hashed using SHA-256 with masked prefixes (`ep_...`).
   - **Zero-Downtime Key Rotation**: Seamless active key rotation preserving uninterrupted client ingestion.
   - **Cascading Deletion**: Clean cascading database deletion across all project resources.
   - **Project Settings Sections A-E, G, H, J**: Persistent settings for default environment, timezone, error sample rate, ignored errors, sensitive data scrubbing fields, retention days, auto-resolve intervals, and performance/regression monitoring with optimistic concurrency locking (`version`).

6. **Module 06: SDK Event Ingestion Pipeline (Files 61 – 65)**
   - `modules/ingestion/fingerprint.ts`: Normalizes in-app stack frames, computes deterministic SHA-256 issue fingerprints, and deeply scrubs PII / sensitive data fields from incoming telemetry.
   - `modules/ingestion/ingest.repo.ts`: Atomic PostgreSQL transaction executing event insertion, issue upsert (with regression detection & status reopening), project event counter increment, and transactional outbox insertion (`event.ingested` / `issue.regression`).
   - `modules/ingestion/ingest.service.ts`: API key authentication, Section D ignored errors filtering, Section C error sampling rate evaluation, PII scrubbing, and severity mapping.
   - `modules/ingestion/ingest.controller.ts`: SDK key extraction from headers (`X-Api-Key`, `Authorization`, `X-Sentry-Auth`) or query params, response enveloper.
   - `modules/ingestion/ingest.routes.ts`: Exposes high-capacity rate-limited `POST /api/v1/events` and public `GET /api/v1/sdk-health`.

7. **Module 07: Issues & Triage (Files 66 – 69)**
   - `modules/issues/`: Implements cursor-paginated issue listing with search, PostgreSQL GIN full-text/tag search (`GET /api/v1/search`), deep issue detail with stack traces & breadcrumbs (`GET /api/v1/issues/:id`), and single/bulk status triage with optimistic concurrency control (`PATCH /api/v1/issues/:id`).

8. **Module 08: Analytics, APM & Sessions (Files 70 – 73)**
   - `modules/analytics/`: Implements Redis-cached (`cacheWrap`) dashboard KPIs & crash histograms (`GET /api/v1/analytics/stats`), APM latency percentiles (`GET /api/v1/performance`), and crash-free session rates (`GET /api/v1/sessions`).

9. **Module 09: Releases & Exports (Files 74 – 77)**
   - `modules/releases/`: Release tracking and S3 presigned source-map upload URLs (`POST /api/v1/releases/sourcemaps/presign`).
   - `modules/exports/`: Asynchronous JSON/CSV telemetry export jobs with presigned S3 download URLs (`POST /api/v1/exports`).

10. **Module 10: Alerts, Integrations & Notifications (Files 78 – 81)**
    - `modules/alerts/`: Alert rule CRUD with custom metric threshold and window conditions.
    - `modules/integrations/`: AES-256-GCM encrypted integration configurations (Slack, GitHub, Webhooks, Email) with masked credentials and live test delivery triggers.
    - `modules/notifications/`: Notification center querying and per-user read state tracking.

11. **Module 11: Billing & Realtime SSE (Files 82 – 85)**
    - `modules/billing/`: Server-calculated quota usage, checkout sessions, invoice downloads, and raw-body signature-verified payment webhooks into `webhook_inbox`.
    - `modules/realtime/`: Tenant-scoped Server-Sent Events (SSE) real-time issue streaming (`GET /api/v1/realtime/issues`) with heartbeat keep-alive.

---

### ✅ Stage 6: Background Workers & Server Entry Points (Files 86 – 93)

Completed the asynchronous worker subsystem, dual process entry points, OpenAPI 3.1 specification, and comprehensive automated test suite:

1. **Background Workers (Files 86 – 89)**
   - `workers/outboxRelay.worker.ts`: Polls PostgreSQL `outbox` table using `FOR UPDATE SKIP LOCKED` for lock-free multi-worker scaling, broadcasting real-time events to Redis pub/sub channels and queuing background jobs.
   - `workers/alertsEvaluation.worker.ts`: Evaluates metric conditions (`new_issue`, `error_count`), enforces 30-minute quiet hours throttling per issue, and fans out alert dispatches.
   - `workers/webhookDispatch.worker.ts`: Dispatches signed webhooks (`X-ErrorPulse-Signature: sha256=...`) with comprehensive **SSRF protection** blocking loopback, link-local, private VPC (RFC 1918), and cloud metadata IP ranges.
   - `workers/emailDelivery.worker.ts`: Reliable transactional alert email dispatch with template rendering and retry strategies.
   - `workers/analyticsRollup.worker.ts`: Performs rolling telemetry cache invalidation (`invalidateByTag`) and processes asynchronous telemetry exports to S3/MinIO.
   - `workers/retentionCleanup.worker.ts`: Auto-resolves inactive issues based on `autoResolveInactiveDays` and prunes expired telemetry events older than `telemetryRetentionDays`.

2. **Standalone Worker Entry Point (File 90)**
   - `backend/src/worker.ts`: Bootstraps all 6 background workers and pollers, with graceful `SIGTERM` and `SIGINT` lifecycle handling draining active jobs and closing Redis and PostgreSQL pools cleanly.

3. **API Server Entry Point (File 91)**
   - `backend/src/server.ts`: Assembles the 12-step middleware pipeline, mounts `express.raw()` for payment webhooks ahead of standard JSON parsers, registers all 11 domain modules under `/api/v1/*`, and implements graceful HTTP connection draining.

4. **OpenAPI 3.1 Specification & Automated Test Suite (Files 92 – 93)**
   - `openapi.yaml`: Full OpenAPI 3.1.0 schema covering all 40+ endpoints, security schemes (`sessionCookie`, `apiKeyAuth`, `csrfToken`), and request/response contracts.
   - `backend/src/__tests__/`: Automated test suite executed with Node.js native test runner:
     - `unit.test.ts`: Stack trace normalization, deterministic fingerprinting, recursive PII scrubbing, cryptographic primitives (Argon2id, AES-256-GCM), and SSRF URL validator.
     - `integration.test.ts`: Full Express server pipeline initialization, SDK ingestion payload validation, signup/auth schema constraints, and cursor pagination queries.
     - `security.test.ts`: Negative security tests, tampered webhook signatures, error code mappings, and malicious SSRF attack blocks.

---

## 🚀 Setup & Development

### 1. Prerequisites
- **Node.js**: v20 or higher (v24 recommended)
- **PNPM**: v9 or higher
- **PostgreSQL**: v15 or higher
- **Redis**: v7 or higher

### 2. Installation
```bash
pnpm install
```

### 3. Environment Setup
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your local database and Redis URLs
```

### 4. Running the Applications
```bash
# Start API Server (Port 4000)
pnpm --filter backend dev

# Start Background Worker Process
pnpm --filter backend worker

# Execute Automated Test Suite
pnpm --filter backend test
```


---
name: api-ops-floor
description: the API-08/09/10/11/16 + API-02/03 operational floor — durable pg adapters, async ports, hand-rolled observability/rate-limit/openapi seams, V36/V37 migrations
metadata:
  type: project
---

The apps/api operational + security floor (2026-06 epic, API-* cards). Non-obvious
decisions + seam locations future work must REUSE, not re-derive.

**Durability — ports went ASYNC + pg-backed (API-03/09).** `AuditLogger` and
`SnapshotStore` (`lib/audit-log.ts`, `lib/snapshot-store.ts`) are now async
(`log/recent`, `set/get` return Promises) so the in-memory and pg adapters are
Liskov-substitutable. `index.ts` wires `createPgAuditLogger(app.pg, app.log)` (table
= **V15 config.audit_log**, already existed — no new migration) and
`createPgSnapshotStore(app.pg)` (table = **V36 config.snapshot**, new). In-memory
adapters remain the test/offline default. `audit.log` is FIRE-AND-FORGET (pg adapter
catches+logs its own write error, never rejects — a config save must not fail on the
audit side-channel); `snapshot`/`recent` PROPAGATE errors (request path → fail-fast).
DB-gated fitness tests simulate "restart" via a 2nd adapter over the same conn.

**Observability (API-10) — api had NO telemetry port.** The engine's `TelemetryPort`
is in `packages/core` (unreachable across the arrow), so I established an api-local
one: `lib/metrics.ts` (`MetricsPort` + `createMetricsRegistry` + Prometheus text
render, hand-rolled, no prom-client) and `lib/observability.ts`
(`registerObservability` = request-id echo + RED hooks + `GET /metrics`). Fastify is
configured with `REQUEST_ID_OPTIONS` (x-request-id propagate-or-mint → req.id, bound
on req.log child). `error-handler.ts` stamps `requestId` into the 9457 body + sets
`Retry-After` from a problem's `retryAfterSeconds` extension (ONE place).

**Rate-limit + bulkhead (API-11), hand-rolled (zero-supply-chain like the JWT).**
`lib/rate-limit.ts` = pure `createFixedWindowLimiter` + `registerRateLimiting`
(global per-IP onRequest seam, bucket table: auth/ingest/default, env-tunable via
`RATE_LIMIT_*`; exempts /metrics + /health). `lib/bulkhead.ts` = generic concurrency
semaphore (`createBulkhead`, `BulkheadRejectedError`). **`canonicalRoutes` is now a
FACTORY `canonicalRoutes(bulkhead?)`** (default = unbounded passthrough for tests;
index.ts injects a bounded one sized by `INGEST_MAX_CONCURRENT/QUEUE`). 429 via the
new `too-many-requests` problem kind + `tooManyRequests(detail, secs, code)` helper
(`code`: RATE_LIMITED | INGEST_BUSY). `index.ts` needs `trustProxy: true` for req.ip.

**Redaction (API-08).** `lib/redact.ts` `redactDataSourceConfig` — denylist-of-
secret-key-names (recursive, drops `auth`/secureJsonData/credentials envelopes +
any token/secret/password/apiKey/authorization key at any depth). Applied at BOTH
public boundaries: `routes/data-sources/index.ts` and the bootstrap datasource map.

**OpenAPI (API-16) — zod is v3 (no `z.toJSONSchema`).** Hand-rolled Zod3→JSON-Schema
in `lib/openapi/zod-to-schema.ts` (instanceof walk, fail-fast on unsupported).
`lib/openapi/document.ts` assembles OpenAPI 3.1 from the LIVE Fastify route table
(onRoute collector = routing SSOT) + curated `routes/openapi/operations.ts` that
imports the EXPORTED boundary Zod schemas (LoginBody, CreateSnapshotBody,
TokenParams/SigQuery, AuditLogQuery — now `export`ed). `registerOpenApi(app)` must be
called BEFORE feature routes so onRoute captures them; serves `/api/openapi.json`.

**Ingest crash-recovery (API-02).** **V37** adds `stats_stage.submission.claimed_at`
+ partial index. worker.ts `claimNext` stamps `claimed_at=now()`; terminal
transitions clear it. `ingest/reclaim.ts reclaimStrandedSubmissions` re-queues
`parsing` rows past the visibility timeout (default 5 min) → `received`; runs at boot
BEFORE the drain in index.ts. See [[api-shared-seams]] for the other reusable lib seams.

import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { env, corsOrigin } from './env.js'
import { dbPlugin } from './db.js'
import { registerProblemErrorHandler } from './lib/error-handler.js'
import { configRoutes } from './routes/config/index.js'
import { publicDataSourcesRoutes } from './routes/data-sources/index.js'
import { bootstrapRoutes } from './routes/bootstrap/index.js'
import { cubeRoutes } from './routes/cube/index.js'
import { catalogRoutes } from './routes/catalog/index.js'
import { schemaRoutes } from './routes/schema/index.js'
import { statsRoutes } from './routes/stats/index.js'
import { authRoutes } from './routes/auth/index.js'
import { snapshotsRoutes, embedRoutes } from './routes/embed/index.js'
import { adminRoutes } from './routes/admin/index.js'
import { setupRoutes } from './routes/admin/setup.js'
import { displaysRoutes } from './routes/admin/displays.js'
import { ingestRoutes } from './routes/ingest/index.js'
import { canonicalRoutes } from './routes/ingest/canonical.js'
import { createPgAuditLogger } from './lib/audit-log.js'
import { runProvisioning } from './provisioning/loader.js'
import { runIngestionWorker, reclaimStrandedSubmissions } from './ingest/index.js'
import { createMetricsRegistry, registerHttpMetrics, METRIC } from './lib/metrics.js'
import { registerObservability, REQUEST_ID_OPTIONS } from './lib/observability.js'
import { registerRateLimiting, defaultBuckets } from './lib/rate-limit.js'
import { createBulkhead } from './lib/bulkhead.js'
import { createPgSnapshotStore } from './lib/snapshot-store.js'
import { registerOpenApi } from './routes/openapi/index.js'

const app = Fastify({
  logger: { level: env.NODE_ENV === 'development' ? 'info' : 'warn' },
  // API-10 — propagate-or-mint x-request-id as req.id; Fastify binds it as reqId on
  // every per-request log line (req.log child), so a request's worker drain +
  // publish + error lines all correlate by one id.
  ...REQUEST_ID_OPTIONS,
  // Same-origin reverse-proxy topology (ADR adr-deployment-topology): trust the
  // proxy's X-Forwarded-For so req.ip is the real client — the key the per-IP rate
  // limiter (API-11) and any per-client diagnostics depend on.
  trustProxy: true,
})

// ── Global error boundary — RFC 9457 Problem Details ──────────────────────────
// MUST be registered BEFORE any route plugin: a Fastify error handler is
// inherited by child encapsulated contexts at THEIR registration time, so a
// handler set after a route plugin would not cascade into it (the route would
// fall back to Fastify's default error shape). Installing it first makes every
// route — current and future — inherit the one canonical serializer. The
// serializer lives in lib/error-handler.ts so tests register the EXACT
// production handler (no drift); validation failures carry their Zod issues and
// the schema-ahead conflict carries its versions as structured extension members.
registerProblemErrorHandler(app, { includeStack: env.NODE_ENV === 'development' })

// ── Observability floor (API-10) ─────────────────────────────────────────────
// ONE metrics registry (the telemetry port's real adapter), wired BEFORE routes so
// its request-id echo + RED metrics hooks cascade into every child plugin, and the
// rate-limiter + ingest bulkhead can dogfood the SAME registry (no dead port).
const metrics = createMetricsRegistry()
registerHttpMetrics(metrics)
registerObservability(app, { metrics })

// ── OpenAPI (API-16) ──────────────────────────────────────────────────────────
// Registered before the feature routes so its onRoute collector (root context,
// where hooks cascade) captures every route into the generated /api/openapi.json.
registerOpenApi(app, { info: { title: 'statdash API', version: '0.0.1', description: 'JSON/config-driven statistical dashboard platform API.' } })

// Same-origin topology (ADR adr-deployment-topology): prod sets CORS_ORIGIN to a
// disabling sentinel → corsOrigin() yields `false` → @fastify/cors emits no CORS
// headers. A real origin string still passes through for any cross-origin dev setup.
await app.register(cors, { origin: corsOrigin() })
await app.register(dbPlugin)

// ── Rate limiting + load shedding (API-11) ────────────────────────────────────
// Global per-IP onRequest seam, installed before routes. Tight on login (anti-
// brute-force), moderate on the ingest upload, generous global. Dogfoods `metrics`.
registerRateLimiting(app, {
  metrics,
  buckets: defaultBuckets({
    authPerMinute:   env.RATE_LIMIT_AUTH_PER_MIN,
    ingestPerMinute: env.RATE_LIMIT_INGEST_PER_MIN,
    globalPerMinute: env.RATE_LIMIT_GLOBAL_PER_MIN,
  }),
})

// ── Durable governance + delivery adapters (API-03 / API-09) ──────────────────
// app.pg is decorated now (dbPlugin). The audit trail and embed snapshots are
// pg-backed so both SURVIVE A RESTART — the in-memory ring/LRU were launch
// blockers (a governance trail and a public embed URL must be durable). One audit
// instance, injected (port) into every producer + the admin read route.
const audit = createPgAuditLogger(app.pg, app.log)
const snapshotStore = createPgSnapshotStore(app.pg)

// ── Ingest bulkhead (API-11/API-14) ───────────────────────────────────────────
// ONE concurrency semaphore shared across all canonical uploads; feeds the
// in-flight gauge + shed counter into the metrics registry (dogfood).
const ingestBulkhead = createBulkhead({
  name: 'ingest',
  maxConcurrent: env.INGEST_MAX_CONCURRENT,
  maxQueue:      env.INGEST_MAX_QUEUE,
  onShed:   () => metrics.incCounter(METRIC.ingestShed),
  onChange: (active) => metrics.setGauge(METRIC.ingestInFlight, active),
})

await app.register(authRoutes, { prefix: '/api/auth' })
await app.register(configRoutes(audit), { prefix: '/api/config' })
await app.register(statsRoutes(audit), { prefix: '/api/stats' })

// P3-4 — public data-source read. UNGUARDED sibling to configRoutes (the admin
// CRUD): the dashboard has no token at boot but must know which sources to wire.
// Mounted as its own scope so the config JWT guard never cascades to it (mirrors
// the setupRoutes / embedRoutes public-sibling pattern). Returns connected
// sources only, minimal projection.
await app.register(publicDataSourcesRoutes, { prefix: '/api/data-sources' })

// ADR-0026 Phase A — public bootstrap composition. UNGUARDED sibling to
// configRoutes (the admin CRUD): the runner has no token at boot but needs the
// whole site in ONE atomic read (Grafana bootData pattern). Own scope so the
// config JWT guard never cascades to it — published-only, minimal projection,
// delivery surface kept separate from the authoring surface (ISP, least-privilege).
await app.register(bootstrapRoutes, { prefix: '/api/bootstrap' })

// ADR-0026 Constructor capability — public cube-profile introspection. UNGUARDED
// sibling to configRoutes (the admin CRUD): the Constructor preview reads the cube
// it can build on WITHOUT a token, so it gets its own scope (the config JWT guard
// never cascades). Per-measure unit is sourced ONLY from stats.measure_unit_resolved
// (V21 SSOT); actualRegion is a guarded SEAM for V26's stats.cube_actual_region —
// null today, populated the instant that view lands, no contract change.
await app.register(cubeRoutes, { prefix: '/api/cube' })

// ADR SDMX-P1-C — public catalog (CategoryScheme V29). UNGUARDED sibling to
// configRoutes: the Constructor dataset palette + public theme nav browse the
// subject taxonomy WITHOUT a token, so it gets its own scope (the config JWT guard
// never cascades). Published-only projection (joins V28 stats.dataset_published);
// degrades to available:false when V29 is not yet applied here (rolling migration).
await app.register(catalogRoutes, { prefix: '/api/catalog' })

// ADR adr-config-and-render-vision §7 — public page-config JSON Schema. UNGUARDED
// sibling to configRoutes: the Constructor reads the config CONTRACT before it has
// any token, so it gets its own scope (the config JWT guard never cascades). A
// static, generated artifact (packages/contracts/schema) served verbatim — the
// machine-readable form of the SAME structural floor validateConfig enforces.
await app.register(schemaRoutes, { prefix: '/api/schema' })

// N38 — snapshot persistence + signed embed (delivery boundary). The pg-backed
// store (created above) is injected into the guarded write route and the public
// read route. The write route also records each mint into the audit trail [N41].
await app.register(snapshotsRoutes(snapshotStore, audit), { prefix: '/api/snapshots' })
await app.register(embedRoutes(snapshotStore), { prefix: '/api/embed' })

// P2-2 — first-admin bootstrap. UNGUARDED on purpose (no admin exists yet to
// authenticate as) but self-disabling once an admin user exists. Mounted as a
// sibling to adminRoutes so it escapes that scope's JWT + admin-role guard.
await app.register(setupRoutes, { prefix: '/api/admin/setup' })

// N41 — admin governance surface (audit-log read). JWT + admin-role guarded.
await app.register(adminRoutes(audit), { prefix: '/api/admin' })

// Curator display-overlay CSV round-trip (export/import). Mounted under /api/admin
// for surface cohesion, but a SELF-CONTAINED SIBLING — NOT nested under adminRoutes —
// because adminRoutes' scope hook is admin-ONLY, whereas display curation is a
// data-curation surface open to admin OR editor (same WRITE_ROLES as ingestRoutes).
// The plugin owns its own auth + curator-role guard, so it is independently testable.
await app.register(displaysRoutes, { prefix: '/api/admin/displays' })

// V11 — Staged Submission Pipeline HTTP entry point. Own scope (JWT + curator
// role guard inside the plugin), sibling to adminRoutes — NOT nested under it, so
// the route owns its own guard and is independently testable (mirrors the
// data-sources public sibling pattern). Mounted at /api/ingest.
await app.register(ingestRoutes(audit), { prefix: '/api/ingest' })

// ADR-0031 Wave 3a — canonical-workbook UPLOAD. The PRIMARY steady-state ingest:
// a curator POSTs a conformant .xlsx; the route parses it at the boundary (the
// worker never sees Excel) and lands up to 3 ordered submissions (codelists →
// displays → facts) into the SAME pipeline. Own scope (JWT + curator-role guard),
// a self-contained SIBLING — NOT nested under ingestRoutes — so it owns its octet-
// stream body parser + guard and is independently testable (mirrors displaysRoutes).
await app.register(canonicalRoutes(ingestBulkhead), { prefix: '/api/ingest/canonical' })

app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

// P2-5 — file-based provisioning (GitOps). Run after the app (and so app.pg) is
// fully booted, before we accept traffic, so the config in PROVISIONING_DIR is
// applied to config.* on every boot (idempotent). A failed run is logged, not
// fatal: provisioning is convergence, not a boot precondition (graceful
// degradation — existing DB config still serves).
await app.ready()
try {
  await runProvisioning(app.pg, {
    dir:    env.PROVISIONING_DIR,
    dryRun: env.PROVISIONING_DRY_RUN,
    logger: app.log,
  })
} catch (err) {
  app.log.error(err, 'provisioning: unexpected failure (continuing boot)')
}

// API-02 — crash-recovery reclaim BEFORE the drain: a worker that died mid-parse
// left a row stranded in 'parsing' (neither 'received' nor terminal), which the
// drain (selects 'received') would never re-claim. The reclaim sweep re-queues any
// 'parsing' row whose claim is older than the visibility timeout back to 'received'
// so the drain immediately below re-processes it. Fail-soft (logged, never fatal).
await reclaimStrandedSubmissions(app.pg, { logger: app.log })

// V11 — drain any submissions left in 'received' from a prior run (a crash between
// accept and process). Runs after provisioning so the gold cube/config is current
// before any publish. FAIL-SOFT (graceful degradation): a worker failure is logged,
// never fatal — the queue is durable and the next route-triggered drain retries.
try {
  await runIngestionWorker(app.pg, { logger: app.log })
} catch (err) {
  app.log.error(err, 'ingest worker: boot drain failed (continuing boot)')
}

try {
  await app.listen({ port: env.PORT, host: env.HOST })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}

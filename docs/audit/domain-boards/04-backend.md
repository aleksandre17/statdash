# Board 04 — Backend / API / Ingestion / SDMX-Serve

> Senior deep-analysis of `platform/apps/api` (Fastify + Postgres/TimescaleDB) against the renderer's
> needs, the canonical ingestion pipeline, SDMX-serve readiness, and production-hardening. Code is
> truth — every card is anchored to a verified file:line. Analysis only; no product code changed.
>
> Verdict up front: this is an **unusually principled service tier** — RFC 9457 done correctly,
> ETag/304 on the hot path, an idempotent Medallion pipeline with a real approval FSM, SCD-2 + as-of
> vintage reconstruction that most commercial stat platforms do NOT have. The gaps are almost entirely
> at the **operational edge** (rate-limiting, OpenAPI, structured request tracing, pagination beyond
> `limit`) and in the **deferred SDMX-REST serve surface** (the port is reserved but only `json` is wired).

---

### [API-01] Delivery API surface vs the renderer's boot needs (bootstrap composition)
- **Status**: ✅DONE
- **Evidence**: `platform/apps/api/src/routes/bootstrap/index.ts:156-317`; mounted unguarded `src/index.ts:66`.
  - **What & why**: `GET /api/bootstrap` returns ONE atomic `SiteManifestContract` (pages forward-migrated, nav CTE, site_config, connected datasources, optional V29 categories) — the Grafana `bootData` / Retool `fetchAppManifest` pattern. The renderer boots the whole site in a single round-trip, never orchestrating server concerns and never seeing a half-composed site. Independent SELECTs run via `Promise.all` (one round-trip latency, not five).
  - **Critical analysis**: Excellent. The public delivery surface is correctly split from the JWT-guarded authoring surface (`config/*`) as a sibling scope, so the guard never cascades (ISP + least-privilege). Per-page forward-migration is skip-with-log (graceful degradation: one schema-ahead page doesn't 409 the whole manifest). One real wart: the manifest is **not paginated/bounded** — a tenant with thousands of published pages composes them all into one body every boot (see [API-13]). The `nav` blob-vs-CTE fallback is a smart Postel move but means two sources of nav truth exist transiently.
  - **Reference platforms**: **Grafana** `bootData` (settings + nav + datasources in one payload) — we match it and add forward-migration-on-read. **Supabase/PostgREST** has no equivalent composition (client orchestrates N reads) — we beat it on round-trips. **Looker** embeds a manifest API; ours is leaner and JSON-safe end-to-end.
  - **Foresight (1-2yr; multi-tenant)**: the boot read is the per-tenant hot path. It needs (a) a per-tenant ETag namespace (already weak-ETag'd on `MAX(updated_at)`, good), (b) edge-cacheable variant once auth-per-tenant lands, (c) a page-budget or lazy page hydration so a 5k-page tenant doesn't ship 5k configs at boot.
  - **Plan**: none required now; track the page-budget concern under [API-13]. Class M, low priority, two-way door.
  - **Raises-the-bar**: forward-migrate-on-read in the delivery composition (stored configs never block a boot) is a pattern most BI backends lack.

### [API-02] Canonical ingestion pipeline — Bronze → Silver → Gold (Pipe-and-Filter + Medallion)
- **Status**: ✅DONE
- **Evidence**: `src/ingest/submit.ts:80-146` (bronze write + idempotency), `src/ingest/worker.ts:42-276` (silver drain), `src/ingest/publish.ts:67-393` (gold promotion); HTTP boundary `src/routes/ingest/canonical.ts:102-295`.
  - **What & why**: A textbook Medallion + Pipe-and-Filter. Bronze = one immutable `submission_blob` (SHA-256 content-hash). Silver = `worker.ts` drains `received → parsing → staged/rejected` through parse→conform→validate, each a replaceable filter; **the DB is the queue** (`SELECT … FOR UPDATE SKIP LOCKED LIMIT 1`, Competing-Consumers, no external broker). Gold = `publish.ts` promotes silver→`stats.*` in one all-or-nothing txn, reusing the canonical idempotent upserts so the V4 dim_key + V8 revision triggers fire identically to the seed. The canonical `.xlsx` upload parses at the HTTP boundary; **the worker never sees Excel** — `format:'canonical-xlsx'` is a provenance label, not a worker branch.
  - **Critical analysis**: This is the strongest part of the tier. Fail-soft drain (one bad file marks `failed` and the loop continues), idempotent silver persistence (DELETE-then-bulk-INSERT per submission so a re-drain is safe), set-based gold promotion (`INSERT … SELECT … ON CONFLICT`, no per-row round-trip). The honest weakness: the worker runs **in-process** (boot drain + `setImmediate` fire-and-forget + in-route synchronous drive for the canonical upload). There is no out-of-process worker, no dead-letter queue with retry/backoff, no visibility timeout beyond the row lock. A `parsing` row whose worker process dies mid-flight is **stranded** (not `received`, so the boot drain won't re-claim it) — a crash-recovery gap. Per-row `INSERT` loops in `insertStagedObs` (`worker.ts:234`) are O(N) round-trips on the silver write (the gold write is set-based; silver is not).
  - **Reference platforms**: **SDMX/.Stat Suite** has a staging→validation→production data lifecycle — ours mirrors it with a tighter FSM and content-hash idempotency. **Hasura/Supabase** have no ingestion pipeline at all (they're CRUD-over-SQL). **dbt** (Medallion reference) is batch-transform only; we add an approval gate dbt lacks.
  - **Foresight**: at multi-tenant scale the in-process worker is the first thing to break under concurrent large uploads (one slow workbook blocks the request thread doing the synchronous drive). Extract to an out-of-process worker (same `runIngestionWorker`, different host) + a `parsing`-reclaim sweep (visibility timeout) + bulk silver COPY.
  - **Plan**: (1) add a boot-time reclaim: `UPDATE … SET status='received' WHERE status='parsing' AND claimed_at < now()-interval` (needs a `claimed_at` column — Class G, architect escalation for the migration). (2) Replace the silver per-row INSERT loop with `pg-copy-streams` or a single multi-row INSERT (Class M, api-local, low risk). (3) Defer out-of-process worker to the scale trigger. Effort: (1)+(2) ~1 day. Risk: two-way door.
  - **Raises-the-bar**: content-hash idempotency at the bronze boundary + dry-run-through-to-gold-then-ROLLBACK (`publish.ts:142`) is a CI-grade "validate a real file end-to-end without mutating the cube" capability.

### [API-03] Approval FSM + publish gate (governance)
- **Status**: ✅DONE
- **Evidence**: `src/routes/ingest/index.ts:203-276` (publish/reject), `src/ingest/publish.ts:85-203` (server-authoritative re-check + txn).
  - **What & why**: `staged → publishing → published/failed`, curator-gated. `POST /jobs/:id/publish` re-checks preconditions server-side (`status='staged'` AND zero error-issues) — the client's `canPublish` is advisory; the server is authoritative (defense in depth, re-asserted again inside `publishSubmission`). `reject` puts the status guard IN the UPDATE (`WHERE status='staged'`) so a concurrent publish cannot be clobbered (optimistic concurrency, zero-rows-updated ⇒ 409). Correct 404-vs-409 disambiguation.
  - **Critical analysis**: The FSM is coherent and the concurrency handling is genuinely careful (the WHERE-guarded UPDATE is the right pattern, not a read-then-write race). Provenance is stamped via `SET LOCAL app.revised_by` so the V8 trigger records *which submission* revised each figure for free. Gap: the FSM has **no terminal audit of *who approved* beyond the audit-log fire-and-forget** — and the audit logger is `createInMemoryAuditLogger(1000)` (`index.ts:43`), i.e. a ring buffer that is **lost on restart** (see [API-10]). The governance trail for a regulated stats agency must be durable.
  - **Reference platforms**: **.Stat Suite** has a four-eyes data approval workflow — ours matches the shape (curator submits, curator/admin approves) but the audit persistence is weaker. **Looker** PDT/approval flows; **Grafana** has none.
  - **Foresight**: regulators (ONS/IMF/Eurostat alignment, per root law 9) will require a durable, queryable approval ledger with actor + timestamp + reason. The in-memory audit is a launch-blocker for that posture.
  - **Plan**: promote the audit sink to a durable `config.audit_log` table (the port already exists — `AuditLogger` is injected everywhere; swap the in-memory adapter for a pg-backed one). Class G (migration), medium priority, one-way-ish (data retention). Effort ~1 day. See [API-10].
  - **Raises-the-bar**: the WHERE-guarded state transition as the concurrency primitive (no SELECT-FOR-UPDATE needed for the simple reject) is clean.

### [API-04] SDMX-REST serve readiness (structure + data messages)
- **Status**: 🟡PARTIAL (port reserved, only `json` wired)
- **Evidence**: `src/routes/stats/serialize/registry.ts:52-107` (reserved formats, only `json` registered), `src/routes/stats/serialize/dispatch.ts:43-73`, observations route `?format=` slot `src/routes/stats/observations.ts:109`.
  - **What & why**: A content-negotiation **port** (`?format=`) is the reserved OCP seam for SIX future formats — `sdmx-json-2.0`, `sdmx-csv`, `qb-turtle`, `datapackage`, `parquet`, `prov`. Today only `json` (the `{data}` envelope) is registered; any other value is a crisp 400 (RFC 9457) "Unsupported format". The cube introspection (`/api/cube/:id/profile`) already serves DSD-shaped structure (dimensions + concept roles + members + resolved units) — the **structure message in all but name**.
  - **Critical analysis**: This is the single most important *deliberate* gap. The platform is positioned as SDMX-native (DSD → Kimball → SDMX-JSON per `docs/architecture/subsystems/11-backend-standards.md`) and the renderer's `fromSDMX` adapter is "the only adapter boundary" — yet the API **does not serve a single SDMX-REST endpoint**. No `/data/{flow}/{key}`, no `/structure/datastructure/{id}`, no `/codelist/{id}`, no `application/vnd.sdmx.data+json;version=2.0.0` media type. The observations response is a bespoke `{data:[{time_period, dim_key, obs_value, obs_status, obs_attribute}]}` shape — close to SDMX-JSON's flat observation form but NOT conformant (no `meta.structure`, no `data.dataSets`, no `series`/`observations` keyed arrays, no `dimensions/attributes` declaration block). A real SDMX consumer (Eurostat harvester, .Stat Suite federation, SDMX RI) cannot read it. The `cube/profile` bundle is a *superior* introspection format for the Constructor but is **not** an SDMX `structure` message. **YAGNI-honestly**: no external SDMX consumer exists yet, so reserving the port (vs building six serializers) is the correct call — but the gap should be named loudly, not implied "done" by the SDMX-flavoured vocabulary.
  - **Reference platforms**: **SDMX/.Stat Suite** IS the reference — it serves SDMX-REST 1.5/2.1 structure+data natively; we serve neither yet. **Cube API** (`/cubejs-api/v1/load`) serves a bespoke JSON + a `/meta` structure endpoint — that's exactly our shape (`observations` + `cube/profile`), so we're at **Cube parity, not SDMX parity**. Where WE beat them: our as-of vintage + SCD-2 (Cube has neither) and our content-negotiation port is cleaner than Cube's hardcoded JSON.
  - **Foresight**: the moment a second agency wants to federate or a Eurostat-style harvester appears, `sdmx-json-2.0` + `sdmx-csv` serializers become the highest-leverage unlock. The data is already shaped for it (dim_key JSONB → SDMX series keys is a pure projection).
  - **Plan**: register two serializers behind the existing port — `sdmx-csv` first (trivial: flatten `dim_key` to columns + OBS_VALUE/OBS_STATUS, `text/csv`) then `sdmx-json-2.0` (assemble `meta.structure` from the `cube/profile` reads + `data.dataSets.series` from observations). Files: new `src/routes/stats/serialize/sdmx-csv.ts` + `sdmx-json.ts`, each one `registerSerializer(...)` call; zero route edits (the port is wired). Fitness-fn: a conformance test against the SDMX-JSON 2.0 JSON Schema. Effort: sdmx-csv ~0.5d, sdmx-json ~2-3d. Risk: two-way door (additive). Class G (cross-module: needs the structure assembly shared with cube). High priority *when* the federation trigger fires; reserved until then.
  - **Raises-the-bar**: building the negotiation port BEFORE the formats (so adding SDMX is a registration, not a refactor) is exactly right; the bar to raise is shipping the first non-json serializer to prove the seam end-to-end.

### [API-05] ETag / 304 conditional-GET (caching with explicit invalidation)
- **Status**: ✅DONE
- **Evidence**: observations `src/routes/stats/observations.ts:121-132,297-315,365-371`; bootstrap `src/routes/bootstrap/index.ts:163-180`.
  - **What & why**: The hot observation read resolves `stats.dataset_version` FIRST, sets a weak ETag `W/"<dataset>.<version>"`, and short-circuits a matching `If-None-Match` with 304 (no body, no obs scan). The version counter is bumped by every ETL/seed (`bumpDatasetVersion`) — the SSOT for cache staleness. Vintage reads use an immutable asOf-keyed ETag (the past can't be re-published → strongly cacheable). Bootstrap uses a `MAX(updated_at)` weak ETag across the five composed tables. RFC 9110 §13.1.2 weak-comparison `If-None-Match` parsing is correct (handles lists + `*` + W/ prefix on either side).
  - **Critical analysis**: This is better than most. The choice of *weak* validators is correctly justified (filtered/paginated projection ⇒ semantic equivalence, not byte-identity). `Cache-Control: no-cache` (store-but-revalidate) is the right directive. Two refinements: (1) no `Vary: Accept` / `Vary` on the `?format=` dimension — once a second serializer lands, the same ETag would serve a cached json body to a `?format=sdmx-csv` request (cache-poisoning across formats). The ETag must incorporate `format`. (2) The cube/profile read deliberately skips ETag (`observations.ts` comment notes "add only if profiling shows hot") — defensible YAGNI, but it IS a Constructor hot path.
  - **Reference platforms**: **PostgREST** emits ETags but no version-counter SSOT (it hashes rows). **Grafana** caches by query-hash in-memory, not HTTP-conditional. We beat both: a monotonic version counter is a cheaper, more honest validator than a content hash and invalidates atomically on write.
  - **Foresight**: fold `format` (and eventually tenant + locale) into the ETag key before shipping serializer #2.
  - **Plan**: when [API-04] lands, change `datasetETag` to `W/"<dataset>.<version>.<format>"` and add `reply.header('Vary','Accept')`. One-line, Class M, do-it-with-the-serializer. Risk: two-way door.
  - **Raises-the-bar**: version-counter-as-validator + the auditability exception (an explicit `?asOf=` permalink skips the lifecycle 404 because "data outlives code") is a thoughtful correctness call.

### [API-06] Auth + RBAC + the role model
- **Status**: 🟡PARTIAL (correct + coherent; production-hardening gaps)
- **Evidence**: JWT `src/lib/auth.ts:50-98` (HS256 on node:crypto), guard `src/auth.ts:24-37`, role gates `src/routes/admin/index.ts:33-38` / `src/routes/ingest/index.ts:45-52`; role model in memory `project_rbac_vocabulary.md`.
  - **What & why**: Hand-rolled HS256 JWT (zero supply-chain surface), verified fail-fast with timing-safe signature compare BEFORE reading claims. RBAC = `admin / editor / viewer` (no `publisher` — publish gated to admin; editor-saves/admin-publishes separation without a 4th role). Two-layer guards: `authPlugin` (401, who-are-you) then a role `onRequest` hook (403, you-may-not) — RFC 7235-correct 401-vs-403 throughout. `requireWrite = admin|editor` on the curation surfaces; admin-only on users/export/audit. Login has correct anti-enumeration (missing-user and wrong-password both 401; disabled-account 403 only after the password verifies) and an env-var bootstrap that self-disables once a DB admin exists (no permanent backdoor).
  - **Critical analysis**: The *design* is senior-grade. The *hardening* is thin for a public-internet posture: (1) **single symmetric secret, no key rotation, no `kid`** — rotating `JWT_SECRET` invalidates every live token instantly (no overlap window). (2) **No refresh tokens / no revocation list** — a leaked 24h token is valid for 24h, full stop; a disabled user keeps their token until expiry (the `enabled` check runs at login, not per-request). (3) **No rate-limiting on `POST /api/auth`** (see [API-11]) — the login is brute-forceable. (4) HS256 single-issuer is fine for single-tenant; multi-tenant will want per-tenant audience/issuer claims. (5) No CSRF concern only because it's Bearer-header (good), but no token-binding either.
  - **Reference platforms**: **Supabase Auth** (GoTrue) — refresh tokens, rotation, JWKS, RLS. **Hasura** — JWKS + per-request claims → RLS. We're behind on rotation/revocation but ahead on simplicity/zero-deps. **Looker** — signed embed + SSO; our embed HMAC ([API-09]) is comparable.
  - **Foresight (multi-tenant)**: per-request authorization (a disabled/role-changed user must lose access immediately) and tenant-scoped claims are mandatory. The single-secret model becomes the bottleneck — move to short-lived access + refresh, or asymmetric (RS256/EdDSA) with a JWKS so the verifier doesn't hold the signing key.
  - **Plan**: (1) add per-request `enabled`-recheck (or short TTL + refresh) — Class G. (2) Add login rate-limit — Class M, see [API-11]. (3) Plan rotation: introduce `kid` + an array of accepted secrets (overlap window) — Class M, additive, two-way door. Escalate the access/refresh split to architect (one-way door on token shape). Effort: rate-limit ~0.5d, kid-overlap ~1d, refresh-tokens ~3d (escalate). Priority: rate-limit HIGH, rest medium.
  - **Raises-the-bar**: the env-bootstrap-that-self-disables and the no-username-enumeration login are correct details most teams miss.

### [API-07] RFC 9457 Problem Details (error contract)
- **Status**: ✅DONE (exemplary)
- **Evidence**: registry `src/lib/problem.ts:46-225`, central handler `src/lib/error-handler.ts:19-43`, registered-before-routes `src/index.ts:38`.
  - **What & why**: ONE `application/problem+json` mechanism. A `PROBLEM_REGISTRY` (open/extensible: new error kind = one entry, not a switch edit) keyed by stable slug → `{urn, title, status}`. Routes throw `problem(kind, detail, ext)` or semantic helpers (`notFound`, `conflict`, `alreadyPublished`); a central `setErrorHandler` normalizes ANY throw (`toProblem`) and serializes with the correct media type via explicit header (survives downstream serializer override). Extension members are first-class (`issues` from Zod/engine validation, `existingJobId`+`code` for idempotency conflicts, `configSchemaVersion`/`currentSchemaVersion` for the schema-ahead guard) — machine-readable §3.2, never a stringified blob in `detail`. 5xx logged at error, 4xx at warn (fail-fast, nothing swallowed). `HttpError` is a Strangler-Fig adapter preserving legacy status-first call sites through the same registry.
  - **Critical analysis**: Genuinely reference-quality. The single observation: the registry's `type` URIs are URN-prefixed (`PROBLEM_URN_PREFIX + urn`) — RFC 9457 allows any URI but **dereferenceable HTTPS type URIs** (pointing at human docs) are the recommended form; URNs are valid but not resolvable. The handler-must-register-before-routes pitfall is correctly documented and avoided (Fastify error handlers cascade at child-registration time). `includeStack` only in dev — correct.
  - **Reference platforms**: **PostgREST** emits a `{code,details,hint,message}` shape — NOT RFC 9457. **Hasura** has its own error envelope. **Stripe**-class APIs use typed error codes; ours is more standards-conformant than any listed reference platform. We beat all of them here.
  - **Foresight**: when the public SDMX/embed surface grows, switch the `type` URN to a dereferenceable docs URL so consumers can click through.
  - **Plan**: optional — change `PROBLEM_URN_PREFIX` to an `https://errors.<domain>/` base and host the catalogue. Class M, trivial, low priority, two-way door.
  - **Raises-the-bar**: the registry-as-SSOT + extension-members-not-blobs discipline is the gold standard; other modules should copy it.

### [API-08] Data-source kinds (static/href/stats) + deferred D-HREF + auth-envelope doors
- **Status**: 🟡PARTIAL (read/provision done; href + auth-envelope deferred by design)
- **Evidence**: public read `src/routes/data-sources/index.ts:32-46`, bootstrap mapping `src/routes/bootstrap/index.ts:290-295`; AuthConfig union in `docs/architecture/subsystems/25-datasource-system.md:141-147`.
  - **What & why**: `config.data_source` rows (name/type/url/config) project to `DatasourceInstanceConfig{id,kind,url,params}` for the renderer's `buildStoreManifest`. `status='connected'` is the publish gate (idle/error/pending sources are filtered server-side — least-privilege). The `kind` is an open string (static/href/stats per the registry), so a new datasource plugin needs zero API change (Grafana plugin model).
  - **Critical analysis**: The provisioning + read path is solid and correctly minimal. But the doc's `AuthConfig` discriminated union (bearer/basic/apikey/custom) is a **client-side** envelope — the API stores `config` JSONB verbatim and ships it to the browser via the **unguarded** bootstrap/data-sources reads. That means a `bearer.token` or `apikey.value` placed in a source `config` would be **served to every anonymous boot client**. Today's geostat sources are single-origin (url=NULL or public), so no secret leaks — but the contract permits it and there is no server-side redaction. The deferred **D-HREF** (a datasource that proxies an external SDMX href) and the **auth-envelope** are correctly NOT built yet, but when they land, the secret-bearing fields MUST be redacted server-side or proxied (the browser must never hold the upstream credential).
  - **Reference platforms**: **Grafana** solves exactly this — datasource secrets are stored encrypted and the *backend* proxies the query (the browser never sees the API key); `secureJsonData` is write-only. **Retool** resource credentials are server-held. We are currently at the *insecure* end of that spectrum by omission (no secrets stored yet, but no redaction either).
  - **Foresight**: the instant D-HREF (proxy an authenticated upstream) ships, this becomes a credential-exposure vulnerability. Build the redaction + backend-proxy seam WITH D-HREF, not after.
  - **Plan**: (1) add a server-side redaction projection on the public data_source reads (strip any `config.auth.*` secret field) — Class M, do now as defense-in-depth even before D-HREF. (2) Design D-HREF as a **backend proxy** (`GET /api/data-sources/:id/proxy?…` injecting the stored credential), never a client-side fetch with a shipped token — Class G, architect escalation (cross-module: renderer store + API proxy + secret-at-rest). Effort: redaction ~0.5d, proxy ~3d. Priority: redaction HIGH (cheap insurance), proxy gated on D-HREF.
  - **Raises-the-bar**: the `status='connected'` server-side gate is good; the bar is the Grafana-style secret-proxy before any authenticated upstream.

### [API-09] Snapshots + signed embed (delivery boundary)
- **Status**: 🟡PARTIAL (correct crypto + lifecycle; in-memory store)
- **Evidence**: `src/routes/embed/index.ts:46-118`, store wired `src/index.ts:93-95`.
  - **What & why**: `POST /api/snapshots` (JWT-guarded write) persists an engine snapshot, returns an HMAC-signed embed URL; `GET /api/embed/:token?sig=` is public, authorized by the HMAC signature (external embedders have no JWT). Fail-fast order is deliberate and correct: 403 bad-sig FIRST (never reveal token existence to an unsigned caller) → 404 not-found → 410 Gone (expired window). Every mint is audited against the JWT subject. The embed returns the raw snapshot JSON (not the `{data}` envelope) — correct, an embedder shouldn't unwrap.
  - **Critical analysis**: The crypto + status semantics are right (410 for expired is exactly correct, most teams wrongly 404). The store is `createSnapshotStore(100)` — an **in-memory ring of 100**, lost on restart and capped. A minted embed URL handed to a partner **dies on the next deploy**. The boundary schema validates only `generatedAt` + passthrough (correctly avoids coupling to engine internals). No per-embed revocation, no view-count/rate cap on the public read.
  - **Reference platforms**: **Looker** signed-embed SSO URLs — durable, revocable; ours is signed but ephemeral. **Grafana** snapshot sharing — DB-backed with expiry; we match the shape, lose on persistence.
  - **Foresight**: a public embed contract that breaks on every deploy is unshippable for real external embedding. The `SnapshotStore` is already a port (injected) — swap the in-memory adapter for pg-backed.
  - **Plan**: implement a `PgSnapshotStore` behind the existing `SnapshotStore` port (one binding change in `index.ts`); add an `expires_at` index + a sweep. Class G (migration for the snapshot table), medium-high priority (blocks external embed). Effort ~1d. Risk: two-way door.
  - **Raises-the-bar**: the 403-before-404 information-leak ordering is the kind of detail that distinguishes a security-aware tier.

### [API-10] Observability — logs / metrics / traces
- **Status**: 🟡PARTIAL (structured logs only; no metrics, no traces, no request-id)
- **Evidence**: logger config `src/index.ts:25-27` (Pino via Fastify), audit ring `src/index.ts:43`; no metrics/trace deps in `package.json`.
  - **What & why**: Fastify's built-in Pino structured logging (info in dev, warn in prod). Domain logs are structured with context (`{id, kind, status, ...preview}` in the worker, `{missing}` in bootstrap). Errors flow through the central handler (5xx→error, 4xx→warn).
  - **Critical analysis**: Logs are present and structured — that's pillar one. Pillars two and three are **absent**: no Prometheus/OpenMetrics endpoint, no RED/USE metrics (request rate/errors/duration, pool saturation, queue depth), no OpenTelemetry traces, **no request-id / correlation-id** propagated through the log lines (so you cannot stitch a single request's worker drain + publish across log entries). For a stat platform with a multi-stage async pipeline, **queue-depth and publish-latency metrics are exactly what you'd page on** — and they don't exist. The audit "log" is an in-memory ring (governance, not observability, but also non-durable — see [API-03]).
  - **Reference platforms**: **Grafana** (ironically the observability reference) exposes `/metrics` + traces natively. **Supabase/Hasura** ship Prometheus metrics. We have none — this is the widest operational gap.
  - **Foresight**: you cannot run SLO/error-budget governance (skill §10) without metrics. At multi-tenant scale, per-tenant request metrics + pipeline-stage histograms are mandatory for capacity planning and on-call.
  - **Plan**: (1) add a `requestId` hook (`req.id` → every log line + the `instance` of Problem responses) — Class M, ~0.5d, highest leverage for debuggability. (2) Add `/metrics` via `fastify-metrics` or hand-rolled `prom-client`: http histogram, pg-pool gauge, ingest queue-depth gauge, publish-duration histogram — Class M/G, ~1-2d. (3) OTel traces — defer to the trigger (first cross-service call). Risk: two-way door. Priority: requestId HIGH, metrics HIGH.
  - **Raises-the-bar**: wiring `requestId` INTO the RFC-9457 `instance` field (already the request URL) closes the log↔error loop elegantly.

### [API-11] Rate limiting / load shedding
- **Status**: 🆕GAP
- **Evidence**: grep `@fastify/rate-limit|429|rateLimit` across `apps/api/src` → **zero matches**; not in `package.json`.
  - **What & why**: There is no rate limiting anywhere — not on `POST /api/auth` (brute-force), not on the public unguarded reads (bootstrap/observations/cube/embed), not on the expensive ingest upload.
  - **Critical analysis**: A clean miss. The login is brute-forceable; the public observation read (with `limit` up to 10000) is a cheap DoS amplifier; the canonical upload (25MB, synchronous in-process drive) is a resource-exhaustion vector (a few concurrent large uploads saturate the event loop AND the pg pool). No backpressure, no load-shedding, no per-IP/per-token budget.
  - **Reference platforms**: **Supabase/PostgREST/Hasura** all ship rate-limiting (or sit behind Kong/an API gateway that does). **Grafana** has request quotas. This is table-stakes we're missing.
  - **Foresight**: mandatory before any public-internet exposure; per-tenant quotas at multi-tenant scale.
  - **Plan**: add `@fastify/rate-limit` — a global default budget + a stricter per-route budget on `POST /api/auth` and `POST /api/ingest/canonical`; 429 with `Retry-After` (RFC 9457 problem `too-many-requests` — a new registry entry, OCP). Files: `index.ts` (register), `lib/problem.ts` (add `too-many-requests`/429 kind). Fitness-fn: a test asserting the 6th login in a window is 429. Effort ~0.5d. Risk: two-way door, Class M. Priority HIGH (security).
  - **Raises-the-bar**: pair it with a `bulkhead` on the ingest path (a concurrency semaphore so N uploads queue rather than saturate the pool).

### [API-12] Idempotency
- **Status**: ✅DONE (where it matters; one nuance)
- **Evidence**: bronze content-hash guard `src/ingest/submit.ts:85-103`, `alreadyPublished` 409 factory `src/lib/problem.ts:154-158`, canonical converge-on-retry `src/routes/ingest/canonical-fsm-drive.ts:109-142`, provisioning idempotent upserts.
  - **What & why**: The Idempotent Receiver (EIP) is correctly implemented: every payload is SHA-256 hashed; an identical already-**published** payload for the same dataset → 409 with `existingJobId` (machine-readable). The guard targets the *published terminal state* (not in-flight dupes), so a retry after a transient failure proceeds. The canonical upload adds a sophisticated **partial-failure → retry → converge** path: if a prior run published reference data but crashed before facts, the retry adopts the existing published reference job (converged no-op) instead of 409-ing the tail. Gold upserts are `ON CONFLICT DO UPDATE`; silver persistence is DELETE-then-INSERT per submission. Provisioning is convergent on every boot.
  - **Critical analysis**: This is more careful than most. The one gap: the public write surfaces (`POST /snapshots`, the curator routes) accept **no client-supplied `Idempotency-Key` header** (the Stripe pattern) — idempotency is *content-derived*, which is correct for ingestion but means a client cannot safely retry a snapshot mint (each POST mints a new token). For ingestion the content-hash is the better key; for snapshots/embeds an explicit idempotency key would prevent duplicate mints on network retry.
  - **Reference platforms**: **Stripe** `Idempotency-Key` header is the gold standard for client-retryable writes; we have content-hash idempotency (better for data, absent for resource-creation). **.Stat Suite** dedupes by dataset+version.
  - **Foresight**: as more write endpoints appear, a generic `Idempotency-Key` middleware (store key→response for 24h) becomes the reusable seam.
  - **Plan**: optional generic `Idempotency-Key` Fastify hook for resource-creating POSTs (snapshots first). Class M, low priority, two-way door. Effort ~1d.
  - **Raises-the-bar**: the converge-on-retry FSM logic is a genuinely advanced resilience pattern (most pipelines just 409 and force a human to untangle the partial state).

### [API-13] Pagination
- **Status**: 🟡PARTIAL (`limit` only; no cursor/offset/total)
- **Evidence**: observations `limit` cap 10000 `src/routes/stats/observations.ts:100`, jobs/audit `limit` caps; grep `offset|cursor|nextCursor` → none in routes.
  - **What & why**: Every list route bounds results with a `limit` (good — no unbounded scans) and orders deterministically.
  - **Critical analysis**: `limit` alone is not pagination — there is **no cursor, no offset, no `nextCursor`/`hasMore`, no total count**. A dataset with >10000 observations matching a filter is silently truncated (the client cannot fetch page 2). The bootstrap composes ALL published pages with no page-budget. For the renderer's current per-page slices this is fine; for a Constructor browsing a large cube or an SDMX consumer harvesting a full flow, it's a correctness gap (truncation-as-silent-data-loss).
  - **Reference platforms**: **PostgREST** `Range` headers + `Content-Range` (offset pagination) + exact/planned counts. **Cube API** `limit`+`offset`. **Hasura** cursor + offset. We're behind — `limit`-only is the weakest form.
  - **Foresight**: keyset/cursor pagination (on `time_period_date, dim_key`) is the scalable form for the time-series hot path; offset is fine for the small admin lists.
  - **Plan**: add keyset pagination to the observations read (cursor = last `(time_period_date, dim_key)`; respond with `nextCursor` when `rows.length === limit`). Offset for jobs/audit. Files: `observations.ts`, `lib/http.ts` (a pagination envelope helper). Fitness-fn: a >limit fixture returns a usable `nextCursor` that fetches the remainder with no gap/overlap. Effort ~1d. Risk: two-way door (additive — absent cursor = today's behavior), Class M. Priority medium (rises with SDMX-serve [API-04]).
  - **Raises-the-bar**: keyset over the hypertable partition key is the right, index-aligned choice.

### [API-14] Async lifecycle / backpressure / streaming (the N34 contract)
- **Status**: ⛔NOT-DONE (designed only; renderer-side concern)
- **Evidence**: `platform/docs/plan/N34/README.md:1-23`, `07-streaming.md:1-18`; framework-gaps `docs/architecture/future/07-framework-gaps/overview.md:78-93`.
  - **What & why**: N34 is a **design-only** contract (QueryResult/DataStore/RenderContext/SSR-fastlane/streaming) for the *renderer's* async lifecycle. The central decision keeps `interpretSpec` synchronous; async is a React-layer concern. Streaming/`subscribe` is a deferred optional extension with polling as the default and explicit backpressure (drop in-flight results superseded by a newer `specDimKey`, last-write-wins; one slow subscription can't block siblings).
  - **Critical analysis**: This is *renderer* backpressure, not *API* backpressure — and on the API side, backpressure is genuinely **absent** (no load-shedding [API-11], the in-process worker has no bounded queue, the synchronous canonical drive has no concurrency limit). The N34 design is sound for the front, but it does NOT address server-side backpressure, and the framework-gaps doc explicitly defers query-level caching, format-agnostic queries, and streaming to "Phase 3/4 — not needed yet". For batch statistical data that's a defensible YAGNI, but server-side backpressure (the bulkhead on ingest, the bounded queue) should NOT wait for streaming.
  - **Reference platforms**: **Grafana** uses RxJS Observables for live panels + has server-side query concurrency limits. We have neither the streaming nor the server bulkhead.
  - **Foresight**: real-time stat releases (a "data just published" push) are a Phase-4 differentiator, but the server bulkhead is a Phase-1 safety need.
  - **Plan**: decouple — ship the ingest bulkhead now (a `p-limit`-style semaphore around the in-process drive + a bounded boot-drain) under [API-11]; keep streaming deferred to its trigger. Class M for the bulkhead. Risk: two-way door.
  - **Raises-the-bar**: N34's `specDimKey` last-write-wins is the correct front-end backpressure; mirror that discipline server-side with a bounded work queue.

### [API-15] Error taxonomy (beyond the envelope)
- **Status**: ✅DONE
- **Evidence**: `PROBLEM_REGISTRY` slugs `src/lib/problem.ts:46-73`, domain codes as extension members (`SUBMISSION_REJECTED`, `ALREADY_PUBLISHED`, `DSD_INCOMPATIBLE`, `PARSE_ISSUES`, `EMPTY_WORKBOOK`).
  - **What & why**: Two-level taxonomy: the RFC 9457 `type` (transport-level kind: validation/conflict/not-found/…) + a domain `code` extension member (business-level: `ALREADY_PUBLISHED`, `DSD_INCOMPATIBLE`, …). Validation failures (Zod AND engine `validateConfig`) unify under one `validation` kind + `issues` member so a client parses ONE contract regardless of which validator fired.
  - **Critical analysis**: Coherent and well-factored. The domain `code`s are ad-hoc string literals scattered at throw sites rather than a central enum/registry — minor (the RFC type is the stable contract; the code is a hint), but a `DOMAIN_CODES` catalogue would prevent drift and enable a generated client. No error-code documentation surface (ties to [API-16] OpenAPI).
  - **Reference platforms**: **Stripe** publishes a full error-code enum + docs; ours is implicit. **PostgREST** maps PG SQLSTATE — lower-level than our domain codes.
  - **Foresight**: a generated TS client (from OpenAPI) would want the domain codes as a union type.
  - **Plan**: centralize domain `code`s into a `const` catalogue (like `PROBLEM_REGISTRY`) and export the union — Class M, low priority, two-way door. Fold into [API-16].
  - **Raises-the-bar**: the validation-unification (Zod + engine errors → one `issues` shape) is the standout.

### [API-16] OpenAPI / machine-readable API contract
- **Status**: 🆕GAP (partial: a config JSON Schema endpoint exists)
- **Evidence**: `GET /api/schema` serves the page-config JSON Schema `src/index.ts:88` / `src/routes/schema/index.ts`; grep `openapi|swagger` in `apps/api/src` → **none**; not in `package.json`.
  - **What & why**: The platform serves the *config* contract (page-config JSON Schema, the Constructor reads it), but there is **no OpenAPI/Swagger document** for the HTTP API itself — no machine-readable description of the routes, params, responses, or error shapes.
  - **Critical analysis**: For an API with this many surfaces (config CRUD, stats, cube, catalog, ingest, releases, snapshots, embed, admin) and external consumers on the horizon (SDMX federation, embedders, the panel/Constructor client), the absence of an OpenAPI contract means: no generated client, no contract tests, no interactive docs, no schema-validated request/response in CI. The Zod schemas at every boundary are *the* source of truth and could **generate** OpenAPI almost for free (`zod-to-openapi` / `@fastify/swagger` + zod). This is the highest-leverage low-risk gap.
  - **Reference platforms**: **PostgREST** auto-generates OpenAPI from the DB schema. **Supabase/Hasura** expose introspectable schemas. **Cube** has a documented REST contract. We're the only one without a published contract.
  - **Foresight**: consumer-driven contract tests (Pact) at the panel↔API and (future) federation boundaries depend on this; a generated client eliminates a class of drift.
  - **Plan**: add `@fastify/swagger` + register the existing Zod schemas (via `fastify-type-provider-zod`) so route schemas double as OpenAPI; serve `/api/openapi.json` + Swagger UI in dev. Fitness-fn: a CI check that every route has a response schema. Effort ~1-2d. Risk: two-way door, Class M (api-local) trending G (it touches every route's schema registration). Priority HIGH (unlocks clients + contract tests + docs).
  - **Raises-the-bar**: Zod-as-SSOT → generate BOTH runtime validation AND the OpenAPI contract from one source (no hand-maintained spec drift).

### [API-17] MED-2 coherence at the API tier (ManifestMode deletion + V35)
- **Status**: ✅DONE
- **Evidence**: `ops/postgres/migrations/V35__drop_site_config_modes.sql:1-33`; bootstrap manifest no longer emits `modes` (`src/routes/bootstrap/index.ts` — no `modes`/`perspectiveRegistry` key); co-ship precondition documented in V35.
  - **What & why**: MED-2 retired the System-A `modes` site_config vocabulary island (a write-with-no-read channel: the runner derived perspectives from each page's authored `page.perspectives` axis, never from the served registry). V35 deletes the orphaned prod row; the precondition is correctly stated — the provisioning artifact edit (S6, drop the `modes` seed entry) MUST ship in the same api image as V35, else `upsertSiteConfig` re-inserts the row on the next boot (provisioning runs AFTER Flyway every boot).
  - **Critical analysis**: Coherent and correctly sequenced. The migration is idempotent (DELETE of an absent row is a no-op), Flyway-immutable-aware (a correction is a new V-migration, never an edit), and the one-way-door risk is correctly assessed LOW (3 static kinds, trivially reconstructible). The co-ship coupling (migration + artifact + api image in one release) is the right call and is documented at the migration. Verified: the bootstrap composition does not reference `modes`, so the serve path is genuinely removed (not just the DB row). No dangling contract field in `SiteManifestContract`.
  - **Reference platforms**: n/a (internal cleanup) — but the discipline (remove the field → remove the serve path → remove the consumer → remove the seed → delete the row, in that dependency order) is the textbook expand-contract *contract* phase.
  - **Foresight**: the co-ship coupling is a deploy-ordering hazard if a hotfix ships the migration without the artifact; a deploy fitness-check (artifact has no `modes` key ⟺ V35 applied) would harden it.
  - **Plan**: optional CI assertion that the provisioning artifact contains no `modes` key (so the migration can never be re-undone by a stale artifact). Class M, low priority, two-way door.
  - **Raises-the-bar**: the documented "provisioning re-applies after Flyway every boot, so the row would resurrect" insight is exactly the subtle failure mode most teams miss when deleting config rows.

### [API-18] As-of vintage + SCD-2 revision reconstruction (the differentiator)
- **Status**: ✅DONE
- **Evidence**: `src/routes/stats/observations.ts:134-260` (live∪pre-image overlay), release-scoped vintage in `releases.ts`, V8 revision capture + SCD-2 classifiers in `publish.ts`.
  - **What & why**: `?asOf=<instant>` reconstructs a series **as it was published on that date** — a live leg (current obs, eligible iff `published_at ≤ D`) UNION a pre-image leg (each superseded value from `observation_revision`, with `[set_by_release.published_at, superseded_by_release.published_at)` validity), then `DISTINCT ON (series) ORDER BY valid_from DESC` collapses to the value live at D. Filters compose into BOTH legs generically (no privileged dims). Vintages are immutably cacheable.
  - **Critical analysis**: This is the capability that puts the platform **ahead of every listed reference**. Temporal/bitemporal data reconstruction (the "revision triangle" of official statistics) is exactly what national accounts require (preliminary→revised→final) and almost no general BI backend offers it. The implementation is careful (the pre-image's `dim_key` is recovered from the live row since only its hash is stored; partition pruning + GIN containment preserved on the live leg). The complexity is high and concentrated in one SQL builder — well-commented but a maintenance hotspot; it leans on release `published_at` being the single temporal anchor (correct, but a release with NULL `published_at` silently drops from both legs — verify the open-release case can't leak).
  - **Reference platforms**: **SDMX/.Stat Suite** supports data versioning/vintages — this is the one place we reach *SDMX-grade* semantics (and arguably exceed .Stat's ergonomics with a single `?asOf=` query param). **Cube/Grafana/PostgREST/Hasura/Looker** — NONE do bitemporal vintage reconstruction. Clear win.
  - **Foresight**: expose vintage as a first-class SDMX dimension (`REPORTING_YEAR`/data version) when [API-04] serializers land; the as-of permalink is a killer feature for citation/reproducibility (root law 9 auditability).
  - **Plan**: no change; protect it with a fitness test for the NULL-`published_at` edge and document it as a headline capability. Class M, low effort.
  - **Raises-the-bar**: THE net differentiator — surface it in the SDMX serialization and the public docs as a primary selling point.

---

## Counts

| Status | Count | Cards |
|---|---|---|
| ✅ DONE | 9 | API-01, 02, 03, 05, 07, 12, 15, 17, 18 |
| 🟡 PARTIAL | 6 | API-06, 08, 09, 10, 13, 16* |
| ⛔ NOT-DONE | 1 | API-14 (designed only) |
| 🆕 GAP | 2 | API-11, 16 |
| 🟡 PARTIAL (reserved-by-design) | 1 | API-04 |

(*API-16 is GAP for OpenAPI but PARTIAL because a config JSON Schema endpoint exists — counted once as GAP.)

Net: the **core data/governance tier is DONE to a high standard**; the gaps cluster at the **operational edge** (rate-limit, metrics/tracing, OpenAPI, pagination) and the **deferred SDMX-serve + D-HREF doors**.

---

## TOP-3 leverage items

1. **[API-16] OpenAPI from the Zod SSOT** — highest leverage, lowest risk. Unlocks generated clients, contract tests (Pact at panel↔API and future federation), interactive docs, and CI schema validation — all from schemas that already exist. ~1-2d, two-way door. Do first.
2. **[API-11] Rate-limiting + ingest bulkhead** (with [API-10] requestId) — the security/operability floor. The login is brute-forceable and the public reads + 25MB synchronous uploads are DoS vectors today. Add `@fastify/rate-limit` + a 429 problem kind + a concurrency semaphore on the canonical drive. ~1d, HIGH priority, two-way door. Pair with the `requestId` hook (the single biggest debuggability win).
3. **[API-04] First non-json serializer (sdmx-csv → sdmx-json-2.0)** — the strategic unlock. The negotiation port is built and the data is already shaped (dim_key JSONB → SDMX series keys is a projection); shipping one serializer proves the seam end-to-end and converts "SDMX-flavoured" into "SDMX-serving". Reserve until the federation/external-consumer trigger, then prioritize. ~3d.

Runner-up worth flagging: **[API-10] durable audit + metrics** and **[API-09] pg-backed snapshot store** are both "the port exists, swap the adapter" — cheap, and each removes a launch-blocker (governance durability; embed survives deploy).

---

## NET-NEW backend innovation (no reference platform has it)

**Bitemporal "vintage diff" serve + as-of ETag federation — a `?asOf=` + `?vsAsOf=` revision-delta endpoint.**

We already reconstruct any series *as published at instant D* ([API-18]) — a capability Cube/Grafana/PostgREST/Hasura/Looker entirely lack and that even SDMX.Stat exposes only clumsily. The net-new step nobody offers: a **first-class revision-delta** read — `GET /api/stats/observations?dataset=…&asOf=D2&vsAsOf=D1` returning, per series, `{value@D1, value@D2, delta, revisedByRelease, revisionReason}` — i.e. the **official-statistics "revision triangle" as an API primitive**, with each cell carrying its W3C-PROV lineage (the `provenance` bag already stamped at bronze, the `set_by_release`/`superseded_by_release` spine already in V8). Because vintages are immutable, each delta is **strongly ETag-cacheable and citation-stable** — a permalink that proves "GDP 2020 was 47.8bn when first published 2021-03, revised to 49.1bn by release R-2022-09." 

Why it's ambitious-but-YAGNI-honest: the entire substrate (pre-image log, release temporal anchors, PROV lineage, the as-of SQL builder, immutable ETags) **already exists** — this is a *projection* over data we already store, not new infrastructure. It is the one feature that would make the platform the reference implementation for *reproducible, auditable* official statistics (root law 9), and it directly composes with the SDMX serializer ([API-04]) to emit revision deltas as `sdmx-json` — something no SDMX serving platform does today. Trigger to build: the first external citation/audit requirement (regulator, academic reproducibility, press fact-check), not before.

---

## Key files cited
- API composition + boot order: `platform/apps/api/src/index.ts`
- Ingestion FSM: `src/ingest/{submit,worker,publish}.ts`, `src/routes/ingest/{index,canonical,canonical-fsm-drive}.ts`
- Error contract: `src/lib/{problem,error-handler,http}.ts`
- Auth/RBAC: `src/lib/auth.ts`, `src/auth.ts`, `src/routes/{auth/index,admin/index}.ts`
- Hot read + ETag/304 + as-of vintage: `src/routes/stats/observations.ts`
- Serializer port: `src/routes/stats/serialize/{registry,dispatch}.ts`
- Delivery surfaces: `src/routes/{bootstrap,cube,catalog,data-sources,embed}/index.ts`
- MED-2: `ops/postgres/migrations/V35__drop_site_config_modes.sql`

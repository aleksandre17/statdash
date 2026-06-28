# DESIGN — True Multi-Tenancy (tenant-ISOLATED) — the irreversible call

> Status: **DECISION DRAFT for owner ratification** (one-way-door data-plane decision).
> Date: 2026-06-28 · Branch: `feat/tenant-agnostic-platform` · Author: architect (Opus).
> Scope: **analysis + design only.** No product code or schema changed by this document.
> Relationship to `work/ADR-multi-tenancy.md`: this doc **stress-tests, corrects, and surpasses** that ADR. It is the input the owner ratifies; the ADR is upgraded to match §10 here once signed.
> Decision class: **M** (Class-M data/API, architect-gated) · Door: **1-way** (the data plane + the model fork) · Priority: **P0-DECISION**.

---

## 0. Executive summary (read this first)

**The fork is not "single-tenant → multi-tenant."** The platform is *already* multi-tenant-capable in two senses, and the real decision is which **isolation model** becomes the default:

1. **Tenant-agnostic (proven):** a 2nd tenant ("BrewMetrics") renders with zero code change from the manifest. *Branding/config* isolation is done.
2. **Silo-per-deploy (already free, unrecognised by the ADR):** the shipped deployment topology (per-app reverse-proxy single-origin, `adr_deployment_topology`) means each agency *can today* get its own SPA + its own API + its own DB. That is **the strongest isolation model in the SaaS canon (silo)** — and it already works. It costs ×N ops.
3. **Pooled shared-instance (NOT built):** one DB, one API, many agencies separated by Postgres RLS. This is the only model that makes onboarding an agency = *insert a row*, not *stand up a deploy*. **This is the irreversible thing the owner is actually deciding to build.**

**Current isolation debt (verified in code, not docs):** the data plane is placeholder-only. Across V1→V37 there are exactly **two** inert `tenant_id` columns — `stats.dataset` (V6, `UUID`, `USING(true)` no-op policy) and `config.snapshot` (V36, **`TEXT`** — a type inconsistency the ADR missed). There is **no `stats.agency` table** (the identity SSOT is named in four `agency TEXT` columns and stored nowhere). `config.*` has no tenant column; `site_config` PK is the bare `key`. `JwtPayload` has no tenant claim; `config.user` has no `tenant_id`. The app connects through pgBouncer in **`POOL_MODE: transaction`** as the **table-owning role `statdash`** (same role runs Flyway migrations *and* the app). **Both classic RLS traps are armed.**

**The single most valuable thing I found that the ADR did not exploit:** the transaction-scoped GUC pattern the tenant spine needs **is already in production** — `apps/api/src/ingest/publish.ts:101` runs `SELECT set_config('app.revised_by', $1, true)` inside a `connect()`/`BEGIN` transaction for provenance. `set_config(key, val, true)` *is* `SET LOCAL`. So FF-5's "transaction-pooling-safe GUC" is not a new mechanism to invent — it is an existing, tested pattern to **generalise**.

**The single correction the ADR most needs:** its claim that "once `config.*`/`stats.*` are RLS-scoped, the existing SELECTs are unchanged and automatically filtered" is **false as written**. Every data-plane read today runs as `app.pg.query(...)` **directly on the pool** — no transaction, so no place for `SET LOCAL` to live. RLS would filter to **zero rows** (no GUC) or, worse, be owner-bypassed entirely. The real, invasive work is **the query-execution seam**: a request-scoped `BEGIN; SET LOCAL app.current_tenant; …; COMMIT` wrapper that every tenant-scoped query must flow through. That seam — not the columns — is the load-bearing engineering.

**Recommended model (high confidence):** a **principled tiered hybrid** — **POOL (shared-schema + FORCE RLS) as the default tier**, with **SILO-per-deploy as a first-class, already-existing escape tier** for a high-isolation or high-volume agency, both selected behind **one `TenantContext` seam resolved at the request boundary**. This is AWS SaaS Lens **mixed-mode / tiered isolation**, and it is *strictly stronger* than the ADR's "POOL now, maybe promote one tenant to silo later," because the silo tier is not a future bolt-on — **it is the deployment topology you already shipped.**

**The one irreversible call the owner ratifies:** *build the pooled shared-instance data plane* — i.e. thread one `tenant_id UUID FK → stats.agency` through `config.*` + the `stats.*` write surface, enforce it with `FORCE ROW LEVEL SECURITY` under a **non-owner app role**, and resolve tenant per-request into a `SET LOCAL` GUC. Everything below the `DataStore` port (`packages/core`, `packages/react`) changes by **zero lines** (Law 1/3/5 hold). Confidence: **high on the model and the seam; medium on effort** (the query-execution retrofit is larger than the ADR implies).

---

## 1. Precise current-state map (every tenant boundary, cited)

Legend: ✅ tenant-correct · �◑ placeholder/partial · ❌ tenant-blind (leaks if shared).

### 1.1 Data plane (the cube)
| Element | File · evidence | State |
|---|---|---|
| RLS seam | `ops/postgres/migrations/V6__display_versioning_rls.sql:159-176` — `stats.dataset.tenant_id UUID` nullable; `ENABLE ROW LEVEL SECURITY`; policy `dataset_tenant_isolation USING (true)` | ◑ live RLS, **no-op policy**, single table |
| Snapshot seam | `V36__snapshot_store.sql:56` — `config.snapshot.tenant_id **TEXT**` nullable, inert, no read filter | ◑ **type mismatch** vs V6 `UUID` — reconcile to `UUID FK` |
| Observations | `stats.observation` (V4/V8) — TimescaleDB hypertable, **no `tenant_id`** | ❌ tenant-blind (the high-cardinality fact table) |
| Cube / classifiers | `apps/api/src/routes/cube/*.ts`, `routes/stats/*.ts` — every read is `app.pg.query(...)` on the pool, **no transaction, no GUC** | ❌ would return 0 rows or owner-bypass under RLS |
| Identity SSOT | `agency TEXT NOT NULL DEFAULT 'SDMX'` on `concept_scheme` (V27:123), `metadataflow` (V31:168), `category_scheme` (V29); `stats.dataset.source TEXT` "agency/provider" (V4:123) | ❌ **no `stats.agency` table** — the SSOT (DB-08) is unmodeled |

### 1.2 Config plane
| Element | Evidence | State |
|---|---|---|
| `config.site_config` | V3:35 — PK is bare `key TEXT` | ❌ single-tenant by construction |
| `config.page` / `page_version` / `data_source` / `data_spec` / `nav_item` | V3 — UUID PKs, **no tenant column** | ❌ tenant-blind |
| Bootstrap composition | `apps/api/src/routes/bootstrap/index.ts` — composes the whole `SiteManifestContract` from `config.*` in one read; **public, unguarded** | ❌ no tenant filter; host is the only possible signal |
| Provisioning | `apps/api/src/provisioning/loader.ts` `runProvisioning` → `applyManifest` (siteConfig→pages→dataSources→nav); `geostat.provisioning.json` = one tenant's config | ◑ idempotent GitOps path, **no `tenant` field** |

### 1.3 Identity / auth plane
| Element | Evidence | State |
|---|---|---|
| JWT | `apps/api/src/lib/auth.ts:9` — `JwtPayload { sub, uid?, iat, exp, roles? }` — **no tenant claim** | ❌ flat |
| Auth hook | `apps/api/src/auth.ts:25` — global `onRequest` Bearer verify → `req.jwtPayload` | ◑ the natural home for a tenant-resolver preHandler |
| Users | `V10__users.sql:27-37` — `config.user(username, password_hash, roles[] NOT NULL DEFAULT '{viewer}')` — **no `tenant_id`** | ❌ RBAC is global, not per-agency |
| Route scopes | `apps/api/src/index.ts:104-165` — `config/*` Bearer-guarded; `bootstrap`/`cube`/`catalog`/`stats`/`data-sources` are **public scopes** | ◑ public surfaces have no tenant signal but host |

### 1.4 Infrastructure plane
| Element | Evidence | State |
|---|---|---|
| Pooler | `ops/compose/infra/services/pgbouncer.yml:23` — `POOL_MODE: transaction`; `pgbouncer.ini.example` `pool_mode = transaction` | **FF-5 trap armed** — session-level `SET` leaks across tenants |
| DB role | `pgbouncer.yml:20` `DB_USER=${POSTGRES_USER:-statdash}`; `flyway.yml:27` migrations run as **the same `statdash`** | **FF-3 trap armed** — app is the table owner ⇒ RLS silently bypassed without `FORCE` |
| GUC precedent | `apps/api/src/ingest/publish.ts:101` — `set_config('app.revised_by', $1, true)` inside `connect()`/`BEGIN` | ✅ **the exact SET-LOCAL-in-txn pattern already exists** |
| Resilience | `apps/api/src/lib/rate-limit.ts`, `lib/bulkhead.ts` | ✅ noisy-neighbor controls already present to per-tenant-scope |

### 1.5 Renderer / port plane (the part that must NOT change)
| Element | Evidence | State |
|---|---|---|
| DataStore port | `packages/react/src/engine/storeManifest.ts` `buildStoreManifest` (Grafana datasource registry); engine reads through `DataStore`, tenant-blind | ✅ Law 5 holds — **the reason core/react change by zero lines** |
| Client fetch boundary | `packages/plugins/datasources/stats-api.ts` → `/api/cube`, `/api/stats` | ✅ browser never knows tenant; the API resolves it server-side |
| Theming | `packages/styles/src/css/tokens.css:143,176` `[data-tenant]` rebinds Tier-2 accent over neutral default | ◑ selector exists; **not yet set at request time** (runner carries no tenant content, `apps/geostat/src/CLAUDE.md`) |

**Summary of debt:** the *render/branding/config-shape* tenancy is done (agnostic). The *data isolation* tenancy is a single inert column, an unmodeled identity SSOT, a tenant-blind fact table, a tenant-blind query-execution model, and two armed RLS traps. That is the gap to close.

---

## 2. Reference-platform survey — the best concepts, to surpass them

### 2.1 The SaaS multi-tenancy canon (AWS SaaS Lens / SaaS Factory)
Three isolation archetypes on the isolation↔cost↔noisy-neighbor↔per-tenant-scaling spectrum:

| Model | Isolation | Cost / ops | Noisy neighbour | Onboarding | Per-tenant scaling |
|---|---|---|---|---|---|
| **Silo** (stack per tenant) | physical, strongest | ×N infra, ×N migrations | none | stand up a deploy | trivial (move the stack) |
| **Bridge** (schema per tenant, shared DB) | strong (namespace) | one DB, ×N schemas, `search_path` juggling, ×N DDL | shared DB resources | create a schema + run DDL | medium |
| **Pool** (shared schema + RLS) | logical (policy) | one DB, one migration, ×1 | **real** (shared cube + pool) | **insert a row** | hard (everyone shares) |

The canon's *mature* guidance is **not "pick one"** — it is **tiered / mixed-mode isolation**: pool the long tail of small tenants for cost, silo the few that demand physical isolation or out-scale the pool, behind **one tenant-context abstraction** so application code is isolation-model-agnostic. **This is the concept to steal and the bar to surpass.**

### 2.2 Postgres tenancy mechanics (the airtight-RLS recipe)
The canonical pooled enforcement, done *correctly* (Supabase / PostgREST / Crunchy patterns):
1. `tenant_id` column on every tenant-scoped table + a policy `USING (tenant_id = current_setting('app.current_tenant', true)::uuid)` and a matching `WITH CHECK` for writes.
2. **`ALTER TABLE … FORCE ROW LEVEL SECURITY`** — *mandatory*, because **RLS does not apply to a table's owner**. The app must not be the owner, *and* FORCE closes the gap even if it is.
3. **A non-owner application role** (`statdash_app`) the API connects as; the owner/migration role (`statdash`) is used only by Flyway and by deliberate platform-admin ops. The app role gets `GRANT SELECT/INSERT/UPDATE/DELETE`, never `BYPASSRLS`.
4. Under a **transaction pooler**, set the tenant with **`SET LOCAL` inside an explicit transaction** (or `set_config(…, true)`), so the GUC dies at `COMMIT` and the server connection returns to pgBouncer clean. Session-level `SET` leaks to the next tenant that reuses the connection.
5. Citus / schema-per-tenant are the **scale-out / strong-isolation escape**, not the default.

The two traps (owner-bypass, pooler-leak) are exactly the project's two armed risks → they become **FF-3** and **FF-5**.

### 2.3 How the data/dashboard platforms isolate — steal + beat
| Platform | Mechanism | Weakness | Where our seam is cleaner |
|---|---|---|---|
| **Grafana** | `org_id` FK threaded through every Go query | **app-enforced** — a missed `WHERE org_id` leaks; re-implemented per subsystem | RLS is declarative + below the port — *can't-forget*; one policy, not N hand-written clauses |
| **Cube.dev** | `securityContext` + `queryRewrite` injects tenant filters into compiled SQL; per-tenant pre-aggs | imperative **rewrite layer**; closest to us | same result *below* the `DataStore` port via RLS — **no rewrite layer**, engine unaware |
| **Looker** | per-tenant connection/model or `user_attributes` in SQL | LookML model duplicated per tenant | config **is data** — no per-tenant model duplication; one `tenant_id` scopes model + data |
| **Metabase** | sandboxing (row-level via attributes) + per-group data perms | app-layer, model-specific | one RLS SSOT covers content *and* data |
| **Tableau** | **Sites** (content isolation) + manual row-level calc filters | data security hand-built per workbook | RLS isolates content **and** data through one SSOT |
| **Grafana orgs / Auth0 orgs** | `org_id` / `org_id` claim | identity only, no data plane | our `tid` claim feeds the **same** GUC that drives the data plane |
| **Snowflake / BigQuery** | row-access policies / authorized views | warehouse-only; no app identity | our policy is fed by the request identity through one boundary |

**The transferable best concept:** *tiered isolation behind one tenant-context abstraction* (§2.1) **+** *the airtight pooled-RLS recipe* (§2.2). **Where the hybrid beats any single model:** the incumbents all **privileged tenancy into one subsystem and bolted it onto the others** (Grafana = data only by `org_id`, Tableau = content only by Sites, Cube = a rewrite layer). This platform has **one identity SSOT (agency = SDMX maintenance agency), one enforcement (RLS below the `DataStore` port), one resolution primitive (`TenantContext` at the boundary)** covering **all five planes at once** — because the platform already speaks *generic-dimension / registry / config-as-data / port*. That structural neutrality is the surpassing advantage; the rest of this doc makes it airtight.

---

## 3. The decided architecture (the irreversible call, defended)

### 3.1 The model: tiered hybrid (POOL default + SILO-per-deploy escape)

> **Adopt POOL (shared schema + FORCE RLS) as the default tier; keep SILO-per-deploy as a first-class escape tier; select per-tenant behind one `TenantContext` seam resolved at the request boundary.**

Why this beats the ADR's "POOL now, promote-to-silo-later": the silo tier is **not hypothetical** — `adr_deployment_topology` already ships per-app reverse-proxy single-origin deploys. A high-isolation agency (a regulator demanding physical separation) or a high-volume agency (out-scaling the shared pool) gets **its own deploy + its own DB today**, with the *same* manifest and the *same* code, by pointing its `DATABASE_URL` at a dedicated instance. The pooled tier and the silo tier **share the application binary and the `TenantContext` seam**; only the connection target and the RLS-vs-physical boundary differ. That is mixed-mode isolation done with zero new silo machinery.

**The architectural insight that makes tenancy *ours, not a bolt-on*:**

> **Tenancy is a SCOPE resolved at the request boundary and enforced declaratively below the `DataStore` port — never a privileged dimension, never a `WHERE` clause threaded through application code.**

This is the exact discipline of the just-shipped **perspective axis** and of **locale**: a resolution context, not `ctx.dims['tenant']`. One resolved `TenantContext` is pushed into (a) a Postgres `SET LOCAL` GUC so RLS isolates data + config declaratively, and (b) the `RenderContext` so theming/catalog resolve per-tenant — while `packages/core` and `packages/react` change by **zero lines** (Law 5: the `DataStore` port already hides *where data comes from*).

### 3.2 Why POOL (not silo/bridge) as the *default* — the named trade-off (ISO 25010)
**POOL gains** *deployability + cost-efficiency + maintainability* (one migration, one TimescaleDB hypertable, one pool, onboard = insert a row) **and cross-tenant shared structure** (two agencies share a DSD / CL_GEO / AgencyScheme and publish different data). **POOL trades away** *physical isolation* and accepts *noisy-neighbour* risk on the shared cube + pool. Both losses are **recovered**: physical isolation via `FORCE` RLS + non-owner role (defense in depth) and via the silo escape tier (Protected Variations — the isolation-strength variation point sits behind a stable seam); noisy-neighbour via the **already-present** `rate-limit.ts` + `bulkhead.ts` scoped per-tenant, `statement_timeout`, and promotion to the silo tier when a tenant out-scales the pool.

### 3.3 The generic seam (registry-driven, Law-1, Law-8)
```
 request ─▶ TenantResolver registry (Strategy + Registry; OCP)
              subdomain · jwt `tid` claim · X-Tenant header   (open for extension)
                        │  resolves ONE
                        ▼
                 TenantContext { tenantId: uuid, agencyCode, isolationTier, capabilities }
        ┌────────────────┼───────────────────────┬────────────────────────┐
        ▼                ▼                       ▼                        ▼
 SET LOCAL app.current_tenant   RenderContext.tenant   data-tenant=agencyCode   catalog/Constructor
 (per-request txn, app role)    (injected port, Law3)  (request-time theme)      capability filter
        │                ▼                       ▼                        ▼
   RLS isolates     engine stays            token set rebinds        registry filtered
   config.*+stats.* tenant-BLIND            per request              by tenant grant
```
- **One primitive** (`TenantContext`), resolved once, read identically everywhere.
- **Registry of strategies** — adding subdomain/claim/header is a registration, not an `if/else` rewrite (Law 8, OCP). Public delivery surface → host; authoring surface → `tid` claim (the claim, never the host, is trusted for **writes**).
- **Declarative enforcement** — the isolation invariant is an RLS *policy* (data), not a discipline (Grafana's failure mode).
- **Law 1 preserved** — `tenant` is never `ctx.dims['tenant']`; FF-6 forbids it appearing as a cube dimension in `packages/core`/`packages/react`.

---

## 4. The full-vertical seams (the engineering, by plane)

### 4.1 DB seam
- **Identity SSOT first (DB-08):** model `stats.agency_scheme` + `stats.agency(id uuid pk, code text unique, name jsonb i18n, parent uuid, contact …)`. `agency.code` = the SDMX `agencyID`. Seed `GEOSTAT` as tenant 0. The four free-`TEXT` `agency` columns re-point to this FK by expand-contract (MT-7).
- **`tenant_id UUID FK → stats.agency`** on the `config.*` tables and the `stats.*` **write surface** (`dataset`, and the fact tables it roots: `observation`, plus `cube_actual_region`). `site_config` PK `key` → composite `(tenant_id, key)`.
- **Reconcile the type defect:** migrate `config.snapshot.tenant_id` from **`TEXT` → `UUID` FK** (the ADR missed this; left as TEXT it cannot FK the agency table and will diverge).
- **TimescaleDB honored:** `stats.observation` stays a time-partitioned hypertable; `tenant_id` is a **column + index**, *not* a new space partition (avoid over-partitioning until measured). RLS policies live on the parent hypertable; chunk inheritance verified in MT-4.
- **Enforcement (MT-4):** policy `USING (tenant_id = current_setting('app.current_tenant', true)::uuid)` + `WITH CHECK (…)`; `ALTER TABLE … FORCE ROW LEVEL SECURITY`; introduce **non-owner role `statdash_app`** with table grants but no `BYPASSRLS`; the API's `DATABASE_URL` switches to `statdash_app`. Flyway stays `statdash` (owner).

### 4.2 API seam — **the load-bearing piece the ADR underweights**
The query-execution model must change. Today reads are `app.pg.query()` on the pool; there is nowhere for `SET LOCAL` to live. Design:

- **`TenantResolver` registry** + a global **`onRequest`/`preHandler`** (sibling to `auth.ts:25`) that resolves `TenantContext` and **fails closed** (no host *and* no claim ⇒ 400/403, never "all tenants").
- **Request-scoped transaction wrapper** — generalise the **existing** `publish.ts` pattern (`set_config('app.revised_by', $1, true)` in a `connect()`/`BEGIN` txn) into a first-class decorator, e.g. `app.withTenant(req, async (client) => …)` that does `client = await pg.connect(); BEGIN; SELECT set_config('app.current_tenant', tenantId, true); …; COMMIT` (`ROLLBACK` on throw, `release()` in `finally`). Every tenant-scoped route migrates from `app.pg.query` to `req`-scoped `client.query` (Strangler — route by route, each green).
- **Trade-off named:** wrapping reads in `BEGIN/COMMIT` adds a round-trip per request and holds a pooled server-connection for the transaction's duration. Mitigation: pipeline `BEGIN; SET LOCAL; <query>; COMMIT`; raise pgBouncer `default_pool_size` with headroom; the bootstrap route already batches its reads. This cost is the *price of declarative isolation* and is bounded.
- **Auth:** add optional `tid` to `JwtPayload` (additive — Postel: pre-`tid` tokens resolve to the default tenant during migration, exactly as `roles?`/`uid?` already degrade). `config.user` gains `tenant_id`; RBAC becomes tenant-scoped (a role is *within* a tenant, DB-19).
- **Platform super-admin:** a cross-tenant operator does **not** get `BYPASSRLS` on the app role. Platform ops run as the **owner role** (`statdash`, already RLS-exempt) through a separate, audited admin path — keeping the app role airtight. This is the clean answer to "who sees all tenants."

### 4.3 Provisioning / Constructor seam (author a tenant with NO code)
- **Provision a tenant** = `INSERT stats.agency` + load that agency's `*.provisioning.json` with a new `tenant` field (default = Geostat). `loader.ts`'s idempotent `applyManifest` upserts into the tenant's namespace via the same path (the GUC set by the resolver scopes the writes). Onboarding is data, not a deploy (the pooled-tier payoff).
- **Constructor scopes automatically:** the catalog route reads `config.*`/`stats.*`, now RLS-scoped, so the dataset palette is tenant-filtered with **zero route change** once the GUC is set. Per-tenant **capability surface** (which plugins/chart-kinds a tenant may author) = a `TenantContext.capabilities` grant filtering the existing capability registries (`describeApp()` is the introspection seam). **Defer the grant table behind door D-CAP** until a 2nd tenant needs a different plugin set (YAGNI — the registry filter is the seam, the grant is the data).

### 4.4 Theming seam (promotion, not new machinery)
- The `[data-tenant]` selector already rebinds Tier-2 accent over the neutral default. The only change: **who sets the attribute and when** — promote from build-time/global to **request-time**, driven by `TenantContext.agencyCode`, with the tenant's token set shipped in the (now tenant-scoped) bootstrap manifest. No new theming code; a *promotion* the semantic-token spine already anticipated.

### 4.5 Renderer (unchanged, by design)
- `packages/core` + `packages/react` change by **zero lines**. The client fetches `/api/cube`/`/api/stats`; the API resolves tenant server-side from host/cookie/claim; the `DataStore` returns already-isolated rows. The browser never holds a tenant key. **FF-6** guards that `tenant` never leaks into the engine as a dimension.

---

## 5. The two correctness gates (mandatory, as fitness functions)

- **FF-3 · FF-EVERY-TENANT-TABLE-HAS-RLS** *(schema introspection, extends `ops/scripts/check-laws.sh`)* — for every table carrying `tenant_id`: `relrowsecurity = true` **AND** `relforcerowsecurity = true` **AND** a tenant-scoped policy exists. Fails CI on any tenant table missing `FORCE` or policy. *Catches the owner-bypass trap (§1.4) — without this the whole spine is a no-op that passes every happy-path test.*
- **FF-5 · FF-GUC-SET-LOCAL-ONLY** *(grep/AST + integration)* — the tenant GUC is only ever set via `SET LOCAL` / `set_config(…, true)` **inside a transaction**; **no** session-level `SET app.current_tenant` anywhere. An integration test proves a recycled pooled connection carries no prior tenant's GUC. *Catches the pgBouncer transaction-pooling leak (§1.4).*

---

## 6. Full fitness suite (prove isolation — encode, don't comment)

- **FF-1 · FF-TENANT-ISOLATION** *(integration, real Postgres)* — GUC=A ⇒ every tenant-scoped table read returns **0 B-rows**; a write with GUC=A and `tenant_id=B` is rejected by `WITH CHECK`. The positive proof.
- **FF-2 · FF-NO-CROSS-TENANT-LEAK** *(integration)* — bootstrap/catalog resolved to A never surfaces a B-authored page/nav/source/dataset (extends `bootstrap-parity.fitness.test.ts`).
- **FF-3**, **FF-5** — §5 (the two gates).
- **FF-4 · FF-TENANT-CLAIM-OR-HOST** *(integration)* — a tenant-scoped route with neither resolved host nor claim **fails closed** (explicit 400/403, never "all tenants").
- **FF-6 · FF-NO-TENANT-DIM-IN-ENGINE** *(grep, Law 1)* — `tenant` never appears as a cube dimension/privileged key in `packages/core`/`packages/react`.
- **FF-7 · FF-FIRST-TENANT-BYTE-IDENTICAL** *(parity)* — Geostat's bootstrap manifest + resolved token set are byte-identical pre/post every phase (extends `tokens.parity.test.ts` + `bootstrap-parity.fitness.test.ts`). The Strangler safety net.
- **FF-8 · FF-CATALOG-TENANT-SCOPED** *(integration)* — Constructor palette for A lists only A's datasets + A-granted capabilities.
- **FF-9 · FF-TENANT-ID-TYPED-UUID** *(introspection — new)* — every `tenant_id` column is `UUID FK → stats.agency` (closes the V36 `TEXT` defect; prevents a future divergent type).
- **FF-10 · FF-APP-ROLE-NOT-OWNER** *(introspection — new)* — the role in the app's `DATABASE_URL` is **not** the owner of any tenant-scoped table and lacks `BYPASSRLS` (hardens §4.2).

---

## 7. Strangler-Fig roadmap (each phase independently green + reversible; Geostat = tenant 0, byte-identical via FF-7)

| Phase | Move | Door | Reversible? | Green criterion |
|---|---|---|---|---|
| **MT-0** | Ratify this doc — POOL default + SILO escape + agency=tenant + RLS spine | model | **one-way (decision)** | sign-off |
| **MT-1** | **AgencyScheme (DB-08)**: `stats.agency_scheme` + `stats.agency`; seed `GEOSTAT` | new tables | two-way (drop) | suite green; agency SSOT exists |
| **MT-2** | **Expand**: nullable `tenant_id UUID FK→agency` on `config.*` + `stats.*` write surface; backfill **all** rows → Geostat; `(tenant_id,key)` on `site_config`; reconcile `snapshot.tenant_id TEXT→UUID`; RLS stays `USING(true)` | additive cols | two-way (drop cols) | one tenant ⇒ identical; FF-7, FF-9 |
| **MT-3** | **Boundary**: `TenantResolver` registry + `app.withTenant` txn wrapper (generalise `publish.ts`); migrate tenant-scoped routes `pg.query`→`req`-client; add `tid` to JWT (Postel); `config.user.tenant_id`; inject `TenantContext` into `RenderContext` | new code | two-way | GUC always = Geostat; FF-5 |
| **MT-4** | **Enforce (the flip)**: `USING(true)`→tenant-scoped + `WITH CHECK`; `FORCE ROW LEVEL SECURITY`; introduce **non-owner `statdash_app`** role; app `DATABASE_URL`→app role | policy + role | two-way (revert policy) but **hardening** | FF-1, FF-3, FF-4, FF-10; missing GUC now fails closed |
| **MT-5** | **Per-request theming/config**: promote `data-tenant` build-time→`TenantContext`; verify per-tenant bootstrap | promotion | two-way | FF-7 still byte-identical |
| **MT-6** | **Onboard tenant #2** (a real 2nd agency, pooled tier) — the proof; then **contract**: `tenant_id NOT NULL` once backfill proven | data commitment | **one-way (NOT NULL)** | two real tenants isolated; full FF suite green |
| **MT-7** | **Cleanup/contract**: drop legacy free-`TEXT` `agency` columns (re-point to FK); retire single-tenant assumptions; (optional) `D-CAP` grant table; document the **silo escape runbook** (point a tenant's `DATABASE_URL` at a dedicated instance) | contract | **one-way (drop cols)** | grep-clean; silo runbook exists |

MT-1→MT-3 and MT-5 are **two-way** — build freely. MT-4 is the enforcement flip (reversible policy; the role change is the real hardening). MT-6/MT-7 carry the **irreversible** `NOT NULL` + column drops — gated on a *proven* second tenant. **Never flip MT-4 in prod blind:** the flip is validated against a second tenant in staging first (FF-1/FF-3 green) before prod.

---

## 8. One-way vs two-way door ledger (ranked by irreversibility)

| # | Door | Severity | De-risk |
|---|---|---|---|
| 1 | **Build pooled shared-instance at all** (vs stay silo-per-deploy) | **HIGH** | The tiered hybrid keeps silo as a *live* escape — the pooled tier is additive; a tenant can always be lifted to its own deploy. We commit to pooled *as default*, not *as only*. |
| 2 | **POOL vs silo per tenant** | HIGH | `tenant_id` FK seam is model-agnostic — promote one tenant to silo without the pool tenants moving (Protected Variations). |
| 3 | **Backfill + `NOT NULL` + `FORCE` RLS** (the data commitment) | HIGH | Expand-contract: nullable → backfill to default tenant → `USING(true)` until MT-4 → reversible flip → `NOT NULL` only at MT-6 after two real tenants proven. Nothing irreversible until validated. |
| 4 | **tenant = agency identity** | MED-HIGH | Model `stats.agency` first (MT-1); `tenant_id` is a UUID **FK** (indirection, swappable); aligns with SDMX (agencies own maintainable artefacts) — standard, not invented. |
| 5 | **`snapshot.tenant_id` TEXT→UUID** | LOW-MED | Caught now (FF-9) before any data depends on the TEXT type; trivial while inert. |
| 6 | **JWT `tid` claim** | LOW | Additive, optional (Postel) — old tokens resolve to default tenant; no flag day. |
| 7 | **Resolution authority (subdomain primary for delivery)** | LOW | Registry of strategies — add/reorder freely (two-way); the `tid` claim remains authority for writes regardless of host. |

---

## 9. Surpass-the-standard innovation, open questions, quality-degraders to refuse

### 9.1 Where this design beats the field
1. **One SSOT isolates five planes** (data + config + theming + auth + authoring) because **config is data** — every incumbent re-implements tenant-scoping per subsystem (§2.3). This is the structural win.
2. **Tiered isolation with a *zero-cost* silo tier** — the silo escape is the deployment topology you already shipped, not a future migration. AWS SaaS Lens mixed-mode without building mixed-mode infra.
3. **The two RLS traps are encoded as CI gates** (FF-3, FF-5), not tribal knowledge — the airtight-RLS recipe done as *architecture*, not discipline.
4. **The GUC mechanism is already in production** (`app.revised_by`) — the riskiest mechanism (transaction-pooler-safe tenant GUC) is a *generalisation of a tested pattern*, not a leap.
5. **Isolation as a fitness-tested property** — FF-1/FF-2 prove zero cross-tenant rows on real Postgres in CI, so "isolated" is a *measured invariant*, not a claim.

### 9.2 Open questions for the owner
- **Business shape:** many small agencies (→ pooled is decisive) vs a few large national agencies (→ silo-per-deploy may be the better *default*)? This sets which tier is primary. My read: pooled default + silo escape fits "platform for many agencies."
- **Cross-agency super-admin UX:** confirm the platform operator uses the owner role through an audited admin path (§4.2) rather than an app-role `BYPASSRLS` — recommended, but it shapes the admin surface.
- **Connection budget:** per-request transactions hold pooled connections longer — set `default_pool_size` headroom and a `statement_timeout`; load-test before MT-6.
- **Subdomain wiring vs single-origin:** the path-prefix `/t/agency/` would break the relative-`/api/` empty-Vite-base topology (`adr_deployment_topology`); **subdomain is the correct primary selector for the public delivery surface** — confirm DNS/cert wildcard (`*.statdash.app`) is acceptable.
- **Per-tenant noisy-neighbour SLOs:** scope `rate-limit.ts`/`bulkhead.ts` by `tenantId` and define per-tenant budgets (ARCH-02 rides this seam).

### 9.3 Agnosticisms / quality-degraders to REFUSE
- **`tenant_id` sprinkled + application-enforced `WHERE`** (Grafana's model) — refused: imperative, forgettable, re-implemented per subsystem. RLS makes isolation a *property* (rejected alt B).
- **Tenant as a cube dimension `ctx.dims['tenant']`** — refused: violates Law 1's spirit (tenant is a boundary scope like locale); FF-6 forbids it (rejected alt C).
- **Session-level `SET app.current_tenant`** — refused: leaks under transaction pooling (FF-5).
- **App connecting as the table owner without `FORCE`** — refused: silent RLS bypass that passes happy-path tests (FF-3).
- **Leaving `snapshot.tenant_id` as `TEXT`** — refused: cannot FK the agency SSOT, will diverge (FF-9).
- **`NOT NULL` / column drops before a proven 2nd tenant** — refused: irreversible before validation (door ledger #3).
- **Deferring the decision to ship more features** — refused: `tenant_id` threading is the most invasive change a data platform can make *late*; cheapest now, backfilling Geostat as tenant 0.

### 9.4 Rejected alternatives (for the record)
- **A. Silo-per-deploy as the *only* model.** Legitimate (it already works, max isolation), but ×N ops and fragments shared SDMX structure; kept as the **escape tier**, not the default.
- **B. App-enforced `WHERE tenant_id`.** §9.3 — Grafana's failure mode.
- **C. Tenant as a dimension.** §9.3 — Law 1 violation.
- **D. Defer.** §9.3 — most-invasive-when-late.
- **E. Stay tenant-agnostic-per-deploy (no isolation work).** The owner's vision overrules this; documented so the decision is explicit. If the hosted goal ever reverts to per-agency on-prem, MT-2→MT-7 are YAGNI and silo-per-deploy already suffices.

---

## 10. Recommendation + confidence

**Build it — the tiered hybrid: POOL (shared-schema + FORCE RLS, non-owner app role) as default + SILO-per-deploy as the already-existing escape — with tenancy as a generic boundary scope resolved into one `TenantContext`, fitness-locked.** It raises the platform from *tool* to *platform* without lowering any bar: the engine stays pure (Law 1/3/5 — zero core change), isolation is declarative (Law 2 spirit — logic in the enforcer), every invariant is a fitness function (evolutionary architecture).

**Critical path:** MT-0 (decide) → **MT-1 (AgencyScheme first — the SSOT prerequisite)** → MT-2 (expand + backfill + reconcile snapshot type) → **MT-3 (the real work: resolver registry + `app.withTenant` txn wrapper + route migration off the raw pool)** → **MT-4 (the airtight gate: `FORCE` + non-owner role + `SET LOCAL`)** → MT-5 (request-time theming) → MT-6 (prove with tenant #2) → MT-7 (contract + silo runbook). Geostat stays byte-identical throughout (FF-7).

**The one irreversible call to ratify:** *commit to the pooled shared-instance data plane* (thread `tenant_id`, FORCE RLS, non-owner role, per-request GUC), accepting that `NOT NULL` + legacy-column drops come only after a proven 2nd tenant.

**Confidence:** **High** on the model (tiered hybrid is the mature canon and the platform's structural neutrality makes it cheap) and on the seam (one `TenantContext`, RLS below the port, two traps as CI gates, GUC mechanism already proven by `app.revised_by`). **Medium** on effort: the genuinely larger-than-the-ADR-implied piece is **MT-3's query-execution retrofit** — moving every tenant-scoped read off `app.pg.query(pool)` into a request-scoped `BEGIN; SET LOCAL; …; COMMIT`. That is the load-bearing engineering, and it is bounded, mechanical, and Strangler-safe (route by route, each green).

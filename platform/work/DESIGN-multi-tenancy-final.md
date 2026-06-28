# DESIGN — Multi-Tenancy: RED-TEAM + RATIFICATION (the signed call)

> Status: **RATIFICATION ARTIFACT** — the database-architect's independent stress-test of `DESIGN-multi-tenancy-decision.md` + `ADR-multi-tenancy.md`.
> Date: 2026-06-28 · Branch: `feat/tenant-agnostic-platform` · Author: database-architect (Opus).
> Scope: **analysis + design only.** No product code or schema changed by this document.
> Decision class: **M** · Door: **1-way** (data plane + model fork) · Priority: **P0-DECISION**.
> Reads with: `DESIGN-multi-tenancy-decision.md` (the decided design, this doc's input).

---

## 0. Verdict in one paragraph

**Every load-bearing claim in the decision doc was verified true in the live tree** (V1–V37, `platform/apps/api/src/**`, `ops/compose/**`): V6 `USING(true)` no-op RLS; V36 `tenant_id TEXT` defect; `publish.ts:101` `set_config('app.revised_by',$1,true)` GUC precedent; Flyway + app both run as `statdash` (owner); `POOL_MODE: transaction`; flat `JwtPayload{sub,uid?,iat,exp,roles?}`; global `stats.dataset.code` PK; tenant-less `uq_observation_series`; tenant-blind `storeManifest`. The red-team found **three gaps the design under-specifies** — one a *correctness break that happy-path tests will not catch*. All three are **fixable inside the Strangler plan; none overturns the model.** **Decision: APPROVED to build, amended by §1–§4.**

---

## 1. The most serious finding — RLS-blind execution contexts (headline)

**MT-3's `withTenant` wrapper is REQUEST-scoped, but four production paths touch tenant-scoped tables with NO request, NO resolver, NO GUC, as the app role — and ALL fail closed the instant MT-4 flips `FORCE` + `NOT NULL` + `WITH CHECK`:**

| Path | Evidence | Breaks how (post-MT-4) |
|---|---|---|
| Boot provisioning | `index.ts:188` `runProvisioning(app.pg,…)` writes `config.*` | `WITH CHECK` rejects (no GUC) — boot convergence dies |
| Ingest worker drain | `index.ts:209` `runIngestionWorker(app.pg,…)` publishes facts to `stats.*` | `INSERT stats.observation` rejected (no GUC) |
| Reclaim sweep | `index.ts:202` `reclaimStrandedSubmissions(app.pg,…)` | cross-tenant stranded reads → 0 rows |
| **`publishSubmission`** | `publish.ts:95-97` takes the **pool**, opens its **own** `connect()`/`BEGIN` | **Even on the request path** it does NOT use the request's `withTenant` client — a GUC set on a *different* pooled client does not apply. Its write is rejected. |

This is the *exact failure mode the design rightly refuses in Grafana* (a path that forgets the scope), relocated from "a missed `WHERE`" to "a missed GUC in a non-request context." **Happy-path request tests will not catch it** — they exercise the wrapper; these paths bypass it. This is why MT-4 must never flip prod-blind.

**RESOLUTION (amends MT-3/MT-4 — mandatory):** a first-class **system/background tenant-execution path**, two sanctioned forms only:
1. **Per-unit-of-work GUC.** `publishSubmission` resolves its submission's `tenant_id` and sets `app.current_tenant` **inside its own `BEGIN`** — one line beside `app.revised_by` (`publish.ts:101`). The worker drain loops per-tenant, never "all." Requires `stats_stage.submission.tenant_id` (MT-2 — the submission carries tenant into the worker).
2. **Admin-role cross-tenant sweeps.** Reclaim + boot provisioning run as a dedicated RLS-exempt **admin** role (§4 F-C) through an explicit, audited system path — the same answer §4.2 gives for super-admin, extended to background jobs. Provisioning a specific tenant still sets that tenant's GUC.

**New gate — FF-11 · FF-NO-UNSCOPED-TENANT-WRITE** *(integration, real Postgres, app role, FORCE on):* run the worker drain + a provisioning apply + a publish with **no ambient GUC**; assert each either sets a per-unit GUC and writes the right tenant, or is the named admin-role path — never a silent app-role write the flip will later reject.

---

## 2. `config.snapshot` is capability-isolated, NOT tenant-RLS-isolated (FF-3 over-reaches)

The public embed read (`routes/embed/index.ts:97` → `store.get(token)` → `SELECT … FROM config.snapshot WHERE token=$1`) is **HMAC-capability-authorized** (`verify(token,sig)`), with **no JWT and no tenant resolver** on the scope. Force RLS + a tenant-GUC policy on `config.snapshot` *because it carries `tenant_id`* and **every embed returns 0 rows ⇒ 404** — a self-inflicted outage of the API-09 embed contract.

The platform legitimately has **two isolation primitives** (correct architecture, not a defect):
- **Tenant-GUC (RLS)** — the authenticated app surface (`config.*`, `stats.*` facts).
- **Capability-token (HMAC)** — the public embed surface; the unguessable token + signature *is* the authorization, the snapshot payload self-contained.

**RESOLUTION:** reconcile `config.snapshot.tenant_id TEXT→UUID FK` (ownership/GC attribution — sound, keep) but **EXCLUDE `config.snapshot` from the RLS-forced set.** FF-3 gains an explicit **capability-isolated allowlist** (today: `config.snapshot`) — a table on it carries `tenant_id` for attribution yet is *intentionally* not RLS-forced. Makes the two-model boundary an asserted invariant, and stops FF-3 from breaking embeds.

---

## 3. The scoped-vs-shared partition is unspecified; global `dataset.code` PK contradicts "shared DSD, different data"

`stats.dataset` PK is a **global `code TEXT`** (`V4:120`); `uq_observation_series` = `(dataset_code, time_period, dim_key_hash, time_period_date)` with **no `tenant_id`** (`V4:258`). Therefore:
- Observation isolation rides **entirely** through `dataset_code → dataset.tenant_id` — sound **only if dataset codes are globally disjoint per tenant.** Two tenants publishing the *same* `dataset_code` **collide on the upsert target and overwrite each other** (cross-tenant corruption). The decision doc's *"two agencies share a DSD and publish different data"* is **not achievable as written** under a global PK.
- The design adds `tenant_id` to `dataset`/`observation`/`cube_actual_region` but is **silent** on `stats.classifier`/`stats.dimension`/`stats.dataset_dimension`/`concept_scheme`/`category_scheme`/`metadataflow`. The V4 `dim_key` validation trigger (`V4:274`) reads `stats.classifier` **globally** — so the implicit (and correct, SDMX-aligned) model is **shared reference structure, tenant-scoped facts.** It must be made **explicit**:

**RESOLUTION — the "shared-reference / scoped-fact" invariant:**
- **Shared (global, NOT tenant-scoped):** `stats.dimension`, `stats.classifier`, `stats.dataset_dimension`, `concept_scheme`, `category_scheme`, `metadataflow`. Stated consequence: **all tenants share one global codelist namespace — a tenant cannot define a conflicting `CL_GEO` member.** Private per-tenant codelists = future door **D-CL** (YAGNI).
- **Scoped (tenant_id + FORCE RLS):** `config.*`, `stats.dataset`, `stats.observation`, `stats.cube_actual_region`, the `stats_stage.*` write surface.
- **`dataset_code` stays a global namespace; tenants own disjoint codes** (`GEOSTAT_GDP`, not a shared `GDP`) — keeps every `…→ stats.dataset(code)` FK + the obs upsert target unchanged (cheaper, two-way). Composite `(tenant_id, code)` is the heavier deferred alternative, taken only if reusing a code across tenants becomes a real need.
- **Denormalized integrity:** `stats.observation.tenant_id` must equal its parent `stats.dataset.tenant_id` — `WITH CHECK` (ideally `FK (dataset_code, tenant_id) → dataset(code, tenant_id)` once `dataset UNIQUE(code, tenant_id)` exists), so no writer can stamp a mismatched tenant. Add to MT-2/MT-4.

**New gate — FF-12 · FF-SCOPED-VS-SHARED-PARTITION** *(introspection):* scoped set carries `tenant_id`+FORCE-RLS; shared set does not; `observation.tenant_id = dataset.tenant_id` holds.

---

## 4. Lesser findings (fix in-flight, no decision impact)

- **F-A · pgBouncer not yet wired** — `db.ts` + `pgbouncer.yml:41` ("App services still use direct Postgres until the rewire"). FF-5 (SET-LOCAL-only) must land **before** the pgBouncer cutover. A plain `SET` leaks even on a *direct* node-postgres pooled client (released → reacquired carries it) — SET-LOCAL-in-txn is the only safe form **regardless** of pgBouncer. Strengthen FF-5 to prove a residual-free GUC on **both** a recycled node-pg client **and** a pgBouncer server connection.
- **F-B · bootstrap parallelism collapses under one txn** — `bootstrap/index.ts:189` fires 5 concurrent `app.pg.query` (5 connections). Inside `withTenant` (one client, one txn) node-postgres **serializes** them. §4.2's "bootstrap already batches" is imprecise (it *parallelizes* — the opposite). Bounded latency cost; mitigate with a single composed CTE under the txn, or accept it. Not a correctness break.
- **F-C · three-role split beats two** — §4.2 routes platform-ops through the **owner** role, which is *also* the Flyway/DDL role (an app-reachable path with full DDL rights). Stronger (Citus / AWS-SaaS-Lens least-privilege): **`statdash_owner`** (DDL/Flyway only), **`statdash_admin`** (cross-tenant DML, owner-of-tables so RLS-exempt, no DDL), **`statdash_app`** (tenant DML, non-owner, FORCE-bound). Background sweeps (§1) use `statdash_admin`, never the DDL owner. Adopt as the MT-4 role design.

---

## 5. Per-layer agnosticism verdict (the owner's hard constraint)

| Layer | Verdict | Basis |
|---|---|---|
| **Data assembly / cube** | **CERTIFIED** (conditional §1+§3) | RLS below the `DataStore` port; engine reads tenant-blind. Conditionality is execution/modeling specifics, not agnosticism. |
| **Render-JSON (manifest/site-config)** | **CERTIFIED** | Manifest carries **no `tenant` key** in the wire contract; tenant resolved at the boundary into the GUC, never baked into config; `storeManifest` is a pure kind→builder registry. Tenant-*resolved content*, tenant-*neutral shape*. |
| **API request / response** | **CERTIFIED** | Tenant from host/`tid`-claim/header at the boundary — never a required request field, never echoed in a response. Embed is a *deliberate* non-tenant-resolved capability path (§2). |
| **Theming** | **CERTIFIED** | `data-tenant={agencyCode}` is a **presentation-token selector (a scope, like locale)**, not a cube dimension/privileged key. FF-6 guards the engine boundary. |
| **Provisioning** | **CERTIFIED w/ amendment** | The manifest `tenant` field is provisioning *input* resolved into the GUC — not a privileged dimension. Boot execution context fixed by §1. |
| **Auth** | **CERTIFIED** | `tid` claim additive (Postel — old tokens → default tenant, as `roles?`/`uid?` degrade in `lib/auth.ts`); resolver registry, OCP. |
| **Pooling** | **CERTIFIED** (conditional §4 F-A) | One role per tier, GUC per-txn; no tenant coupling in the pooler. |
| **core / react (below the port)** | **CERTIFIED — zero lines** | `storeManifest` + engine tenant-blind; FF-6 forbids `tenant` as a dimension. Law 1/3/5 hold. |

**No layer is tenant-coupled or tenant-privileged.** Tenant is a boundary scope everywhere, resolved once, enforced declaratively — the owner's hard constraint is **met**, contingent only on closing §1–§3.

---

## 6. Surpass-standard verdict

The "one SSOT isolates five planes, declaratively, below the port" thesis is **genuinely stronger** than Grafana (`org_id` threaded, app-enforced), Cube (`queryRewrite` imperative layer), Tableau (Sites, content-only), Looker (per-tenant model duplication) — **IF §1 is closed.** Unclosed, the platform inherits the *exact* Grafana failure mode, so the surpass claim is **contingent**, not automatic. On the data plane it meets the airtight-pooled-RLS canon (Crunchy/Supabase, Citus row-based + RLS) and matches Snowflake/BigQuery row-access-policy posture. **Be stronger** by: (a) the three-role split (§4 F-C); (b) treating the worker/system identity as **non-exempt-by-default** — Snowflake evaluates row-access policies even for service identities; our bar = "no identity is implicitly RLS-exempt except one named, audited role." **YAGNI discipline is correct** (silo = existing deploy topology; D-CAP/D-CL deferred). **One over-reach corrected:** forcing RLS on `config.snapshot` (§2).

---

## 7. The one irreversible call to ratify (amended)

**Build the pooled shared-instance data plane:** thread `tenant_id UUID FK → stats.agency` through `config.*` + the **scoped fact/dataset/stage** surface (per the shared-reference / scoped-fact invariant §3 — NOT the shared reference structure), enforce with `FORCE ROW LEVEL SECURITY` under a **non-owner app role** (three-role split §4 F-C), resolve tenant into a `SET LOCAL` GUC **per request AND per background unit-of-work** (§1). `config.snapshot` stays **capability-isolated** (§2). Everything below the `DataStore` port changes by **zero lines**. `NOT NULL` + legacy-`agency`-column drops come **only after a 2nd tenant proven in STAGING** (FF-1/FF-3/FF-11 green), never prod-blind.

---

## 8. Amended fitness suite + door ledger deltas

- **Add FF-11** (no unscoped tenant write — §1), **FF-12** (scoped-vs-shared partition + `obs.tenant_id = dataset.tenant_id` — §3).
- **Amend FF-3** — explicit **capability-isolated allowlist** (`config.snapshot`): carries `tenant_id` for attribution, intentionally not RLS-forced; FF-3 asserts the allowlist is explicit, not silent.
- **Amend FF-9** — `config.snapshot.tenant_id` → `UUID FK` (attribution), but UUID-typing must not imply RLS-forcing (defer to FF-3's scoped set).
- **Amend FF-5** — residual-free GUC on **both** a recycled node-pg client and a pgBouncer server connection (§4 F-A).
- **Placement note** — FF-3/FF-9/FF-11/FF-12 are real-Postgres introspection/integration gates: `ops/scripts/check-laws.sh` is **pure grep, no DB connection**, so they live in the Postgres test suite (beside `bootstrap-parity.fitness.test.ts`). Only grep gates (FF-5 AST arm, FF-6) extend `check-laws.sh`.
- **Door ledger** — add **D-CL** (per-tenant private codelist — deferred; shared-reference is default) beside D-CAP; record §3's "global `dataset_code`, disjoint per tenant" as the ratified call, composite `(tenant_id, code)` the heavier deferred alternative.
- **MT-2 gains:** `stats_stage.submission.tenant_id` (carries tenant into the worker); `dataset UNIQUE(code, tenant_id)` to back the obs integrity FK.
- **MT-4 gains:** three-role split; `obs.tenant_id = dataset.tenant_id` `WITH CHECK`; `config.snapshot` excluded from FORCE; background sweeps on `statdash_admin`.

---

## 9. Ratification

**Decision: APPROVED to build, amended by §1–§4.** The tiered hybrid (POOL default + SILO escape) is the correct, surpassing model; the platform's structural neutrality makes it cheap. The three findings are execution/modeling specifics fully absorbed by the Strangler plan — none changes the model or the seam. **Confidence: HIGH** on model + per-layer agnosticism; **HIGH** that the gaps are closed by the MT-2/MT-3/MT-4 + FF-11/FF-12 amendments; **MEDIUM** on effort (MT-3 retrofit + the now-explicit background-context path is the load-bearing, bounded, Strangler-safe work). **The owner ratifies §7.**

# BOARD — statdash-platform

_Last updated: 2026-06-23_

---

## ✅ Completed (P1–P3)

| Item | Notes |
|------|-------|
| P1-1 ApiStore live (CachedStore wrapping) | Per-query obs caching, ETag/304, DI mapRow |
| P1-2 ETag/304 on observations route | dataset_version → weak ETag |
| P1-4 i18next mock (3 suites) | vi.mock('i18next') |
| P2-1 rowLimit / queryFrame / truncated | DataSpec.rowLimit → NodeDataFrame.truncated |
| P2-2 Real user/role model + auth tests | V10, scrypt, 61 api tests |
| P2-3 Preliminary badge (resolvePreliminary) | 3-signal, MetadataPort, 5 shells |
| P2-4 CachedStore obs TTL + invalidate() | 5-min TTL, ETag-aware |
| P2-5 GitOps provisioning loader | JSON+YAML, dry-run, export route |
| P2-6 Locale coverage fitness test | Recursive walker; 8 violations fixed |
| P3-1 Constructor round-trip fitness | 55 tests; undefined-drop contract |
| P3-2 FieldMeta suggestedEncodings | Grammar of Graphics rules; storeSchema() enriches |
| P3-3 Schema versioning (migratePageConfig) | migration.ts; 13 tests (engine-core: 221) |
| P3-4 STORE_MANIFEST → config.data_source | fetchStoreManifest(); 3 DS rows seeded |
| api→engine dist + migratePageConfig in pages.ts | Workspace dep fixed; 409 forward-compat guard |

---

## ✅ Data Ingestion Phase — Staged Submission Pipeline

### Architecture: Medallion Bronze→Silver→Gold + Pipe-and-Filter + Async Job + Approval Gate

```
POST /api/ingest/facts|codelists|displays  → 202 { jobId }
        ↓
  BRONZE  stats_stage.submission + submission_blob  (raw payload, content_hash)
        ↓  parse → conform (in-memory) → validate (batch DB)
  SILVER  obs_staging / classifier_staging / display_staging / validation_issue
        ↓  POST /api/ingest/jobs/:id/publish  (approval gate)
  GOLD    stats.observation / stats.classifier / stats.classifier_display  ← UNCHANGED
```

| # | Item | Status | Notes |
|---|------|--------|-------|
| DI-1 | V11__ingest_staging.sql | ✅ | stats_stage schema, 7 tables, 7 indexes, risk gate TWO-WAY |
| DI-2 | types + conform + validate + publish + worker | ✅ | Partial success, topological classifier publish, DB-as-queue |
| DI-6 | worker.ts table alignment fix | ✅ | Single-stage model (no *_raw), parseBronze from blob |
| DI-7 | Submission API routes (8 handlers) | ✅ | Fire-and-forget worker, content_hash dedup, requireWrite auth |
| DI-8 | Display CSV export/import | ✅ | RFC 4180 + UTF-8 BOM, shared createSubmission, goes through pipeline |
| DI-9 | V12__display_revision.sql | ✅ | Symmetric to V8, composite FK (member_id,locale), ON DELETE SET NULL |
| DI-10 | seed.ts → bronze producer | ✅ | SEED_MODE=pipeline; submit→poll staged→publish→poll published |

### API surface

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/ingest/facts` | POST | admin/editor | Submit observation data → 202 jobId |
| `/api/ingest/codelists` | POST | admin/editor | Submit codelist data → 202 jobId |
| `/api/ingest/displays` | POST | admin/editor | Submit display overlays → 202 jobId |
| `/api/ingest/jobs` | GET | any JWT | List recent jobs (status/kind filter) |
| `/api/ingest/jobs/:id` | GET | any JWT | Poll job status + canPublish |
| `/api/ingest/jobs/:id/issues` | GET | any JWT | Full validation report |
| `/api/ingest/jobs/:id/publish` | POST | admin/editor | Promote silver → gold |
| `/api/ingest/jobs/:id/reject` | POST | admin/editor | Reject staged submission |
| `/api/admin/displays/export` | GET | admin/editor | Export display overlays as CSV |
| `/api/admin/displays/import` | POST | admin/editor | Import edited CSV → pipeline |

### Run in pipeline mode
```
$env:SEED_MODE='pipeline'  # default is 'direct' (backward compat)
pnpm --filter @geostat/api seed
```

---

## ✅ I18N Foundation

### Architecture: Locale Registry (SSOT) + Fallback Chain + Write-Time Enforcement

```
config.locale (PK: BCP 47 subtag 'ka'/'en')
  ↓ fallback chain  ka → en → (root)
  ↓
config.validate_locale_string(label)   — no unknown keys + all active present
config.resolve_label(label, preferred) — fallback walker, cycle-guarded ≤16 hops
config.enforce_locale_string()         — generic trigger (TG_ARGV[0] = column name)
  ↓ attached to 5 tables (V14)
stats.dimension/classifier/dataset.label  · config.page.title  · config.nav_item.label
```

| # | Item | Status | Notes |
|---|------|--------|-------|
| I18N-1 | V13__i18n_foundation.sql | ✅ | config.locale SSOT, validate/resolve/enforce funcs, ICU collations, FTS configs — zero V1-V12 touch |
| I18N-2 | V14__i18n_apply.sql | ✅ | Pre-flight guard (all 5 tables), 5 completeness triggers, FK classifier_display.locale, 5 GIN jsonb_path_ops indexes |
| I18N-3 | provisioning/upsert.ts locale-agnostic lookup | ✅ | `label->>'ka'` WHERE → `label = $1::jsonb` |
| I18N-4 | Frontend locale SSOT (locale-coverage.test) | ⏳ | `REQUIRED_LOCALES` hardcoded; needs `src/config/locales.ts` shared module — blocked until locale-switcher UI (Phase 2) |

---

## 🔧 Silver → Gold Contract Alignment

> Chief-engineer audit (2026-06-22): gold layer excellent; silver diverges from gold on i18n, SCD-2, throughput, and governance.

| # | Item | Status | Notes |
|---|------|--------|-------|
| DI-11 | Silver locale rule → `config.locale` SSOT | ✅ | `KNOWN_LOCALES` deleted; `fetchActiveLocales(db)` queries registry; `.some` → all-active; silver ≡ gold |
| DI-12 | SCD-2 codelist history (implement, not advertise) | ✅ | `upsertClassifier` close-old/insert-new + Step 3 SELECT id; COALESCE color. Note: V4 `UNIQUE(dim_code,code)` blocks 2nd revision until dropped (future migration) |
| DI-13 | Set-based publish (no per-row loops) | ✅ | `publishFacts`: one INSERT…SELECT…ON CONFLICT; `publishDisplays`: LEFT JOIN unresolved-check + one set-based INSERT JOIN; classifiers topo-sort unchanged (SCD-2 per-row acceptable) |
| DI-14 | Publish audit trail + V15 `audit_log` migration | ✅ | V15: `config.audit_log` append-only + immutability trigger; `publishSubmission(opts)` + `ingestRoutes(audit)` factory; `ingest.publish`/`ingest.reject` events |

---

## ✅ SDMX Domain Completeness — Platform Hardening

> Architect deep-research (2026-06-22) vs Eurostat/ONS/ECB/IMF: "structural engineering top-tier; gaps are SDMX domain completeness." Three P0 gaps identified; UNIT_MEASURE (P0-3) shipped.

| # | Item | Status | Notes |
|---|------|--------|-------|
| V16 | `stats.unit_measure` codelist + dataset default columns | ✅ | 11 SDMX units (GEL, GEL_MN, USD, PERCENT, INDEX…), i18n-enforced, dataset unit_code/unit_mult/decimals/base_period |
| V17 | Trigger-driven `dataset_version` bump | ✅ | Statement-level AFTER trigger on observation; `PERFORM bump_dataset_version`; dry-run GUC skip; closes app-only-bump gap |
| V18 | SCD-2 unlock + classifier acyclicity + concept roles | ✅ | Drops V4 `classifier_dim_code_code_uq`; cycle-prevention trigger; `dimension.concept_role` (SDMX). Flagged: future migration must add `is_current` to dim_key validation trigger |
| V19 | `parse_time_period_end()` + frequency-aware obs query | ✅ | SDMX time range (A/S/Q/M/W/D); `observations.ts` no longer assumes annual; backward compat |
| V20 | UNIT_MEASURE at measure-classifier level (Decision C) | ✅ | classifier unit_code(FK)/unit_mult/decimals + backfill from metadata (PCT→PERCENT); obs_attribute override retired |
| V21 | `stats.measure_unit_resolved` view (resolution SSOT) | ✅ | measure-classifier → dataset default → NULL; read surface for Constructor cube-profile |
| — | seed-units.ts PCT→PERCENT canonical fix | ✅ | Source emits canonical codelist code; no alias (Law 1: one code per concept) |

### Decision C (ADR)
Unit attaches at the **measure-classifier**, not dataset, not series_attribute, not obs_attribute. Architect caught a third live model (`seed.ts` already wrote unit to `classifier.metadata` unvalidated) — Strangler-Fig consolidation onto validated columns. GDP_ANNUAL is genuinely mixed-unit (GEL_MN + PERCENT + USD on one measure axis), so dataset-level alone was wrong.

---

## ✅ SCD-2 Identity Integrity — "version vs identity" change-set

> Chief-engineer final coherence pass caught one root cause surfacing in 4 places: SCD-2 unlock (V18) gave each revision a new surrogate `id`, but dependents assumed one-row-per-(dim_code,code). Fixed as ONE change-set, not 4 patches.

| # | Fix | File | What |
|---|-----|------|------|
| 1 | Re-point children on parent revision (highest risk) | `ingest/upsert.ts` | `upsertClassifier` close `RETURNING id` → re-point `UPDATE parent_id=newId WHERE parent_id=oldId`, atomic, fires LTREE path recompute |
| 2 | Parent resolution via is_current | `ingest/publish.ts` | `publishClassifiers` gold-parent lookup `AND is_current=true` (mirrors publishDisplays) |
| 3 | ON CONFLICT partial-index target | `scripts/seed-helpers.ts` | `ON CONFLICT (dim_code,code) WHERE is_current` — infers V6 partial unique; in-place convergence (seed≠SCD-2) |
| 4 | is_current mirror in approval preview | `ingest/validate.ts` (3 loads) | preview validates against LIVE codes only — honest vs gold |
| 5 | V22: gold validation trigger is_current | `V22__scd2_validation_integrity.sql` | `validate_observation_dim_key` + `is_current=true`; read-only pre-flight; reworded error for retired-code case |
| — | V19 header self-references corrected | `V19__time_period_end.sql` | cosmetic (V16→V19 in own header) |

Note: `provisioning/upsert.ts` named in trace but verified NOT a classifier writer (config.page/data_source/nav_item only) — agent correctly refused to invent a fix.

### Second coherence pass — 2 more bugs in same cluster (runtime ingest path, untested)
| # | Bug | Fix |
|---|-----|-----|
| B | `upsert.ts` `ON CONFLICT ON CONSTRAINT uq_classifier_current` — partial INDEX has no pg_constraint → throws on 1st revision | → inference form `ON CONFLICT (dim_code,code) WHERE is_current DO NOTHING` |
| A | Single-level re-point leaves grandchild LTREE `path` stale (≥3-level hierarchy) | Recursive-CTE subtree repath after Step 3; `path = parent.path \|\| self.id` top-down, arbitrary depth |
| FF | No test on the SCD-2 revision path (both bugs hid there) | `upsert.scd2.test.ts` — 3-level revise: no-throw, one is_current/code, child→new parent, grandchild path fresh, no orphans. CI-gated (live DB) |

Chief-engineer honestly self-corrected: its 1st pass had mis-blessed the `ON CONSTRAINT` form as correct.

### ADR-0023 — code-chain hierarchy (root-cause, user chose "best architecture")
Deeper question surfaced: one surrogate-id space + one LTREE path can't serve BOTH live tree AND temporal history (SCD-2 mints new id per revision → temporally-incoherent historical edges). Architect decided: **hierarchy edge = `(dim_code, code)` business key, path = code-chain** (stable across revisions). SDMX-aligned (codelist = code→parent-code), Law 1 (code is identity, surrogate id is plumbing).

| # | Item | Status | Notes |
|---|------|--------|-------|
| V23 | Code-path EXPAND | ✅ | `parent_code` + `code_path LTREE` parallel to V4 path; `code_to_ltree_label()` sanitiser; trigger; parity assertion block |
| V24 | Code-path CONTRACT (one-way) | ✅ | Drops `parent_id`/`path`/id-triggers; `id` survives (PK + display.member_id); cycle guard re-pointed to parent_code. **Apply only after live parity** |
| code | upsert.ts simplification | ✅ | **Step 3 re-point + Step 3b recursive repath DELETED** (~120→~40 lines) — they were repair work for a churning id that no longer carries hierarchy |
| code | publish/validate/classifiers routes | ✅ | parent_code passed through; topological loop kept (≥3-level safe); `code_path::text AS path` wire-stable; validate.ts already code-based |
| test | as-of-time + stability fitness | ✅ | grandchild `code_path` byte-identical before/after grandparent revision = the win; as-of-D query via validity window |

Key finding: observations reference classifiers ONLY by (dim_code, code), never surrogate id → zero blast radius on fact table. Staging already used `parent_code` → publish passes straight through.
Flagged: `code_to_ltree_label` sanitises hyphens (`GE-TB`→`GE_TB`) for LTREE — many-to-one; safe (ancestry traversal not identity, uniqueness is on `(dim_code,code)` not code_path) but noted for review.

### Final verdict — chief engineer
> **"It IS a work of art."** Root-cause fix (identity vs version de-conflated in the path), textbook expand-contract with live parity gate + scrutinised one-way door, zero blast radius on fact table, test suite *inverted* to prove the repair is no longer needed. Senior work. Temporal-incoherence defect gone **by construction** (make-illegal-states-unrepresentable at the data-model level).

Last blemish fixed: V24 cycle trigger renamed `trg_classifier_no_cycle`→`trg_classifier_acyclic` so it alphabetically sorts before `trg_classifier_code_path` — cycle guard now genuinely fires first (clear error before code_path materialization); comment now matches reality.

**Apply order V1→V24 clean. All API typecheck green. V24 (contract) applies only after live V23 parity.**

---

## 🔭 SDMX P0 Backlog (architecture-approved, not yet built)

| # | Gap | Why P0 | Approach | Status |
|---|-----|--------|----------|--------|
| SDMX-P0-2 | **Vintage-as-release** — queryable publication vintages | Can't reconstruct "GDP as published on date D"; revision triangles need release grouping | V25: `stats.release` + release_id stamping (GUC trigger) + open/publish helpers + genesis backfill; publish.ts integration; `?asOf=D` + `/releases` endpoints | ✅ DONE (ADR-0025) |
| SDMX-P0-1 | **ContentConstraint** — valid dimension *combinations* | Cube accepts impossible tuples; renderer can't distinguish "no data" from "impossible by construction" | ✅ V26: predicate-row model (B9-only-side-U = 1 row, generic); `dim_key_in_allowed_region()` SSOT + `cube_actual_region` view; batch `ILLEGAL_COMBINATION` (silver, region.ts twin); provisioning + fitness; hot path untouched | ✅ DONE |
| Constructor | `GET /api/cube/:code/profile` cube-profile endpoint | Constructor power ∝ what it can auto-discover | ✅ `GET /api/cube/:dataset/profile`: dims+conceptRole+isTime+members, measures+V21 units (fitness-locked), actualRegion auto-detects V26 view | ✅ DONE |
| SDMX-P1 | ConceptScheme · CategoryScheme · ref-metadata · quality indicators · dataset lifecycle · SDMX REST API | Expected at agency level | **Mostly BUILT** (board was stale): V27 ConceptScheme (+concept_role), V28 dataset-lifecycle FSM, V29 CategoryScheme — each with a live-DB fitness test (all green in the 2026-06-23 validation). **Still open:** ref-metadata, quality indicators, the SDMX REST API surface. | 🟡 PARTIAL |

---

## 🚀 Bootstrap Runner — geostat → universal SDUI renderer (ADR-0026)

> Goal: `apps/geostat` becomes a pure generic Server-Driven-UI runner that renders ANY site from `/api/bootstrap`, knowing nothing app-specific. Recon: app is ALREADY ~80% separated; entanglement in 3 import sites. Store half of Phase 1→2 switch already LIVE.

**Research synthesis (reference platforms):** Grafana `bootData` (one atomic boot payload) + fixed compiled panel set + provisioning · Superset/Metabase authoring-vs-delivery split · Vega-Lite GoG declarative · Backstage shell+registry · Builder.io/Plasmic JSON-tree→registry. **Pattern: shell ← registry ← spec ← API. Generic w.r.t. CONTENT, not CODE.**

**Architect decisions:** gut-in-place (no separate package until 2nd consumer) · compiled-in plugins (microkernel, not module federation) · single-tenant-now/host-resolved-later (manifest host-agnostic) · NEW public `GET /api/bootstrap` (Grafana bootData pattern, sibling to data-sources, composes existing config.* reads, published-only projection).

| Phase | What | Reversible gate | Fitness function | Status |
|-------|------|-----------------|------------------|--------|
| A | Flip manifest switch: `/api/bootstrap` + resolve 3 entanglement points (`buildManifest`→fetch, `ALL_PAGES`→manifest, `LocaleGuard` LANDING→`manifest.indexPageId`); move modes+locales into manifest | env flag + buildManifest fallback | geostat renders identically from API vs local | ✅ DONE |
| B | Extract content to DB via provisioning (pages/nav/site_config/data_source); add chromeConfig/i18n/indexPageId/modes keys | provisioning idempotent + dryRun | fresh DB + provisioning → /api/bootstrap returns full manifest | ✅ DONE |
| C | Runner = the deployable; delete src/pages, src/data/<dataset>, configs, mocks | git tag pre-deletion | **2nd demo tenant (diff dims/pages/brand) renders zero-code** ← definition of done | 📋 NEXT |
| D | Multi-tenant host→site (only if real) | additive routing | 2 hostnames → 2 sites, 1 deployment | 📋 |

### Phase B — DONE (chief-engineer verdict: "platform-quality"). Full suite 780 green.
- **Foundation**: `upsertPage` publish-fix (provisioned published pages now actually set is_published — atomic, mirrors POST /:id/publish; was the gap that would return empty pages); `upsertSiteConfig`; bootstrap reads 6 site_config keys (+ `nav` blob, falls back to nav_item CTE).
- **Extraction**: `export-provisioning.ts` (geostat TS → committed `geostat.provisioning.json`: 4 pages all published+slug===config.id, 6 siteConfig keys). Auditable, re-runnable, byte-stable.
- **3 architect-found gaps resolved**: publish-state (silent empty pages), nav shape mismatch + label encoding (both → nav-as-blob in site_config, dodges V14 LocaleString trigger), all in the design.
- **Parity chain** (split across dependency arrow, Law 3): geostat-side `buildManifest()===committed JSON` (no-DB, runs) + api-side `committed JSON===DB bootstrap` (DB-gated) + slug===config.id fitness + i18n⊆config.locale. Proves MIGRATED equality (documented).
- **Type debt cleared** (vitest hid it, tsc caught it): `KpiSpec.label` widened string→LocaleString (lone non-i18n label outlier; resolved at ctx.locale seam) + 5 roundtrip-dataspec test bugs fixed to real `op`-discriminant TransformStep contract.
- ⏳ **Remaining (infra, → blocked list)**: CI Postgres with DATABASE_URL so the DB-gated parity half actually runs (joins P1-3).

### Phase A — DONE (all tests green: engine/core 221, api+geostat+react 402)
- **Backend** `GET /api/bootstrap` (new public sibling route): composes published config.page (migratePageConfig, skip-with-log if schema ahead) + nav recursive CTE + site_config + connected data_source → one atomic SiteManifest. Weak ETag from max(updated_at) across composed tables. Law 3 respected: api does NOT import @geostat/react — config blobs are pass-through JSON (delivery = projection, not 2nd SSOT).
- **Frontend**: `VITE_SITE_MODE=api` → `fetchBootstrap()` with `buildManifest()` fallback (mirrors live store-half resilience). 3 entanglements resolved; modes→`modes.config.ts` + manifest; locales de-hardcoded; `PageLoader` resolves via `usePageById(SiteContext)`; `LocaleGuard` uses `manifest.indexPageId` + line-50 JSX bug fixed.

⚠️ **Phase B cross-surface contract** (flagged by both agents): manifest `pages` keyed by config `.id`; `indexPageId` points at that id-space. Provisioning upserts page identity by `slug`. Phase B must keep **`slug === config.id`** (as example files do) or architect decides manifest key = slug. site_config keys (index_page_id/chrome/chrome_config/i18n/modes) currently absent → defaulted; Phase B seeds them (provisioning loader doesn't handle site_config yet).

---

## 🛠️ Ops/KIT Reconfiguration — back/front/panel + infra (geostat-kit)

> Inherited geostat-kit (manifest-driven ops toolkit from geostat-chat-ai) reconfigured to THIS project. SSH Docker server reused (192.168.1.199, local gitignored key). Security flag CLEARED: ssh keys + google-creds are gitignored, never tracked.

| Item | Status | Notes |
|------|--------|-------|
| Config reorg → api/geostat/panel + infra/db | ✅ | Real env vars sourced from `apps/api/src/env.ts` + app vite usage (caught geostat's old .env using vars geostat doesn't read — fixed to VITE_SITE_MODE/STORE_MODE/API_STATS_URL) |
| Prune inherited cruft | ✅ | Deleted config/{corpus,ingestion,retrieval,languages,profiles,backend,frontend} + root chat-bot .env.example + kit/dfsdafa — each grep-verified no OURS reference |
| deploy.env + ssh/config | ✅ | DEPLOY_PROJECT=statdash; ssh IdentityFile → in-repo key (was old-repo path). Remote path `/home/administrator/statdash/{api,geostat,panel,infra}` |
| Postgres image reconcile 3→1 | ✅ | docker-compose.yml + catalog.json `postgres:16-alpine` → `timescaledb-ha:pg16` (migrations REQUIRE it); redundant `ops/postgres/init/` deleted (Flyway is SSOT) |
| node-api kit driver | ✅ | Built (pnpm-build + docker service deploy, health-gate + image rollback — java-boot service pattern, Node not JVM); registered; **api module added to manifest; `geostat validate` OK (3 modules); kit pytest +5, no regressions** |
| java-boot driver | KEPT | Registered, test-covered kit capability — NOT cruft (Chesterton's Fence; kit is project-agnostic) |

### Deploy capability
- ✅ **`platform/apps/api/docker-compose.{prod,dev}.yml`** created (kit's per-module model). `statdash-api`, build from workspace + apps/api/Dockerfile, `/health` healthcheck, `statdash-net` external, no cross-project depends_on (infra is a separate compose project). Local `geostat api compose --prod up` works.
- ⏳ **Remote `geostat api deploy` blocked by a kit toolkit bug**: `gen_server_compose.py:56` hardcodes `build.context:"."` but `node-upload.sh` rsyncs the workspace to `$rp/context/` → server-side Dockerfile `COPY pnpm-lock.yaml` fails. Fix: emit `context:"./context"`. (vendored-kit, generic node-api server path)
- ⏳ **geostat/panel same per-module-compose gap** (node-vite remote deploy): their compose lives only in `ops/compose/` (catalog-gen), no per-module source file. Larger (3-file base+override+prod shape) — follow-up.
- ✅ Kit pytest restored 44F/193P/11E → **250P/23S/0F/0E**: root cause = conftest tested the LIVE consumer manifest; fix = synthetic self-contained fixture (project-agnostic) + 1 real kit bug fixed (`compose_identity` primary-api naming fallback). Flagged follow-up: `migrate_layout_names.py` hardcodes legacy dir names (make manifest-driven).

### Deploy capability — COMPLETE (sources for all 3 modules)
- ✅ **Gap 1 fixed**: `gen_server_compose.py --build-layout {jar|context-dir}` (uploader owns layout = SSOT); node-api emits `context:./context, dockerfile:../Dockerfile`; java-boot unchanged (default jar). Kit suite unchanged.
- ✅ **Gap 2 fixed**: `platform/apps/{geostat,panel}/docker-compose.{yml,prod,override}.yml` (node-vite 3-file model); **geostat Dockerfile rewritten** (was broken `npm ci` — can't resolve pnpm `catalog:`/`workspace:`; now 5-stage pnpm-workspace nginx); panel Dockerfile+nginx created; catalog context reconciled to one model (`../../platform`).
- ⏳ **node-vite remote tar-scope** (driver-level follow-up): `deploy.ps1 remote` tars module dir, not workspace → remote container build can't see `engine/*` siblings. Local dist/sync/watch work. Fix: mirror node-api's workspace rsync.

### Needs the user (local secrets / server)
- `ops/config/{api,geostat,panel}/.env.{dev,prod}` (local, gitignored) — DATABASE_URL→statdash-pgbouncer:5432, JWT_SECRET, ADMIN_*
- `docker network create statdash-net` + infra stack up before apps

---

## ⏳ Blocked (infrastructure)

| Item | Notes |
|------|-------|
| P1-3 verify-parity CI gate | Needs live DB in CI + `pnpm build:engine` before api step |
| Bootstrap DB-parity gate | `bootstrap-parity.fitness.test.ts` skip.unless DATABASE_URL — needs CI Postgres (same job as P1-3) to prove round-trip losslessness + i18n⊆config.locale |
| P3-5 Constructor RBAC | Needs Constructor canvas UI (Phase 2) |
| seed.ts direct mode retirement | After CI adopts pipeline mode |
| UNNEST bulk inserts in worker | Row-at-a-time now; perf optimization when payload sizes known |
| RFC 9457 structured errors | Deferred — 409 payload currently JSON-in-message |

---

## Platform Structure — Re-architecture (proposed)

Status: PROPOSED. Full assessment + rejected alternatives + per-phase fitness gates in architect ADR `adr_platform_structure_rearchitecture.md`. Strangler-Fig: every phase ends 780-green and reverts independently.

**Keep (already best-in-class):** dependency-arrow eslint gate (real fitness fn); source-condition zero-build resolution; expr/core/charts/styles/react seams; `catalog:` SSOT.

**Defects:** P0-1 `workspace:*` declared but `@geostat/*` not installed — aliases load-bearing, clean install diverges (SSOT). P0-2 no contracts package → api dupes boundary types (`PageDataSnapshot` in `snapshot-store.ts`) to avoid react (DRY). P1-1 laws describe a phantom tree (`packages/…←src`; none exist). P1-2 `@geostat/*` lib scope = first-tenant erosion on a multi-tenant platform. P1-3 Dockerfile/nginx inside `apps/{geostat,panel}/src/`. P1-4 `engine/` fights `packages/` convention + overclaims. P2: 3 layout conventions; inline vs `__tests__` split; stray 2nd compose.

**Target:** `platform/packages/{contracts(NEW),expr,core,charts,styles,react,plugins,runner(future)}` + `apps/{api,geostat,panel}`; libs → `@statdash/*` (keep `apps/geostat`=`national-accounts`, the tenant); Dockerfiles → app root; **update laws to match tree** (Law 7). Arrow folder-visible, same gate: `contracts←expr←core←charts←react←plugins←apps`; `contracts←api`.

**Roadmap:** 0 freeze/tag · 1 `@statdash/contracts` · 2 Dockerfiles→root · 3 fix workspace:*/alias · 4 `engine/`→`packages/` · 5 `@geostat/*`→`@statdash/*` (one-way door, before panel publish) · 6 layout/test convergence · 7 future `@statdash/runner` (YAGNI-gated by ADR-0026).

**Status:** Phases 0-4+6 ✅ DONE (783 tests green, arrow proven enforcing, laws reconciled). **Phase 5 (scope rename) — DECIDED GO** (lead, senior call: first-tenant erosion + pre-publish cheapest window + de-tenanting north-star). **Sequenced: execute as ONE atomic sweep when Constructor lanes A+B quiesce green** (rename touches every package.json name + import — can't run concurrent with active packages/+panel edits). Then green-gate + fitness ("no `@geostat/<lib>` survives") + resume C3/C5. ✅ Build now GREEN (react-dom peer resolved by Lane A — verified 2026-06-23: build:engine + typecheck + build:geostat green, 931 tests pass / 33 DB-skipped). Phase 5 is a ONE-WAY DOOR (irreversible atomic rename) — HELD for explicit user GO at the start of a focused session, NOT fired autonomously. Phase 3 alias-drop sequenced right after.

---

## Constructor (Phase 2) — Architecture (proposed)

Status: PROPOSED (design only; no panel code edited). Full ADR + rejected alternatives + fitness fns: architect memory `adr_constructor_phase2.md`. North star: "Constructor generates JSON, no code."

**Keep (build ON):** live WYSIWYG canvas using the REAL `NodePageRenderer`+overlay (`canvas/CanvasView.tsx`); open-registry palette (`paletteEntries.ts`); 3-layer store+undo/redo; flat→tree adapter (`canvasPageAdapter.ts`); DataSpec editors (no functions); append-only page_version FSM + atomic publish + AuditLogger (`config/pages.ts`); cube-profile discovery API. **PropSchema inspector seam is 88% populated** (15/17 node metas declare `schema`; `getSchema`/`describeRegistry`/`propSchemaToJsonSchema` exist).

**Gaps (close seams):** G1 no Inspector consumer (nothing reads `getSchema` to render a property panel — top leverage). G2 closed `CanvasNodeKind` enum vs open palette (Law-1/OCP). G3 empty-store-only preview. G4 DataSpec not cube-profile-bound. G5 no suggest-the-chart (conceptRole→panel). G6 publish/RBAC/i18n UI partial.

**Decision:** Tree + Inspector + live-Preview triad (Webflow/Builder.io/Grafana), NOT free-canvas (would break lossless round-trip). Consume+extend EXISTING `PropSchema` (reject parallel `editorMeta` — SSOT). Unify store on engine NodeDef (kill enum — Law 1). Palette = registry ∩ cube-profile ∩ actualRegion. Save emits only valid/complete/current-schema/serializable (fitness-enforced).

**Engine extensions:** `PropFieldType 'enum-ref'` (+`source`) and `PropField.coverage:'localized'`; backfill `schema` on `filter-bar`, `layout/card`, `panels/{chart,table,kpi-strip}`; optional `placeableInto()` + `GET /api/registry/manifest`; publisher role on POST `/:id/publish`.

**Roadmap (Strangler-Fig):** C0 schema completeness+manifest (engine) · C1 the Inspector+FieldControlRegistry+LocaleField (MVP) · C2 unify store `{type,variant,props,childIds}`+`fromNodePageConfig` · C3 cube-profile palette+actualRegion gate+`suggestPanels` · C4 publish/version/RBAC UI (unblocks P3-5) · C5 round-trip hardening+i18n shift-left. **MVP = C0+C1+C2+C4**.

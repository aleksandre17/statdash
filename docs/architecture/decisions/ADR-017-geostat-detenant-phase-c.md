---
title: Geostat De-tenanting (pure SDUI runner + portable re-loadable data)
status: Proposed
date: 2026-06-23
authors: architect
migrated_from: project_detenant_phase_c_adr (orig. ADR-0028 / ADR-0026 Phase C)
---

# ADR-017 — Geostat De-tenanting (Phase C) [orig. ADR-0028]

**Status:** Proposed (design; implementation is the next wave). Extends ADR-018 (bootstrap Phase B) and the bootstrap-runner ADR (Phase A).

## Context

`apps/geostat` still holds tenant data in TS modules (`data/{gdp,accounts,regional}/{raw,adapter,store}.ts` — the Phase-1 SSOT `*_FACTS/_CLASSIFIERS/_DISPLAY`). To make geostat a PURE generic SDUI runner, that data must move out. The upload format ALREADY exists (`format:'bundle'` in the ingest pipeline; `seed-pipeline-payloads.ts` already maps each bundle → the exact `Raw*Row[]`). Phase B already extracted pages/nav/chrome/site_config/modes/i18n. What remains is the DATA bundles + assets, and several consumers break on TS deletion.

## Decision

- **D1 — Serialize the EXISTING bundle `BronzePayload` to versioned files** under `ops/seed-data/geostat/` (sibling to `ops/postgres/migrations/`), in the exact `format:'bundle'` shape the pipeline already accepts (reuse the proven mapper — Strangler-Fig, not a new format).
- **Two-stage preservation:** stage-1 = the SQL gold seed (existing `seed.ts` idempotent path); stage-2 = pipeline upload of the bundle files.
- **A 4-way parity gate before any deletion:** `verify-parity.ts` (bundle projection == GET /observations) must pass before the TS is removed.

## Rejected Alternatives

1. **Invent a new upload/export format for the extracted data** — REJECTED: the ingest pipeline already accepts `format:'bundle'` and a mapper already produces the exact `Raw*Row[]`; a new format would be duplicate machinery (reuse the proven path).
2. **Delete the geostat TS bundles before the parity gate passes** — REJECTED: multiple consumers (`seed.ts`, `verify-parity.ts`, mocks, locale-coverage test, `buildManifest`) break on deletion; deletion is gated on 4-way parity (Strangler-Fig safety).

## Consequences

- Positive: geostat becomes a pure runner; tenant data is portable, GitOps-versioned, and re-loadable through the real pipeline; parity is proven before deletion.
- Negative / cost: `ops/seed-data/` must be created; the deletion wave must wait on the parity gate; consumers must be migrated off the TS bundles.

---

## Detailed Record (preserved verbatim from architect memory)

> Migrated from `.claude/agent-memory/architect/`. Backend/DB ADR family (see ADR-016, ADR-018).


# ADR-0028 — Geostat De-tenanting (ADR-0026 Phase C): pure runner + portable re-loadable data

Extends [[bootstrap-runner-adr]] (ADR-0026) + [[bootstrap-phase-b]]. Builds on [[ingestion-architecture]] (the upload target) and [[db-layer]] (gold cube). Status: Proposed 2026-06-23. Design only; implementation is the next wave.

## Context — what was VERIFIED in the code (not assumed)
- **The dataset bundles** (`apps/geostat/src/data/{gdp,accounts,regional}/{raw,adapter,store}.ts`) are the Phase-1 SSOT: `*_FACTS`, `*_CLASSIFIERS`, `*_DISPLAY`. GDP flat (geo constant 'GE'); regional surrogate-id facts + LTREE hierarchy (id→code at the Kimball boundary); accounts derived from `ACCOUNTS_2025` SDMX-JSON, plus flat `ACCOUNTS_FACTS/_CLASSIFIERS/_DISPLAY`. Labels are BARE Georgian strings (no {ka,en} bags). Package specifier is `@statdash/*` (engine/react/contracts), type-only in raw.ts (erases at runtime under tsx).
- **The upload format ALREADY EXISTS.** `apps/api/src/routes/ingest/schemas.ts` accepts `format: 'bundle'` for facts/codelists/displays. The worker's `parseBronze` reads `BronzePayload { obs?: RawObsRow[]; classifiers?: RawClassifierRow[]; displays?: RawDisplayRow[] }` (worker.ts L143). The Raw*Row shapes are in `apps/api/src/ingest/types.ts`. **`apps/api/scripts/seed-pipeline-payloads.ts` already maps each bundle → exactly these Raw*Row[]** (gdpObs/gdpClassifiers/gdpDisplays, etc.), and `seed-pipeline.ts seedViaPipeline()` already merges + POSTs them as `format:'bundle'`. The "uploadable files" are these payloads serialized to disk instead of POSTed in-memory — NOT a new format.
- **Stage-1 (SQL gold) already exists** as `seed.ts` direct path: idempotent INSERT…ON CONFLICT into stats.* gold, ACL-typed bundle import. `verify-parity.ts` is the live fitness gate (bundle projection == GET /observations, byte-tolerant).
- **Phase B already extracted** pages/nav/chrome/site_config/modes/i18n/indexPageId → `apps/api/provisioning/geostat.provisioning.json` via `apps/geostat/scripts/export-provisioning.ts`. That covers EVERYTHING under `src/pages/**` + `src/data/{nav.config,chrome-config,site-config,modes.config}.ts`. Phase C does NOT re-extract those — it extracts the remaining DATA bundles + assets, then deletes the TS.
- **Consumers that import the TS bundles** (break on deletion): `seed.ts`, `seed-pipeline-payloads.ts`, `verify-parity.ts` (all `../../geostat/src/data/**/raw.js`); `src/mocks/handlers/{gdp,accounts,regional}.ts` (serve raw over `/api/datasets/*` for VITE_STORE_MODE=api); `src/__tests__/locale-coverage.test.ts` (reads `listPages()` — already Phase-B content, dies when pages/ deleted); `src/data/site-manifest.ts buildManifest()` + `fetchApi()` (import the raw + adapters).
- **No `ops/seed-data/` exists yet.** `ops/` has only postgres migrations (per [[db-layer]]).

## DECISIONS

### D1 — Uploadable artifact: serialize the EXISTING bundle BronzePayload to versioned files (Strangler-Fig, reuse the proven mapper)
The portable SSOT is a per-dataset directory of pipeline-ready JSON, in the EXACT `format:'bundle'` shape the ingest pipeline accepts. Location: **`ops/seed-data/geostat/`** (sibling to `ops/postgres/migrations/` — both are tenant-provisioning data, GitOps-versioned, env-agnostic).

```
ops/seed-data/geostat/
  manifest.json                      # index: tenant id 'geostat', datasets[], publish order, content-hash per file
  codelists.bundle.json              # { classifiers: RawClassifierRow[] }   (cross-dataset merged, like seedViaPipeline step 1)
  displays.bundle.json               # { displays:    RawDisplayRow[] }      (cross-dataset merged, step 2)
  facts/GDP_ANNUAL.bundle.json       # { obs: RawObsRow[] }
  facts/ACCOUNTS_SEQUENCE.bundle.json
  facts/REGIONAL_GVA.bundle.json
```
WHY this shape, not raw `*_FACTS`:
- It is **already what the pipeline consumes** — zero new parser, zero new format. The id→code Kimball translation, the geo='GE' injection, the seqPos→obs_attribute move, the unit_measure/decimals metadata are ALL already encoded in `seed-pipeline-payloads.ts`. Serializing its output = the canonical, post-conform-ready artifact. (Postel: codes already resolved, so conform has nothing surrogate to fail on.)
- It makes Geostat **just-another-tenant**: a fresh platform loads it via the same Submission API a real curator uploads through. This is the ADR-0026 success test (a 2nd tenant from JSON, zero code) generalized to DATA.
- A NEW committed script `apps/api/scripts/export-seed-data.ts` (the data analogue of Phase-B's `export-provisioning.ts`) imports the bundles + reuses the `seed-pipeline-payloads.ts` builders and writes these files with stable key order (the same `canonicalize`/`stableStringify` discipline). One GENERATE step; the script stays in-repo so re-gen from TS is one command until deletion.
REJECTED: CSV/xlsx-rows format (lossy for nested obs_attribute + metadata; the pipeline's `bundle` is the lossless native form). REJECTED: copying raw `*_FACTS` verbatim (would re-implement the id→code/geo-inject/seqPos mapping in a NEW consumer = SSOT duplication + drift; the mapper already exists — reuse it).

### D2 — Two-stage preservation, ONE source, derived not divergent (the SQL seed = stage 1)
The user's "first stage a SQL seed so it's not lost" is a SAFETY NET that must exist BEFORE deletion. Both stages derive from the SAME extracted files — never two hand-authored SSOTs.

- **Stage 1 (guaranteed preservation — `.sql` dump loaded by Flyway repeatable migration):** a generated `ops/postgres/seed/R__seed_geostat_gold.sql` (Flyway **repeatable** `R__` migration — runs after versioned, re-runs on checksum change, idempotent INSERT…ON CONFLICT) containing the GOLD cube rows (stats.dimension/classifier/classifier_display/observation) for the three datasets. GENERATED by a script that runs the EXISTING `seed.ts` projection logic against the extracted files and emits SQL (not hand-written). This is the durable, restore-from-nothing artifact: `flyway migrate` reconstructs the exact gold cube with no API, no engine, no TS. It is "stage 1" because it bypasses bronze→silver and lands gold directly — fastest, surest preservation.
  - WHY Flyway `R__` not a versioned `Vnn`: seed DATA is not schema and must re-converge when the data changes; a `Vnn` is immutable-once-applied (Law: never edit an applied migration). Repeatable + idempotent INSERT = re-runnable preservation without violating Flyway's append-only versioned contract. Reconciles with "Flyway owns schema, seed.ts owns data": schema stays in `Vnn`; this is a clearly-namespaced `ops/postgres/seed/R__*` lane, generated, reviewable.
- **Stage 2 (proper ingestion — pipeline upload):** the `ops/seed-data/geostat/*.bundle.json` files POSTed through bronze→silver→gold via the Submission API (the existing `seed-pipeline.ts` flow, re-pointed to READ the files instead of importing TS). This exercises conform/validate/publish + provenance (observation_revision, release) — the production-grade path a real tenant uses.
- **Relationship (no divergence):** the extracted bundle files (D1) are the SSOT. Stage-1 SQL is GENERATED from them (via the seed.ts projection). Stage-2 loads them directly. A fitness test asserts stage-1-gold == stage-2-gold == bundle-projection (D5) so the two stages can never drift.
REJECTED: `seed.ts` re-pointed to consume the files as the ONLY preservation (no SQL) — fails the user's explicit "SQL seed so it's not lost" + leaves preservation dependent on a running API/tsx. REJECTED: a versioned `Vnn` seed migration with the data inline — immutable-once-applied conflicts with data evolution.

### D3 — What apps/geostat BECOMES (the pure runner) — enumerated STAYS vs DELETED
**STAYS (the generic shell — names nothing Geostat):**
- `src/main.tsx`, `src/app/**` (App, LocaleGuard, PageLoader, providers) — the render path, already fully data-driven via nodeRegistry + injected stores.
- `src/setupRegistrations.ts` (microkernel: compiled-in node/panel/mode registry) — but mode DEFINITIONS move to manifest.modes (already Phase-B'd into site_config.modes); the file keeps only `*.register()` wiring, no Georgian labels.
- `src/data/site-manifest.ts` — but gutted to the API path only: `fetchBootstrap`, `resolveManifest`, `bootstrapSite`, `fetchStats`/`fetchStoreManifest` (the live-stats store path), the SiteManifest/SiteBootstrap types. See D4 for buildManifest's fate.
- `src/data/stats-api.ts`, `src/data/fetch-store-manifest.ts`, `src/data/stats-registrations.ts` — the generic stats-API client + store-manifest-from-config.data_source path. Stays (it is the runner's data port).
- `src/i18n/formatters.ts` + the i18n machinery — but locale list derives from manifest.i18n.locales (Phase-B). `src/i18n/feedback.ts` (UI chrome strings) — KEEP if generic; if it carries Geostat copy, move to chrome_config/site_config (tenant content) — audit at implementation.
- The extensions/plugin mechanism, all `engine/*` (untouched — those are the framework).

**DELETED (tenant content — now lives as seed data / provisioning):**
- `src/data/{gdp,accounts,regional}/**` (raw/adapter/store) — extracted to `ops/seed-data/geostat/` (D1). The adapters (fromGDPFacts etc. = typed identities) die with them; the live path uses the generic stats-api ApiStore, not these.
- `src/data/store-manifest.ts` (STORE_MANIFEST = the static ExternalStore fallback) + `src/data/metrics.ts` + `src/data/modes.config.ts`/`nav.config.ts`/`chrome-config.ts`/`site-config.ts` (all already in geostat.provisioning.json).
- `src/pages/**` (all page configs — already in provisioning.json).
- `src/mocks/**` (the MSW `/api/datasets/*` Layer-2 path — its whole reason was serving the static bundles; with content in the DB the runner uses VITE_STORE_MODE=stats against the real API). DELETE the mocks; the offline story is the API's seeded DB, not MSW.
- `src/assets/{hero.png,img.png,GDP.xlsx,region.xlsx,ORIENTIRES}` + `public/data/georgia-regions.geojson` — tenant assets (D6). `react.svg`/`vite.svg` are generic scaffolding — keep or drop, immaterial.
- `src/data/{export-provisioning.fitness.test.ts, stats-api.test.ts}` reviewed: stats-api.test stays (tests the generic client); export-provisioning fitness moves with the export tooling.

### D4 — buildManifest's fate: REPLACE with a minimal generic EMPTY-STATE fallback (not delete, not keep Geostat)
With content gone, `buildManifest()` has nothing Geostat to assemble — but the runner MUST still boot to something sane if /api/bootstrap is down or unconfigured (resilience / graceful degradation — the Phase-A reversibility gate must not vanish). DECISION: replace the Geostat-content fallback with a tiny **generic empty SiteManifest** baked into the runner:
```
emptyManifest(): SiteManifest = {
  pages: { '__offline': <a generic "site unavailable / not configured" NodePageConfig> },
  indexPageId: '__offline', nav: [], chrome: {}, chromeConfig: <neutral brand>,
  i18n: { locales:['en'], defaultLocale:'en', fallbackLocale:'en' }, modes: [], datasources: []
}
```
WHY not delete entirely (API-only): a hard dependency on the API at boot makes the runner un-bootable when unconfigured — violates fail-soft + the "runner shows something sane" requirement. A generic empty state is tenant-AGNOSTIC (Law 1) and astonishment-free (Principle of Least Astonishment: an unconfigured runner says so, it does not crash). WHY not keep Geostat content: that is the whole point of Phase C — zero brand in the runner. The empty page config must use locale-agnostic copy ('en' only) per [[engine-react-locale-agnostic]]. `resolveManifest()` keeps its try/fetch → catch → `emptyManifest()` shape; the only change is the fallback target.

### D5 — Consumer redesign (what to consume / add after extraction)
- **`seed.ts`** (stage-1 SQL generator + direct loader): re-point its bundle import to READ `ops/seed-data/geostat/*.bundle.json` instead of `../../geostat/src/data/**/raw.js`. Its projection logic is UNCHANGED (the files already carry resolved codes, so the id→code/geo-inject steps become identity — or, cleaner, split a `project-gold.ts` the SQL-emitter and the direct-loader share). It also gains a `--emit-sql` mode that writes `R__seed_geostat_gold.sql`.
- **`seed-pipeline-payloads.ts`**: DELETE the bundle import + mappers; the files ARE the payloads now. `seed-pipeline.ts` reads the 5 files and POSTs them (it already merges + POSTs identical shapes). The mapper logic moves INTO `export-seed-data.ts` (the one-time generator) — it runs ONCE at extraction, not on every seed.
- **`verify-parity.ts`**: re-point its Phase-1 reference from the TS bundles to the extracted files (parse `facts/*.bundle.json` → ParityRow). The Phase-2 side (GET /observations) is unchanged. It remains the live gate that stage-2-gold matches the files.
- **`locale-coverage.test.ts`**: it reads `listPages()` (Phase-B content). After `src/pages/**` deletion it must read the committed `geostat.provisioning.json` pages[] instead (or move to apps/api as a provisioning-artifact fitness test). It is a provisioning-artifact check now, not a runner test.
- **mocks**: DELETED (D3) — no redesign.
- **ADD:** `export-seed-data.ts` (generator), `R__seed_geostat_gold.sql` (generated), the `ops/seed-data/geostat/` files, a `seed-data.fitness.test.ts` (D5 parity-of-stages).

### D6 — assets / geojson (binary / non-tabular tenant content)
Hero image, georgia-regions.geojson, source xlsx are tenant assets, NOT runner code. DECISION: a tenant asset store served by the API. Minimal now (YAGNI): a committed `ops/seed-data/geostat/assets/` dir + the API serves them under a tenant-namespaced static path (e.g. `GET /api/tenant/geostat/assets/*` or a generic `/assets/:tenant/*`), and chrome_config/page configs reference assets by that URL (they already reference by path). The map node already loads geojson by URL — point it at the served path. WHY not bundle into the runner: that re-tenants the runner (Law 1). WHY not S3/object-store now: YAGNI — a served committed dir is the reversible minimal seam; promote to object storage when a real tenant needs upload-at-runtime (mirrors the ADR-0026 "compiled-in until a 2nd tenant is real" line). The source xlsx (`GDP.xlsx`, `region.xlsx`) are PROVENANCE, not runtime — they belong in `ops/seed-data/geostat/source/` as the human-auditable origin of the bundles, never served.

## SAFETY SEQUENCE — the parity gate that proves preservation BEFORE deletion (one-way door)
Deletion of the TS bundles is the irreversible step (one-way door — gets max scrutiny). It is gated behind a THREE-WAY parity proof + a git tag:

1. **EXTRACT** (additive, reversible): write `export-seed-data.ts`; generate `ops/seed-data/geostat/*.bundle.json` + `source/` + `assets/`. Generate `R__seed_geostat_gold.sql`. Nothing deleted. Commit.
2. **PROVE** (the gate): a fitness test asserting **bundle-files-projection == stage-1-SQL-gold == stage-2-pipeline-gold == CURRENT-TS-bundle-projection**, all four normalized to ParityRow (verify-parity's canonical shape), byte-for-byte within tolerance. This proves the extracted files reproduce the EXACT current cube before any TS dies. The 4th term (current TS) is the reversibility anchor — it is the ONLY step where TS and files coexist and are compared.
3. **TAG** the pre-deletion commit (`pre-detenant-phase-c`) — the rollback point (per ADR-0026 Phase C gate).
4. **STRIP** (the one-way door, only after 2+3 green): delete the TS bundles, mocks, pages, configs, assets-in-src; re-point seed.ts/verify-parity/locale-coverage to the files; replace buildManifest with emptyManifest.
5. **VERIFY RUNNER BOOTS GENERIC**: (a) with API up + seeded DB → runner renders geostat identically (the ADR-0026 Phase-A snapshot parity, now from DB only); (b) with API DOWN → runner boots the empty-state, does not crash; (c) the ADR-0026 success test — a 2nd toy tenant from JSON renders zero-code.

## ALIGNMENT WITH LAWS
- **Law 1 (no privileged dims / tenant-agnostic):** the runner names nothing Geostat; data + brand + assets are all tenant input. The empty-state fallback is generic.
- **Law 5 (API-readiness):** the extracted files ARE the "swap DataStore in one param" principle generalized — Geostat becomes loadable through the same ingest API a real source uses.
- **Law 6/7 (best solution / architecture leads):** reuse the EXISTING bundle format + mapper + seed projection (root-cause, no new parser); legacy TS migrates to seed data (Strangler-Fig), the runner is the target.
- **SSOT:** one source (the extracted files); SQL stage-1 + pipeline stage-2 both DERIVE from it; the 4-way parity gate enforces non-divergence.
- **One-way door:** deletion gated behind a parity proof + git tag (max scrutiny on the irreversible step).
- **Named patterns:** Medallion (bronze→silver→gold) for stage-2; Pipe-and-Filter (export → preserve → prove → strip); Strangler-Fig (TS → seed data); Anti-Corruption Layer (seed.ts ACL retained); Idempotent Receiver (ON CONFLICT + content-hash); GitOps (ops/seed-data committed + loaded on boot).

## REJECTED ALTERNATIVES (architecture-level)
1. **A bespoke new export format** for the uploadable files — rejected: the pipeline's `format:'bundle'` is the lossless native form and the mapper already exists; a new format = new parser + drift (DRY/SSOT violation).
2. **Only a pipeline upload, no SQL seed** — rejected: fails the user's explicit "SQL seed so it's not lost" + ties preservation to a running API; the gold SQL dump is the restore-from-nothing net.
3. **Two hand-authored SSOTs (SQL + files written independently)** — rejected: divergence risk; both must derive from one extracted source, enforced by the parity gate.
4. **Delete buildManifest, runner is API-only** — rejected: un-bootable when unconfigured; violates fail-soft + "show something sane". Replaced with a generic empty-state.
5. **Bundle assets into the runner** — rejected: re-tenants the runner (Law 1). Served from a tenant asset path instead.
6. **Delete TS before proving parity** — rejected: that is the unguarded one-way door; the 4-way parity gate + tag must come first.

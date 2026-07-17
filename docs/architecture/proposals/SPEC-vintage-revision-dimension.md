---
title: Vintage / Release-Time as a First-Class PORT Dimension
status: Proposal (audit + design; NO code changes)
date: 2026-07-11
authors: platform-architect
supersedes-scope: extends ADR-0025 (DB layer) upward into the engine/port/semantic/Constructor layers
related: ADR-0025 (vintage-as-release, DB), ADR-034 (semantic query plane), ADR-024 (reactive graph / extractDeps)
---

# SPEC — Vintage / Release-Time as a First-Class Port Dimension

> **The gate this answers:** *Is the data foundation anti-pattern-free and canonically sound to carry a first-class `vintage` (release-time) dimension — and if not, what rot must be fixed FIRST?*
> **Scope of this document:** AUDIT + DESIGN only. No migrations, no code, no prod. It defines the canonical, Strangler-Fig sequence to make vintage expressible as `ctx.dims['vintage']` end-to-end, on a foundation proven sound.

---

## 0. Executive Summary — the Verdict

**VERDICT: the foundation is SOUND, not rotten. The mission's core fear — "a revision OVERWRITES the prior value; history is destroyed" — is UNFOUNDED.** The DB already implements an ALFRED/FRED-grade *real-time (vintage) database*: the current cube is single-valued-current, and every superseded value is preserved as a **release-keyed closed validity interval** in an append-only pre-image log. A working **as-of reconstruction** (`queryAsOf`, `buildAsOfSql`) and a **release/vintage REST surface** already exist. Law 1 is honored at the engine: the store's matching loop iterates `ctx.dims` generically, with no privileged-time special-casing.

**What is MISSING is not integrity — it is REACH.** Vintage lives at the DB+REST layer but is **not yet expressible as a coordinate through the DataSource PORT**, so the semantic layer, `extractDeps`, and the Constructor cannot treat "as of 2021-Q1 vs latest" as just another dimension. Closing that reach is additive and reversible.

**The canonical insight (why this is a GOOD story, not a rebuild):** vintage is a **bitemporal axis** — exposed at the port as a generic peer dim (`ctx.dims['vintage']`), physically realized by the as-of overlay. This is *exactly* how ALFRED exposes `vintage_dates` / `realtime_start` as query parameters over a bitemporally-stored series. It **reconciles** Law 1 (vintage = a generic peer dim) with the sound physical model (release + pre-image log, NOT `dim_key` bloat). The DataSource port is precisely the abstraction seam where the logical-dim → physical-as-of translation belongs (Law 2: logic in the port, not config).

### Sound-or-rot ledger

| # | Finding | Class | Evidence |
|---|---------|-------|----------|
| S1 | History is preserved on revision (append-only pre-image log, release-keyed validity intervals) | **SOUND** | `V8` capture trigger + `V25` `set_by`/`superseded_by_release_id`; `upsert.ts` `DO UPDATE` fires the pre-image capture |
| S2 | As-of vintage reconstruction is BUILT (not just designed) | **SOUND** | `observations.ts` `queryAsOf` + `buildAsOfSql` (live ∪ pre-image, `DISTINCT ON` covering interval); `releases.ts` `GET /:id/observations` |
| S3 | Law 1 honored at the engine — generic `ctx.dims`, no privileged-time branch | **SOUND** | `matchedValues` iterates `ctx.dims`; `TIME_DIM`/`MEASURE_DIM` are named SSOT conventions, not branches; no `ctx.year` found |
| S4 | `extractDeps` / reactive graph would carry a vintage dim GENERICALLY, zero new code | **SOUND** | `NodeDeps.dims` is `ReadonlySet<string>`; `scanObsQuery`/`addAmbient`/`sweepRefs` are generic-key |
| G1 | The store PORT (`StoreQuery`) has NO as-of/vintage coordinate; `ApiStore` never sends `?asOf=` | **GAP** (additive) | `store.ts` `StoreQuery` union; `store-api.ts` wire = `from`/`to`/`filter` only |
| G2 | No governed `vintage` dimension, no `revision` metric in the semantic layer | **GAP** (additive) | `dimension.ts` / `metric.ts` registries have the machinery, not the entries |
| G3 | `fromSDMX`/ingest does not capture SDMX release/real-time versioning into the release aggregate | **GAP** (additive) | ingest `conform.ts` / DSD path carries no `REPORTING`/`EXTRACTED`/vintage concept |
| **R1** | **A non-publish writer can revise `obs_value` without a release context** → pre-image gets `superseded_by_release_id = NULL` → the as-of overlay cannot place that revision on the timeline (open-ended hole) | **ROT-TO-FIX-FIRST** | `publish.ts` sets `app.release_id` correctly, but the ADR-0025 fitness function ("every post-genesis revision has non-null `superseded_by`") appears **designed, not implemented** — no test found |
| **R2** | Pre-image stores only `dim_key_hash`; `buildAsOfSql` recovers `dim_key` by **LEFT JOIN to the live row**. A **discontinued series** (live row deleted / no longer in latest vintage) → `dim_key` unrecoverable → that historical series **vanishes** from as-of reads | **ROT-TO-FIX-FIRST** | `observations.ts` preimg leg `LEFT JOIN stats.observation live_obs … ` |
| R3 | `observation.release_id → release` is intentionally not FK-enforced (hypertable hot path) | ACCEPTED risk | `V25` §2 comment; mitigation = periodic integrity check |

**The gate's answer:** BUILD may proceed — but **R1 and R2 are the "don't build on rot" items and must be closed FIRST** (they are DB-integrity gates on the *trustworthiness of the vintage timeline itself*, independent of the port work). R1 and R2 are small, additive, and testable. Everything else (G1–G3) is the additive reach-extension the innovation needs, and it is Law-1-clean.

---

## 1. Ground Truth — how a datum is keyed today

`stats.observation` (V4) keys a datum by **`(dataset_code, time_period, dim_key_hash, time_period_date)`** — a UNIQUE index, and the `ON CONFLICT … DO UPDATE` target of the sole writer (`upsert.ts::upsertObservation`). So the **current cube is single-valued per (series × period)**: a new release **overwrites** `obs_value`.

**But that overwrite is non-destructive**, because it is guarded by two triggers:
- **V8 `capture_observation_revision`** (BEFORE UPDATE OF `obs_value`/`obs_status`/`obs_attribute`, `IS DISTINCT FROM` guard) writes the **pre-image** to `stats.observation_revision`.
- **V25 extension** stamps that pre-image with `set_by_release_id` (= `OLD.release_id`, the release that set the now-old value) and `superseded_by_release_id` (= the publishing release from the `app.release_id` GUC), plus stamps the live row's `release_id`.

**Result:** every value the cube ever held survives as a pre-image whose validity interval is `[set_by.published_at, superseded_by.published_at)`. This is a textbook **bitemporal / real-time database** (ALFRED's `realtime_start` / `realtime_end`). `time_period` = *event time*; `release.published_at` = *knowledge/decision time*.

**Two temporal axes, neither in `dim_key`:**
- *Event time* (`time`) → hoisted to its own column `time_period` + `time_period_date` (the TimescaleDB partition dimension), marked `is_time_dim`. Privileged **at the storage layer** for partitioning, NOT at the engine.
- *Vintage* (release time) → a release stamp + pre-image validity interval, reconstructed by an as-of overlay. NOT in `dim_key`.

So **"vintage as just another `dim_key` dim" is not the model — and correctly so.** ADR-0025 rejected full SCD-2-in-the-hot-table (rejected-alt #1) for sound reasons: a TimescaleDB unique index must include the partition column; `valid_from`/`valid_to` fight compression; it doubles the hottest table. The pre-image log already *is* the history store — reuse it (SSOT), don't duplicate.

---

## 2. The reconciliation — vintage is a BITEMPORAL PORT coordinate

The mission's ambition (Law 1): *"vintage SHOULD already be expressible as just another dim — `ctx.dims['vintage']`."* This is **correct at the logical/port layer** and does NOT require putting vintage in `dim_key`. The DataSource port is the abstraction seam:

```
CONFIG / SEMANTIC LAYER        PORT (DataStore)              PHYSICAL STORE
─────────────────────────      ────────────────────          ─────────────────────
ctx.dims['vintage'] =       →  ApiStore reads the       →   GET /observations?asOf=<D>
  <ISO instant | release-id      reserved VINTAGE_DIM          → queryAsOf overlay
  | 'latest'>                    coordinate, translates        (live ∪ pre-image,
                                 to the as-of read;            DISTINCT ON covering
a 'vintage' PERSPECTIVE axis     EXCLUDES it from the          interval)
or FILTER bar (Constructor)      structural dim_key filter
```

This is the **ALFRED pattern**: the vintage date is a *query dimension* over a bitemporally-stored series. The dim is generic at `ctx` / `extractDeps` / semantic / Constructor; the store's translation of it to an as-of query is port logic (Law 2). No dimension is privileged (Law 1) — `vintage` becomes the **third named SSOT convention** the port threads specially, exactly as `time` (→ `from`/`to`) and `measure` (→ the `val` code axis) already are. The precedent is established and canonical.

### Why a reserved-dim convention, not a `StoreQuery.asOf` field (decision)

- **Reserved dim `VINTAGE_DIM = 'vintage'` in `ctx.dims`** (RECOMMENDED). Vintage becomes first-class in exactly the way `time` and `measure` already are. It flows through `extractDeps` (a generic dim-key Set) and the Constructor's **filter-bar / perspective-axis** machinery for **free** — an author adds a "vintage" perspective axis with states `{latest, 2021-Q1, 2022-Q1, …}` and **zero new machinery** (VISION #3 orthogonal regions). Maximal decoupling: authored once, orthogonal to every other axis. Cost: the store must know to NOT pass `vintage` to `buildObsFilterParam` (same handling `time` already gets).
- **A `StoreQuery.asOf` field on every discriminant** (REJECTED). More explicit, but duplicated onto every query type, and it does NOT flow through the generic dim machinery — so it would NOT be Constructor-authorable as a filter/perspective without bespoke wiring. Less Law-1-generic; loses the free reach.

---

## 3. Rot-to-fix-FIRST (the "don't build on an anti-pattern" gate)

These are DB-integrity gates on the trustworthiness of the vintage timeline. They are independent of the port work and must land **before** vintage reads are trusted end-to-end. Both are small, additive, `⇄` reversible.

### R1 — Enforce release-context on every fact-revision (no un-released revision)
**Problem.** `publish.ts` correctly `SET LOCAL app.release_id` around fact writes, so the *publish path* is safe. But nothing PREVENTS another writer (a raw seed/backfill script, a future ETL) from `UPDATE`-ing `obs_value` with no release GUC. That produces a pre-image with `superseded_by_release_id = NULL` — an **open-ended validity interval** the as-of overlay cannot place on the timeline. The ADR-0025 fitness function ("every post-genesis `observation_revision` has non-null `superseded_by_release_id`") is **designed but not found implemented**.
**Fix (design).** Make the invariant executable:
1. A **fitness test** (SQL assertion): after any publish, `SELECT count(*) FROM stats.observation_revision WHERE superseded_by_release_id IS NULL AND revised_at > <genesis cutoff>` = 0. `⇄`
2. Optionally a **BEFORE UPDATE guard trigger**: reject a value-changing `obs_value` update when `app.release_id` is unset AND `app.dry_run` is not set (fail-fast — a revision without a release is a bug). `⇄` (drop the trigger to revert). Class-M, GUC-gated (byte-identical when the GUC is set).

### R2 — Preserve the pre-image `dim_key` (survive discontinued series)
**Problem.** The pre-image stores only `dim_key_hash`; `buildAsOfSql`'s preimg leg recovers `dim_key` by `LEFT JOIN` to the **live** observation for the same series. If a series is **discontinued** (its live row is deleted, or the dim member disappears from the latest vintage), the join yields `NULL` `dim_key` — the historical series **vanishes** from as-of reads. A vintage database that cannot reconstruct a discontinued series is not vintage-complete.
**Fix (design).** Store `dim_key` (the full jsonb, not just its hash) on `stats.observation_revision` going forward (additive `ADD COLUMN`, metadata-only), and have the capture trigger copy `OLD.dim_key`. Backfill best-effort from live rows where still joinable; flag the unrecoverable pre-genesis remainder (never invent). Then `buildAsOfSql` reads the pre-image's own `dim_key` (drop the fragile self-join). `⇄` additive.

### R3 — (accepted) periodic FK-integrity check on `observation.release_id`
Not a blocker. A scheduled assertion that every non-null `release_id` resolves to a `stats.release` row, since the FK is deliberately not enforced on the hot path.

---

## 4. The canonical build sequence (Strangler-Fig, reversible, additive)

Every step is byte-identical when `vintage` is absent (Postel / N=1-free). Tags: `⇄` two-way reversible · `⛔` one-way door (contract freeze).

### M0 — Close the integrity gates (PREREQUISITE)
- **R1** fitness test (+ optional guard trigger). `⇄`
- **R2** pre-image `dim_key` column + capture-trigger copy + `buildAsOfSql` read-from-self. `⇄`
- *Exit:* the vintage timeline is provably hole-free and discontinuation-safe. **Only after this does the port work build on proven-sound rock.**

### M1 — The PORT coordinate `⛔ (contract)`
- Add `VINTAGE_DIM = 'vintage'` SSOT constant (peer of `TIME_DIM`/`MEASURE_DIM`, `core/context.ts`).
- Add `StoreCaps.asOf?: boolean` (capability discovery — the palette introspects which stores can serve a vintage).
- **`ApiStore`**: if `ctx.dims[VINTAGE_DIM]` is present and ≠ `'latest'`/`''` → resolve to an instant (ISO passthrough, or resolve a release-id → `published_at` via a tiny `/releases/:id` lookup) → append `?asOf=<D>` to the wire; and **exclude `vintage` from `buildObsFilterParam`** (it is bitemporal, not structural). Absent/`'latest'` ⇒ byte-identical to today.
- **`ExternalStore`**: config datasets are single-vintage by default (Postel: ignore a `vintage` coordinate) OR, when observations carry a `vintage`/`releasePublishedAt` field, apply a small as-of reducer (rows with `published_at <= D`, latest wins). Generic — no privileged dim.
- **Fitness:** `FF-VINTAGE-PORT` — a `val`/`obs` read with `ctx.dims.vintage` absent is byte-identical to pre-M1; with a vintage present, `ApiStore` emits `?asOf=` and drops `vintage` from the structural filter.
- *Why `⛔`:* the reserved-dim semantics + `?asOf=` wire contract is a boundary other layers bind to. Freeze it deliberately.

### M2 — The semantic layer `⇄`
- `registerDimension('vintage', { code:'vintage', conceptRole:'vintage', label:{…}, defaultMember:'latest', description })` — a **governed dimension** the Constructor palette surfaces (peer of `metric.ts`). Its members are the dataset's releases (from `/releases`), read at runtime (Law 5), never copied into config.
- A governed **`revision` MetricDef** — a computed metric = `value @ vintageB − value @ vintageA` (or `latest − asOf(D)`), declared through the existing metric grammar (`at`/`by`/`time`) now that the port can read at a vintage coordinate. This is the "governed revision metric": the revision magnitude becomes a first-class, Constructor-selectable measure.
- **Fitness:** `FF-REVISION-METRIC` — `resolveMeasureRef('revision')` expands to the two vintage-pinned reads; a raw-code path stays byte-identical.

### M3 — The reactive graph (VERIFY, no code) `⇄`
- `extractDeps` already carries a vintage dim generically: a spec binding `{ $ctx: 'vintage' }`, a `vintage` perspective axis (`visibleWhen`), or an ambient `vintage` dim flows into `deps.dims` with **zero new code** (`scanObsQuery` / `addAmbient` / `sweepRefs` are all generic-key). A vintage change re-fires exactly the nodes that read it.
- **Fitness:** `FF-VINTAGE-DEPS` — `extractDeps` of a vintage-bound node includes `'vintage'` in `deps.dims`; a node that does not read vintage does not re-fire on a vintage change.

### M4 — The Constructor-authored revision views `⇄`
- **Vintage as a PERSPECTIVE axis** — the author adds a "vintage" axis (VISION #3 orthogonal regions) with states `{latest, <release labels>}`; the existing `perspectiveState` + `visibleWhen` machinery scopes reads to the active vintage with no new machinery. "GDP as known in 2021-Q1 vs latest" = flipping the axis.
- **Vintage as a FILTER bar** — a `select`/`year-select` param bound to `VINTAGE_DIM`, offering the dataset's releases; picking one pins `ctx.dims.vintage`.
- **Revision triangle** = a declarative table/heatmap node: `time_period` on one axis, `vintage` on the other, bound to the `revision` metric (or two vintage-pinned reads). Fully declarative, Constructor-authorable, lossless round-trip (Law 2). The frontier view — *no BI tool ships this* — falls out of the grammar for free.

### Sketch — end-to-end (store → semantic → metric → Constructor view)
```
Author drops a "Revision Triangle" (Constructor palette shows it because
  StoreCaps.asOf === true and a governed 'vintage' dimension is registered)
        │
        ▼   declarative config (Law 2 — data + intent, no logic)
{ type: 'heatmap',
  data: { type:'metric', metric:'revision', by:['time','vintage'], time:{…} },
  encoding: { x:{field:'time'}, y:{field:'vintage'}, color:{field:'value'} } }
        │
        ▼   extractDeps (M3, already generic) → deps.dims ⊇ {time, vintage}
        │   reactive graph subscribes the node to time + vintage
        ▼
interpretSpec → resolveMeasureRef('revision') expands to two reads:
   storeVal(code, { ...dims, vintage:'latest' }) − storeVal(code, { ...dims, vintage:'2021-Q1' })
        │
        ▼   PORT (M1): ApiStore threads vintage → ?asOf=
GET /api/stats/observations?dataset=GDP&from=…&to=…&asOf=2021-03-31
        │
        ▼   PHYSICAL (sound today): queryAsOf overlay (live ∪ pre-image,
            DISTINCT ON covering interval) → the series AS KNOWN at that instant
```

---

## 5. Law compliance

- **Law 1 (no privileged dims):** `vintage` is a generic peer in `ctx.dims`; the store threads it as a named convention exactly like `time`/`measure` — not a branch in the domain. The engine's matching loop stays generic.
- **Law 2 (declarative; logic in the renderer):** vintage coordinate + revision metric + revision-triangle view are pure config data; the logical-dim → as-of translation is port logic, never config. No functions in config.
- **Law 4 (standards whole):** adopts the SDMX/ECB release model (already in ADR-0025) and the ALFRED/FRED real-time-database concept (vintage date as a query dimension over a bitemporal store) — whole, in their best form. Revision triangles = OECD revision-analysis standard.
- **Law 5 (`fromSDMX` only adapter):** the release/vintage concept is captured at the ingest boundary (G3, additive); members read from the DSD/releases at runtime, never duplicated in config.
- **Dependency arrow:** `VINTAGE_DIM` in `core/context`; port logic in `core/data`; semantic entries in `core/data`; Constructor surfaces via `describeApp()`. No arrow violation.

## 6. Fitness functions (the invariants, as executable gates)
- `FF-VINTAGE-TIMELINE-COMPLETE` (R1) — no post-genesis pre-image with NULL `superseded_by_release_id`.
- `FF-VINTAGE-DISCONTINUATION-SAFE` (R2) — a discontinued series remains reconstructable as-of.
- `FF-VINTAGE-PORT` (M1) — vintage-absent read is byte-identical; vintage-present emits `?asOf=` and drops `vintage` from the structural filter.
- `FF-REVISION-METRIC` (M2) — `revision` expands to two vintage-pinned reads; raw-code byte-identical.
- `FF-VINTAGE-DEPS` (M3) — `extractDeps` carries `vintage` generically.

## 7. Open questions for the orchestrator / database-architect
1. **R1 guard trigger** — reject un-released `obs_value` revisions outright, or fitness-test only? (fail-fast vs. tolerate seed paths). database-architect to weigh.
2. **Vintage coordinate value type** — ISO instant, release-id UUID, or both (union)? Recommend: accept both, resolve id→`published_at` at the port.
3. **`ExternalStore` vintage** — do config-file datasets need multi-vintage support (for demos/tests), or is single-vintage + Postel sufficient for Phase 2? (YAGNI check.)
4. **G3 scope** — which SDMX-JSON version/real-time fields does `conform.ts` capture into the release aggregate, and when (before or after M1)?

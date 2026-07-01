---
name: adr-time-range-readiness-seam
description: Canonical seam for sourcing a dataset's available TIME RANGE so a year-select default {from:options,pick:last} resolves to the real latest year on the live async store WITHOUT hanging. VERDICT = A-variant (store-builder folds server time coverage into store.classifiers['time'], keeping the synchronous getOptions path; time stays a generic classifier per Law 1). Endpoint = cube profile gains timeCoverage (min/max + distinct periods) from existing cube_actual_region. Zero config migration. Plus 2 defense-in-depth guards (toObsParams omit from/to on unset; autoParse year-select no-value sentinel).
metadata:
  type: project
---

# ADR — Time-Range Readiness Seam (year-select `pick:'last'` on the live store)

Closes the last data-render blocker on the geostat front: GDP `year-bar` `year` default
`{from:'options', pick:'last'}` must resolve to the REAL latest period (e.g. 2025) on the
live async (`ApiStore`) path, and must RESOLVE — never hang.

## Context — the exact failure (verified in code, not the brief)

The year-select default resolution is a **fully synchronous, classifier-backed** path. It
never touches `queryAsync`:

```
useFilterState.getOptions(key='year')                         (react/filters/useFilterState.ts:87-109)
  → resolveYears(def.years, store, STUB_CTX)                  (core/data/resolve.ts:57-72)
    → resolveRaw(inline {$cl:'time'})                         (resolve.ts:29-38)
      → resolveRef({$cl:'time'}, { classifiers: store.classifiers, … })   (core/ref/ref.ts:118-136)
        → store.classifiers['time']                           ← NEVER POPULATED
```

`store.classifiers` is an in-memory `Record<string,Classifier>` the store-builder fills at
build time for `nonTimeDims` ONLY (`plugins/datasources/stats-registrations.ts:111-116`);
`time` is excluded by design. So `resolveYears` returns `[]` → `resolveDefaults` Tier-3 sets
`dims['year']=''` (`core/config/filter-eval.ts:170-177`) → `autoParse` coerces `''` to `0`
(`filter-eval.ts:19`) → `toObsParams` emits `from=0&to=0` (`core/data/store-api.ts:204-215`)
→ API 400 (`sdmxTimePeriod` regex rejects `0`, `apps/api/.../stats/observations.ts:32-37`).

Why the react-specialist correctly REFUSED a gate-on-the-classifier fix: `store.classifiers['time']`
is never populated on ANY path, so a filter gate that waits for it waits forever. Gating is
only safe if something actually RESOLVES the wait.

Two more load-bearing facts the brief implied but the code confirms:
- **The server ALREADY has the time range.** `stats.cube_actual_region` (V26) carries
  `first_time_period` / `last_time_period` per realised dim-key combination — read today by
  `loadActualRegion` (`apps/api/src/routes/cube/actual-region.ts:103-118`) and already shipped
  in the cube-profile bundle (per-combination, not as a dataset time axis).
- **`StoreQuery` already declares a `distinct` discriminant** (`core/data/store.ts:43-44`) —
  but `ApiStore.caps.queryTypes=['obs','val']` omits it and nothing implements it. It is a
  half-built seam, NOT a live capability.

## Decision — Option A (variant): build-time time coverage → `store.classifiers['time']`

The store-builder fetches the dataset's available time coverage at build time (one read,
alongside the classifiers it already fetches) and folds it into `store.classifiers['time']`
as an ordinary `Classifier` (array of `{ code: '2015' } … { code: '2025' }`, ascending). The
inline `{$cl:'time'}` source then resolves **synchronously** through the unchanged
`resolveYears` path; `pick:'last'` picks the max year.

```
store-builder (build time)
  ├─ fetch nonTimeDim classifiers          (unchanged)
  ├─ fetch dataset meta → MetadataPort      (unchanged)
  └─ fetch time coverage → classifiers['time'] = [{code:'2015'}…{code:'2025'}]   ← NEW
        (source: cube profile `timeCoverage`, min/max + distinct periods)
```

Time coverage is sourced from an **extended cube profile**: `GET /api/cube/:code/profile`
gains a `timeCoverage` field — `{ min, max, periods? }` — aggregated from the V26
`cube_actual_region` (`MIN(first_time_period)`, `MAX(last_time_period)`, and the distinct
period list for selector population). The profile is the natural home: it is the cube's
introspected SHAPE, read-only, the delivery surface (skill §12 capability discovery).

### Why A-variant over B (distinct store query-type), and over A-raw

**Rejected — B (`ApiStore` implements `distinct` for `time`, year-select migrates to
`{type:'query'}`/`{type:'distinct'}` store source).** B is the "generic OLAP" instinct and
the `distinct` discriminant already exists, but it forces the FILTER GATE to grow an
async-warm path it does not have today. `getOptions` is synchronous; a `distinct` query on
`ApiStore` (`caps.sync===false`) would throw cold from `querySync` (`store-api.ts:186-190`).
Making it work means re-architecting `resolveDefaults`/`useFilterState` to suspend on option
loading (a parallel of `useNodeRows`' warm-then-read) — a large, cross-cutting change to the
filter spine for one default. It ALSO forces a **config migration** of every `{$cl:'time'}`
to a store source. B is the right model for *interactive* dim dropdowns that must reflect
server cardinality live; it is over-built for "what is the latest year at boot." Door kept
open: **D-DISTINCT** (below).

**Rejected — A-raw (profile carries the range, but a NEW config source kind `{from:'profile'}`
or a new selector type reads it).** Adds a config-surface vocabulary and a new resolver for
no gain: the range, once in `classifiers['time']`, is consumed by the EXISTING `{$cl:'time'}`
ref. A-variant reuses the one classifier channel; A-raw forks a second.

**Chosen — A-variant** wins on: (1) zero filter-gate async rework — the synchronous
`getOptions` path is untouched; (2) **zero config migration** — `{$cl:'time'}` already in
provisioning resolves naturally once `classifiers['time']` exists; (3) Law 1 — `time` becomes
just another entry in the generic `Record<string,Classifier>`, no privileged dim, no special
case in `resolveYears`; (4) it cannot hang — coverage loads at build time (awaited, with a
graceful-degradation catch), so by the time any filter renders, `classifiers['time']` is
either populated or empty-but-settled (never pending-forever); (5) it reuses an existing
server read (`cube_actual_region`) and an existing endpoint (cube profile).

### How it loads + the async-readiness signal (no hang)

Coverage loads **at store build**, awaited inside the `registerStoreBuilder('stats', …)`
async builder — exactly where `nonTimeDims` classifiers and dataset meta already load
(`stats-registrations.ts:111-133`). The builder is already `async` and the manifest boot
(`fetchStoreManifest` → `buildStoreManifest`) already awaits every store's construction
before the runner renders. So the readiness signal is the **store-construction promise
itself** — the same signal that already gates `nonTimeDims` classifiers. No new gate, no new
wait primitive. By first filter render `store.classifiers['time']` is settled.

Resilience (graceful degradation, mirrors the meta read at `stats-registrations.ts:125`): a
failed/absent coverage read must NOT block store construction. `.catch(() => undefined)` →
`classifiers['time']` simply absent → `resolveYears` returns `[]` → the year default falls to
the secondary guards below (unbounded "all years"), never a 400, never a hang.

### Config-source shape — does `{$cl:'time'}` migrate?

**No config migration.** Provisioning keeps `years: { type:'inline', items:{$cl:'time'},
field:'code' }` verbatim (`geostat.provisioning.json:1129-1135`). It resolves to `[]` today
and to the real period list once the store-builder populates `classifiers['time']`. This is a
pure capability addition under an unchanged config contract (expand-only; no stored config
breaks).

### Law 1 + dependency arrow

- **Law 1 (no privileged dim).** The seam is generic: the store-builder loads coverage for
  the dataset's TIME dim, but the engine never special-cases `'time'` — it is one key in
  `classifiers`, resolved by the same `resolveRef`/`resolveYears` as any `$cl`. `TIME_DIM`
  remains the SSOT for *which* key is time; the seam reads that, it does not hardcode `'time'`
  anywhere in the engine. (The store-builder's `nonTimeDims`/time split is app/DSD config, the
  correct place to know the time dim — not the engine.)
- **Arrow.** API route (`apps/api`) ← cube profile SQL. Store-builder (`packages/plugins`,
  below apps) reads the profile via `stats-api` (its co-located adapter) and writes
  `classifiers['time']` into the engine `ApiStore` (`packages/core`). `packages/core` and
  `packages/react` are untouched by the primary fix — they already consume `classifiers`
  generically. No import crosses the arrow.

## The two defense-in-depth guards (ship regardless — validated safe + correct)

These are correct independent of the seam (they fix a latent "unset time ⇒ wrong query"
bug) and they are the safety net when coverage degrades:

1. **`toObsParams` omits `from`/`to` when time is unset/`0`** (`core/data/store-api.ts:204-215`).
   Current code emits `from/to` whenever `timeDim !== undefined && !== ''`; a `0` (or `'0'`)
   slips through and becomes `from=0&to=0` → 400. Correct semantics: an unset time bound means
   "unbounded → all periods" (the observations route already treats absent `from`/`to` as no
   filter, `observations.ts:247-248`). Guard: treat `0`/`'0'`/`NaN`/`''`/`undefined` as unset
   and omit both bounds. This makes "no year resolved yet" return the full series, not a 400.

2. **`autoParse` year-select returns a no-value sentinel, not `0`** (`core/config/filter-eval.ts:19`).
   `Number(raw) || Number(def.default) || 0` coerces an empty year to `0` — a fake period that
   poisons `toObsParams`. Return a no-value sentinel (`''`/`undefined`) so an unresolved year is
   ABSENT from `ctx.dims`, not a spurious `0`. Pairs with guard 1: absent time ⇒ omitted bounds
   ⇒ all years. (`def.default` here is the OptionsDefault object `{from,pick}`, so `Number(def.default)`
   is already `NaN` — the `|| 0` is the actual bug source.)

Together: even if coverage NEVER loads, the page renders the full series (degraded but
correct + non-hanging) instead of 400ing. With coverage loaded, `pick:'last'` narrows to the
latest year. Belt and suspenders.

## Open doors (deferred, with triggers)

- **D-DISTINCT** — promote `StoreQuery['distinct']` to a live `ApiStore` capability +
  async-warm filter options (option B). Trigger: the first dim selector that must reflect
  *live server cardinality* (not a build-time snapshot), OR time coverage that changes within
  a session. Until then the build-time snapshot is correct (a dataset's period set is stable
  per boot).
- **D-TIME-PROFILE-PERIODS** — if `timeCoverage.periods` (the full distinct list) proves too
  large for some cube, ship `{min,max}` only and synthesize the year sequence client-side for
  annual cubes; keep `periods` for irregular (quarterly/gapped) series. Trigger: a cube whose
  distinct-period read is measurably heavy in the profile.

## Fitness functions

- **FF-YEAR-DEFAULT-LATEST** — given a stats store whose `classifiers['time']` = `[2015…2025]`
  and a year-select `{from:'options',pick:'last'}`, `resolveDefaults` yields `dims['year']='2025'`
  (the MAX). (core test: `resolve` + `filter-eval`.)
- **FF-TIME-RANGE-LOADS** — the `stats` store-builder, given a profile with `timeCoverage`,
  produces a store whose `classifiers['time']` is non-empty and ascending; given a profile
  WITHOUT `timeCoverage` (degraded), the store still builds and `classifiers['time']` is
  absent/empty (no throw). (plugins test.)
- **FF-NO-ZERO-TIME** — `toObsParams` NEVER emits `from`/`to` equal to `'0'`/`0`; an unset/`0`
  time dim omits both bounds. `autoParse(year-select, '')` returns a no-value sentinel, never
  `0`. (core test: `store-api` + `filter-eval`.)
- **FF-TIME-COVERAGE-SSOT** — the profile's `timeCoverage` derives ONLY from
  `cube_actual_region` (the V26 realised-region SSOT), never from a separate scan of
  `stats.observation` that could fork the "what periods exist" rule. (api fitness test,
  alongside `cube-profile.fitness.test.ts`.)
- **FF-NO-HANG** — a filter render with an unpopulated `classifiers['time']` settles
  (`isLoading` resolves, never stays pending) because the year default degrades to unbounded
  rather than waiting on a never-arriving option. (react test.)

## Implementation roadmap — byte-precise, ordered, owner per step

Order is bottom-up the arrow so each layer's test is green before the next consumes it.

**T0 — API: extend cube profile with `timeCoverage` (owner: api/backend specialist)**
- File: `platform/apps/api/src/routes/cube/actual-region.ts` — add a helper
  `loadTimeCoverage(app, datasetCode): Promise<{ min: string|null; max: string|null; periods: string[] }>`
  reading the V26 region:
  `SELECT MIN(first_time_period) AS min, MAX(last_time_period) AS max FROM stats.cube_actual_region WHERE dataset_code=$1`
  plus the distinct period list for selector population. Because `cube_actual_region` stores
  per-combination first/last (not every period), the distinct list is best derived as:
  `SELECT DISTINCT time_period FROM stats.observation WHERE dataset_code=$1 ORDER BY time_period`
  — BUT to keep FF-TIME-COVERAGE-SSOT (one rule for "what periods exist"), prefer expressing
  it through the region where the schema allows; if a per-period materialization does not
  exist, document this single observation read as the periods SSOT and assert it in the
  fitness test (it is the same table the region is built from). Guard absent-view exactly like
  `loadActualRegion` (`actual-region.ts:80-96`): degrade to `{min:null,max:null,periods:[]}`.
- File: `platform/apps/api/src/routes/cube/index.ts` — add `timeCoverage` to the
  `CubeProfile` interface (after `actualRegion`), run `loadTimeCoverage` in the existing
  `Promise.all` block (lines 168-232 / the actualRegion read at 274), include it in the
  returned `profile` object (line 276).
- Tests: extend `platform/apps/api/src/routes/cube/cube-profile.test.ts` +
  `cube-profile.fitness.test.ts` → FF-TIME-COVERAGE-SSOT.

**T1 — plugins: profile adapter reads `timeCoverage` (owner: data/plugins specialist)**
- File: `platform/packages/plugins/datasources/stats-api.ts` — extend `StatsCubeProfileRow`
  (lines 91-95) with `timeCoverage: { min: string|null; max: string|null; periods: string[] }`.
  `fetchCubeProfile` (line 249) already returns the bundle; only the type widens.

**T2 — plugins: store-builder folds time coverage into `classifiers['time']` (owner: data/plugins specialist)**
- File: `platform/packages/plugins/datasources/stats-registrations.ts`, inside
  `registerStoreBuilder('stats', …)` (lines 98-148). After the existing nonTimeDim classifier
  fetch (111-116), add a coverage fetch:
  - `const profile = await fetchCubeProfile(base, datasetCode).catch(() => undefined)`
  - build a time `Classifier` from `profile?.timeCoverage`:
    `periods.map(code => ({ code }))`, ascending; if only `{min,max}` and the cube is annual,
    synthesize `min..max` (the D-TIME-PROFILE-PERIODS note) — but PREFER the explicit `periods`
    list so quarterly/gapped series are exact.
  - merge into the `classifiers` record under the dataset's TIME dim key (read the time dim
    name from the profile's `dimensions[].isTime`, NOT a hardcoded `'time'` — Law 1; fall back
    to `TIME_DIM` only as the documented default).
  - Pass the augmented `classifiers` into `new ApiStore(...)` (line 138-145) unchanged.
- The fetch is awaited and `.catch`-guarded (graceful degradation) so a missing
  `timeCoverage` never blocks construction (FF-TIME-RANGE-LOADS degraded branch).
- Tests: a plugins test asserting both branches of FF-TIME-RANGE-LOADS.

**T3 — core: guard 1, `toObsParams` omit unset/`0` bounds (owner: core/engine specialist)**
- File: `platform/packages/core/src/data/store-api.ts`, `toObsParams` (lines 200-248). Replace
  the `timeDim !== undefined && timeDim !== ''` test (205) with an `isUnsetTime` check that
  also rejects `0`/`'0'`/`NaN`. When unset, omit BOTH `from` and `to` (the route reads absent
  bounds as "all periods"). Comma-range path (207-214) unchanged.
- Tests: extend the store-api test → FF-NO-ZERO-TIME (params half).

**T4 — core: guard 2, `autoParse` year-select no-value sentinel (owner: core/engine specialist)**
- File: `platform/packages/core/src/config/filter-eval.ts`, `autoParse` (line 19). Change
  `case 'year-select': return Number(raw) || Number(def.default) || 0` to return a no-value
  sentinel (`''`) when `raw` is empty/non-numeric, so an unresolved year is ABSENT from
  `ctx.dims` rather than `0`. Verify downstream consumers of the year dim tolerate absence
  (they must, per guard 1's "unbounded → all years"). Keep numeric parse for a real year.
- Tests: extend filter-eval test → FF-NO-ZERO-TIME (parse half) + a `resolveDefaults` test for
  FF-YEAR-DEFAULT-LATEST.

**T5 — react: FF-NO-HANG settle test (owner: react specialist)**
- File: `platform/packages/react/src/filters/` — a `useFilterState` test asserting that with
  `store.classifiers['time']` absent, `isLoading` resolves (the year default is not a
  pending-forever Tier-3) and the resulting `ctx.dims` has no `'0'` year. No production change
  expected here — this is the guard that the synchronous path stays synchronous.

**Config — no migration.** `geostat.provisioning.json:1129-1135` is correct as-is; do NOT
touch it. Add only a regression assertion that the GDP year default resolves to the seeded
max year end-to-end once coverage loads.

### Sequencing summary
T0 (api) → T1 (plugins types) → T2 (plugins builder) wires the PRIMARY fix; T3+T4 (core
guards) + T5 (react settle) are the INDEPENDENT safety net and can land in parallel with
T0–T2 (they have no dependency on the profile change). Land T3/T4 FIRST if a fast unblock is
needed: alone they convert the 400 into a correct all-years render (non-hanging, no latest-year
narrowing); T0–T2 then add the `pick:'last'` precision. Either half is shippable; together they
are the canonical seam.

## Files (absolute)
- `C:\Users\Test-User\WebstormProjects\national-accounts\platform\apps\api\src\routes\cube\index.ts` (T0)
- `C:\Users\Test-User\WebstormProjects\national-accounts\platform\apps\api\src\routes\cube\actual-region.ts` (T0)
- `C:\Users\Test-User\WebstormProjects\national-accounts\platform\apps\api\src\routes\cube\cube-profile.fitness.test.ts` (T0 FF)
- `C:\Users\Test-User\WebstormProjects\national-accounts\platform\packages\plugins\datasources\stats-api.ts` (T1)
- `C:\Users\Test-User\WebstormProjects\national-accounts\platform\packages\plugins\datasources\stats-registrations.ts` (T2)
- `C:\Users\Test-User\WebstormProjects\national-accounts\platform\packages\core\src\data\store-api.ts` (T3)
- `C:\Users\Test-User\WebstormProjects\national-accounts\platform\packages\core\src\config\filter-eval.ts` (T4)
- `C:\Users\Test-User\WebstormProjects\national-accounts\platform\packages\react\src\filters\useFilterState.ts` (T5 test target)
- `C:\Users\Test-User\WebstormProjects\national-accounts\platform\apps\api\provisioning\geostat.provisioning.json` (NO change — regression assertion only)

Related: multistore (buildStoreManifest), data_source_reference_spectrum (storeId kind),
semantic_layer_n26 (classifiers as the dim SSOT).

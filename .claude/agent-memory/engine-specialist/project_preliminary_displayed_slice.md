---
name: preliminary-displayed-slice
description: Year-aware preliminary-badge fix — KPI+panel derive from displayed obs status, not dataset-wide; applyEncoding now carries obsStatus
metadata:
  type: project
---

Data-integrity "preliminary" badge made YEAR-AWARE (branch `fix/integrity-displayed-slice`, 3 commits, uncommitted-to-main). Owner's law: badge = OR over VISIBLE panels/KPIs of "the SPECIFIC obs this element displays carry SDMX obsStatus=P", NEVER dataset-wide.

**Why:** on /ka/gdp year 2024 (final) wrongly lit the chip because the GDP dataset ALSO held a 2025-P obs. Two year-blind leaks read dataset-wide provenance instead of the displayed slice.

**How to apply / non-obvious findings:**
- KPI leak was `kpi.ts interpretKpi`: `store.metadata?.provenance(code)` (dataset-wide). Replaced by `valueIsPreliminary` (new `data/kpi-preliminary.ts`) — status-aware twin of resolveValue, reads obsStatus at each value discriminant's coordinate(s) via `storeObs`. Split read-coord helpers (resolveTime/withFilter) into `data/kpi-coord.ts` (bloat gate: kpi.ts hit 498 > 400 ceiling).
- **`useKpiRows` (react) ALREADY warms `obs` per requirement alongside `val`** (line ~140: `qa({type:'obs',measure:r.code})`). THIS is what makes a synchronous `storeObs` read inside interpretKpi safe on the async ApiStore — read with the SAME `{measure}` shape → warm-cache hit, no cold-throw. Wrapped in try/catch→false anyway (best-effort, never crash the strip).
- **`ExternalStore._observe` IGNORES ctx.dims** — matches ONLY `query.filter` (measure via measure param). So an obs read with no filter returns ALL times' rows → coordIsPreliminary client-filters returned obs by measure + every concrete dim in c.dims (incl pinned time). ApiStore obs slice is already wire-scoped by ctx.dims (non-time) + from/to (time); measure NOT threaded to obs wire → client measure-filter essential there too.
- Panel leak was `resolvePreliminary.ts` step 3 (dataset-wide MetadataPort). REMOVED. Steps 1 (def.preliminary) + 2 (displayed rows carry obsStatus) are authoritative.
- **Source fix (Law 6): `applyEncoding` was DROPPING obsStatus** — the `DataRow.status` @deprecated doc falsely claimed "applyEncoding continues to populate it". It didn't → encoded chart panels (the `დინამიკა` timeseries) couldn't report preliminary. Now applyEncoding carries `obs.obsStatus ?? obs.status` onto new `DataRow.obsStatus` (optional, additive; only when present → byte-identical for status-free data). Raw obs field name from stats adapter (fromStatsObsRow) is camelCase `obsStatus`, normalized lowercase 'p'.
- Obs status carrier field: `obsStatus` on the mapped Observation (NOT `obs_status` — that's the wire RawObsRow). `Observation = Readonly<Record<string,DimVal>>`.

**Verification note (worktree):** rendering suites (jsdom-hook: useKpiRows.async, data-integrity consolidation, renderNode.async) fail in the isolated worktree with dup-React (`node-linker=hoisted` needed for vitest4 #module-evaluator, but it dup-installs React) — CONFIRMED env artifact (untouched suites fail identically). Verify those in main checkout. Node-env + pure-function tests are reliable: core 668 green, react resolvePreliminary green, plugins FF-INTEGRITY-DISPLAYED-SLICE 4 green, geostat tsc clean, eslint+check-laws clean. See [[worktree-vitest-hoisted]] / [[shared-tree-concurrency]].

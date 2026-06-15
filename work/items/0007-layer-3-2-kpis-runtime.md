---
id: "0007"
title: "3.2 deferred: KPI specs — runtime year refs instead of module-load constants"
status: ready
class: M
priority: P2
owner: —
links:
  - docs/plan/roadmap-phase-3-4.md
---
**Goal** — `gdp/accounts/regional.kpis.ts` compute FIRST/LAST at module-load via
`codesOf(classifiers.time)`. Replace with `{ $ctx: 'fromYear' }` / `{ $ctx: 'toYear' }`
ctx refs and template strings so KPI specs are pure JSON, Constructor-ready.

**Root cause:** KpiSpec was authored before the DefaultSpec / runtime-ref system
existed. TimeRef already supports `CtxRef = { $ctx: string }` but interpretKpi
passes `trendSub` and `label` through raw without calling `resolveTemplate`.

**Changes:**
1. `engine/core/src/data/kpi.ts` (Class-M): import `resolveTemplate`; in
   `interpretKpi`, resolve `label` and `trendSub` via `resolveTemplate(str, ctx)`.
2. `apps/geostat/src/pages/gdp.kpis.ts`: remove codesOf/FIRST/LAST; from/to/time
   → ctx refs; trendSub/label → template strings.
3. Same for accounts.kpis.ts and regional.kpis.ts.

**DoD**
- [ ] No `codesOf(...)` at module-top in any kpis.ts.
- [ ] `interpretKpi` resolves label and trendSub templates.
- [ ] tsc EXIT=0.

**Notes** — Closes 3.2 deferred. Class-M on kpi.ts only (data layer). Two-way door.

---
name: project-time-mode-decision
description: The ratified orthogonal-axis law for time "modes" — selection ⊥ grain ⊥ dim; grain axis deferred behind D-GRAIN on data grounds
metadata:
  type: project
---

Foundational, owner-delegated architecture call (DESIGN doc: `platform/work/DESIGN-time-mode-decision.md`, successor to `DESIGN-time-mode-decoupling.md`). Decision: **Option C** — a data view is the PRODUCT of orthogonal axes `dimension ⊥ selection-type ⊥ granularity`, authored once each; the flat fused-mode enum (`year, range, quarterly…`) is REFUSED at every tier. `year`/`range` become two values of ONE `selection-type` axis (`point`/`window`/`all`), not two views.

Build NOW (real consumers exist): generalize `scope.timeBinding` → dim-generic `binding` with an explicit `selection` discriminant (kills the illegal `pin & window` state); open the closed `TimeGranularity` union → registry string; retire the surviving `=== 'year'` fused literal in `template.ts:75` (resolveCarrier `{year,range}` → perspective-keyed Record).

Deferred behind named doors (NO real consumer): `D-GRAIN` (2nd grain axis), `D-PERIOD-SELECT` (generic period-select past year-only `resolveYears`), `D-COMPARE` (compare as its own axis).

**Why grain is deferred:** all 3 seeded geostat datasets are `frequency='A'`; all ~2131 obs carry bare 4-digit-year timePeriod (2010–2025); the DSD has NO FREQ dimension. Zero sub-annual consumer ⇒ building a grain axis = empty cathedral. Re-verify the seed/DSD before opening D-GRAIN — a quarterly dataset landing is the trigger.

**Why:** owner wanted "maximal decoupling, more than yesterday's perspective-axis (P0–P6) selection-layer refactor." Resolved: maximal = orthogonality, not axis-count.
**How to apply:** treat the orthogonal-axis law as binding for any future time/grain/compare work; refuse fused enums and new `if mode==='…'` literals; open deferred doors only when a real consumer appears. See [[feedback-maximal-orthogonality]].

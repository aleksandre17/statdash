---
name: perspective-axis-p5
description: P5 LANDED 2026-06-27 — migrated the 3 geostat pages onto the P4.5 perspective time-binding seam BYTE-IDENTICALLY (two-bar collapse + effects/timeMode removal + perspective-is gates). One engine refinement (writeBound representation-preserving window echo). Builds on [[perspective-axis-p45]].
metadata:
  type: project
---

# Perspective-axis P5 — geostat config migration (LANDED 2026-06-27)

Migrated `apps/api/provisioning/geostat.provisioning.json` (accounts/gdp/regional) from the legacy TWO-BAR weave onto the P4.5 seam. NOT committed/deployed (orchestrator deploys + visually verifies, then commits). Builds on P4.5 (e5f3b8e).

## Per-page migration (all 3 identical pattern)
- **Added `page.perspectives` keyed by the EXISTING `mode` param** (permalink byte-identical — param NOT renamed). Two perspectives:
  - `year`  → `scope.timeBinding = { dim:'time', pin:{$ctx:'year'} }` (single-period pin; the pin's `$ctx` source = the OWNERSHIP key that suppresses `year` in range mode).
  - `range` → `scope.timeBinding = { dim:'time', range:[{$ctx:'fromYear'},{$ctx:'toYear'}], targetKeys:{from:'fromYear',to:'toYear'} }`.
- **Collapsed two bars → ONE `bar`** (no showWhen). Used the year-bar's SELECT versions of `account`/`sector` (so year mode unchanged; range mode now SHOWS those selectors — a UI change the orchestrator visually verifies; DATA identical at default state). Dropped dup `mode`/`account`/`measure`/`sector`/`region`.
- **Removed `effects`** (orthogonality; the active perspective's binding alone applies, so a stale cross-mode URL value never cross-pins).
- **Removed `context.timeMode`** ⇒ `timeModeKeyPre`/`timeModeKey` fall back to `'mode'` ⇒ ownership gate engages. KEPT `context.dims` (the time→year / fromYear→fromYear mappings the resolvers read).
- **Converted 11 `{op:eq,param:'mode',is:X}` → `{op:'perspective-is',perspective:X}`** (param-less ≡ eq-on-mode per P2). 3 accounts + 4 gdp + 4 regional.
- regional: KEPT `spanFrom`/`spanTo` `alwaysResolve:true` in the collapsed bar (page-level CAGR window; resolves both perspectives). Did NOT move to page-level computed (optional cleanup, P6).

## KEPT (System A — P6 deletes, NOT P5): `modeOrder`, `mode-bar` node, `KpiSpec.mode` + the kpi-strip `ctx.timeMode` filter. `ctx.timeMode` still set correctly via `useModeContext('mode', modeOrder)` reading URL `state.mode` → kpi-strip partition byte-identical.

## ENGINE REFINEMENT (the one byte-identical fix found by the fitness)
`scopeCtxByPerspective` window branch wrote `dims.fromYear = effectiveBounds(...)` = a NUMBER, OVERWRITING the STRING `context.dims` already set (legacy select autoParse → string). Divergence: range-mode `ctx.dims.fromYear` `2020` (mig) vs `"2020"` (legacy). Render-invisible (resolveTemplate `String()`, resolveTime `Number()`) but NOT byte-identical at ctx.dims. FIX: new `writeBound(dims,key,bound)` helper (perspective-axis-parser.ts) — when the dim ALREADY holds a value whose `Number()` form EQUALS the resolved bound (the ECHO case: window reads `{$ctx:fromYear}` + writes back `fromYear`), PRESERVE the existing representation; only write the number when the bound genuinely DIFFERS (literal/clamped window). Byte-identical for an echo, correct for a transform. Compatible with all P4.5 FFs (FF-BINDING-TARGET-KEYS numeric ctx → echo preserves number).

## BYTE-IDENTICAL PROOF (FF-SNAPSHOT-VIEW-EQUIV, P5)
`apps/api/src/provisioning/perspective-migration-equiv.fitness.test.ts` (18 tests). Harness = PURE replication of the live `useFilterState`+`SiteRenderer` ctx derivation (gate + resolveDefaults + context.dims projection + scopeCtxByPerspective) over a tiny data-agnostic fixture store (years 2020-25, accounts, sectors, bilingual display). Asserts: migrated `sectionCtx` (dims + timeMode) === LEGACY sectionCtx per page×perspective×locale (12 cases, RELATIVE property → holds for any store). Legacy side = FROZEN pre-P5 two-bar schemas (`__fixtures__/legacy-filter-schemas.ts`, extracted from the backup — do NOT regen from live artifact). Migrated side = LIVE committed artifact (catches future JSON regressions). + parity (year pins time=2025, fromYear/toYear unset; range time unset full-span, fromYear/toYear set; regional sector="_T"+span both perspectives) + NON-VACUOUS (year≠range) + gate-verdict (11 perspective-is each visible only in its perspective).

## Harness GOTCHA: apps/api resolves `@statdash/engine` to DIST (not src) — had to `pnpm --filter @statdash/engine run build` after the P4.5 export + the writeBound edit before apps/api tests saw them. (apps/api otherwise `import type` only; here it imports the pure core derivation fns at runtime — arrow-legal, apps/api→core.)

## Green: typecheck (core+api+geostat) · lint 0-err · check-laws · suite 1742 (+18 from 1724). NOT committed.

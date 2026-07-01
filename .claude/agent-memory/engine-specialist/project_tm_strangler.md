---
name: tm-strangler
description: TM-STRANGLER LANDED (green, uncommitted 2026-07-01) — time-mode orthogonal-axis Strangler P0→P3. DimBinding+Selection discriminant replaces shape-inferred timeBinding; template.ts fused-mode literal killed; TimeGranularity opened; live config migrated to scope.binding. P-final (delete timeBinding) deferred.
metadata:
  type: project
---

# TM-STRANGLER — time-mode as one orthogonal axis (LANDED green, uncommitted)

Executed CLOSE-BOARD P1 / DESIGN-time-mode-decision Option C, phases P0→P3 + template-literal kill + grain-open + FFs. Scope stayed in **packages/core + the one live provisioning JSON + core/api fitness** (did NOT touch react/styles/plugins per lane rule; apps/panel authoring deferred to P-final).

## The discriminant model (the load-bearing change)
`Selection = {kind:'point',at:TimeBound} | {kind:'window',from,to,targetKeys?} | {kind:'all'}` and `DimBinding = {dim:string, selection:Selection, granularity?:string}` in `config/perspective-axis.ts`. Makes the legacy illegal `pin & window` state (shape-inferred `pin?` XOR `range?`) UNREPRESENTABLE. `PerspectiveScope` gains `binding?` (primary) + keeps `timeBinding?` (deprecated Postel alias).

## Strangler mechanism (byte-identical, proven)
- **`resolveDimBinding(scope)`** (parser) = Postel: prefer `scope.binding`; else LOWER `scope.timeBinding` via `bindingFromTimeBinding` (pin→point, single-year YearsSpec→point, [from,to]ctx-tuple→window, 'all'/multi-year→all, absent→undefined). ONE fold path + ONE ownership walk downstream — no shape fork.
- **`scopeCtxByPerspective`** folds the normalized DimBinding: point→`resolveTimePin`→dims[dim]; window→`effectiveBounds`→`writeBound` under `windowTargetKey`; all→nothing. Clone-timing preserved (lazy `dims ??=` only on real write) so referential + value identity hold.
- **`bindingOwnedKeys(DimBinding)`** replaces the tb-shaped ownership. point.at={$ctx}→owns param; window→owns targetKeys ?? `${dim}From/To`.
- Proven by new `perspective-binding.fitness.test.ts` (FF-BINDING-SELECTION-EQUIV: legacy-timeBinding axis vs migrated-binding axis produce deep-equal scopeCtx + identical ownership, year+range).

## template.ts literal KILLED (the MED finding)
`resolveCarrier` `{year,range}` `=== 'year'` → generic `activePerspective(state) in tpl` key-lookup over `Record<perspectiveId,string>` (new exported `PerspectiveCarrier` type). No `=== 'year'`, no `'year' in tpl && 'range' in tpl`. Byte-identical because `current` defaults to `available[0].id`='year' (usePerspectiveContext) so activePerspective is never undefined on an axis page. **Badge config was ALREADY perspective-keyed JSON (`{range,year}`) — no config change.** LocaleString `{ka,en}` disambiguated (no perspective-id key → falls to locale resolve).

## TimeGranularity opened (D3)
`'year'|'quarter'|...` → `string` (open registry grain). Inert; no exhaustive switch. Still decorative at `time-dimension.ts:124` (GRAIN-G4 threads it when D-GRAIN lands).

## `binding` scope-key registered
`perspective-scope-schemas.ts`: `binding.selection.kind` string-dropdown (point/window/all) + showWhen-gated sub-fields (at | from/to/targetKeys), ALONGSIDE `timeBinding` (both registered = OCP-additive; panel PerspectivesPane/coverage tests stay green by construction).

## Live config migration
`geostat.provisioning.json` 6 sites (replace_all, all 3 pages identical): year→`binding{selection:point, at:{$ctx:year}}`, range→`binding{selection:window, from/to:{$ctx:fromYear/toYear}, targetKeys}`. Verified: JSON valid, binding×6 (3 point/3 window), timeBinding=0.

## FFs
- **FF-NO-MODE-LITERAL** — vitest `no-mode-literal.fitness.test.ts` (scans core+react src; excludes comment lines + the legit `i18n/format.ts` `format==='year'` DATE-kind per DESIGN R3) + **bash twin** in `ops/scripts/check-laws.sh` (`=== '(range|quarter|month)'` / `'(year|range)' in `). SSOT+twin pattern (see [[tenant-content-gates]]).
- **FF-SELECTION-EXPLICIT** (`@ts-expect-error` illegal-state) + **FF-GRAIN-OPEN** in perspective-binding.fitness.
- Updated `no-capability-without-consumer.fitness.ts` non-vacuous mirror (binding+timeBinding+metric; `scope.binding`/`scope.timeBinding` textual consume-check — resolveDimBinding pre-guards scope so access is `scope.x` NOT `scope?.x`).

## Gates: build:engine ✅ typecheck(mine) ✅ lint(mine) ✅ check-laws ✅ test 2045 pass/0 fail/74 skip.

## BLOCKER on the SHARED gate (NOT mine) — see [[shared-tree-concurrency]]
Concurrent responsive lane's UNTRACKED `packages/plugins/chrome/app-header/default/app-header.overflow.fitness.test.ts:24` has `existsSync` unused (TS6133 + eslint no-unused-vars) → the shared typecheck+lint are RED through no fault of TM-STRANGLER. Did NOT touch (forbidden lane). My edits green in isolation.

## Follow-ons (named, deferred)
1. **P-final**: delete `PerspectiveTimeBinding`/`timeBinding` wholesale + migrate apps/panel authoring (perspectiveScopeSchemaSource, PerspectivesPane/perspectiveModel/coverage tests) + swap panel `PageHeaderNode.badge` type `{year,range}`→`Record<string,string>` (plugins lane) + grep-zero timeBinding.
2. **FF-BINDING-DIM-EXISTS**: `config-cube-contract.fitness` does NOT currently walk perspective scope dims (never did for timeBinding either) — additive gate to add.
3. **GRAIN-G4 adjacency**: TimeGranularity now open-string but still inert at `resolveTimeDimension`; thread granularity→point-series.grain (see [[grain-store-port]]).

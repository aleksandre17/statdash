---
name: perspective-axis-p45
description: P4.5 LANDED 2026-06-27 — engine OWNS the time-binding via scope.timeBinding (3 additive capabilities + 1 React filter touch). Unblocks the P5 geostat two-bar collapse byte-identically. Architect ruled (A) on the [[perspective-axis-p4-blocker]] escalation.
metadata:
  type: project
---

# Perspective-axis P4.5 — engine owns the time binding (LANDED 2026-06-27)

Resolves the [[perspective-axis-p4-blocker]]: architect ruled (A) (additive engine phase BEFORE config collapse). Strangler-Fig — the binding lands alongside the STILL-LIVE legacy two bars, proven byte-identical, so P5 can collapse to one bar / drop effects byte-identically. ZERO production config changed; new mechanism INERT until a config opts in.

## The three additive capabilities (all byte-identical, fitness-locked)
**(a) Ctx-ref single-period PIN** — new `pin?: TimeBound` on `PerspectiveTimeBinding`. `scopeCtxByPerspective` (perspective-axis-parser.ts) resolves it via new `resolveTimePin` (time-dimension.ts) → reuses `resolveRef` (same dispatcher legacy `{$ctx}` used). Unset/NaN ⇒ writes NOTHING (uses `isUnsetTime` SSOT, NOT resolveTimeBound's 0/Infinity default — a pin is a discrete SELECTION). Fires BEFORE the range branch (early `continue`).

**(b) Configurable window target-keys** — new `targetKeys?: {from?,to?}` on `PerspectiveTimeBinding`. Window branch writes `targetKey(tb,dim,side)` = declared key ?? `${dim}From`/`${dim}To`. geostat will declare `{from:'fromYear',to:'toYear'}` so the window drives the EXISTING `{$ctx:'fromYear'}`/`{$ctx:'toYear'}` resolvers.

**(c) Perspective-aware default-resolution gate (Protected Variations)** — NEW engine helper `perspectiveOwnedParamKeys(axes, perspectiveState) → {active, all}` (parser). React `useFilterState` gains 3rd optional arg `ownership?: PerspectiveOwnership`; gate becomes `isAlwaysResolve || ownsActive.has(key) || (!ownsAny.has(key) && legacyBarBranch)`. Empty ownership ⇒ reduces to legacy `barShowWhen` branch EXACTLY. Owned keys = pin's `{$ctx}` source param + window targetKeys (or `${dim}From/To`).

## KEY DESIGN: PerspectiveTimeBinding (NOT TimeDimensionSpec widening)
`pin`/`targetKeys` live on `PerspectiveTimeBinding = TimeDimensionSpec & {pin?, targetKeys?}` in perspective-axis.ts — strict-SOLID: NEVER bloat the shared `TimeDimensionSpec` (used by every data spec) with perspective-only fields. Stays assignable to TimeDimensionSpec (intersection) so effectiveBounds consumes it unchanged.

## React wiring (SiteRenderer.tsx)
Chicken-egg solved: `axes` + `ownership` now computed BEFORE `useFilterState` (was after). `timeModeKeyPre = page.filterSchema?.context?.timeMode ?? 'mode'` (== hook's returned timeModeKey). `useFilter().state` hoisted to top. Removed the now-duplicate `axes` useMemo + `useFilter` destructure lower down.

## Files
- `packages/core/src/config/perspective-axis.ts` — `PerspectiveTimeBinding` type, `timeBinding` retyped
- `packages/core/src/config/perspective-axis-parser.ts` — pin branch + `targetKey()` + `perspectiveOwnedParamKeys()` + `PerspectiveOwnership`
- `packages/core/src/core/time-dimension.ts` — `resolveTimePin()`
- `packages/core/src/config/perspective-scope-schemas.ts` — authoring fields pick/from/to → pin/targetKeys.from/to
- `packages/core/src/index.ts` — export PerspectiveTimeBinding, PerspectiveOwnership, perspectiveOwnedParamKeys
- `packages/react/src/filters/useFilterState.ts` — 3rd arg + gate
- `packages/react/src/engine/SiteRenderer.tsx` — hoist + thread ownership
- `packages/core/src/config/perspective-p45.fitness.test.ts` — 4 FFs

## Fitness (4 new, all non-vacuous)
FF-BINDING-PIN-CTX-REF · FF-BINDING-TARGET-KEYS · FF-PERSPECTIVE-DEFAULT-GATE · FF-BINDING-ADDITIVE-IDENTITY. Suite 1724 passed / 0 fail (was 1723). typecheck + lint(0 err) + check-laws green.

## GOTCHA: no-tenant-content gate (see [[tenant-content-gates]])
Comments in packages/react MUST NOT contain the literal tenant name. First full-suite run failed on 2 comments saying "today's geostat" → reworded to "an un-migrated page". The gate scans comment text too.

## NOT done in P4.5 (per scope)
NO production config change (P5). NO Constructor pane for pin/targetKeys authoring (P-final). Legacy `barShowWhen` default-gate branch STAYS (P6 deletes once configs migrate).

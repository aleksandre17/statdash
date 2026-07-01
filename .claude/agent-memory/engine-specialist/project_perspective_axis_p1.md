---
name: perspective-axis-p1
description: Landed state for P1 of the perspective-axis refactor (expand-contract relax + parser + perspectiveState SSOT migration across 6 sites + ctx-scoping step + 2 FFs). What changed, where, the byte-identical/legacy-still-works proof.
metadata:
  type: project
---

# Perspective-axis refactor, PHASE P1 (landed 2026-06-27, builds on P0 [[perspective-axis-p0]])

Additive + byte-identical when no `perspectives` declared. Legacy `mode`/`timeMode`/`by-mode` paths kept working (Postel, retire P2–P6). Plan: `platform/work/VISION-mode-as-perspective-axis.v3-PLAN.md` §P1. **SYNTHESIS is the authoritative envelope.**

**How to apply:** when P2+ begins, this is the landed P1 seam. Build on it; don't re-derive.

## 1. Expand-contract RELAX (HIGH-2, the load-bearing first step)
- `ContextMapping.timeMode` (filter-params.ts:293) → **OPTIONAL** (`timeMode?`). Was mandatory. Surfaced one real consumer: `useFilterState.ts:168` (`raw[context.timeMode]`) → guarded `context?.timeMode ? … : 'year'`. (`:217` `context?.timeMode ?? 'mode'` already handled it.)
- `BarDef.timeToggle`/`timeModes`/`TimeModeItem` were ALREADY optional — no change needed.
- `SiteRenderer` timeModeKey: unchanged (`useFilterState` returns it `?? 'mode'`); the new `perspectives` parse uses it as the desugar param.

## 2. The parser (NEW `packages/core/src/config/perspective-axis-parser.ts`, engine-pure)
- `parsePerspectiveAxes({ perspectives?, modeOrder?, timeModeParam? }) → PerspectivesByParam | undefined`. Reads declared `perspectives` (new path) ELSE derives a single-axis `{ [param]: { perspectives: modeOrder.map(id → {id, label:{ka:id,en:id}}) } }` (the Postel desugar). NEITHER ⇒ `undefined` (N=1-free, no axis). **The derived axis has NO `scope.timeBinding`** — legacy pages keep binding time imperatively until P5 authors it, so the desugar is render-neutral.
- Input is a plain bag (NOT the react `NodePageConfig`) → arrow clean. React extracts the 3 fields off the page.
- `activeIdForAxis(axis, param, perspectiveState)` = `perspectiveState[param]` (validated) ?? `perspectives[0].id` (LOW-1 default).
- `scopeCtxByPerspective(ctx, axes, perspectiveState)` — the ctx-scoping step (declarative time-mode replacement). Applies the ACTIVE perspective's `scope.timeBinding` to `ctx.dims` before interpretSpec: year-PIN (`isYearsSpec` + len 1) → `dims[dim]=year`; WINDOW (`[from,to]`) → `effectiveBounds` (the SAME seam legacy fromDim/toDim used) → `dims[`${dim}From`]`/`dims[`${dim}To`]`. **IDENTITY (same ref) when no axes / no timeBinding** — byte-identical, N=1-free. Multi-axis-ready (walks the Record).

## 3. perspectiveState SSOT (HIGH-3) — the 6 sites all wired to ONE source
- **NEW `packages/core/src/config/perspective-state.ts`**: `PERSPECTIVE_PARAM='perspective'`, `LEGACY_MODE_PARAM='mode'`, `activePerspective(state)` — reads conventional 'perspective' ?? 'mode' ?? single-axis value. For the param-less legacy `mode-*` ops.
- **`evalVisibility` SIGNATURE CHANGED** (visibility.ts): 3rd arg `mode?: ModeId` → `perspectiveState?: Record<string,string>`. The `eq`/`neq`/`in`/`isset` ops UNCHANGED (read filterParams). `mode-is`/`mode-in`/`mode-not` now resolve via `activePerspective(perspectiveState)`. **This is why geostat is byte-identical: its 11 gates are `{op:eq,param:'mode'}` (read filterParams, untouched); ZERO `mode-*` ops in the config.**
- The 6 sites: (1) `renderNode.ts:158` reads `ctx.sectionCtx.perspectiveState`; (2) warm.ts collectRequirements + (3) api.ts walkNode via `activeViewGate`→`VisibilityGate.perspectiveState` (visibilityGate.ts changed `activeView:string` → `perspectiveState:Record`); (4) `navUtils.getNavMode` now parses `mode-is`/`mode-not` too (+ legacy `{op:eq,param:timeModeKey}`); (5) `SiteRenderer` builds `perspectiveState={[timeModeKey]:currentMode}` + scopes ctx; (6) `ModeContext` URL param → currentMode → seeds the SSOT.
- **SSR seed**: `buildStaticContext` (html.tsx) seeds `sectionCtx.perspectiveState={[timeModeKey]:mode.current}` (immutable clone; preserves caller-supplied). `activeViewGate` reads the SSOT (Postel-derives from mode.current if absent).

## 4. Two FFs (NEW `packages/core/src/config/perspective-p1.fitness.test.ts`, non-vacuous)
- **FF-ONE-VIEW-NO-MACHINERY**: parser yields undefined for {}/empty perspectives/empty modeOrder; `scopeCtxByPerspective` returns the SAME ref (no clone/mutation) when no axes or no timeBinding; desugar fires only when modeOrder non-empty.
- **FF-PERSPECTIVE-IS-PURE-FUNCTION**: scoping year pins only `dims.time`, sibling geo/sector UNTOUCHED, source ctx not mutated; switching year→range writes window keys, does NOT clear `time` (vs the deleted mode-clearing effects — orthogonal regions); warm-key≡read-key (same state ⇒ identical dims); the gate flips visibility solely off perspectiveState.

## 5. React additions
- `PageConfigBase.perspectives?: PerspectivesByParam` added (types/node.ts), imported from engine. Carried generically by the panel adapter spread → round-trips (panel coverage guard updated: META_FIELD_COVERAGE + fullMeta + assertion).
- core index exports: `PERSPECTIVE_PARAM`, `LEGACY_MODE_PARAM`, `activePerspective`, `ParsePerspectiveInput`, `parsePerspectiveAxes`, `activeIdForAxis`, `scopeCtxByPerspective`.

## 6. Incidental (required by the bloat gate, NOT scope-creep)
- **`renderNode.ts` was 460 lines at P0 (over the 400 hard ceiling).** The post-edit-laws hook BLOCKS any edit to an over-ceiling file. To land the 1-line SSOT change I extracted the self-contained `makeLazyRendered` proxy (~72 lines) → NEW `packages/react/src/engine/lazyRendered.ts` (pure, one caller, zero behaviour change). renderNode now 389 lines. This is a clean Law-5/6 split, not a refactor of the render pipeline. **GOTCHA for P2+: renderNode is near-ceiling again — any further edit may re-trip the gate; extract another concern (e.g. warnSlotPlacement, 44 lines) rather than append.**

## 7. Gate state (all green)
- typecheck geostat + panel clean; lint 0 errors (43 pre-existing react-refresh warnings, untouched files); check-laws all clean; **full suite 1706 passed / 66 skipped / 0 failed** (1772; +10 vs P0's 1696). `pnpm build:engine` clean (DTS+ESM).
- Byte-identical proof: geostat config = legacy modeOrder+timeMode+`{op:eq,param:mode}` gates, ZERO `perspectives`/`mode-*`. Desugar derives an axis with no scope ⇒ scoping is identity; eq-gates read filterParams unchanged; perspectiveState seeded but only consulted by mode-* ops (none in config). Legacy still works via Postel.

## Residuals (unchanged from P0 [[perspective-axis-residuals]])
- ScopeOverride.compare DEAD → DELETE P6. scope.metric = measure-SWAP, not the point↔cagr carrier (node-local value.type). `ctx.timeMode` still read by `_specTag`/by-mode resolver/template.ts/kpi.ts mode-filter — all legacy, retire P3/P6.

---
name: perspective-axis-p51
description: P5.1 LANDED 2026-06-27 — perspective-scoped filter-ITEM visibility (ParamMeta.visibleWhen, render-only). Each perspective now shows only its own time selector(s) after the P5 two-bar collapse. Additive; default-resolution still on the P4.5 ownership seam. Builds on [[perspective-axis-p5]].
metadata:
  type: project
---

# Perspective-axis P5.1 — perspective-scoped filter-item visibility (LANDED 2026-06-27)

Completes the perspective-model's filter-scoping (Superset/ViewDef-style). Fixes the post-P5-collapse UI delta: after two time-mode bars → one bar, the year-selector showed inert in range mode and from/to showed in year mode. NOW each perspective shows only its own time selector(s). Render-only — does NOT touch default resolution (stays on P4.5 perspective-ownership gate). NOT committed (orchestrator green-gates + commits + re-probes selectors per-mode).

## The seam (engine + plugin + config)
**(1) Engine type** — `visibleWhen?: VisibilityExpr` added to `ParamMeta` (filter-params.ts). DISTINCT from existing `showWhen: WhenMap` (NOT an overload — strict-SOLID thin optional cross-cutting field on the shared base, mirrors node `view.visibleWhen`). Reuses VisibilityExpr + evalVisibility + perspective-is (P2 canon). Type-only import of VisibilityExpr from `./visibility` (no runtime cycle; visibility.ts doesn't import filter-params). Passes through to `item.visibleWhen` AUTOMATICALLY via `schemaToBarNodes` spread (`{key, ...paramDef}`, useFilterState.ts) — no parser change.

**(2) Plugin gate** — FilterBarShell.tsx (plugins/nodes/filter-bar/default; THE load-bearing shell — geostat uses `type:'filter-bar'` which renders items inline). Gate: `if (item.visibleWhen && !evalVisibility(item.visibleWhen, fp, perspectiveState)) return null`. `perspectiveState = ctx.sectionCtx.perspectiveState` (SAME SSOT renderNode reads for node visibleWhen — already on RenderContext, NO new threading). `evalVisibility` import added to existing `@statdash/engine` import (arrow-clean). (DefaultFilterBarShell in react delegates to `ctx.renderNode(bar)`; geostat doesn't use it, untouched.)

**(3) Config** — geostat.provisioning.json (now at `platform/apps/api/provisioning/`, NOT `apps/api/`). 9 gates = (year + fromYear + toYear) × 3 pages. `year`→`{op:perspective-is,perspective:year}`; `fromYear`/`toYear`→`{op:perspective-is,perspective:range}`. account/sector/measure/region/spanFrom/spanTo UNGATED. Pages: 0=accounts, 1=gdp, 3=regional (page 2 = no filterSchema). Param names per page: accounts has account+fromYear+measure+mode+toYear+year; gdp fromYear+mode+toYear+year; regional adds region+sector+spanFrom+spanTo.

## RENDER-ONLY proof (the key guarantee)
`visibleWhen` gates ONLY which control DISPLAYS — NEVER default resolution. useFilterState gate stays `isAlwaysResolve || ownsActive.has(key) || (!ownsAny.has(key) && barShowWhen)` (P4.5 ownership), which never reads `visibleWhen`. In range: fromYear/toYear visible+owned ⇒ resolve; year HIDDEN but suppressed by OWNERSHIP (year-owned/inactive), not by visibleWhen. Chart render byte-identical (FF-SNAPSHOT-VIEW-EQUIV stays green — P5 fitness untouched).

## Fitness — NEW FILE (NOT appended; the existing P5 fitness was at 337 lines, append hit the 400 BLOAT ceiling at 455)
`platform/apps/api/src/provisioning/perspective-filter-visibility.fitness.test.ts` (4 tests, FF-FILTER-ITEM-PERSPECTIVE-VISIBILITY). Loads LIVE artifact. (1) 9 gates year→year/from-to→range, disjoint sets + per-perspective evalVisibility flip. (2) RENDER-ONLY: `resolvedKeys()` replicates useFilterState gate EXACTLY (real parsePerspectiveAxes + perspectiveOwnedParamKeys + evalWhen, no visibleWhen read) → resolve-set byte-identical whether visibleWhen present or stripped (non-vacuous: gated has 3, stripped 0). (2b) corollary: hidden-but-owned resolves, non-active-owned suppressed by ownership.

## Constructor-ready
`visibleWhen` on a filter item is declarative JSON the round-trip preserves; same VisibilityExpr authoring surface already registered in visibility-schemas.ts (perspective-is leaf). No new schema needed — authorable like node visibleWhen.

## GOTCHA (re-confirmed from P5): apps/api resolves @statdash/engine to DIST. Had to `pnpm --filter @statdash/engine run build` before apps/api tests saw exports (but here only reused existing exports — build still needed for fresh dist).

## Green: typecheck (tsc -b project refs) · lint 0-err (43 pre-existing react-refresh warns) · check-laws · suite 1746 (+4 from 1742). NOT committed.

---
name: time-mode-weave
description: Where time-mode actually lives in code+config (System A privileged timeMode), and the real eager-vs-lazy data-load split — for VISION-mode-as-view-axis validation
metadata:
  type: reference
---

Validation of `platform/work/VISION-mode-as-view-axis.md` against real code (2026-06).

## Where time-mode is woven (System A — privileged timeMode)
- `SectionContext.timeMode` — named field beside generic dims: `core/core/context.ts:57-58`. `TimeMode = ModeId` alias L11-13.
- `ContextMapping.timeMode` (URL param → ctx.timeMode): `core/config/filter-params.ts:292-295`.
- `ParamYearSelect.rangeKey`/`rangeLabel`: `filter-params.ts:113-117`. `BarDef.timeToggle`/`timeModes`: `filter-params.ts:247-250`.
- `DataSpec 'by-mode'` union member: `core/config/data-spec.ts:181`. Resolver `ByModeResolver`: `core/registry/resolvers.ts:141-170`. extractRequirements by-mode branch: `core/data/spec.ts:126-130`.
- bar-visibility default-resolution GATE + `alwaysResolve` hoist: `react/.../useFilterState.ts:88-112,230-232`. `ParamHidden.alwaysResolve`: `filter-params.ts:97-101`.
- mode-clearing `applyEffects`: `react/.../SiteRenderer.tsx:124-129,175`. STUB_CTX hardcodes timeMode:'year' `useFilterState.ts:63`.

## System B (generic, newer)
- `ModeId=string` + `ModeContext`: `core/mode/types.ts`. `mode-is/mode-in/mode-not` visibility ops: `core/config/visibility.ts:25-28,52-55` (legacy `{op:'eq',param:'mode'}` still works). page.modeOrder, navMode `SiteRenderer.tsx:145-147`.

## CRITICAL config reality (differs from Vision's prose)
- ZERO `by-mode` DataSpecs in geostat.provisioning.json (grep "by-mode" = 0 matches). The Vision's "accounts by-mode envelopes" do NOT exist as DataSpecs.
- The actual KPI mode split is `KpiSpec.mode: 'year'|'range'|'both'` (`core/data/kpi.ts:62`), filtered in `interpretKpis` L221 + `extractKpiRequirements` L309. Point-KPI vs CAGR-KPI = two KpiSpecs with different `mode` tag in the SAME kpi-strip (geostat KPIs ~line 36-265).
- Genuinely-different nodes per mode = section-level `view.visibleWhen {op:eq,param:mode,is:year}` (11 occurrences). These are Vision case (c).
- Range time clamp = per-query `fromDim:'fromYear'`/`toDim:'toYear'` (+ canonical `timeDimension` R5). Year pin = ctx.dims[time] via year-select.

## Data-load: EAGER vs LAZY (the optimization question)
- LIVE React path = ALREADY LAZY. renderNode step 0.5 (`react/.../renderNode.ts:228-231`) evaluates view.visibleWhen and returns null BEFORE resolveRows/useNodeRows/useKpiRows. Hidden-mode nodes never warm. KPIs further pruned by mode inside extractKpiRequirements/interpretKpis even within one rendered strip.
- SSR/snapshot path = EAGER. `warm.ts collectRequirements` + `api.ts walkNode` walk the WHOLE tree via nodeWalk (DATA_CARRYING_KEYS denylist) and call extractRequirements/interpretSpec on EVERY node.data — they do NOT consult visibleWhen/showWhen/mode. So both modes' slices warm in SSR/JSON snapshot.
- So the optimization win is REAL but scoped to the SSR/warm + JSON-snapshot targets, not the live DOM (already lazy). Switch-latency mitigation: CachedStore TTL + per-slice 304/conditional-GET (commit 26e28b9) + optional prefetch-on-idle.

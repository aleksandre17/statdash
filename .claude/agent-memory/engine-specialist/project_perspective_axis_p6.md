---
name: perspective-axis-p6
description: P6 LANDED 2026-06-27 — RETIRED ALL of System A grep-clean. Full Mode*→Perspective* rename (engine+react+plugins+panel+geostat+api) + every legacy mode surface deleted. Resolves [[perspective-axis-p6-blocker]]. Builds on [[perspective-axis-p52]].
metadata:
  type: project
---

# Perspective-axis P6 — System A fully retired (LANDED 2026-06-27)

Resolves [[perspective-axis-p6-blocker]] (now UNBLOCKED — P5/P5.1/P5.2 had migrated every live surface). Deleted ALL legacy mode machinery byte-identically (perspective path was already THE live render). RENDER-AFFECTING; NOT committed/deployed (orchestrator deploys + visually verifies, then commits).

## The full rename (mandate: ZERO surviving legacy/alias incl. `Mode*` vocabulary)
- **core `mode/`→`perspective/`**: `ModeId`→`PerspectiveId`, `ModeDef`→`PerspectiveOption`, `ModeContext`→`PerspectiveContext`, `modeRegistry` DELETED (`perspectiveRegistry` sole). `perspectiveModeDefs`→`perspectiveOptions`.
- **RenderContext + StaticRenderContext**: `mode: ModeContext`→`perspective: PerspectiveContext`; `timeModeKey`→`perspectiveKey` (73 occurrences/12 files incl. plugin AnchorNavContext/InnerSidebar/InnerPageShell + FiltersCtx + navContext shape).
- **react context**: `ModeContext.tsx` DELETED → NEW `PerspectiveContext.tsx` (`usePerspectiveContext`/`PerspectiveProvider`/`usePerspective`) — reads perspectiveState + axis options, NO registry (current=URL param, set=filterSet, available=axis-owned).
- **commands**: `mode:set`→`perspective:set` ({id,param?}, plain filterSet write — NO applyEffects; geostat effects=[] so byte-identical). event `mode:change`→`perspective:change`.
- **panel**: `EnumRefField` source `'modes'`→`'perspectives'` (perspectiveRegistry); `AppManifest.modes`→`perspectives`; visibility-schemas source `'modes'`→`'perspectives'`; pageSchemaSource `modeOrder` authoring field→`perspectives`; visibilityFactory + VisibilityBuilder OP labels dropped mode-*.
- **SiteManifest `modes` field KEPT** (contract `ManifestMode` is its own type, NOT `=ModeDef`; not in grep set; the provisioning `site_config` key string `"modes"` = perspective vocab for Constructor palette — DB-compat, no migration). api bootstrap: `ModeDef`(engine, arrow-crossing)→`ManifestMode`(contracts, arrow-correct). geostat site-manifest `ModeDef[]`→`PerspectiveOption[]`; App.tsx `modeRegistry`→`perspectiveRegistry`.

## Deletions (the System-A set, all grep-zero)
- `SectionContext.timeMode` + `TimeMode` type (context.ts) — ~50 test fixtures stripped (`timeMode:'year'` literals, multiple regex variants), STUB_CTX/EMPTY_CTX(×2 plugins).
- useFilterState `barShowWhen` default-gate branch → ownership-only (`isAlwaysResolve||ownsActive||!ownsAny`). geostat=no-showWhen-bars ⇒ byte-identical. `alwaysResolve` KEPT-JUSTIFIED (spanFrom/spanTo page-level cube-extent, NOT perspective-owned, not a mode concern — [[alwaysresolve-seam]]).
- `mode-bar` node dir DELETED + 7 registrations (nodes/index, registry, catalog ×2, emit-schema, no-privileged PLUGIN_NODE_TYPES, InnerPageNode.accepts). perspective-bar moved css→`perspective-bar.css` (renamed `.mode-tab-*`→`.perspective-tab-*`, self-contained shell+skeleton).
- `modeOrder` field (NodePageConfig) + wire-schema + parser legacy desugar (parsePerspectiveAxes now ONLY explicit `perspectives`; ParsePerspectiveInput = {perspectives?} only). nodeWalk/walkNodes DATA_KEYS `modeOrder`→`perspectives`.
- `ContextMapping.timeMode`, `ParamYearSelect.rangeKey`/`rangeLabel`, `BarDef`+`BarNode.timeToggle`/`timeModes`, `TimeModeItem` (filter-params + param-schemas + 3 barrels).
- `mode-is`/`mode-in`/`mode-not` ops (visibility.ts) + schemas (visibility-schemas) + VISIBILITY_OPS discriminant-manifest + panel factory/builder.
- `ScopeOverride.compare`+`.timeMode`→`{dimOverride?}`; mergeScope timeMode-read removed; `resolveCompareRows` (resolveNodeRows) + renderNode compare block + `RenderContext.compareRows`/`compareLabel` + engine/index export. NEW: renderNode applies `view.scope.dimOverride` generically (was compare-coupled; 0 configs use it ⇒ inert/byte-identical).
- `template.ts` `{year,range}` badge union: `ctx.timeMode==='year'`→`activePerspective(ctx.perspectiveState)==='year'` (LIVE geostat page-header badges ×3 — load-bearing, byte-identical).

## getNavMode (the ONE byte-identity subtlety)
DELETED `mode-is`/`mode-not` branch; KEPT generic `{op:eq,param:perspectiveKey}` ONLY. Did NOT add `perspective-is` parsing: geostat nav-contributor sections (sna-hero/regions-bar/sector-history etc.) carry `perspective-is` gates that getNavMode ALREADY returned undefined for pre-P6 (geostat used perspective-is, not mode-is) ⇒ they show in both perspectives' nav TODAY. Adding parsing = behavior change. So preserved exact current nav. FF-NAV-ORDER test rewritten from `mode-is` fixtures→`{op:eq,param:mode}` (the op getNavMode actually reads).

## Obsolete-test handling (System-A comparison gone)
- perspective-migration-equiv (FF-SNAPSHOT-VIEW-EQUIV): dropped legacy-vs-migrated comparison (System A deleted = migrated config IS live render); deriveCtx→ownership-only gate, no timeMode/modeOrder/barShowWhen; parity behaviors (year-pins, range-full-span, span-always) + determinism KEPT.
- perspective-filter-visibility (P5.1): resolvedKeys→ownership-only.
- p1 desugar cases / p2 mode-* alias-equiv block / roundtrip mode-* / VisibilityBuilder mode-* → deleted or converted to perspective-*.

## Green: typecheck (tsc -b exit 0) · lint 0-err/43-warn (baseline) · check-laws all-clean · gen:schema (node_perspective-bar, 0 mode-bar/modeOrder) · FULL suite 1753 pass/66 skip/0 fail · 71 perspective+snapshot-equiv fitness green. Grep-clean: load-bearing-ZERO (remaining = comments + 2 `it()`-test-titles naming the historical mode-bar/modeOrder the byte-identity test compares against). NOT committed/deployed.

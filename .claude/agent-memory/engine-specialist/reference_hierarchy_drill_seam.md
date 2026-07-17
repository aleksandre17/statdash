---
name: hierarchy-drill-seam
description: ADR-034 §8 S4 dimension-hierarchy drill primitive — DimensionDef.hierarchy + data/drill.ts; reifies from SDMX codelist parent edges; composes evalMeasureAtGrain (no metric-grain change); the AR-40/50 ⟷ AR-42 bridge
metadata:
  type: reference
---

The governed dimension HIERARCHY / drill-path primitive (ADR-034 §8, D-AR50-4) — un-defers the old S4 as the AR-42 drill-down bridge. Additive/reversible, LANDED first slice, all gates green.

**The declaration (thin, generic, Law 2)** — `packages/core/src/data/dimension.ts`:
- `HierarchyLevel { dim: string; label?: LocaleString }` — a tier over a GENERIC grain axis (Law 1, no privileged name).
- `DimensionHierarchy { levels: HierarchyLevel[] }` (coarsest→finest); `DimensionDef.hierarchy?`.
- Member parent/child NEVER hand-authored — reifies from the SDMX codelist `parent` edges (Law 5). dimension.ts stays a PURE vocabulary leaf (types only, no store import).

**Reification (codelist.ts, exported)**: `childrenOf(c,code)` · `depthOf(c,code)` (dist from root, 0-based) · `membersAtDepth(c,depth)`. Unify BOTH classifier forms via `codeGraph` (array parent=code, record parent=surrogate-id → resolved to code).

**The seam** — `packages/core/src/data/drill.ts` (store-aware, arrow-clean core→data):
- `DrillTarget { dimension: string; level: number }` — the AR-42 selection emits this.
- `drillAxis(def, level)` → the grain axis (star-form bridge: inject into `MetricSpec.by`).
- `reifyLevelMembers(def, level, classifier)` = `membersAtDepth(classifier, depthWithinAxis(def,level))` — the ONE rule unifying self-nested (all levels same axis → depth = level index) and star (distinct dims → depth 0).
- `evalMetricDrill(ref, def, target, ctx, store, classifier)` → reads each reified member as a **grain-∅ cell** at `ctx.dims ⊕ {axis:member}` via `evalMeasureAtGrain`. Base → store sums descendant leaves (DimResolver leaf-set expand); calc/ratio → RE-DERIVES (FF-NO-SUM-OF-RATIO holds). Emits `{[axis]:member, value, id, label}`.

**KEY INSIGHT — why NO metric-grain change:** raw fact-grain enumeration can't enumerate ROLLUP coords (facts carry leaves). The drill supplies the reified coordinate SET; each cell read delegates to the guarded M2 SSOT. Leaf-level drill ≡ `evalMeasureAtGrain(ref,ctx,store,[axis])` (parity gate). See [[reference_grain_store_port]], [[project_ar50_semantic_layer]].

**MetricSpec is UNCHANGED** — drill composes existing `by` + the new seam; M-SQ public contract stable, whole slice git-revert-able.

**Gate:** `FF-HIERARCHY-DRILL` = `data/drill.fitness.test.ts` (reify + additive rollup + ratio re-derive + leaf-parity + 2nd dim-pair sector = Law 1). `FF-NO-PRIVILEGED-DIM` extended to scan `drill.ts`. Exports wired in core/index.ts.

**AR-42 P2 render Consumer LANDED (capability+fitness green; live demo BLOCKED at adapter):** the `drill` NodeAction arm (`type:'drill'`{dimension,toLevel,param?}; `drillParamKey(dim)`=`__drill:<dim>` SSOT; in SELECTION_WRITE_ACTIONS) folds through the ONE applySelection/CommandBus write point via a per-arm `selectionWrite` resolver in useNodeInteractions (drill sources value from `toLevel` literal, filter/highlight from row field — Bounded-Element, no type-branch in the loop). Consumer = `packages/react/src/engine/resolveDrill.ts` (wired into resolveNodeRows as `drilled ?? interpretSpec` — byte-identical when not drilled): a metric-spec node (`data.type==='metric'`) with an active drill param re-renders via `evalMetricDrill` per ref (additivity-correct, regions Σ=nation, ratio re-derives). Gate: `FF-DRILL-CONSUMER` (resolveDrill.fitness) + `drill` entry in FF-ACTION-ARM-CONSUMED. **Blast:** adding DrillAction (no `key`) to NodeAction union broke TableShell's `.key` access → narrowed to key-bearing arms (`'key' in a`).
**✅ ADAPTER GAP CLOSED — DRILL LAST-MILE LANDED (all gates green, additive/reversible):** the wire now carries the hierarchy and the boot threads it:
- `contracts/manifest.ts`: new zero-dep mirrors `ManifestHierarchyLevel {dim; label?:Record<string,string>}` + `ManifestDimensionHierarchy {levels}`; `ManifestDimension.hierarchy?` (additive, absent⇒flat byte-identical). NOTE the label DIRECTION: wire label is `Record<string,string>` (⊆ core `LocaleString`), so wire→core refines with NO cast, but core `DimensionHierarchy`→wire is NOT assignable (LocaleString⊋Record) — project via `.map(l=>({dim:l.dim}))` when going core→wire.
- `data/drill.ts` NEW export `reifyHierarchy(classifier, axis, labels?)` → derives level COUNT from codelist depth (loops `membersAtDepth(c, d+1)` until empty); flat (no parent edges)→`undefined`. The in-memory TWIN of the api's server-side projection.
- `manifest-catalog.ts` `registerManifestDimensions` now THREADS `d.hierarchy` onto DimensionDef.hierarchy (was dropped) → `getDimension(id).hierarchy` populated → drill live.
- `apps/api/routes/bootstrap/index.ts` PROJECTS at manifest build: `loadDimensionHierarchies` reads `MAX(nlevel(code_path))` over `stats.classifier` (LTREE depth, ADR-0023 V23) GROUP BY dim_code HAVING >=2; `withHierarchy(d, depths)` attaches `levels=Array(depth).fill({dim:code})` matching `dimension.code`=`stats.classifier.dim_code` (authored hierarchy wins; flat dim untouched). Law-3-clean (api can't import core reify helpers → reifies same fact via SQL). **Goes live via api RESTART only — reads codelist at each bootstrap, NO re-provision of pages/dimensions blob.** Ground truth: geo(`_T`→R2..R12) + sector(`_T`→9 children) = depth 2 → 2 levels; account/side/approach/time flat → no hierarchy.
- Gate: NEW `data/manifestDrill.fitness.test.ts` (FF-MANIFEST-DRILL, 7 tests: reify-from-codelist + wire→core thread + geo/sector drill + flat byte-identical). Existing drill.fitness/resolveDrill.fitness/no-sum-of-ratio unaffected.

**Flagged follow-ons (NOT built):** multi-member `where` child-narrowing (MetricSpec.where is single-val; store filter already takes DimVal[]); a `drill` field ON MetricSpec (rejected — churns M-SQ for no gain); time granularity reconcile with `TimeDimensionSpec.granularity`; drilled rows carry `label=code` (no display-name join yet).

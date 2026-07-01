---
name: constructor-paramdef-filters-v0
description: Constructor V0 — page-level FilterSchema/ParamDef authoring landed; param-schema registry + FiltersDrawer + COVERAGE_TODO.paramDefs emptied
metadata:
  type: project
---

Constructor roadmap V0 (page-level FilterSchema / ParamDef authoring) is DONE — the biggest coverage gap ("a dashboard IS its filters") closed.

**Why:** page-level filters were entirely un-authorable in the Constructor; all 7 ParamDef types sat in COVERAGE_TODO.paramDefs.

**How to apply (the pattern, mirrors V1 transform StepForms exactly, one rung down — a ParamDef instead of a TransformStep):**
- Each ParamDef type CARRIES an authoring PropSchema in `packages/core/src/config/param-schemas.ts` (mirrors `op-schemas.ts`), registered via `registerParamSchema` in `param-schema-registry.ts` (schema-only registry — no handler, because the render half lives in `packages/react` FilterRenderers, blocked by the arrow). Side-effect `import './config/param-schemas'` lives in `packages/core/src/index.ts` (core index does NOT import the config barrel).
- Panel: `filterParamSchemaSource` (mirrors `transformStepSchemaSource`) + `ParamDefEditor` (mirrors `TransformStepEditor`, models ParamDef as `{type, props}` CanvasNode) render through the EXISTING generic `<Inspector>`. `FiltersDrawer` is the surface (in `apps/panel/src/features/filters/`), mounted in `PageStep.tsx` Inspector column, page-scoped (not element-scoped).
- Pick-don't-type: `key` binds `enum-ref`→`cube.dimensions`; cube-bound `default` binds `enum-ref`→`cube.members` scoped via new `sourceDim` PropField descriptor (now TYPED on PropField; EnumRefField reads it non-defensively). Collection fields (options/years/tree) use the documented `object`/`array` JSON sub-editor escape hatch (same as op-schemas melt.idFields etc.).
- Round-trip is ALREADY lossless: `page.meta.filterSchema` carried by canvasPageAdapter structural pass-through (PageMeta). `filterSchemaModel.ts` does flat-map⇄ParamNode[] only at the editor boundary; unedited schema round-trips byte-identical. validateConfig unaffected (engine FilterSchema types unchanged).

**Gotchas hit:**
- `no-tenant-content.fitness.test.ts` ALLOW set must list any new bilingual-label catalog file — added `packages/core/src/config/param-schemas.ts` next to the `op-schemas.ts` entry (TIER-2 Georgian-script exempt; TIER-1 currency/brand still enforced). See [[law4_i18n_check]].
- React Compiler lint errors ("Compilation Skipped: existing memoization could not be preserved") on a `useCallback` reading render-scope `page`/`schema` — drop the `useCallback`, let the compiler memoize (plain inline fn).

**Coverage gate:** `coverage.fitness.test.ts` — `COVERAGE_TODO.paramDefs` is now EMPTY; gate uses `paramDefAuthorable(t) = getParamSchema(t) != null` (no hand-list). A ParamDef type that loses its schema now FAILS the build.

**Left noted (YAGNI):** FilterSchema `effects` / `crossValidate` / `context` / `computed` and bar add/remove/reorder are PRESERVED verbatim (`setBarParams` never touches them) but not yet authored — a later slice adds their builders behind the same Inspector seam. Tests: 1175→1192.

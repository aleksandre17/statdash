---
name: constructor-dataspec-editors-v2
description: Constructor V2 — remaining DataSpec editors (row-list/by-mode/transform/pivot); dataSpecs COVERAGE_TODO emptied to only `custom` → full DataSpec authoring coverage
metadata:
  type: project
---

Constructor roadmap V2 — the last DataSpec editors. EMPTIES `coverage.fitness.test.ts` `COVERAGE_TODO.dataSpecs` to just `custom` (PERMANENT). Builds on [[constructor-coverage-and-op-schemas]] / [[constructor-paramdef-filters-v0]] / [[constructor-inspector]].

**row-list (schema-driven, mirrors V0 param-schemas EXACTLY one rung down — a RowSpec instead of a ParamDef):**
- RowSpec CARRIES its authoring PropSchema in `packages/core/src/config/rowspec-schemas.ts` (`rowSpecSchema`: code+pctOf = `enum-ref`/`cube.measures` pick-don't-type, label=LocaleString localized, color, negate/isTotal boolean). RowSpec is a SINGLE shape (not a union), so registry keyed by the single `ROW_SPEC_KEY='row-spec'` const, `registerRowSpecSchema(schema)`/`getRowSpecSchema()` in `rowspec-schema-registry.ts` (schema-only, no handler — RowSpec carries no behavior; the renderer interprets it). Side-effect `import './config/rowspec-schemas'` + exports in `packages/core/src/index.ts`. Add `rowspec-schemas.ts` to `tests/no-tenant-content.fitness.test.ts` ALLOW set (catalog-class bilingual labels).
- Panel: `rowSpecSchemaSource` (getSchema ignores node.type — single shape) + `RowSpecEditor` (models RowSpec as `{type:ROW_SPEC_KEY, props:row}` CanvasNode, renders via the EXISTING `<Inspector>`, setAtPath write-back) + `RowListEditor` (DnD add/remove/reorder, parallel stable-uid array length-synced via the PipelineBuilder "adjust state while rendering" pattern; each card wraps RowSpecEditor). All in `features/data-layer/editors/rowlist/`.

**by-mode (recursive — mirrors VisibilityBuilder recursion):** `ByModeEditor` picks a ModeId from the live `modeRegistry.list()` (pick-don't-type) → authors the nested DataSpec by REUSING `<DataSpecEditor>` RECURSIVELY (a DataSpec inside a DataSpec). ES-module import cycle DataSpecEditor↔ByModeEditor is fine (render-time use only). Add/remove a mode branch; default new branch = `{type:'row-list',rows:[]}`.

**transform (reuse, don't rebuild):** `TransformEditor` authors `{source,steps,encoding}` — `steps` via the EXISTING `PipelineBuilder` (V1), `encoding` via the EXISTING `EncodingEditor`, `source` (inline literal rows) via `JsonDataField` (the documented bounded JSON escape hatch — YAGNI, not a grid).

**pivot:** `PivotEditor` keeps pivot's OWN friendly vocabulary (rows JSON / keyField text / valueFields ChipInput / colors JSON) — NOT routed through transform (POLA: an author who picked "pivot" shouldn't see the desugared melt). Pivot desugars to transform+melt in the ENGINE (R3); the authored `pivot` shape round-trips losslessly.

**JsonDataField gotcha (`features/data-layer/editors/JsonDataField.tsx`):** a controlled JSON textarea. Do NOT use `useEffect`+setState to re-sync on external value change — the React Compiler lint rule "Calling setState synchronously within an effect can trigger cascading renders" is a HARD ERROR (not warning). Use the render-time reconcile: track `syncedJson` (canonical JSON of last-emitted/synced value) in state; when incoming `canonical(value) !== syncedJson` it's an OUTSIDE change → reset draft. A user's invalid mid-typing draft must NOT clobber (we never emit it, syncedJson unchanged). Distinguishes "value moved externally" from "user typing invalid JSON".

**Wiring:** all four added to `DataSpecEditor.tsx` `SpecBody` switch (default specs already existed in `defaultSpec`); only `custom` now falls to `JsonFallback`. `coverage.fitness.test.ts`: `DATASPEC_EDITORS` now has all 8 non-custom discriminants; `COVERAGE_TODO.dataSpecs` = only `custom`.

**Green:** build:engine+geostat+panel+typecheck+lint(0 err, 43 accepted react-refresh warnings)+gen:schema(unchanged — no config TYPE changed, only registry)+test 1259→1272. Tests: RowList/RowSpec (5), ByMode recursion (3, MUI-Select interaction + modeRegistry.register in beforeAll like VisibilityBuilder.test), Transform/Pivot reuse (5). The dataSpecs coverage gate is the full-coverage proof: EVERY DataSpec discriminant has an authoring surface, only `custom` (code-resolver ref) is JSON-only.

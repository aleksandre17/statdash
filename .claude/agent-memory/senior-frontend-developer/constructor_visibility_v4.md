---
name: constructor-visibility-v4
description: Constructor V4 VisibilityExpr "show-when" builder — leaf PropSchemas + recursive builder; closes last COVERAGE_TODO (visibilityOps)
metadata:
  type: project
---

Constructor roadmap V4 (node-level `view.visibleWhen` "show when" builder) landed — the LAST COVERAGE_TODO category (`visibilityOps`, all 10) is now empty/green.

**Why:** every renderer capability must be authorable (Coverage Fitness #1, ADR adr_constructor_vision_north_star). VisibilityExpr was the last un-authorable union.

**How to apply / shape:** mirrors V0 (param-schemas) + V1 (op-schemas) EXACTLY, one rung down.
- Engine (`packages/core/src/config/`): `visibility-schema-registry.ts` (two surface kinds: `'leaf'` carries a PropSchema, `'composite'` is a marker) + `visibility-schemas.ts` (registrations, module-init side-effect imported in `src/index.ts`). Leaf ops eq/neq/in/isset/mode-* carry PropSchemas; composites and/or/not are `registerVisibilityComposite` markers. `isVisibilityOpAuthorable(op)` is the gate predicate.
- New `PropFieldSource` tokens added: `'filterParams'` (page's authored ParamDef keys — the leaf `param` binds here, pick-don't-type) and `'modes'` (registered ModeId set — mode-* leaves bind here). Both resolved in panel `EnumRefField.tsx` STORE_SOURCES. `eq/neq.is` is `cube.members` scoped via `sourceDim:'param'` — EnumRefField maps param-key→dimension via `paramDimension()` reading the active page's filterSchema.
- Panel (`apps/panel/src/features/visibility/`): `visibilityLeafSchemaSource` (mirror filterParamSchemaSource), `VisibilityLeafEditor` (mirror ParamDefEditor — leaf as CanvasNode `{type:op,props:leaf}`), `VisibilityBuilder` (recursive Composite-pattern tree: leaf=op-picker+Inspector form, and/or=group w/ AND/OR toggle + add condition/group + remove, not=single child), `VisibilitySection` (mounts in NODE Inspector in PageStep.tsx after `<Inspector>`; toggle on/off clears `view.visibleWhen` byte-clean via `setVisibleWhen`).
- The op-picker in VisibilityBuilder is a MUI `<Select>` (NOT native) — tests drive it via mouseDown+click-option, not fireEvent.change. The leaf `mode`/`param`/`is` controls ARE native `<select>` (EnumRefField) — fireEvent.change works but needs registered modes / bound cube for options.
- no-tenant-content.fitness ALLOW set: `visibility-schemas.ts` added (bilingual PropField label catalog, same class as param-schemas/op-schemas).

Counts: 1192→1209 tests green.

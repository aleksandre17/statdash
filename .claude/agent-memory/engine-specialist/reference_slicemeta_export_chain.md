---
name: reference-slicemeta-export-chain
description: Where PropField/PropFieldType/slice-meta types are defined and the barrels + consumers a new one must touch
metadata:
  type: reference
---

Adding a new `PropFieldType`, `PropField` member, or related slice-meta type requires editing a re-export CHAIN plus one exhaustive consumer:

1. **Definition:** `packages/react/src/engine/slice-meta.ts` — the source (PropFieldType union, PropFieldSource, PropField interface, PropSchema, all SliceMeta variants).
2. **Re-export barrel A:** `packages/react/src/engine/types/slice.ts` (`export type {...} from '../slice-meta'`).
3. **Re-export barrel B:** `packages/react/src/engine/types/index.ts` (re-exports from `'./slice'`).
4. **Public barrel:** `packages/react/src/engine/index.ts` (re-exports from `'./types'`).

If you only add to slice-meta.ts and the top barrel, `tsc -b` (the BUILD invocation, stricter than per-package `tsc --noEmit`) fails with TS2305 "no exported member" pointing at index.ts / slice.ts. Add the new name to ALL of 2, 3, 4.

**Exhaustive consumer:** `packages/react/src/components/PropSchemaForm.tsx` has `FIELD_RENDERERS: Record<PropFieldType, FieldRenderer>` — a NEW PropFieldType breaks this with TS2741 until you add a renderer entry. PropSchemaForm is the engine-side generic schema→form renderer (app-agnostic, no MUI/i18next). For panel-resolved types like `enum-ref` (options from a runtime catalog the engine can't resolve, Law 3), map to `textInput` and document that the panel replaces it with a source-resolving control.

**enum-ref + coverage (added C0):** `PropFieldType 'enum-ref'` carries `PropField.source?: PropFieldSource` ('cube.measures'|'cube.dimensions'|'cube.members'|'dataSpecs'|'tokens'|'pages'|string&{}) — open discriminant the PANEL resolves. `PropField.coverage?: 'localized'` marks a LocaleString field for per-locale authoring (orthogonal to `type`).

**Schema-completeness fitness:** `packages/plugins/nodes/__tests__/schema-completeness.fitness.test.ts` — imports real metas (plugins layer is the only one allowed to import plugin META per the arrow). Invariant: every node/panel meta that's not transparent/not a pure container has a non-empty schema. Pages (rootOnly templates) and chrome/control are exempt. Note `SliceMeta` union includes chrome/control WITHOUT `.type` — narrow to `NodeSliceMeta|PanelSliceMeta|PageSliceMeta` to index `.type`.

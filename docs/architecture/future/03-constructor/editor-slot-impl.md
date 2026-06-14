# editor-slot-impl.tsx

> Reference example (TypeScript) — documentation, not compiled source.

```tsx
/**
 * Example — editor? slot: Constructor config panel per filter control type
 *
 * This is Phase 2. Phase 1: editor = undefined → Constructor uses META.schema fields.
 *
 * When does editor? replace META.schema?
 *   META.schema = static field list → Constructor renders generic form inputs.
 *   editor?     = custom React component → full UX (dataset picker, live preview, etc.)
 *
 * Rule: editor? lives in engine/react (React dep). META.schema lives in engine/core (pure).
 *
 * Platform precedent:
 *   Grafana: each variable type has an editor component (QueryVariableEditor, CustomVariableEditor…)
 *            shown in the dashboard Variables panel when user configures that variable.
 *   Builder.io: each registered input has a defaultValue + optional editor component
 *               rendered in the visual editor's right panel.
 *
 * Interface (add to engine/react when starting Phase 2):
 *
 *   interface ConstructorEditorProps<C> {
 *     value:    C                   // current ParamDef config
 *     onChange: (next: C) => void   // update config (Constructor saves to DB)
 *   }
 *
 *   // On FilterControlSlice:
 *   editor?: ComponentType<ConstructorEditorProps<C>>
 */

import type { ComponentType }   from 'react'
import type { DataSpec }        from '@geostat/engine'
import type { ParamDefMap }     from '@geostat/react'

// ── ConstructorEditorProps — add to engine/react when starting Phase 2 ──

interface ConstructorEditorProps<C> {
  value:    C
  onChange: (next: C) => void
}


// ═══════════════════════════════════════════════════════════════════════════
// Example: CascadeEditor — replaces generic META.schema field form
// ═══════════════════════════════════════════════════════════════════════════
//
// Constructor user configuring a cascade filter:
//   1. Browse catalog → pick dataset (GDP_GE, ACCOUNTS_GE…)
//   2. Pick optionsQuery DataSpec from catalog entry
//   3. Preview: shows loaded options live (calls interpretSpec)
//   4. Set default value from preview list
//
// This UX is impossible with META.schema static field list.
// editor? = the escape hatch when the config form needs app-specific UX.

type CascadeConfig = ParamDefMap['cascade']

const CascadeEditor: ComponentType<ConstructorEditorProps<CascadeConfig>> =
  function CascadeEditor({ value, onChange }) {
    // Phase 2 implementation:
    //
    // 1. <DatasetPicker> — GET /api/catalog → DatasetEntry[]
    //    user picks dataset → buildDataSpecFromCatalog() → value.optionsQuery
    //
    // 2. <OptionsPreview> — calls interpretSpec(value.optionsQuery, EMPTY_CTX, httpStore)
    //    shows loaded options as a list → user confirms before saving
    //
    // 3. <DefaultValuePicker> — <select> populated from preview list
    //    user picks default → value.defaultValue
    //
    // 4. <DependsOnPicker> — multi-select of other filter keys in the same FilterBar
    //    user picks parents → value.dependsOn[]
    //
    // Stub — replace with actual implementation in Phase 2:
    return (
      <div className="constructor-editor">
        <label>optionsQuery (DataSpec JSON)</label>
        <textarea
          value={JSON.stringify(value.optionsQuery ?? {}, null, 2)}
          onChange={(e) => {
            try { onChange({ ...value, optionsQuery: JSON.parse(e.target.value) as DataSpec }) }
            catch { /* invalid JSON — ignore */ }
          }}
        />
        <label>default value</label>
        <input
          value={value.defaultValue ?? ''}
          onChange={(e) => onChange({ ...value, defaultValue: e.target.value })}
        />
      </div>
    )
  }


// ═══════════════════════════════════════════════════════════════════════════
// Example: YearSelectEditor — dataset-aware year range picker
// ═══════════════════════════════════════════════════════════════════════════
//
// META.schema has: defaultValue (number), range (json), label (string)
// editor? can: read available years from /api/catalog → show slider with real range

type YearSelectConfig = ParamDefMap['year-select']

const YearSelectEditor: ComponentType<ConstructorEditorProps<YearSelectConfig>> =
  function YearSelectEditor({ value, onChange }) {
    // Phase 2: <YearRangeSlider min={catalogMin} max={catalogMax} value={value.range} />
    // For now: generic number inputs
    return (
      <div className="constructor-editor">
        <label>ნაგულისხმევი წელი</label>
        <input
          type="number"
          value={value.defaultValue ?? ''}
          onChange={(e) => onChange({ ...value, defaultValue: Number(e.target.value) })}
        />
      </div>
    )
  }


// ═══════════════════════════════════════════════════════════════════════════
// How to wire editor? into FilterControlSlice (Phase 2)
// ═══════════════════════════════════════════════════════════════════════════
//
// In engine/react/src/filters/slices/cascadeSlice.tsx (Phase 2):
//
//   import { CascadeEditor } from '../../constructor/editors/CascadeEditor'
//
//   export const cascadeSlice: FilterControlSlice<string, ParamDefMap['cascade']> = {
//     Shell:        CascadeShell,
//     META: {
//       controlType: 'cascade',
//       label:       'კასკადური სელექტი',
//       icon:        'list-tree',
//       category:    'indicator',
//       schema:      cascadeFilterSchema,  // still needed: JSON editor fallback
//     },
//     defaultValue: () => '',
//     codec:        cascadeCodec,
//     editor:       CascadeEditor,         // ← Phase 2: replaces META.schema form
//   }
//
//
// Constructor reads editor? before META.schema:
//
//   function FilterControlConfigPanel({ type }: { type: string }) {
//     const slice = filterControlRegistry.get(type)
//     if (!slice) return null
//
//     if (slice.editor) {
//       const Editor = slice.editor
//       return <Editor value={currentConfig} onChange={updateConfig} />
//     }
//
//     // fallback: generic field form from META.schema
//     return <ConstructorSchemaForm schema={slice.META.schema} ... />
//   }


// ═══════════════════════════════════════════════════════════════════════════
// Phase 1 → Phase 2 migration (no breaking changes)
// ═══════════════════════════════════════════════════════════════════════════
//
// Phase 1: all slices have editor = undefined
//   → Constructor shows META.schema generic form for all filter types ✅
//
// Phase 2: add editor? to specific slices (cascade first, others as needed)
//   → Constructor shows custom editor for those types ✅
//   → Other slices: unchanged, still use META.schema ✅
//   → Existing pages in DB: unaffected (editor = config UI only, not runtime) ✅
//
// Zero migration needed for existing pages. editor? is additive.


export { CascadeEditor, YearSelectEditor }
export type { ConstructorEditorProps }
```

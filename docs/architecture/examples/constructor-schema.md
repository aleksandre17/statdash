# constructor-schema.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Example — schemaCompiler: ConstructorSchema compilation from all registries
 *
 * Demonstrates:
 * - ConstructorSchema interface (fields · groups · preview · palette)
 * - schemaCompiler.compile(type, registry) — pure function, no React dep
 * - All three registries feed into Constructor palette:
 *     nodeRegistry          → node types (section, chart, table…)
 *     filterControlRegistry → filter control types (year-select, cascade…)
 *     chromeRegistry        → shell types (AppHeader variants…)
 * - Constructor palette assembly: one unified list from all registries
 * - Phase 1 → Phase 2 migration: schema grows without breaking existing pages
 * - editor? slot: Phase 2 Constructor UI reads this to render config panel
 *
 * Platform precedents:
 *   Grafana:    PanelOptionsEditorRegistry — compiled editor per panel type
 *   Builder.io: block.inputs: Input[]     — compiled field list with UI hints
 *   Sanity CMS: defineField({ name, type, title, group, hidden })
 *
 * Rule: schemaCompiler is a pure function (engine/core — zero React).
 *       editor? slot lives in engine/react (may reference React components).
 *       Constructor imports schemaCompiler — not nodeRegistry directly.
 */

import type {
  ConstructorSchema,
  ConstructorFieldDef,
  NodeRegistryMeta,
  FilterControlMeta,
} from '@geostat/react'
import { nodeRegistry, filterControlRegistry } from '@geostat/react'


// ═══════════════════════════════════════════════════════════════════════════
// ConstructorFieldDef — one field in the Constructor config panel
// ═══════════════════════════════════════════════════════════════════════════
//
// Shown here for reference (defined in @geostat/engine — pure, no UI deps):
//
// interface ConstructorFieldDef {
//   name:        string
//   type:        string           // 'string' | 'number' | 'boolean' | 'select' | 'json' | 'code'
//   label?:      string           // Georgian UI label
//   description?: string
//   required?:   boolean
//   group?:      string           // matches ConstructorSchema.groups[].key
//   hidden?:     boolean          // conditional display handled in Constructor UI
//   options?:    Array<{ value: string; label: string }>  // for type: 'select'
// }
//
// interface ConstructorSchema {
//   fields:    ConstructorFieldDef[]
//   groups?:   Array<{ key: string; label: string; collapsed?: boolean }>
//   preview?:  string              // thumbnail path — palette tile only
//   palette:   { label: string; icon?: string; category?: string }
// }


// ═══════════════════════════════════════════════════════════════════════════
// schemaCompiler.compile() — pure function, engine/core
// ═══════════════════════════════════════════════════════════════════════════
//
// Constructor UI never touches nodeRegistry directly.
// schemaCompiler is the seam: it reads raw meta + JSON Schema,
// outputs ConstructorSchema (stable UI contract).
//
// Benefits:
//   - Constructor depends on ConstructorSchema only — not on registry internals
//   - Adding a new ConstructorSchema field = zero nodeRegistry change
//   - JSON Schema still available via nodeRegistry.getSchema() for JSON editor fallback
//   - schemaCompiler can merge hints from multiple sources (registry meta + hardcoded defaults)

interface SchemaCompilerOptions {
  collapseAdvancedByDefault?: boolean   // groups marked 'advanced' start collapsed
  locale?: string                       // 'ka' | 'en' — label fallback language
}

// Signature (implementation lives in engine/core):
declare function compileNodeSchema(
  type: string,
  meta: NodeRegistryMeta,
  opts?: SchemaCompilerOptions,
): ConstructorSchema

declare function compileFilterSchema(
  type: string,
  meta: FilterControlMeta,
  opts?: SchemaCompilerOptions,
): ConstructorSchema


// ═══════════════════════════════════════════════════════════════════════════
// Concrete ConstructorSchema examples — one per node type
// ═══════════════════════════════════════════════════════════════════════════

// ── section node ──────────────────────────────────────────────────────────

const sectionSchema: ConstructorSchema = {
  palette: { label: 'სექცია',  icon: 'layout-section', category: 'layout' },
  groups: [
    { key: 'content',  label: 'შინაარსი' },
    { key: 'data',     label: 'მონაცემები' },
    { key: 'display',  label: 'გარეგნობა' },
    { key: 'advanced', label: 'დამატებითი', collapsed: true },
  ],
  fields: [
    { name: 'title',   type: 'string',  label: 'სათაური',       group: 'content', required: true  },
    { name: 'variant', type: 'select',  label: 'სტილი',          group: 'display',
      options: [{ value: 'card', label: 'კარტა' }, { value: 'panel', label: 'პანელი' }, { value: 'hero', label: 'ჰირო' }] },
    { name: 'color',   type: 'string',  label: 'ფერი',           group: 'display'  },
    { name: 'data',    type: 'json',    label: 'DataSpec',       group: 'data',    description: 'JSON — DataSpec config' },
    { name: 'view',    type: 'json',    label: 'View Options',   group: 'advanced' },
    { name: 'id',      type: 'string',  label: 'ID (unique)',    group: 'advanced', required: true },
  ],
}

// ── chart node ────────────────────────────────────────────────────────────

const chartSchema: ConstructorSchema = {
  palette: { label: 'გრაფიკი', icon: 'chart-line', category: 'data' },
  groups: [
    { key: 'type',     label: 'ტიპი' },
    { key: 'encoding', label: 'ენკოდინგი' },
    { key: 'display',  label: 'გარეგნობა' },
  ],
  fields: [
    { name: 'chartType', type: 'select', label: 'გრაფიკის ტიპი', group: 'type', required: true,
      options: [
        { value: 'bar',    label: 'სვეტი'   },
        { value: 'hbar',   label: 'ჰ-სვეტი' },
        { value: 'line',   label: 'ხაზი'    },
        { value: 'area',   label: 'ფართობი' },
        { value: 'donut',  label: 'დონატი'  },
        { value: 'treemap',label: 'ტრიმეფი' },
      ]},
    { name: 'height',    type: 'number', label: 'სიმაღლე (px)', group: 'display' },
    { name: 'stacked',   type: 'boolean',label: 'დაწყობილი',    group: 'display' },
    { name: 'label',     type: 'string', label: 'სათაური',      group: 'display' },
    { name: 'encoding',  type: 'json',   label: 'Encoding',     group: 'encoding', description: 'Grammar of Graphics channel bindings' },
    { name: 'fieldConfig', type: 'json', label: 'ველის კონფიგ.', group: 'display' },
  ],
}

// ── table node ────────────────────────────────────────────────────────────

const tableSchema: ConstructorSchema = {
  palette: { label: 'ცხრილი', icon: 'table', category: 'data' },
  groups: [
    { key: 'columns',  label: 'სვეტები' },
    { key: 'display',  label: 'გარეგნობა' },
    { key: 'advanced', label: 'დამატებითი', collapsed: true },
  ],
  fields: [
    { name: 'colLabel', type: 'string',  label: 'პირველი სვეტის სათაური', group: 'columns' },
    { name: 'columns',  type: 'json',    label: 'სვეტები (ColumnDef[])',   group: 'columns', required: true },
    { name: 'footer',   type: 'json',    label: 'ჯამური სტრიქონი',        group: 'display' },
    { name: 'color',    type: 'string',  label: 'სათაურის ფერი',          group: 'display' },
    { name: 'id',       type: 'string',  label: 'ID',                     group: 'advanced' },
  ],
}

// ── kpi-strip node ────────────────────────────────────────────────────────

const kpiStripSchema: ConstructorSchema = {
  palette: { label: 'KPI ზოლი', icon: 'bar-chart', category: 'data' },
  groups: [
    { key: 'data',     label: 'მონაცემები' },
    { key: 'display',  label: 'გარეგნობა' },
  ],
  fields: [
    { name: 'data', type: 'json',   label: 'DataSpec',  group: 'data',    required: true },
    { name: 'id',   type: 'string', label: 'ID',        group: 'display' },
  ],
}

// ── filter-bar node ───────────────────────────────────────────────────────

const filterBarSchema: ConstructorSchema = {
  palette: { label: 'ფილტრის პანელი', icon: 'filter', category: 'layout' },
  groups: [
    { key: 'bars',     label: 'ფილტრის ზოლები' },
    { key: 'advanced', label: 'დამატებითი', collapsed: true },
  ],
  fields: [
    { name: 'bars', type: 'json', label: 'Bar კონფიგ. (BarDefMap)', group: 'bars', required: true,
      description: 'key → { position: sticky|float, filters: { key: ParamDef } }' },
    { name: 'id',   type: 'string', label: 'ID', group: 'advanced' },
  ],
}


// ═══════════════════════════════════════════════════════════════════════════
// Filter control ConstructorSchemas — filterControlRegistry.list()
// ═══════════════════════════════════════════════════════════════════════════
//
// filterControlRegistry.list() → FilterControlMeta[]
// Each META.schema → ConstructorSchema (drives Constructor's filter config panel)
//
// When Constructor user adds a filter to a FilterBar:
//   1. filterControlRegistry.list() → shows available control types in picker
//   2. User picks 'year-select'
//   3. META.schema → Constructor renders field panel (defaultValue, range…)
//   4. Output: ParamDef JSON → saved to DB → FilterBarProvider reads at runtime

const yearSelectFilterSchema: ConstructorSchema = {
  palette: { label: 'წლის სელექტი', icon: 'calendar', category: 'time' },
  fields: [
    { name: 'defaultValue', type: 'number',  label: 'ნაგულისხმევი წელი'    },
    { name: 'range',        type: 'json',    label: 'დიაპაზონი [min, max]',
      description: 'optional — defaults to classifier range' },
    { name: 'label',        type: 'string',  label: 'ლეიბელი'               },
    { name: 'dependsOn',    type: 'json',    label: 'დამოკიდებულება (keys[])',
      description: 'other filter keys this control reads' },
  ],
}

const cascadeFilterSchema: ConstructorSchema = {
  palette: { label: 'კასკადური სელექტი', icon: 'list-tree', category: 'indicator' },
  groups: [
    { key: 'data',     label: 'მონაცემები' },
    { key: 'display',  label: 'გარეგნობა' },
    { key: 'advanced', label: 'დამატებითი', collapsed: true },
  ],
  fields: [
    { name: 'options',      type: 'json',   label: 'OptionsSource (წყარო)',     group: 'data',    required: true,
      description: '{ type: "static"|"inline"|"query"|"api", ... }' },
    { name: 'defaultValue', type: 'string', label: 'ნაგულისხმევი კოდი',        group: 'display'  },
    { name: 'label',        type: 'string', label: 'ლეიბელი',                  group: 'display'  },
    { name: 'dependsOn',    type: 'json',   label: 'დამოკიდებულება (keys[])',   group: 'advanced',
      description: 'parent filter keys — cascade re-loads when parents change' },
  ],
}

const selectFilterSchema: ConstructorSchema = {
  palette: { label: 'სელექტი', icon: 'chevrons-up-down', category: 'indicator' },
  fields: [
    { name: 'options',      type: 'json',   label: 'ოფციები (SelectOption[])', required: true },
    { name: 'defaultValue', type: 'string', label: 'ნაგულისხმევი'                             },
    { name: 'label',        type: 'string', label: 'ლეიბელი'                                  },
  ],
}

const multiSelectFilterSchema: ConstructorSchema = {
  palette: { label: 'მრავალი სელექტი', icon: 'list-checks', category: 'indicator' },
  fields: [
    { name: 'options',      type: 'json',   label: 'ოფციები (SelectOption[])', required: true },
    { name: 'defaultValue', type: 'json',   label: 'ნაგულისხმევი (string[])'                 },
    { name: 'label',        type: 'string', label: 'ლეიბელი'                                  },
  ],
}

const rangeFilterSchema: ConstructorSchema = {
  palette: { label: 'დიაპაზონი', icon: 'calendar-range', category: 'time' },
  fields: [
    { name: 'defaultValue', type: 'json',   label: 'ნაგულისხმევი [from, to]' },
    { name: 'label',        type: 'string', label: 'ლეიბელი'                  },
    { name: 'dependsOn',    type: 'json',   label: 'დამოკიდებულება (keys[])'  },
  ],
}


// ═══════════════════════════════════════════════════════════════════════════
// Constructor palette assembly — all registries unified
// ═══════════════════════════════════════════════════════════════════════════
//
// Constructor UI builds ONE palette from all registries.
// Sections:
//   'nodes'   — node types (nodeRegistry.list())
//   'filters' — filter controls (filterControlRegistry.list())
//
// "Add new node type → palette auto-sees it"  ✅
// "Add new filter control → palette auto-sees it" ✅
// No Constructor code changes. Open registry pattern.

interface PaletteSection {
  key:   string
  label: string
  items: ConstructorSchema['palette'][]
}

function buildConstructorPalette(): PaletteSection[] {
  const nodeItems = nodeRegistry
    .list()
    .filter(m => m.schema != null)
    .map(m => m.schema!.palette)

  const filterItems = filterControlRegistry
    .list()
    .filter(m => m.schema != null)
    .map(m => m.schema!.palette)

  // Group by category within each section
  return [
    { key: 'nodes',   label: 'კომპონენტები', items: nodeItems   },
    { key: 'filters', label: 'ფილტრები',      items: filterItems },
  ]
}

// Result (schematic — actual types come from @geostat/react):
//
// buildConstructorPalette() →
// [
//   { key: 'nodes', label: 'კომპონენტები', items: [
//       { label: 'სექცია',          icon: 'layout-section', category: 'layout' },
//       { label: 'გრაფიკი',        icon: 'chart-line',     category: 'data'   },
//       { label: 'ცხრილი',         icon: 'table',          category: 'data'   },
//       { label: 'KPI ზოლი',       icon: 'bar-chart',      category: 'data'   },
//       { label: 'ფილტრის პანელი', icon: 'filter',         category: 'layout' },
//   ]},
//   { key: 'filters', label: 'ფილტრები', items: [
//       { label: 'წლის სელექტი',       icon: 'calendar',          category: 'time'      },
//       { label: 'დიაპაზონი',          icon: 'calendar-range',    category: 'time'      },
//       { label: 'კასკადური სელექტი',  icon: 'list-tree',         category: 'indicator' },
//       { label: 'სელექტი',            icon: 'chevrons-up-down',  category: 'indicator' },
//       { label: 'მრავალი სელექტი',    icon: 'list-checks',       category: 'indicator' },
//   ]},
// ]


// ═══════════════════════════════════════════════════════════════════════════
// schemaCompiler.compile() — how it derives ConstructorSchema from meta
// ═══════════════════════════════════════════════════════════════════════════
//
// Phase 1: META.schema is hand-authored (as above). schemaCompiler = identity.
// Phase 2: schemaCompiler derives fields from JSON Schema → less hand-authoring.
//
// Pure function — no side effects, no React. Lives in engine/core.
// Constructor imports this, not nodeRegistry.getSchema() directly.
// → Constructor UI depends on ConstructorSchema only. Stable seam.

function schemaCompilerPhase1(
  meta: NodeRegistryMeta | FilterControlMeta,
): ConstructorSchema | undefined {
  // Phase 1: just return what's in meta
  return 'schema' in meta ? meta.schema : undefined
}

// Phase 2 schemaCompiler will:
//   1. Read JSON Schema from meta (if present)
//   2. Merge with meta.constructorHints (field groups, conditional visibility)
//   3. Output ConstructorSchema with all fields ordered + grouped
//   4. Derive type: 'select' options from JSON Schema enum
//   5. Mark required fields from JSON Schema required[]


// ═══════════════════════════════════════════════════════════════════════════
// editor? slot — Phase 2 Constructor config panel
// ═══════════════════════════════════════════════════════════════════════════
//
// FilterControlSlice.editor? = React component rendered in Constructor's config panel.
// Phase 1: undefined — Constructor falls back to ConstructorSchema field rendering.
// Phase 2: custom React component with full UX (autocomplete, live preview, etc.)
//
// Why it's on the slice (not on META.schema):
//   - META.schema = pure data (JSON-serializable) → lives in engine/core
//   - editor = React component → lives in engine/react (has React dep)
//   - Keeps engine/core free of React. Clean layer boundary.
//
// See: filter-control-registry.tsx → editor? section for implementation pattern.
//
// Example (Phase 2):
//
//   import { CascadeEditor } from '@geostat/react/constructor'
//
//   export const cascadeSlice: FilterControlSlice<string, ParamDefMap['cascade']> = {
//     Shell: CascadeShell,
//     META: {
//       controlType: 'cascade',
//       label: 'კასკადური სელექტი',
//       schema: cascadeFilterSchema,
//     },
//     defaultValue: () => '',
//     codec: cascadeCodec,
//     editor: CascadeEditor,  // ← Phase 2: custom config panel in Constructor
//   }
//
//   function CascadeEditor({ value, onChange }: ConstructorEditorProps<ParamDefMap['cascade']>) {
//     // full UX: dataset picker from /api/catalog, preview of loaded options, etc.
//     return <OptionsSourcePicker value={value.options} onChange={src => onChange({ ...value, options: src })} />
//   }


// ═══════════════════════════════════════════════════════════════════════════
// Phase 1 → Phase 2 migration — zero breaking changes
// ═══════════════════════════════════════════════════════════════════════════
//
// Existing pages (DB JSON) are unaffected by schema additions.
// ConstructorSchema is read-only by Constructor — never stored.
// Adding a new field to ConstructorSchema:
//   → Constructor form shows new field
//   → Existing pages: field absent → renderer uses its default
//   → No migration needed ✅
//
// Adding a new filter control type:
//   → Register slice with filterControlRegistry.register(newSlice)
//   → filterControlRegistry.list() returns it
//   → Constructor palette shows new type ✅
//   → Existing pages: unaffected ✅
//
// Adding a new node type:
//   → Register with nodeRegistry.register(type, renderer, meta)
//   → nodeRegistry.list() returns it → Constructor palette shows it ✅
//   → Existing pages: unaffected ✅
//
// This is the open/closed principle at platform level:
//   Open for extension (new types, new fields)
//   Closed for modification (no changes to existing types needed)


// Suppress unused variable warnings (examples only)
export type { SchemaCompilerOptions }
export {
  sectionSchema, chartSchema, tableSchema, kpiStripSchema, filterBarSchema,
  yearSelectFilterSchema, cascadeFilterSchema, selectFilterSchema,
  multiSelectFilterSchema, rangeFilterSchema,
  buildConstructorPalette, schemaCompilerPhase1,
}
```

# filter-control-registry.tsx

> Reference example (TypeScript) — documentation, not compiled source.

```tsx
/**
 * Example — FilterControl Registry: full formal design (Phase 1 + Phase 2 ready)
 *
 * Three concerns, one slice:
 *   Shell:    renders the control UI              (React component, no onChange prop)
 *   META:     Constructor-facing metadata          (JSON-serializable ✅)
 *   Runtime:  codec · defaultValue · validate? · formatValue? · editor? (Phase 2 slot)
 *
 * Platform precedents:
 *   Grafana variableAdapters  — component + URL codec + validation + normalize, full slice
 *   Builder.io registered inputs — type + component + schema (palette + form editor)
 *   TanStack Form             — field.value + field.set, no onChange prop drilling
 *
 * Open/Closed:
 *   New control type = one ControlSlice file + one barrel entry.
 *   Zero changes to FilterBarShell, FilterContext, FilterBarProvider, or any existing slice.
 *
 * Constructor readiness:
 *   filterControlRegistry.list() → Constructor filter palette (META for each type)
 *   META.schema (ConstructorSchema) → Constructor form editor renders inputs
 *   slice.editor? → Phase 2: custom Constructor config UI; Phase 1: omit (generic schema renderer)
 *   All META fields JSON-serializable ✅
 */

import React                                       from 'react'
import type { ComponentType }                      from 'react'
import type { ParamDef, ParamDefMap,
              SectionContext, SelectOption,
              ConstructorSchema }                  from '@geostat/engine'
import type { FilterControlSlice,
              FilterControlProps,
              FilterControlMeta,
              FilterCodec,
              OptionsLoader,
              DependencyGraph,
              DependencyNode,
              FilterBarSpec,
              ActiveFilter,
              FilterBarNodeDef,
              RenderContext,
              NodeRenderer }                       from '@geostat/react'
import { useFilter, useFilterBars,
         filterControlRegistry }                   from '@geostat/react'
import { useStores, useStoreQuery }                from '@geostat/react'


// ═══════════════════════════════════════════════════════════════════════════
// Dependency graph — formal filter dependency tracking
// ═══════════════════════════════════════════════════════════════════════════
//
//  Built by FilterBarProvider from ParamDefBase.dependsOn declarations.
//  Topological sort → resolve order. Circular dep → schema error.
//
//  Grafana: variables.resolveOrder() — same concept.
//  Our version: pure function, no side effects, testable in isolation.

function buildDependencyGraph(bars: Record<string, { filters: Record<string, ParamDef> }>): DependencyGraph {
  const allFilters = Object.values(bars).flatMap(bar => Object.entries(bar.filters))
  const nodes: DependencyNode[] = []
  const visited   = new Set<string>()
  const inStack   = new Set<string>()
  let   hasCycle  = false

  function topoVisit(key: string, deps: string[], level: number): void {
    if (inStack.has(key)) { hasCycle = true; return }
    if (visited.has(key)) return
    inStack.add(key)
    const maxChildLevel = deps.reduce((max, dep) => {
      const depNode = nodes.find(n => n.key === dep)
      return depNode ? Math.max(max, depNode.level + 1) : max
    }, 0)
    nodes.push({ key, deps, level: Math.max(level, maxChildLevel) })
    visited.add(key)
    inStack.delete(key)
  }

  for (const [key, def] of allFilters) {
    topoVisit(key, def.dependsOn ?? [], 0)
  }

  const order = nodes.slice().sort((a, b) => a.level - b.level).map(n => n.key)
  return { nodes, order, hasCycle }
}


// ═══════════════════════════════════════════════════════════════════════════
// FilterBarProvider — computes FilterBarSpec[] + provides context
// ═══════════════════════════════════════════════════════════════════════════
//
//  Bridges config world (BarDef) → runtime world (FilterBarSpec[]).
//  FilterBarRenderer injects this. Shell calls useFilterBars() to read it.
//  Injects SectionContext for cascade $ctx ref resolution.
//
//  Responsibility split (Grafana panel pattern):
//    FilterBarProvider: graph build, dependency resolution, loading aggregation
//    FilterBarShell:    layout, clear buttons, error display
//    FilterControlSlot: registry dispatch, Shell render
//    Shell:             the input control only (useFilter inside)


// ═══════════════════════════════════════════════════════════════════════════
// FilterBarShell — registry consumer, no switch/if
// ═══════════════════════════════════════════════════════════════════════════
//
//  Uses useFilterBars() — reads FilterBarSpec[] from FilterBarProvider.
//  For each filter: registry lookup → Shell dispatch → clear button → error.
//  No knowledge of specific control types. Open/Closed: new type = zero changes here.

export const FilterBarShell: NodeRenderer<FilterBarNodeDef> = (_def, ctx) => {
  return <FilterBarControl ctx={ctx} />
}

function FilterBarControl({ ctx }: { ctx: RenderContext }) {
  const bars = useFilterBars()   // FilterBarSpec[] from FilterBarProvider

  return (
    <div className="filter-bar-wrapper">
      {bars.map(bar => (
        <div
          key={bar.barId}
          className={`filter-bar filter-bar--${bar.position}`}
          style={{ order: bar.order }}
        >
          {bar.filters.map(filter => (
            <FilterControlSlot key={filter.key} filter={filter} ctx={ctx} />
          ))}
          {bar.errors.length > 0 && (
            <ul className="filter-bar__errors" role="alert">
              {bar.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

// ── FilterControlSlot — one filter cell ──────────────────────────────────
//
//  Reads current value from FilterContext (via useFilter hook).
//  Dispatches to registered Shell — no switch/if on type.
//  FilterBarShell owns: clear button + error message (layout concern).
//  Shell owns: the input control only.

function FilterControlSlot({ filter, ctx }: { filter: ActiveFilter; ctx: RenderContext }) {
  const activeFilter = useFilter(filter.key)
  const slice        = filterControlRegistry.get(filter.paramDef.type)

  if (!slice) return null

  const value   = activeFilter.value ?? slice.defaultValue(filter.paramDef)
  const isEmpty = slice.codec.isEmpty(value as never)
  const error   = slice.validate?.(value as never, filter.paramDef, ctx.scope as never) ?? null
  const label   = slice.formatValue
    ? slice.formatValue(value as never, filter.paramDef)
    : String(value)

  const Shell = slice.Shell as ComponentType<FilterControlProps>

  return (
    <div className={`filter-control${error ? ' filter-control--error' : ''}${filter.waitingFor?.length ? ' filter-control--waiting' : ''}`}>
      {filter.waitingFor && filter.waitingFor.length > 0 ? (
        <div className="filter-control__waiting" aria-disabled="true">
          {filter.waitingFor.join(', ')} — ჯერ აირჩიეთ
        </div>
      ) : (
        <Shell filterKey={filter.key} config={filter.paramDef} />
      )}

      {!isEmpty && !filter.waitingFor?.length && (
        <button
          className="filter-control__clear"
          aria-label={`Clear ${slice.META.label}`}
          onClick={() => activeFilter.reset()}
        >
          ×
        </button>
      )}

      {error && (
        <span className="filter-control__error" role="alert">{error}</span>
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// Built-in slices — plugins/controls/
// ═══════════════════════════════════════════════════════════════════════════
//
//  Each slice lives at: plugins/controls/{controlType}/index.ts
//  Registered via barrel + registerSlice in setupRegistrations.ts
//
//  Folder structure:
//    plugins/controls/
//      year-select/index.ts
//      select/index.ts
//      multi-select/index.ts
//      range/index.ts
//      cascade/index.ts
//      hidden/index.ts
//      index.ts  ← barrel: export * as yearSelect from './year-select' etc.
//
//  ConstructorSchema fields reference:
//    name     → ParamDef field name
//    type     → value type string (for Constructor form input selection)
//    label    → friendly label in Constructor form
//    required → shows asterisk + blocks save if empty
//    group    → tab/section grouping in Constructor form


// ── year-select ─────────────────────────────────────────────────────────────

type YearSelectDef = ParamDefMap['year-select']

function YearSelectShell({ filterKey, config }: FilterControlProps<YearSelectDef>) {
  const filter  = useFilter<number>(filterKey)
  const current = filter.value ?? yearSelectSlice.defaultValue(config)

  const years = config.range
    ? Array.from(
        { length: config.range[1] - config.range[0] + 1 },
        (_, i) => config.range![0] + i,
      ).reverse()
    : []

  return (
    <select
      className="filter-control__select"
      value={current}
      onChange={e => filter.set(Number(e.target.value))}
      aria-label={config.range ? `${config.range[0]}–${config.range[1]}` : 'Year'}
    >
      {years.map(y => <option key={y} value={y}>{y}</option>)}
    </select>
  )
}

const yearSelectSchema: ConstructorSchema = {
  palette: { label: 'Year Selector', icon: 'calendar', category: 'time' },
  fields: [
    { name: 'range',        type: '[number, number]', label: 'Year range',     required: true  },
    { name: 'defaultValue', type: 'number',           label: 'Default year',   required: false },
    { name: 'dependsOn',    type: 'string[]',         label: 'Depends on',     required: false, group: 'advanced' },
  ],
}

export const yearSelectSlice: FilterControlSlice<number, YearSelectDef> = {
  Shell:        YearSelectShell,
  META: {
    controlType: 'year-select',
    label:       'Year Selector',
    description: 'Single-year dropdown from a numeric range',
    category:    'time',
    icon:        'calendar',
    schema:      yearSelectSchema,
  },
  defaultValue: (config) => config.range?.[1] ?? new Date().getFullYear(),
  codec: {
    toUrl:     v  => String(v),
    fromUrl:   s  => s ? parseInt(s, 10) : null,
    isEmpty:   v  => v == null || !Number.isFinite(v),
    normalize: raw => typeof raw === 'number' ? raw : parseInt(String(raw), 10),
  },
  validate: (v, config) => {
    if (!config.range) return null
    const [min, max] = config.range
    return v >= min && v <= max ? null : `Year must be between ${min} and ${max}`
  },
  formatValue: (v) => String(v),
  // editor?: Phase 2 — custom Constructor form for year-select
  //   YearSelectEditor: shows visual year range slider instead of number inputs
}


// ── select ──────────────────────────────────────────────────────────────────

type SelectDef = ParamDefMap['select']

function SelectShell({ filterKey, config }: FilterControlProps<SelectDef>) {
  const filter  = useFilter<string>(filterKey)
  const current = filter.value ?? selectSlice.defaultValue(config)

  return (
    <select
      className="filter-control__select"
      value={current ?? ''}
      onChange={e => filter.set(e.target.value)}
    >
      {config.options.map(opt => (
        <option key={String(opt.value)} value={String(opt.value)}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

const selectSchema: ConstructorSchema = {
  palette: { label: 'Dropdown', icon: 'chevron-down', category: 'indicator' },
  fields: [
    { name: 'options',      type: 'SelectOption[]', label: 'Options',      required: true  },
    { name: 'defaultValue', type: 'string',         label: 'Default',      required: false },
  ],
}

export const selectSlice: FilterControlSlice<string, SelectDef> = {
  Shell:        SelectShell,
  META:         { controlType: 'select', label: 'Dropdown', category: 'indicator', icon: 'chevron-down', schema: selectSchema },
  defaultValue: (config) => String(config.defaultValue ?? config.options[0]?.value ?? ''),
  codec: {
    toUrl:     v  => v || null,
    fromUrl:   s  => s,
    isEmpty:   v  => v == null || v === '',
    normalize: raw => String(raw ?? ''),
  },
  formatValue: (v, config) =>
    config.options.find(o => String(o.value) === v)?.label ?? v,
}


// ── multi-select ─────────────────────────────────────────────────────────────

type MultiSelectDef = ParamDefMap['multi-select']

function MultiSelectShell({ filterKey, config }: FilterControlProps<MultiSelectDef>) {
  const filter  = useFilter<string[]>(filterKey)
  const current = filter.value ?? multiSelectSlice.defaultValue(config)

  const toggle = (val: string) => {
    const next = current.includes(val)
      ? current.filter(v => v !== val)
      : [...current, val]
    filter.set(next)
  }

  return (
    <fieldset className="filter-control__multiselect">
      <legend className="sr-only">{config.defaultValue ?? 'Select'}</legend>
      {config.options.map(opt => {
        const v = String(opt.value)
        return (
          <label key={v} className="filter-control__checkbox-label">
            <input type="checkbox" checked={current.includes(v)} onChange={() => toggle(v)} />
            {opt.label}
          </label>
        )
      })}
    </fieldset>
  )
}

const multiSelectSchema: ConstructorSchema = {
  palette: { label: 'Multi-select', icon: 'check-square', category: 'geo' },
  fields: [
    { name: 'options',      type: 'SelectOption[]', label: 'Options',  required: true  },
    { name: 'defaultValue', type: 'string[]',       label: 'Defaults', required: false },
  ],
}

export const multiSelectSlice: FilterControlSlice<string[], MultiSelectDef> = {
  Shell:        MultiSelectShell,
  META:         { controlType: 'multi-select', label: 'Multi-select', category: 'geo', icon: 'check-square', schema: multiSelectSchema },
  defaultValue: (config) => config.defaultValue ?? [],
  codec: {
    toUrl:     v  => v.length > 0 ? v.join(',') : null,
    fromUrl:   s  => s ? s.split(',').filter(Boolean) : null,
    isEmpty:   v  => !v || v.length === 0,
    normalize: raw => Array.isArray(raw) ? raw.map(String) : [],
  },
  validate: (v, config) => {
    const valid = new Set(config.options.map(o => String(o.value)))
    const bad   = v.filter(x => !valid.has(x))
    return bad.length === 0 ? null : `Unknown values: ${bad.join(', ')}`
  },
  formatValue: (v, config) => {
    if (v.length === 0) return ''
    if (v.length === 1) return config.options.find(o => String(o.value) === v[0])?.label ?? v[0]
    return `${v.length} selected`
  },
}


// ── range ────────────────────────────────────────────────────────────────────

type RangeDef   = ParamDefMap['range']
type RangeValue = [number, number]

function RangeShell({ filterKey, config }: FilterControlProps<RangeDef>) {
  const filter  = useFilter<RangeValue>(filterKey)
  const current = filter.value ?? rangeSlice.defaultValue(config)

  return (
    <div className="filter-control__range">
      <input type="number" value={current[0]} aria-label="From"
        onChange={e => filter.set([Number(e.target.value), current[1]])} />
      <span className="filter-control__range-sep" aria-hidden="true">–</span>
      <input type="number" value={current[1]} aria-label="To"
        onChange={e => filter.set([current[0], Number(e.target.value)])} />
    </div>
  )
}

const rangeSchema: ConstructorSchema = {
  palette: { label: 'Year Range', icon: 'calendar-range', category: 'time' },
  fields: [
    { name: 'defaultValue', type: '[number, number]', label: 'Default range', required: false },
  ],
}

export const rangeSlice: FilterControlSlice<RangeValue, RangeDef> = {
  Shell:        RangeShell,
  META:         { controlType: 'range', label: 'Year Range', category: 'time', icon: 'calendar-range', schema: rangeSchema },
  defaultValue: (config) => config.defaultValue ?? [2000, new Date().getFullYear()],
  codec: {
    toUrl:     v  => v.join(','),
    fromUrl:   s  => s ? (s.split(',').map(Number) as RangeValue) : null,
    isEmpty:   v  => !v || v.length !== 2,
    normalize: raw => Array.isArray(raw) ? raw.map(Number) as RangeValue : [2000, 2024],
  },
  validate: (v) => v[0] <= v[1] ? null : `Start year (${v[0]}) must not exceed end year (${v[1]})`,
  formatValue: (v) => `${v[0]}–${v[1]}`,
}


// ── cascade ──────────────────────────────────────────────────────────────────
//
//  Options loaded from DataStore — uses OptionsLoader protocol.
//  Key example of WHY Shell must be React component (hooks required for async loading).
//  SectionContext injected via useFilterContext() — resolves { $ctx: 'geo' } refs.
//
//  OptionsLoader protocol (formal async contract):
//    Phase 1: useStores() + useStoreQuery() directly in Shell
//    Phase 2: FilterBarProvider injects loader via context →
//             Shell calls useOptionsLoader(filterKey) → same SelectOption[]
//             → Constructor live preview calls same loader without React

type CascadeDef = ParamDefMap['cascade']

function CascadeShell({ filterKey, config }: FilterControlProps<CascadeDef>) {
  const filter    = useFilter<string>(filterKey)
  const { state } = useFilterContext()          // current dims for $ctx ref resolution
  const stores    = useStores()
  const current   = filter.value ?? cascadeSlice.defaultValue(config)

  // Async options from OptionsSource — ctx resolves parent-driven $ctx refs
  const { data: options = [], isLoading } = useOptionsSource(
    config.options,
    stores,
    state,    // SectionContext — parent filter dims flow here via $ctx
  )

  if (isLoading) {
    return <div className="filter-control__loading" aria-busy="true" aria-label="Loading options" />
  }

  return (
    <select
      className="filter-control__select"
      value={current ?? ''}
      onChange={e => filter.set(e.target.value)}
    >
      <option value="">— all —</option>
      {options.map((opt: SelectOption) => (
        <option key={String(opt.value)} value={String(opt.value)}>{opt.label}</option>
      ))}
    </select>
  )
}

const cascadeSchema: ConstructorSchema = {
  palette: { label: 'Cascade Select', icon: 'git-branch', category: 'geo' },
  fields: [
    { name: 'options',      type: 'OptionsSource', label: 'Options source', required: true  },
    { name: 'defaultValue', type: 'string',        label: 'Default',        required: false },
    { name: 'dependsOn',    type: 'string[]',      label: 'Depends on',     required: false, group: 'advanced' },
  ],
}

export const cascadeSlice: FilterControlSlice<string, CascadeDef> = {
  Shell:        CascadeShell,
  META: {
    controlType: 'cascade',
    label:       'Cascade Select',
    description: 'Options loaded from DataStore (geography, category hierarchy)',
    category:    'geo',
    icon:        'git-branch',
    schema:      cascadeSchema,
  },
  defaultValue: (config) => config.defaultValue ?? '',
  codec: {
    toUrl:     v  => v || null,
    fromUrl:   s  => s,
    isEmpty:   v  => v == null || v === '',
    normalize: raw => String(raw ?? ''),
  },
  formatValue: (v) => v,
}


// ── hidden ───────────────────────────────────────────────────────────────────
//
//  No UI. Value lives in FilterContext for internal state + permalink.
//  codec.toUrl = null → NOT written to URL (internal params stay internal).
//  HiddenShell seeds defaultValue into context on mount.

function HiddenShell({ filterKey, config }: FilterControlProps) {
  const filter = useFilter(filterKey)
  React.useEffect(() => {
    if (filter.value == null) {
      const def = config as ParamDefMap['hidden']
      if (def.defaultValue != null) filter.set(def.defaultValue as never)
    }
  }, [])    // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export const hiddenSlice: FilterControlSlice<unknown, ParamDefMap['hidden']> = {
  Shell:        HiddenShell,
  META: {
    controlType: 'hidden',
    label:       'Hidden Param',
    description: 'Internal state — no UI, value from config defaultValue. Not in URL.',
    category:    'indicator',
    icon:        'eye-off',
  },
  defaultValue: (config) => config.defaultValue,
  codec: {
    toUrl:     _  => null,       // never in URL — internal only
    fromUrl:   _  => null,
    isEmpty:   v  => v == null,
    normalize: raw => raw,
  },
}


// ═══════════════════════════════════════════════════════════════════════════
// Registration + Constructor integration
// ═══════════════════════════════════════════════════════════════════════════

// plugins/controls/index.ts — barrel:
//   export * as yearSelect  from './year-select'
//   export * as select      from './select'
//   export * as multiSelect from './multi-select'
//   export * as range       from './range'
//   export * as cascade     from './cascade'
//   export * as hidden      from './hidden'

// src/setupRegistrations.ts:
//   import * as Controls from '../plugins/controls'
//   Object.values(Controls).forEach(registerSlice)
//
//   registerSlice dispatch (isControlSlice → filterControlRegistry.register(slice)):
//   } else if (isControlSlice(mod)) {
//     filterControlRegistry.register(mod)   // stores full slice keyed by META.controlType
//   }

// Constructor palette — filterControlRegistry.list():
//   [
//     { controlType:'year-select', label:'Year Selector', category:'time',      icon:'calendar',       schema:{...} },
//     { controlType:'range',       label:'Year Range',    category:'time',      icon:'calendar-range', schema:{...} },
//     { controlType:'select',      label:'Dropdown',      category:'indicator', icon:'chevron-down',   schema:{...} },
//     { controlType:'multi-select',label:'Multi-select',  category:'geo',       icon:'check-square',   schema:{...} },
//     { controlType:'cascade',     label:'Cascade Select',category:'geo',       icon:'git-branch',     schema:{...} },
//     { controlType:'hidden',      label:'Hidden Param',  category:'indicator', icon:'eye-off'                      },
//   ]
// Constructor groups by category → filter palette sidebar:
//   time:      [Year Selector, Year Range]
//   geo:       [Cascade Select, Multi-select]
//   indicator: [Dropdown, Hidden Param]

// Constructor form for year-select (META.schema → ConstructorFieldDef[]):
//   range: [number, number] → Constructor renders two number inputs (min/max)
//   defaultValue: number    → Constructor renders number input
//   Phase 2: yearSelectSlice.editor → custom year range slider instead of number inputs


// ═══════════════════════════════════════════════════════════════════════════
// Phase 2 — editor slot example (future, do not implement now)
// ═══════════════════════════════════════════════════════════════════════════
//
//  When Constructor needs richer config UI than generic schema renderer:
//
//  export const yearSelectSlice: FilterControlSlice<number, YearSelectDef> = {
//    ...yearSelectSlice,
//    editor: function YearSelectEditor({ config, onChange }) {
//      return (
//        <div className="constructor-year-range-editor">
//          <YearRangeSlider
//            min={config.range?.[0] ?? 2000}
//            max={config.range?.[1] ?? 2024}
//            onChange={(range) => onChange({ ...config, range })}
//          />
//          <NumberInput
//            label="Default year"
//            value={config.defaultValue}
//            onChange={(v) => onChange({ ...config, defaultValue: v })}
//          />
//        </div>
//      )
//    },
//  }
//
//  Constructor uses editor when present:
//    const slice = filterControlRegistry.get('year-select')
//    if (slice?.editor) return <slice.editor config={paramDef} onChange={save} />
//    return <GenericSchemaForm schema={slice?.META.schema} ... />


// ═══════════════════════════════════════════════════════════════════════════
// Adding a new control type — the full workflow (Constructor auto-sees it)
// ═══════════════════════════════════════════════════════════════════════════
//
//  1. Declare ParamDef shape (plugins/controls/date-picker/types.ts):
//
//     declare module '@geostat/engine' {
//       interface ParamDefMap {
//         'date-picker': ParamDefBase & { type: 'date-picker'; format?: string; defaultValue?: string }
//       }
//     }
//
//  2. Write slice (plugins/controls/date-picker/index.ts):
//
//     type DatePickerDef = ParamDefMap['date-picker']
//
//     function DatePickerShell({ filterKey, config }: FilterControlProps<DatePickerDef>) {
//       const filter = useFilter<string>(filterKey)
//       return <input type="date" value={filter.value ?? ''} onChange={e => filter.set(e.target.value)} />
//     }
//
//     export const datePickerSlice: FilterControlSlice<string, DatePickerDef> = {
//       Shell:        DatePickerShell,
//       META:         { controlType: 'date-picker', label: 'Date Picker', category: 'time', icon: 'calendar-days',
//                       schema: { palette: { label:'Date Picker', category:'time' }, fields: [{ name:'format', type:'string', label:'Date format' }] } },
//       defaultValue: (_config) => new Date().toISOString().slice(0, 10),
//       codec:        { toUrl: v => v, fromUrl: s => s, isEmpty: v => !v, normalize: raw => String(raw ?? '') },
//     }
//
//  3. Add to barrel (plugins/controls/index.ts):
//     export * as datePicker from './date-picker'
//
//  4. Result:
//     filterControlRegistry.list() → now includes date-picker META
//     Constructor filter palette   → shows 'Date Picker' in 'time' group ✅
//     Existing slices              → zero changes ✅
//     engine / engine/react      → zero changes ✅


// ═══════════════════════════════════════════════════════════════════════════
// Anti-patterns
// ═══════════════════════════════════════════════════════════════════════════

// ❌ switch/if on controlType:
//   if (filter.type === 'year-select') return <YearSelectShell ... />
//   → Closed to extension. New type = edit this. Not Open/Closed.
// ✅ Registry dispatch:
//   const slice = filterControlRegistry.get(filter.paramDef.type)
//   return slice ? <slice.Shell filterKey={filter.key} config={filter.paramDef} /> : null

// ❌ onChange prop on Shell:
//   <YearSelectShell value={v} onChange={setV} />
//   → Shell controlled externally. Tight coupling.
// ✅ useFilter hook inside Shell:
//   const filter = useFilter<number>(filterKey)   // Shell owns state access

// ❌ codec missing normalize:
//   codec: { toUrl: v => String(v), fromUrl: s => s }
//   → URL returns "2023" string, type mismatch downstream.
// ✅ normalize on every codec:
//   normalize: raw => parseInt(String(raw), 10)

// ❌ ParamDef as closed union:
//   type ParamDef = { type: 'year-select' } | { type: 'select' } | …
//   → New type requires engine core PR. Not extensible.
// ✅ ParamDefMap module augmentation:
//   interface ParamDefMap { 'year-select': … }   // base
//   declare module '@geostat/engine' { interface ParamDefMap { 'date-picker': … } }   // extension

// ❌ register(type, control, codec) — split storage:
//   filterControlRegistry.register('year-select', YearSelectControl, { encode, decode })
//   → codec and Shell stored separately → drift possible.
// ✅ register(slice) — full slice:
//   filterControlRegistry.register(yearSelectSlice)
//   → Shell + codec + META + validate always in sync. Structurally impossible to drift.

// ❌ brand in control CSS:
//   .year-select--geostat { background: #005A9C }
// ✅ token-driven:
//   .filter-control__select { border-color: var(--color-border) }
//   .filter-control__select:focus { border-color: var(--color-primary) }
```

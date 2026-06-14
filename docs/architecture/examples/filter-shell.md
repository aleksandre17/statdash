# filter-shell.tsx

> Reference example (TypeScript) — documentation, not compiled source.

```tsx
/**
 * Example — FilterBar shell architecture: WHY + communication flow
 *
 * Scope: shell-level concerns — how FilterBarShell dispatches controls,
 *   why onChange is NOT on ActiveFilter, FilterCodec URL pattern.
 * For full FilterControlSlice (Shell+META+codec+validate+formatValue):
 *   → see filter-control-registry.tsx
 *
 * Demonstrates:
 * - WHY onChange was removed from ActiveFilter
 * - HOW shell communicates filter state changes via useFilter() hook
 * - ActiveFilter = display data only (key, paramDef, value)
 * - Filter control registry — Open/Closed: register, never switch/if on type
 * - FilterBarShellProps: def + bars (resolved FilterBarSpec[])
 * - FilterCodec — URL encode/decode, Grafana variableAdapters pattern
 */

import type { FC }                                    from 'react'
import { useFilter }                                  from '@geostat/react'
import type { FilterBarShellProps, ActiveFilter,
              ParamDef, DimVal }                      from '@geostat/react'


// ═══════════════════════════════════════════════════════════════════════════
// WHY onChange is NOT on ActiveFilter
// ═══════════════════════════════════════════════════════════════════════════
//
// ActiveFilter = display data only — what to render:
//   key:      string          — which filter param
//   paramDef: ParamDef        — type, options, defaultValue, ...
//   value:    DimVal|DimVal[] — current value
//
// Shell decides HOW to handle state updates via useFilter() hook.
// Passing onChange on ActiveFilter = coupling shell to callback pattern = narrowing.
//
// Communication: shell → useFilter() → FilterContext → URL state → re-render


// ═══════════════════════════════════════════════════════════════════════════
// Filter control registry — Open/Closed principle
// ═══════════════════════════════════════════════════════════════════════════
//
// Never switch/if on paramDef.type — that's closed.
// Register a component per type — that's open.
// New type (e.g. 'date-picker') = registerFilterControl() — zero existing code changes.

interface FilterControlProps {
  filter:       ActiveFilter
  currentValue: DimVal | DimVal[] | undefined
  onCommit:     (v: DimVal | DimVal[]) => void
}

type FilterControlFC = FC<FilterControlProps>

// ── FilterCodec — URL encode/decode per param type ─────────────────────
//
//  Grafana variableAdapters pattern: each type bundles ALL its concerns
//  (component + URL serialization) in one registration.
//  One registry → component and URL codec always in sync. Zero drift.
//
//  encode: DimVal → URL string   (called on every filter change)
//  decode: URL string → DimVal   (called on mount + browser navigation)

export interface FilterCodec {
  encode: (val: DimVal | DimVal[]) => string
  decode: (raw: string)            => DimVal | DimVal[]
}

// Fallback for types with no explicit codec (treat as opaque string):
const STRING_CODEC: FilterCodec = {
  encode: (v) => String(v),
  decode: (v) => v,
}

interface FilterControlRegistration {
  component: FilterControlFC
  codec:     FilterCodec
}

const filterControlRegistry: Record<string, FilterControlRegistration> = {}

// registerFilterControl — one call per type at startup.
//   component: renders the filter UI
//   codec:     reads/writes URL state
//
// Adding a new type (e.g. 'date-picker'):
//   registerFilterControl('date-picker', DatePickerControl, {
//     encode: (v) => String(v),
//     decode: (raw) => raw,
//   })
//   → zero existing code changes (Open/Closed ✅)
export function registerFilterControl(
  type:      string,
  component: FilterControlFC,
  codec:     FilterCodec = STRING_CODEC,
): void {
  filterControlRegistry[type] = { component, codec }
}

// getFilterCodec — used by useFilters() to read/write URL params.
//   No switch/if — O(1) registry lookup.
export function getFilterCodec(type: string): FilterCodec {
  return filterControlRegistry[type]?.codec ?? STRING_CODEC
}

// FilterControl — dispatches by type string. zero switch/if.
function FilterControl(props: FilterControlProps) {
  const reg = filterControlRegistry[props.filter.paramDef.type]
  if (!reg) return null
  return <reg.component {...props} />
}


// ═══════════════════════════════════════════════════════════════════════════
// Built-in filter controls — registered in src/app/setupEngine.ts
// ═══════════════════════════════════════════════════════════════════════════
//
// Same pattern as engine.extend(nodeRegistry) — one registration call at startup.
// Add new filter type: registerFilterControl('date-picker', DatePickerControl)

function YearSelectControl({ filter, currentValue, onCommit }: FilterControlProps) {
  const paramDef = filter.paramDef as Extract<ParamDef, { type: 'year-select' }>
  // years: YearsSource resolved by useFilters() → string[] passed to shell
  // defaultValue: resolved OptionsDefault → number
  return (
    <YearSelect
      value={currentValue as number ?? paramDef.defaultValue}
      onChange={onCommit}
    />
  )
}

function SelectControl({ filter, currentValue, onCommit }: FilterControlProps) {
  const paramDef = filter.paramDef as Extract<ParamDef, { type: 'select' }>
  // options: OptionsSource — resolved via useOptionsSource() in full slice impl
  // see filter-control-registry.tsx for complete implementation with useOptionsSource()
  return (
    <Select
      value={currentValue as string ?? paramDef.defaultValue}
      options={paramDef.options}
      onChange={onCommit}
    />
  )
}

function MultiSelectControl({ filter, currentValue, onCommit }: FilterControlProps) {
  const paramDef = filter.paramDef as Extract<ParamDef, { type: 'multi-select' }>
  // options: OptionsSource — resolved via useOptionsSource() in full slice impl
  return (
    <MultiSelect
      value={currentValue as string[] ?? paramDef.defaultValue ?? []}
      options={paramDef.options}
      onChange={onCommit}
    />
  )
}

function RangeControl({ filter, currentValue, onCommit }: FilterControlProps) {
  const paramDef = filter.paramDef as Extract<ParamDef, { type: 'range' }>
  return (
    <RangePicker
      value={currentValue as [number, number] ?? paramDef.defaultValue}
      onChange={onCommit}
    />
  )
}

function CascadeControl({ filter, currentValue, onCommit }: FilterControlProps) {
  const paramDef = filter.paramDef as Extract<ParamDef, { type: 'cascade' }>
  return (
    <CascadeSelect
      value={currentValue as string}
      options={paramDef.options}
      onChange={onCommit}
    />
  )
}

// Registration (call in src/app/setupEngine.ts alongside engine.extend):
//
//  Each entry bundles component + URL codec — Grafana variableAdapters pattern.
//  Component renders the filter UI.
//  Codec reads/writes URL state for that type. useFilters() calls getFilterCodec().
export function setupFilterControls() {
  registerFilterControl('year-select', YearSelectControl, {
    encode: (v)   => String(v),
    decode: (raw) => Number(raw),
  })
  registerFilterControl('select', SelectControl, {
    encode: (v)   => String(v),
    decode: (raw) => raw,
  })
  registerFilterControl('multi-select', MultiSelectControl, {
    encode: (v)   => (v as string[]).join(','),
    decode: (raw) => raw.split(',').filter(Boolean),
  })
  registerFilterControl('range', RangeControl, {
    encode: (v)   => (v as number[]).join(','),
    decode: (raw) => raw.split(',').map(Number) as [number, number],
  })
  registerFilterControl('cascade', CascadeControl, {
    encode: (v)   => String(v),
    decode: (raw) => raw,
  })
  registerFilterControl('hidden', () => null, {
    // hidden filters ARE encoded in URL — permalink must restore full state
    encode: (v)   => String(v),
    decode: (raw) => raw,
  })
  // New type: one call, component + URL codec together — zero existing changes:
  // registerFilterControl('date-picker', DatePickerControl, {
  //   encode: (v) => (v as Date).toISOString().slice(0, 10),   // '2023-06-15'
  //   decode: (raw) => raw,                                     // shell parses as needed
  // })
}


// ═══════════════════════════════════════════════════════════════════════════
// GeostatFilterBarShell — full implementation
// ═══════════════════════════════════════════════════════════════════════════

export function GeostatFilterBarShell({ def, bars }: FilterBarShellProps) {
  const { state, setMany } = useFilter()   // reads + writes via FilterContext

  return (
    <div className="filter-bar-wrapper">
      {bars.map(bar => (
        <div
          key={bar.barId}
          className={`filter-bar filter-bar--${bar.position}`}
          style={{ order: bar.order }}
        >
          {bar.filters.map(filter => (
            <FilterControl
              key={filter.key}
              filter={filter}
              currentValue={state[filter.key]}               // from context
              onCommit={v => setMany({ [filter.key]: v })}  // shell owns this
            />
          ))}
          {bar.errors.length > 0 && (
            <div className="filter-bar__errors">
              {bar.errors.map((e, i) => <span key={i}>{e}</span>)}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// Communication flow
// ═══════════════════════════════════════════════════════════════════════════
//
//   useFilters(schema)                     ← page component
//     → FiltersResult { ctx, bars }         ← passed to SiteRenderer
//       → FilterProvider                    ← injects FilterContext
//         → engine.renderNode(filterBarNode)
//           → GeostatFilterBarShell         ← ctx.theme.shells['filter-bar']
//             → useFilter()                 ← state + setMany from FilterContext
//             → FilterControl               ← dispatches by paramDef.type (registry)
//               → onCommit(v)               ← setMany({ key: v }) → URL update
//                 → re-render               ← new ctx.dims flows to all sections
```

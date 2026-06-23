import { useFilter }                              from '@statdash/react'
import type { ParamRangeNode }                   from '@statdash/engine'

export function RangeShell({ filterKey, config }: { filterKey: string; config: ParamRangeNode }) {
  const { state, set } = useFilter()
  const raw   = state[filterKey] ?? ''
  const parts = raw ? raw.split(',').map(Number) : []
  const from  = isNaN(parts[0]) ? (config.min ?? 0)   : parts[0]
  const to    = isNaN(parts[1]) ? (config.max ?? 100)  : parts[1]

  return (
    <div className="filter-control__range">
      <input
        type="number"
        className="filter-range-input"
        value={from}
        min={config.min}
        max={to}
        step={config.step}
        onChange={e => set(filterKey, `${e.target.value},${to}`)}
        aria-label={config.fromLabel ?? config.label}
      />
      <span className="filter-control__range-sep" aria-hidden="true">–</span>
      <input
        type="number"
        className="filter-range-input"
        value={to}
        min={from}
        max={config.max}
        step={config.step}
        onChange={e => set(filterKey, `${from},${e.target.value}`)}
        aria-label={config.toLabel ?? config.label}
      />
      {config.unit && <span className="filter-range-unit">{config.unit}</span>}
    </div>
  )
}
import { useFilter, useCurrentStore }             from '@geostat/react'
import { resolveOptions }                         from '@geostat/engine'
import type { ParamSelectNode }                   from '@geostat/engine'

const EMPTY_CTX = { timeMode: 'year' as const, dims: {} }

export function SelectShell({ filterKey, config }: { filterKey: string; config: ParamSelectNode }) {
  const { state, set } = useFilter()
  const store          = useCurrentStore()
  const current        = state[filterKey] ?? config.default ?? ''

  const options = store
    ? resolveOptions(config.options, store, EMPTY_CTX)
    : config.options.type === 'static' ? config.options.items : []

  return (
    <select
      className="filter-select filter-control__select"
      value={current}
      onChange={e => set(filterKey, e.target.value)}
      aria-label={config.label ?? 'Select'}
    >
      {config.emptyLabel !== undefined && <option value="">{config.emptyLabel}</option>}
      {options.map(o => (
        <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
      ))}
    </select>
  )
}
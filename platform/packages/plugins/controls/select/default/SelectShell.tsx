import { useFilter, useCurrentStore }             from '@statdash/react'
import { resolveOptions }                         from '@statdash/engine'
import type { ParamSelectNode }                   from '@statdash/engine'

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
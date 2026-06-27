import { useFilter, useCurrentStore, useResolveLocale } from '@statdash/react'
import { resolveYears }                           from '@statdash/engine'
import type { ParamYearSelectNode }               from '@statdash/engine'

const EMPTY_CTX = { dims: {} }

export function YearSelectShell({ filterKey, config }: { filterKey: string; config: ParamYearSelectNode }) {
  const { state, set } = useFilter()
  const store          = useCurrentStore()
  const resolveLabel   = useResolveLocale()
  const current        = state[filterKey] ?? config.default ?? ''

  const years = store
    ? resolveYears(config.years, store, EMPTY_CTX).slice().reverse()
    : []

  return (
    <select
      className="filter-select filter-control__select"
      value={current}
      onChange={e => set(filterKey, e.target.value)}
      aria-label={config.label ? resolveLabel(config.label) : 'Year'}
    >
      {years.map(y => <option key={y} value={y}>{y}</option>)}
    </select>
  )
}
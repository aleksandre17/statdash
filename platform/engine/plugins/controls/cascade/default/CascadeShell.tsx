import { useFilter }                              from '@geostat/react'
import { CascadeSelect }                          from '@geostat/react'
import type { ParamCascadeNode }                  from '@geostat/engine'

export function CascadeShell({ filterKey, config }: { filterKey: string; config: ParamCascadeNode }) {
  const { state, set } = useFilter()
  const current = state[filterKey] ?? config.default ?? ''
  const path    = current ? current.split(',').map(Number) : []

  return (
    <div className="filter-control__cascade">
      {config.label && (
        <span className="filter-control__label">{config.label}</span>
      )}
      <CascadeSelect
        tree={config.tree}
        path={path}
        onChange={p => set(filterKey, p.join(','))}
        placeholders={config.placeholders}
      />
    </div>
  )
}
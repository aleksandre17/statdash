import { useFilter }                              from '@statdash/react'
import type { ParamMultiSelectNode }              from '@statdash/engine'

export function MultiSelectShell({ filterKey, config }: { filterKey: string; config: ParamMultiSelectNode }) {
  const { state, set } = useFilter()
  const raw     = state[filterKey] ?? ''
  const current = raw ? raw.split(',').filter(Boolean) : []

  const options = config.options.type === 'static' ? config.options.items : []

  const toggle = (val: string) => {
    const next = current.includes(val)
      ? current.filter(v => v !== val)
      : [...current, val]
    set(filterKey, next.join(','))
  }

  return (
    <fieldset className="filter-control__multiselect">
      <legend className="sr-only">{config.label}</legend>
      {options.map(opt => {
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
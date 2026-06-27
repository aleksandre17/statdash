import { useFilter, useResolveLocaleSafe }        from '@statdash/react'
import type { ParamMultiSelectNode }              from '@statdash/engine'

export function MultiSelectShell({ filterKey, config }: { filterKey: string; config: ParamMultiSelectNode }) {
  const { state, set } = useFilter()
  // i18n boundary: resolve LocaleString option/legend labels to the active locale
  // (no-op on plain strings) — never let a {en,ka} reach text as "[object Object]".
  const t       = useResolveLocaleSafe()
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
      <legend className="sr-only">{t(config.label)}</legend>
      {options.map(opt => {
        const v = String(opt.value)
        return (
          <label key={v} className="filter-control__checkbox-label">
            <input type="checkbox" checked={current.includes(v)} onChange={() => toggle(v)} />
            {t(opt.label)}
          </label>
        )
      })}
    </fieldset>
  )
}
import { useFilter, useCurrentStore, useResolveLocaleSafe } from '@statdash/react'
import { resolveOptions }                         from '@statdash/engine'
import type { ParamSelectNode }                   from '@statdash/engine'

const EMPTY_CTX = { dims: {} }

export function SelectShell({ filterKey, config }: { filterKey: string; config: ParamSelectNode }) {
  const { state, set } = useFilter()
  const store          = useCurrentStore()
  // i18n boundary: option labels arrive as LocaleStrings (bilingual classifier
  // labels carried intact from the $d/$cl source — see resolveOptions). THIS is
  // the React layer that holds the active locale, so it resolves them; the engine
  // never picks a locale (Law 1). A plain-string label is a no-op.
  const t              = useResolveLocaleSafe()
  const current        = state[filterKey] ?? config.default ?? ''

  const options = store
    ? resolveOptions(config.options, store, EMPTY_CTX)
    : config.options.type === 'static' ? config.options.items : []

  return (
    <select
      className="filter-select filter-control__select"
      value={current}
      onChange={e => set(filterKey, e.target.value)}
      aria-label={config.label ? t(config.label) : 'Select'}
    >
      {config.emptyLabel !== undefined && <option value="">{t(config.emptyLabel)}</option>}
      {options.map(o => (
        <option key={String(o.value)} value={String(o.value)}>{t(o.label)}</option>
      ))}
    </select>
  )
}
import { useFilter, useT }                         from '@statdash/react'
import type { ParamRangeNode }                   from '@statdash/engine'

// ── RangeShell — from→to year-range control ───────────────────────────────
//
//  Renders as a localized template rather than an anonymous "a – b" pair:
//    ka:  [from-year] დან [to-year] მდე
//    en:  from [x] to [y]
//  The three connector words come from the `range` i18n namespace (useT), so no
//  language is hardcoded (AR-37). A word slot that resolves empty for the active
//  locale renders nothing — one template, both reading conventions. Each selector
//  keeps its own aria-label (fromLabel/toLabel), so the control stays accessible.
//
export function RangeShell({ filterKey, config }: { filterKey: string; config: ParamRangeNode }) {
  const { state, set } = useFilter()
  const t     = useT('range')
  const raw   = state[filterKey] ?? ''
  const parts = raw ? raw.split(',').map(Number) : []
  const from  = isNaN(parts[0]) ? (config.min ?? 0)   : parts[0]
  const to    = isNaN(parts[1]) ? (config.max ?? 100)  : parts[1]

  const lead  = t('range-lead')
  const mid   = t('range-mid')
  const trail = t('range-trail')

  return (
    <div className="filter-control__range">
      {lead && <span className="filter-range-word">{lead}</span>}
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
      {mid && <span className="filter-range-word">{mid}</span>}
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
      {trail && <span className="filter-range-word">{trail}</span>}
      {config.unit && <span className="filter-range-unit">{config.unit}</span>}
    </div>
  )
}

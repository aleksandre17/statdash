import { YearSelectShell }                        from './YearSelectShell'
import type { FilterControlSlice }                from '@statdash/react/engine'
import type { ParamYearSelectNode }               from '@statdash/engine'

export const yearSelectSlice: FilterControlSlice<ParamYearSelectNode, number> = {
  Shell:        YearSelectShell,
  META: {
    sliceType:   'control',
    controlType: 'year-select',
    label:       'Year Selector',
    category:    'filter',
    dimension:   'time',
    // Bilingual default accessible-name for the <select> when the filter config
    // authors no explicit label — registered under the 'year-select' namespace
    // (AR-37 P1). Without this the shell fell back to a hardcoded English 'Year'
    // aria-label on the KA locale (WCAG 3.1.2).
    i18n: {
      ka: { label: 'წელი' },
      en: { label: 'Year' },
    },
  },
  defaultValue: (config) => Number(config.default) || new Date().getFullYear(),
  codec: {
    toUrl:     v => String(v),
    fromUrl:   s => s ? parseInt(s, 10) : null,
    isEmpty:   v => v == null || !Number.isFinite(v),
    normalize: raw => typeof raw === 'number' ? raw : parseInt(String(raw), 10),
  },
  validate: (v, config) => {
    const src = config.years
    if (!src || src.type !== 'static' || src.items.length === 0) return null
    const min = Math.min(...src.items)
    const max = Math.max(...src.items)
    return v >= min && v <= max ? null : `Year must be between ${min} and ${max}`
  },
  formatValue: v => String(v),
}
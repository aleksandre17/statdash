import { MultiSelectShell }                       from './MultiSelectShell'
import type { FilterControlSlice }                from '@statdash/react/engine'
import type { ParamMultiSelectNode }              from '@statdash/engine'

export const multiSelectSlice: FilterControlSlice<ParamMultiSelectNode, string[]> = {
  Shell:        MultiSelectShell,
  META: {
    sliceType:   'control',
    controlType: 'multi-select',
    label:       'Multi-select',
    category:    'filter',
    dimension:   'geo',
  },
  // Only a Tier-1 literal CSV string default applies here; Tier-2/3 specs
  // (ExprVal / OptionsDefault objects) are resolved by the filter-eval pipeline.
  defaultValue: (config) => typeof config.default === 'string' ? config.default.split(',').filter(Boolean) : [],
  codec: {
    toUrl:     v => v.length > 0 ? v.join(',') : null,
    fromUrl:   s => s ? s.split(',').filter(Boolean) : null,
    isEmpty:   v => !v || v.length === 0,
    normalize: raw => Array.isArray(raw) ? raw.map(String) : [],
  },
  formatValue: (v) => v.length === 0 ? '' : v.length === 1 ? v[0] : `${v.length} selected`,
}
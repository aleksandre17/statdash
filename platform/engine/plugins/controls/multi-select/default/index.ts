import { MultiSelectShell }                       from './MultiSelectShell'
import type { FilterControlSlice }                from '@geostat/react/engine'
import type { ParamMultiSelectNode }              from '@geostat/engine'

export const multiSelectSlice: FilterControlSlice<ParamMultiSelectNode, string[]> = {
  Shell:        MultiSelectShell,
  META: {
    sliceType:   'control',
    controlType: 'multi-select',
    label:       'Multi-select',
    category:    'geo',
  },
  defaultValue: (config) => config.default ? config.default.split(',').filter(Boolean) : [],
  codec: {
    toUrl:     v => v.length > 0 ? v.join(',') : null,
    fromUrl:   s => s ? s.split(',').filter(Boolean) : null,
    isEmpty:   v => !v || v.length === 0,
    normalize: raw => Array.isArray(raw) ? raw.map(String) : [],
  },
  formatValue: (v) => v.length === 0 ? '' : v.length === 1 ? v[0] : `${v.length} selected`,
}
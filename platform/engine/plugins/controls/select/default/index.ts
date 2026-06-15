import { SelectShell }                            from './SelectShell'
import type { FilterControlSlice }                from '@geostat/react/engine'
import type { ParamSelectNode }                   from '@geostat/engine'

export const selectSlice: FilterControlSlice<ParamSelectNode, string> = {
  Shell:        SelectShell,
  META: {
    sliceType:   'control',
    controlType: 'select',
    label:       'Dropdown',
    category:    'indicator',
  },
  defaultValue: (config) => {
    if (config.default) return config.default
    if (config.options.type === 'static') return String(config.options.items[0]?.value ?? '')
    return ''
  },
  codec: {
    toUrl:     v => v || null,
    fromUrl:   s => s,
    isEmpty:   v => v == null || v === '',
    normalize: raw => String(raw ?? ''),
  },
  formatValue: v => v,
}
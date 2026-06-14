import { HiddenShell }                            from './HiddenShell'
import type { FilterControlSlice }                from '@geostat/react/engine'
import type { ParamHiddenNode }                   from '@geostat/engine'

export const hiddenSlice: FilterControlSlice<ParamHiddenNode, string> = {
  Shell:        HiddenShell,
  META: {
    sliceType:   'control',
    controlType: 'hidden',
    label:       'Hidden',
    category:    'internal',
  },
  defaultValue: (config) => config.default ?? '',
  codec: {
    toUrl:     v => v || (null as unknown as string),
    fromUrl:   s => s ?? null,
    isEmpty:   v => v == null || v === '',
    normalize: raw => String(raw ?? ''),
  },
  formatValue: () => '',
}
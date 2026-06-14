import { CascadeShell }                           from './CascadeShell'
import type { FilterControlSlice }                from '@geostat/react/engine'
import type { ParamCascadeNode }                  from '@geostat/engine'

export const cascadeSlice: FilterControlSlice<ParamCascadeNode, string> = {
  Shell:        CascadeShell,
  META: {
    sliceType:   'control',
    controlType: 'cascade',
    label:       'Cascade Select',
    category:    'geo',
  },
  defaultValue: (config) => config.default ?? '',
  codec: {
    toUrl:     v => v || (null as unknown as string),
    fromUrl:   s => s ?? null,
    isEmpty:   v => v == null || v === '',
    normalize: raw => String(raw ?? ''),
  },
  formatValue: v => v,
}
import { RangeShell }                             from './RangeShell'
import type { FilterControlSlice }                from '@geostat/react/engine'
import type { ParamRangeNode }                   from '@geostat/engine'

type RangeValue = [number, number]

export const rangeSlice: FilterControlSlice<ParamRangeNode, RangeValue> = {
  Shell:        RangeShell,
  META: {
    sliceType:   'control',
    controlType: 'range',
    label:       'Range',
    category:    'time',
  },
  defaultValue: (config) => [config.min ?? 2000, config.max ?? new Date().getFullYear()],
  codec: {
    toUrl:     v => `${v[0]},${v[1]}`,
    fromUrl:   s => s ? (s.split(',').map(Number) as RangeValue) : null,
    isEmpty:   v => !v || v.length !== 2,
    normalize: raw => Array.isArray(raw) ? raw.map(Number) as RangeValue : [2000, 2024],
  },
  validate: v => v[0] <= v[1] ? null : `Start (${v[0]}) must not exceed end (${v[1]})`,
  formatValue: v => `${v[0]}–${v[1]}`,
}
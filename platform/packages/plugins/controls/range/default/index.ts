import { RangeShell }                             from './RangeShell'
import { rangeI18n }                              from './meta'
import type { FilterControlSlice }                from '@statdash/react/engine'
import type { ParamRangeNode }                   from '@statdash/engine'

type RangeValue = [number, number]

export const rangeSlice: FilterControlSlice<ParamRangeNode, RangeValue> = {
  Shell:        RangeShell,
  META: {
    sliceType:   'control',
    controlType: 'range',
    label:       'Range',
    category:    'filter',
    dimension:   'time',
    // From→to template connector words (AR-37) — catalog lives in ./meta.ts.
    i18n: rangeI18n,
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
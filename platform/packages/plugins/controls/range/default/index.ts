import { RangeShell }                             from './RangeShell'
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
    // From→to template connector words (AR-37). Three positional slots wrap the
    // two selectors so ONE template renders both reading conventions:
    //   ka (postposition):  [from] დან [to] მდე   → lead='', mid='დან', trail='მდე'
    //   en (preposition):   from [x] to [y]        → lead='from', mid='to', trail=''
    // Empty slots render nothing (the shell guards on a non-empty string).
    i18n: {
      ka: { 'range-lead': '',     'range-mid': 'დან', 'range-trail': 'მდე' },
      en: { 'range-lead': 'from', 'range-mid': 'to',  'range-trail': ''    },
    },
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
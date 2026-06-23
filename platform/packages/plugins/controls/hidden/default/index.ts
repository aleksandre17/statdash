import { HiddenShell }                            from './HiddenShell'
import type { FilterControlSlice }                from '@statdash/react/engine'
import type { ParamHiddenNode }                   from '@statdash/engine'

export const hiddenSlice: FilterControlSlice<ParamHiddenNode, string> = {
  Shell:        HiddenShell,
  META: {
    sliceType:   'control',
    controlType: 'hidden',
    label:       'Hidden',
    category:    'filter',
    dimension:   'internal',
  },
  // Only a Tier-1 literal string default applies here; Tier-2/3 specs
  // (ExprVal / OptionsDefault objects) are resolved by the filter-eval pipeline.
  defaultValue: (config) => typeof config.default === 'string' ? config.default : '',
  codec: {
    toUrl:     v => v || null,
    fromUrl:   s => s ?? null,
    isEmpty:   v => v == null || v === '',
    normalize: raw => String(raw ?? ''),
  },
  formatValue: () => '',
}
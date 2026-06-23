import { SelectShell }                            from './SelectShell'
import type { FilterControlSlice }                from '@statdash/react/engine'
import type { ParamSelectNode }                   from '@statdash/engine'

export const selectSlice: FilterControlSlice<ParamSelectNode, string> = {
  Shell:        SelectShell,
  META: {
    sliceType:   'control',
    controlType: 'select',
    label:       'Dropdown',
    category:    'filter',
    dimension:   'indicator',
  },
  defaultValue: (config) => {
    // Only a Tier-1 literal string default applies here; Tier-2/3 specs
    // (ExprVal / OptionsDefault objects) are resolved by the filter-eval pipeline.
    if (typeof config.default === 'string') return config.default
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
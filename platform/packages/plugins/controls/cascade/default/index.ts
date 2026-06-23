import { CascadeShell }                           from './CascadeShell'
import type { FilterControlSlice }                from '@statdash/react/engine'
import type { ParamCascadeNode }                  from '@statdash/engine'

export const cascadeSlice: FilterControlSlice<ParamCascadeNode, string> = {
  Shell:        CascadeShell,
  META: {
    sliceType:   'control',
    controlType: 'cascade',
    label:       'Cascade Select',
    category:    'filter',
    dimension:   'geo',
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
  formatValue: v => v,
}
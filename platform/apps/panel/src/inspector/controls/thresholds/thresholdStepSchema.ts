// ── thresholdStepSchema — authoring PropSchema for ONE threshold step ─────────
//
//  The numeric-breakpoint sibling of VALUE_MAPPING_SCHEMA. The Constructor renders
//  this generically (the ThresholdField FieldControl drives the ordered step list,
//  each step edited by the Inspector over THIS schema). The `token` is an `enum-ref`
//  over `source: 'tokens'` — the author PICKS a registered semantic token, so a
//  literal colour is unrepresentable by construction (Law 2). `from` is the inclusive
//  lower bound the step owns; leaving it empty makes the step the BASE (−∞) default.
//
//  WHY HERE (apps/panel), not core: bilingual Constructor-EDITOR metadata whose SOLE
//  consumer is the panel Inspector — the runtime contract (the `Threshold` type + the
//  `resolveThreshold` resolver) lives in `@statdash/engine`; the authoring face lives
//  in the authoring app. Mirrors valueMappingSchema.ts exactly, one axis over.
//
import type { PropSchema } from '@statdash/react/engine'

export const THRESHOLD_STEP_SCHEMA: PropSchema = [
  {
    field: 'from', type: 'number',
    label: { ka: 'დან (≥)', en: 'From (≥)' },
    // Empty ⇒ the base step (−∞) — the default presentation below the first breakpoint.
  },
  {
    field: 'token', type: 'enum-ref', source: 'tokens', tokenGroup: 'status',
    label: { ka: 'ფერი (ტოკენი)', en: 'Colour (token)' },
  },
  {
    field: 'glyph', type: 'string',
    label: { ka: 'სიმბოლო', en: 'Glyph' },
    options: [
      { value: 'up',   label: { ka: 'ზევით ↗',  en: 'Up ↗'   } },
      { value: 'down', label: { ka: 'ქვევით ↘', en: 'Down ↘' } },
      { value: 'flat', label: { ka: 'სწორი →',  en: 'Flat →' } },
    ],
  },
  {
    field: 'state', type: 'LocaleString', coverage: 'localized',
    label: { ka: 'მდგომარეობა (წარწერა)', en: 'State label' },
  },
]

// ── valueMappingSchema — authoring PropSchema for ONE value-mapping rule [EXP-06] ──
//
//  The Constructor renders this generically (the ValueMappingField FieldControl drives
//  a rule list, each rule edited by the Inspector over this schema). The `token` field
//  is an `enum-ref` over `source: 'tokens'` — the author PICKS a registered semantic
//  token, so a literal colour is unrepresentable by construction (Law: no hardcoded
//  values). The `match.kind` discriminant drives showWhen so the Inspector shows only
//  the relevant condition fields.
//
//  WHY HERE (apps/panel), not in core: this is bilingual Constructor-EDITOR metadata
//  whose SOLE consumer is the panel Inspector — the runtime contract (the `ValueMapping`
//  type + the `applyValueMap` resolver) lives in `@statdash/engine`; the authoring face
//  lives in the authoring app (cohesion). Mirrors the engine `*-schemas` catalogs one
//  tier out — the same schema-driven-Inspector pattern, app-local.
//
import type { PropSchema } from '@statdash/react/engine'

export const VALUE_MAPPING_SCHEMA: PropSchema = [
  {
    field: 'match.kind', type: 'string', required: true,
    label: { ka: 'პირობა', en: 'Condition' },
    options: [
      { value: 'exact', label: { ka: 'ზუსტი მნიშვნელობა', en: 'Exact value' } },
      { value: 'range', label: { ka: 'დიაპაზონი',         en: 'Range' } },
      { value: 'regex', label: { ka: 'რეგ. გამოსახულება',  en: 'Regex' } },
      { value: 'empty', label: { ka: 'ცარიელი / null',     en: 'Empty / null' } },
    ],
  },
  { field: 'match.value',   type: 'string', label: { ka: 'მნიშვნელობა', en: 'Value' },   showWhen: "match.kind === 'exact'" },
  { field: 'match.from',    type: 'number', label: { ka: 'დან', en: 'From' },            showWhen: "match.kind === 'range'" },
  { field: 'match.to',      type: 'number', label: { ka: 'მდე', en: 'To' },              showWhen: "match.kind === 'range'" },
  { field: 'match.pattern', type: 'string', label: { ka: 'შაბლონი', en: 'Pattern' },     showWhen: "match.kind === 'regex'" },
  { field: 'text',  type: 'LocaleString', coverage: 'localized', label: { ka: 'ტექსტი', en: 'Text' } },
  { field: 'token', type: 'enum-ref', source: 'tokens',          label: { ka: 'ფერი (ტოკენი)', en: 'Colour (token)' } },
  { field: 'icon',  type: 'icon',                                label: { ka: 'ხატულა', en: 'Icon' } },
]

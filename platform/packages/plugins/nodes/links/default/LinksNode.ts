import type { NodeBase } from '@statdash/react/engine'
import type { LinkDef }  from '@statdash/engine'
import { defineSchema, type AssertSchemaCovers, type Expect } from '../../../schema-contract'

export interface LinksNode extends NodeBase {
  type:  'links'
  items: LinkDef[]
}

// ── LinkItemSchema — the per-LINK nested schema (D7.2 / ADR-022) ─────────────
export const LinkItemSchema = defineSchema([
  { field: 'href',  type: 'LocaleString', label: { ka: 'URL',      en: 'URL' }, required: true },
  { field: 'label', type: 'LocaleString', label: { ka: 'წარწერა',  en: 'Label' }, coverage: 'localized', required: true },
  {
    field: 'icon', type: 'string', label: { ka: 'ხატულა', en: 'Icon' }, required: true,
    options: [
      { value: 'doc',  label: { ka: 'დოკუმენტი', en: 'Document' } },
      { value: 'info', label: { ka: 'ინფო',       en: 'Info'     } },
      { value: 'ext',  label: { ka: 'გარე ბმული', en: 'External' } },
    ],
  },
])

// FF-SCHEMA-COMPLETE depth (tier c): 1:1 with LinkDef's editable keys.
export type _LinkItemCovers = Expect<AssertSchemaCovers<LinkDef, typeof LinkItemSchema>>

export const LinksSchema = defineSchema([
  {
    field: 'items', type: 'array', label: { ka: 'ბმულები', en: 'Links' }, required: true,
    itemSchema: LinkItemSchema, itemLabel: 'label',
  },
])

// FF-SCHEMA-COMPLETE (tier b): `items` (LinkDef[]) is now a STRUCTURED nested field.
export type _LinksCovers = Expect<AssertSchemaCovers<LinksNode, typeof LinksSchema>>

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'links': LinksNode }
}
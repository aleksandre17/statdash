import type {
  NodeBase, NodeDef, SlotDef, LocaleString, PropertyGroup,
} from '@statdash/react/engine'
import { defineSchema, type AssertSchemaCovers, type Expect } from '../../../../schema-contract'

export interface CardNode extends NodeBase {
  type:      'card'
  /** Optional card heading — a complete LocaleString over active locales. */
  title?:    LocaleString
  children?: NodeDef[]
}

export const CardSlots: Record<string, SlotDef> = {
  children: {
    field: 'children',
    label: { ka: 'შიგთავსი', en: 'Content' },
    multi: true,
  },
}

// ── CardSchema — the inspector-editable props of a card node ──
//
//  A card is a content container (children slot). Its sole authored scalar is
//  an optional `title`, rendered as a heading. `coverage:'localized'` marks it
//  as a LocaleString the Inspector authors per active locale (shift-left of the
//  locale-coverage gate). The children slot is structural — edited in the tree,
//  not the property panel — so it is intentionally absent from the schema.
//
export const CardSchema = defineSchema([
  {
    field:    'title',
    type:     'LocaleString',
    coverage: 'localized',
    label:    { ka: 'სათაური', en: 'Title' },
  },
])

// FF-SCHEMA-COMPLETE (tier b): 1:1 with editable keys (children slot excluded).
export type _CardCovers = Expect<AssertSchemaCovers<CardNode, typeof CardSchema>>

export const CardGroups: PropertyGroup[] = [
  { label: { ka: 'შიგთავსი', en: 'Content' }, fields: ['title'] },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'card': CardNode }
}
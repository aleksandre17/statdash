import type { NodeBase, PropertyGroup, SlotDef, LocaleString } from '@statdash/react/engine'
import { defineSchema, type AssertSchemaCovers, type Expect } from '../../../schema-contract'

export interface HeroCardDef {
  id:     string
  title:  LocaleString
  sub?:   LocaleString
  color:  string
  img:    string
  pageBg: string
}

export interface HeroNode extends NodeBase {
  type:      'hero'
  title:     LocaleString
  subtitle?: LocaleString
  cards:     HeroCardDef[]
}

export const HeroSchema = defineSchema([
  { field: 'title',    type: 'LocaleString', label: { ka: 'სათაური',    en: 'Title' }, required: true },
  { field: 'subtitle', type: 'LocaleString', label: { ka: 'ქვესათაური', en: 'Subtitle' } },
  { field: 'cards',    type: 'array',        label: { ka: 'ბარათები',   en: 'Cards' }, required: true },
])

// FF-SCHEMA-COMPLETE (tier b): HeroSchema is 1:1 with HeroNode's editable keys.
// `cards` (HeroCardDef[]) is covered top-level; its per-item authoring is the
// tier-c itemSchema backlog (SCHEMA_TODO in schema-completeness.fitness.test.ts).
export type _HeroCovers = Expect<AssertSchemaCovers<HeroNode, typeof HeroSchema>>

// ── HeroDefaults — must be SAVE-GUARD-valid the instant the node is dropped ──
//
//  Defaults-vs-guard contract (Constructor saveGuard check 4, locale-complete):
//    • A REQUIRED localized field (`title`) must seed a COMPLETE LocaleString —
//      a non-empty value for every active locale. An empty-but-present record
//      `{ka:'',en:''}` is "set but blank" and the guard correctly rejects it,
//      so we seed real placeholder content the author then edits in place.
//    • An OPTIONAL localized field (`subtitle`) must be ABSENT, not an empty
//      record: absent = "not set" (guard skips it); a present LocaleString =
//      "set" (guard requires per-locale completeness). Seeding `{ka:'',en:''}`
//      would force the author to fill OR clear it before the first save.
//
//  `cards` is a required array; an empty array is structurally valid JSON and
//  is owned by the per-node validity check (check 3 / required), not the
//  locale-completeness contract this file is reconciling.
export const HeroDefaults: Partial<HeroNode> = {
  title: { ka: 'სათაური', en: 'Title' },
  cards: [],
}

export const HeroSlots: Record<string, SlotDef> = {}

export const HeroGroups: PropertyGroup[] = [
  { label: { ka: 'შიგთავსი', en: 'Content' }, fields: ['title', 'subtitle', 'cards'] },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'hero': HeroNode }
}
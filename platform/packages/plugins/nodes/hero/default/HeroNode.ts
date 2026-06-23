import type { NodeBase, PropertyGroup, SlotDef, LocaleString, PropSchema } from '@statdash/react/engine'

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

export const HeroSchema: PropSchema = [
  { field: 'title',    type: 'LocaleString', label: 'სათაური',    required: true },
  { field: 'subtitle', type: 'LocaleString', label: 'ქვესათაური' },
  { field: 'cards',    type: 'array',        label: 'ბარათები',   required: true },
]

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
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

export const HeroDefaults: Partial<HeroNode> = {
  title:    { ka: '', en: '' },
  subtitle: { ka: '', en: '' },
  cards:    [],
}

export const HeroSlots: Record<string, SlotDef> = {}

export const HeroGroups: PropertyGroup[] = [
  { label: { ka: 'შიგთავსი', en: 'Content' }, fields: ['title', 'subtitle', 'cards'] },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'hero': HeroNode }
}
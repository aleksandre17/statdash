import type { NodeBase, PropertyGroup, SlotDef, LocaleString } from '@statdash/react/engine'
import { defineSchema, type AssertSchemaCovers, type Expect } from '../../../schema-contract'

export interface StatItem {
  icon?:       string
  iconBg?:     string
  label:       LocaleString
  value:       string
  unit:        LocaleString
  change?:     number
  changeText?: LocaleString
}

export interface StatSlide {
  tab:   LocaleString
  title: LocaleString
  stats: StatItem[]
}

export interface StatsCarouselNode extends NodeBase {
  type:        'stats-carousel'
  slides:      StatSlide[]
  autoplayMs?: number
}

// ── StatItemSchema — the per-STAT nested schema (D7.2 / ADR-022) ─────────────
//  One editorial stat inside a slide. `value` is a hand-typed string (editorial
//  node, caps:[]) — NOT a governed metric-ref (that is the featured-slider's role).
export const StatItemSchema = defineSchema([
  { field: 'icon',       type: 'icon',         label: { ka: 'ხატულა',       en: 'Icon' } },
  { field: 'iconBg',     type: 'color',        label: { ka: 'ხატულის ფონი',  en: 'Icon background' } },
  { field: 'label',      type: 'LocaleString', label: { ka: 'წარწერა',      en: 'Label' }, coverage: 'localized', required: true },
  { field: 'value',      type: 'string',       label: { ka: 'მნიშვნელობა',   en: 'Value' }, required: true },
  { field: 'unit',       type: 'LocaleString', label: { ka: 'ერთეული',      en: 'Unit' }, coverage: 'localized', required: true },
  { field: 'change',     type: 'number',       label: { ka: 'ცვლილება (%)',  en: 'Change (%)' } },
  { field: 'changeText', type: 'LocaleString', label: { ka: 'ცვლილების ტექსტი', en: 'Change caption' }, coverage: 'localized' },
])

// FF-SCHEMA-COMPLETE depth (tier c): 1:1 with StatItem's editable keys.
export type _StatItemCovers = Expect<AssertSchemaCovers<StatItem, typeof StatItemSchema>>

// ── StatSlideSchema — the per-SLIDE nested schema; recurses into StatItem[] ───
export const StatSlideSchema = defineSchema([
  { field: 'tab',   type: 'LocaleString', label: { ka: 'ტაბი',    en: 'Tab' }, coverage: 'localized', required: true },
  { field: 'title', type: 'LocaleString', label: { ka: 'სათაური', en: 'Title' }, coverage: 'localized', required: true },
  {
    field: 'stats', type: 'array', label: { ka: 'სტატისტიკები', en: 'Stats' }, required: true,
    itemSchema: StatItemSchema, itemLabel: 'label',
  },
])

// FF-SCHEMA-COMPLETE depth (tier c): 1:1 with StatSlide's editable keys — the
// nested `stats` array carries its own itemSchema (arbitrary-depth recursion).
export type _StatSlideCovers = Expect<AssertSchemaCovers<StatSlide, typeof StatSlideSchema>>

export const StatsCarouselSchema = defineSchema([
  { field: 'autoplayMs', type: 'number', label: { ka: 'ავტოთამაში (ms)', en: 'Autoplay (ms)' }, default: 7000 },
  {
    field: 'slides', type: 'array', label: { ka: 'სლაიდები', en: 'Slides' }, required: true,
    itemSchema: StatSlideSchema, itemLabel: 'title',
  },
])

// FF-SCHEMA-COMPLETE (tier b): 1:1 with editable keys. `slides` (StatSlide[]) is
// now a STRUCTURED nested field recursing slide → stats.
export type _StatsCarouselCovers = Expect<AssertSchemaCovers<StatsCarouselNode, typeof StatsCarouselSchema>>

export const StatsCarouselDefaults: Partial<StatsCarouselNode> = {
  autoplayMs: 7000,
  slides:     [],
}

export const StatsCarouselSlots: Record<string, SlotDef> = {}

export const StatsCarouselGroups: PropertyGroup[] = [
  { label: { ka: 'ქცევა',    en: 'Behaviour' }, fields: ['autoplayMs'] },
  { label: { ka: 'შიგთავსი', en: 'Content'   }, fields: ['slides']    },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'stats-carousel': StatsCarouselNode }
}
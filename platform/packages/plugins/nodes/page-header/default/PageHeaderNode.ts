import type { NodeBase, PropertyGroup } from '@statdash/react/engine'
import type { LocaleString }                        from '@statdash/engine'
import { defineSchema, type AssertSchemaCovers, type Expect } from '../../../schema-contract'

/** One breadcrumb entry — a localized label + an optional href. */
export interface PageHeaderCrumb {
  label: LocaleString
  href?: string
}

export interface PageHeaderNode extends NodeBase {
  type:    'page-header'
  /** Page title — LocaleString (plain or { ka, en }); resolved by the shell. */
  title:   LocaleString
  /**
   * Badge caption — either a LocaleString OR a perspective carrier
   * `Record<perspectiveId, LocaleString>` (e.g. `{ year: { ka, en }, range: { ka, en } }`).
   * PERSPECTIVE × LOCALE are orthogonal: the shell's resolver collapses the active
   * perspective arm THEN the active locale. A plain-string arm is a degenerate
   * LocaleString (Postel), so `{ year: 'x', range: 'y' }` still type-checks and renders.
   */
  badge?:  LocaleString | Record<string, LocaleString>
  crumbs?: PageHeaderCrumb[]
}

// ── CrumbItemSchema — the per-BREADCRUMB nested schema (D7.2 / ADR-022) ───────
export const CrumbItemSchema = defineSchema([
  { field: 'label', type: 'LocaleString', label: { ka: 'წარწერა', en: 'Label' }, coverage: 'localized', required: true },
  { field: 'href',  type: 'string',       label: { ka: 'ბმული',   en: 'Link' } },
])

// FF-SCHEMA-COMPLETE depth (tier c): 1:1 with PageHeaderCrumb's editable keys.
export type _CrumbItemCovers = Expect<AssertSchemaCovers<PageHeaderCrumb, typeof CrumbItemSchema>>

export const PageHeaderSchema = defineSchema([
  { field: 'title',  type: 'string', label: { ka: 'სათაური', en: 'Title' }, required: true },
  { field: 'badge',  type: 'string', label: { ka: 'ბეჯი',    en: 'Badge' } },
  {
    field: 'crumbs', type: 'array', label: { ka: 'ნავიგაციის ბილიკი', en: 'Breadcrumbs' },
    itemSchema: CrumbItemSchema, itemLabel: 'label',
  },
])

// FF-SCHEMA-COMPLETE (tier b): 1:1 with editable keys. `crumbs` (PageHeaderCrumb[])
// is now a STRUCTURED nested field.
export type _PageHeaderCovers = Expect<AssertSchemaCovers<PageHeaderNode, typeof PageHeaderSchema>>

export const PageHeaderGroups: PropertyGroup[] = [
  { label: { ka: 'შიგთავსი', en: 'Content' }, fields: ['title', 'badge', 'crumbs'] },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'page-header': PageHeaderNode }
}
import type { NodeBase, PropertyGroup, PropSchema } from '@statdash/react/engine'
import type { LocaleString }                        from '@statdash/engine'

export interface PageHeaderNode extends NodeBase {
  type:    'page-header'
  /** Page title — LocaleString (plain or { ka, en }); resolved by the shell. */
  title:   LocaleString
  /** Badge caption — LocaleString OR the { year, range } perspective union. */
  badge?:  LocaleString | { year: string; range: string }
  crumbs?: { label: LocaleString; href?: string }[]
}

export const PageHeaderSchema: PropSchema = [
  { field: 'title',  type: 'string', label: { ka: 'სათაური', en: 'Title' }, required: true },
  { field: 'badge',  type: 'string', label: { ka: 'ბეჯი',    en: 'Badge' } },
  { field: 'crumbs', type: 'array',  label: { ka: 'ნავიგაციის ბილიკი', en: 'Breadcrumbs' } },
]

export const PageHeaderGroups: PropertyGroup[] = [
  { label: { ka: 'შიგთავსი', en: 'Content' }, fields: ['title', 'badge', 'crumbs'] },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'page-header': PageHeaderNode }
}
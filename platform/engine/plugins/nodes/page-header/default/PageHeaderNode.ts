import type { NodeBase, PropertyGroup, PropSchema } from '@geostat/react/engine'

export interface PageHeaderNode extends NodeBase {
  type:    'page-header'
  title:   string
  badge?:  string | { year: string; range: string }
  crumbs?: { label: string; href?: string }[]
}

export const PageHeaderSchema: PropSchema = [
  { field: 'title',  type: 'string', label: 'სათაური',    required: true },
  { field: 'badge',  type: 'string', label: 'Badge' },
  { field: 'crumbs', type: 'array',  label: 'Breadcrumbs' },
]

export const PageHeaderGroups: PropertyGroup[] = [
  { label: { ka: 'შიგთავსი', en: 'Content' }, fields: ['title', 'badge', 'crumbs'] },
]

declare module '@geostat/react/engine' {
  interface NodeTypeMap { 'page-header': PageHeaderNode }
}
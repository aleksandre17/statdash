import type { NodeBase, PropertyGroup } from '@geostat/react/engine'

export interface PageHeaderNode extends NodeBase {
  type:    'page-header'
  title:   string
  badge?:  string | { year: string; range: string }
  crumbs?: { label: string; href?: string }[]
}

export const PageHeaderSchema = {
  type: 'object',
  required: ['title'],
  properties: {
    title:  { type: 'string',  title: 'სათაური' },
    badge:  { type: 'string',  title: 'Badge' },
    crumbs: { type: 'array',   title: 'Breadcrumbs' },
  },
} as const

export const PageHeaderGroups: PropertyGroup[] = [
  { label: { ka: 'შიგთავსი', en: 'Content' }, fields: ['title', 'badge', 'crumbs'] },
]

declare module '@geostat/react/engine' {
  interface NodeTypeMap { 'page-header': PageHeaderNode }
}
import type { NodeSliceMeta } from '@statdash/react/engine'
import { SectionSchema, SectionDefaults, SectionSlots, SectionGroups } from './SectionNode'

export const META: NodeSliceMeta = {
  sliceType:       'node',
  type:            'section',
  variant:         'default',
  label:           { ka: 'სექცია',  en: 'Section' },
  icon:            'layout-section',
  category:        'layout',
  schema:          SectionSchema,
  defaults:        SectionDefaults,
  slots:           SectionSlots,
  groups:          SectionGroups,
  canHaveChildren: true,
  caps:            ['collapsible', 'methodology'],
  version:         1,
  i18n: {
    ka: {
      'view-toggle':  'ხედის გადართვა',
      'info':         'ინფორმაცია',
      'methodology':  'მეთოდოლოგია',
      'source':       'წყარო',
      'last-updated': 'ბოლო განახლება',
      'close':        'დახურვა',
    },
    en: {
      'view-toggle':  'Toggle view',
      'info':         'Information',
      'methodology':  'Methodology',
      'source':       'Source',
      'last-updated': 'Last updated',
      'close':        'Close',
    },
  },
}

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
  // ── Declared variants (the data-attr spine; see variant-meta.ts) ──────
  //  `emphasis` collapses the former two booleans `view.hero` + `view.compact`
  //  into ONE mutually-exclusive enum: a section has exactly ONE emphasis level,
  //  so the illegal `hero && compact` state is now unrepresentable. defineShell
  //  resolves this to `data-emphasis` (resolveVariants); section.css reads
  //  `[data-emphasis="hero"|"compact"]`. A new emphasis level = one option here
  //  + one CSS rule → zero shell code.
  variants: {
    emphasis: {
      attr:    'data-emphasis',
      kind:    'enum',
      options: [
        { value: 'hero',    label: { ka: 'გამორჩეული', en: 'Hero' } },
        { value: 'compact', label: { ka: 'კომპაქტური', en: 'Compact' } },
      ],
      label:   { ka: 'აქცენტი', en: 'Emphasis' },
    },
  },
  caps:            ['collapsible', 'methodology', 'nav-contributor'],
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

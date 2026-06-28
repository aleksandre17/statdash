import type { NodeBase, NodeDef, ViewParams, PropertyGroup, SlotDef, PropSchema } from '@statdash/react/engine'
import type { DataSpec }                                               from '@statdash/engine'

export interface SectionMethodology {
  /** Free-text methodology note; supports template vars (e.g. {account_label}). */
  note?:        string
  /** Data source label, e.g. "GeoStat / National Accounts". */
  source?:      string
  /** ISO date string or display string, e.g. "2024-03" or "March 2024". */
  lastUpdated?: string
}

export interface SectionNode extends NodeBase {
  type:          'section'
  id:            string
  title:         string
  label?:        string
  anchor?:       string
  color?:        string
  data?:         DataSpec
  children:      NodeDef[]
  view?:         ViewParams
  prependLabel?: string
  /** Methodology disclosure shown when the info button is clicked. */
  methodology?:  SectionMethodology
}

export const SectionSchema: PropSchema = [
  { field: 'title',        type: 'string', label: { ka: 'სათაური', en: 'Title' }, required: true },
  { field: 'label',        type: 'string', label: { ka: 'წარწერა', en: 'Label' } },
  { field: 'color',        type: 'color',  label: { ka: 'ფერი',    en: 'Colour' } },
  { field: 'anchor',       type: 'string', label: { ka: 'მიმაგრების ID',      en: 'Anchor ID' } },
  { field: 'prependLabel', type: 'string', label: { ka: 'დეტალიზაციის წარწერა', en: 'Drill label' } },
  // ── Methodology disclosure (Law 9 — IMF/Eurostat/ONS data integrity) ──────
  //  Authors the `methodology` panel SectionShell already renders (note +
  //  source + last-updated). Plain strings (NOT LocaleString) — matching the
  //  current SectionMethodology data model, so existing configs stay
  //  byte-identical. `note` supports template vars (resolved at render).
  { field: 'methodology.note',        type: 'string', label: { ka: 'მეთოდოლოგიის შენიშვნა', en: 'Methodology note' } },
  { field: 'methodology.source',      type: 'string', label: { ka: 'მონაცემთა წყარო',       en: 'Data source' } },
  { field: 'methodology.lastUpdated', type: 'string', label: { ka: 'ბოლო განახლება',          en: 'Last updated' } },
]

export const SectionDefaults: Partial<SectionNode> = {
  view: { toggle: true, defaultOpen: true },
}

export const SectionSlots: Record<string, SlotDef> = {
  children: {
    field:   'children',
    label:   { ka: 'შიგთავსი', en: 'Content' },
    accepts: ['chart', 'table', 'kpi-strip', 'row', 'wrap', 'geograph'],
    multi:   true,
  },
}

export const SectionGroups: PropertyGroup[] = [
  { label: { ka: 'შიგთავსი',   en: 'Content'  }, fields: ['title', 'label', 'color', 'prependLabel'] },
  { label: { ka: 'ქცევა',      en: 'Behaviour' }, fields: ['view.toggle', 'view.defaultOpen', 'view.noCollapse'] },
  // hero + compact retired into the declared `emphasis` enum variant (variants.emphasis):
  // the Inspector renders one select instead of two mutually-exclusive booleans.
  { label: { ka: 'განლაგება',  en: 'Layout'    }, fields: ['view.width', 'variants.emphasis', 'anchor'] },
  // Methodology disclosure — the data-integrity fieldset (Law 9). Renders the
  // SectionMethodology panel only when authored (the shell gates on def.methodology).
  { label: { ka: 'მეთოდოლოგია', en: 'Methodology' }, fields: ['methodology.note', 'methodology.source', 'methodology.lastUpdated'] },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'section': SectionNode }
}
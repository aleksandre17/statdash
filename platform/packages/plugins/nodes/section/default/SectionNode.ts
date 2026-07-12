import type { NodeBase, NodeDef, ViewParams, PropertyGroup, SlotDef } from '@statdash/react/engine'
import type { DataSpec, LocaleString }                                  from '@statdash/engine'
import { defineSchema, type AssertSchemaCovers, type Expect } from '../../../schema-contract'

export interface SectionMethodology {
  /**
   * Free-text methodology note; supports template vars (e.g. {account_label}).
   * A `LocaleString` (AR-37 P1): a bilingual `{ ka, en }` bag OR a plain string
   * (a single-locale legacy value stays byte-identical). Resolved at the
   * SectionMethodology boundary through the canonical template resolver, which
   * collapses locale THEN expands `{vars}` — so the note flips with the URL locale.
   */
  note?:        LocaleString
  /**
   * Data source label, e.g. "GeoStat / National Accounts". `LocaleString` so it
   * localizes (AR-37 P1) — previously a raw string that rendered one language on
   * every locale (the R2 monolingual-leak class).
   */
  source?:      LocaleString
  /** ISO date / display string, e.g. "2024-03" or "March 2024". `LocaleString` (AR-37 P1). */
  lastUpdated?: LocaleString
  /**
   * Author override (AR-39 OR-signal #1): explicitly mark this section's dataset
   * preliminary, independent of any per-panel row signal. The section indicator
   * OR-folds this with the panels' reported status. Optional — auto-detection
   * from child panels remains the primary mechanism.
   */
  preliminary?: boolean
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

export const SectionSchema = defineSchema([
  { field: 'title',        type: 'string', label: { ka: 'სათაური', en: 'Title' }, required: true },
  { field: 'label',        type: 'string', label: { ka: 'წარწერა', en: 'Label' } },
  { field: 'color',        type: 'color',  label: { ka: 'ფერი',    en: 'Colour' } },
  { field: 'anchor',       type: 'string', label: { ka: 'მიმაგრების ID',      en: 'Anchor ID' } },
  { field: 'prependLabel', type: 'string', label: { ka: 'დეტალიზაციის წარწერა', en: 'Drill label' } },
  // ── Methodology disclosure (Law 9 — IMF/Eurostat/ONS data integrity) ──────
  //  Authors the `methodology` panel SectionShell already renders (note +
  //  source + last-updated + preliminary override). The RUNTIME type is now
  //  `LocaleString` (AR-37 P1) so these localize; the Inspector control stays
  //  `type:'string'` for now (a single-locale field) — wiring the bilingual
  //  `locale-string` control here is AR-37 P4 (Constructor parity). A monolingual
  //  authored value is caught by FF-AUTHORING-LOCALE-COMPLETE (its methodology
  //  parent-key rule), so the gate — not a byte-compat comment — is what holds
  //  the bilingual line.
  { field: 'methodology.note',        type: 'string',  label: { ka: 'მეთოდოლოგიის შენიშვნა', en: 'Methodology note' } },
  { field: 'methodology.source',      type: 'string',  label: { ka: 'მონაცემთა წყარო',       en: 'Data source' } },
  { field: 'methodology.lastUpdated', type: 'string',  label: { ka: 'ბოლო განახლება',          en: 'Last updated' } },
  // NOTE: `methodology.preliminary` (the AR-39 author override) is a RUNTIME field
  // on SectionMethodology but is intentionally NOT yet in this PropSchema — adding
  // it re-emits page-config.schema.json (the gen:schema drift coupling). Wiring the
  // Inspector control + regenerating the schema is the AR-37 P4 follow-up. The
  // override still works in hand-/programmatically-authored configs today.
])

// FF-SCHEMA-COMPLETE (tier b): 1:1 with editable keys (id/data/view/children
// excluded as system/slot). `methodology` is covered top-level via its dot-path
// fields; its nested `preliminary` arm is the tier-c backlog (SCHEMA_TODO).
export type _SectionCovers = Expect<AssertSchemaCovers<SectionNode, typeof SectionSchema>>

export const SectionDefaults: Partial<SectionNode> = {
  view: { toggle: true, defaultOpen: true },
}

export const SectionSlots: Record<string, SlotDef> = {
  children: {
    field:   'children',
    label:   { ka: 'შიგთავსი', en: 'Content' },
    // ── Capability content model (HTML5 content-model grammar, ADR-041 / composition) ──
    //  A section is a generic page-content region: it admits any FLOW CONTENT block —
    //  declared by the block via `caps: ['flow']`, NOT enumerated here. This retires the
    //  former hardcoded type list (`chart · table · kpi-strip · columns · grid · wrap ·
    //  geograph`), which left hero/text/links/card/divider/spacer/stack "homeless" (the
    //  owner's "blank page only holds a section"). A NEW content block is now placeable by
    //  DECLARING `flow` alone — zero edit to this slot (OCP · FF-CAPABILITY-ACCEPTS). It
    //  admits everything the old list did (each of those blocks declares `flow`) PLUS the
    //  formerly-homeless content blocks + gauge; page-level structure (page-header,
    //  filter-bar, perspective-bar, section, repeat) does NOT declare `flow`, so it stays
    //  correctly excluded.
    acceptsCaps: ['flow'],
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
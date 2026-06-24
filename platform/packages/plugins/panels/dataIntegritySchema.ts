// ── dataIntegritySchema — shared data-panel authoring fragment (Law 9) ────────
//
//  A reusable PropSchema fragment every DATA panel (chart / table / gauge / …)
//  composes into its own schema. It authors the `preliminary` flag — signal #1
//  of resolvePreliminary (`def.preliminary === true`, the explicit author
//  override) that drives the panel-title PreliminaryBadge (IMF/Eurostat/ONS
//  data-integrity standard).
//
//  WHY A SHARED FRAGMENT, not a NodeBase widen:
//    `preliminary` is a CROSS-PANEL data-integrity concern, but it is NOT a
//    universal node field (a layout `row`/`wrap`/`section` has no badge). Widening
//    the shared NodeBase with it would bloat the base for every node (the
//    thin-base / per-element-schema rule). Instead each data panel OWNS the
//    field on its own node type (ISP) and OPTS IN by spreading this fragment into
//    its schema — one declaration, authored by the same generic Inspector. A new
//    data panel that should carry the badge spreads the same fragment; a layout
//    node simply doesn't. The badge already renders — this makes it AUTHORABLE.
//
//  Bilingual labels (Law 4 i18n) — a tenant-free catalog fragment, parallel to
//  each panel's own schema labels.
//
import type { PropField } from '@statdash/react/engine'

/**
 * The data-integrity field(s) a data panel adds to its PropSchema. Spread into
 * the panel's schema array; reference the field name(s) from a PropertyGroup.
 */
export const DATA_INTEGRITY_SCHEMA: PropField[] = [
  {
    field: 'preliminary',
    type:  'boolean',
    label: { ka: 'წინასწარი მონაცემები', en: 'Preliminary data' },
  },
]

/** The field names this fragment contributes — for a panel's PropertyGroup.fields. */
export const DATA_INTEGRITY_FIELDS = ['preliminary'] as const

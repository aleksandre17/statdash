// ── DataLinks — declarative drill-down / navigation (Grafana DataLinks) ──
//
//  Every node can declare dataLinks[]. When a user clicks a data point
//  (chart bar, table row, KPI card), the shell resolves the link using the
//  clicked row's fields and navigates or opens the target.
//
//  100% JSON-serializable — Constructor generates these without code.
//
//  Analogues:
//    Grafana   — DataLink / DataLinksContextMenu per panel
//    Retool    — onClick event → navigate action with row param mapping
//    Builder.io — data bindings in button onClick → router.push
//

import type { LocaleString } from '../i18n/types'

// ── DataLinkParam — value source for resolved link params ────────────────
//
//  '$row'  — resolved from the clicked DataRow (e.g. bar's geo code)
//  '$ctx'  — resolved from current filter params (e.g. active time)
//  literal — constant string value
//
export type DataLinkParam =
  | { $row: string }      // row[field]
  | { $ctx: string }      // filterParams[key]
  | string                // literal constant

// ── DataLinkDef — declarative link definition ─────────────────────────────
export interface DataLinkDef {
  /** Display label for the link (shown in context menu). */
  title:   LocaleString

  /** Where to navigate: internal page, URL template, or external URL. */
  target:  'page' | 'url' | 'external'

  /** Internal page path for target='page' (e.g. '/regional'). */
  page?:   string

  /** URL string for target='url'|'external'. Supports {param} interpolation. */
  url?:    string

  /**
   * Query params to append / interpolate.
   * Each value resolved against the clicked row + current filter params.
   */
  params?: Record<string, DataLinkParam>

  /** How to open the link. Default: 'self' for page, 'tab' for external. */
  openIn?: 'self' | 'tab'
}

// ── ResolvedLink — runtime-resolved link (ready to render) ────────────────
export interface ResolvedLink {
  title:   string
  target:  'page' | 'url' | 'external'
  href:    string
  openIn:  'self' | 'tab'
}
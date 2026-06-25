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
//  A DataLink param value is a `$`-ref in the unified Ref taxonomy (../ref):
//  '$row'    — resolved from the clicked DataRow (row scope; e.g. bar's geo code)
//  '$param'  — resolved from current filter params (param scope; e.g. active time)
//  literal   — constant string value
//
//  NOTE [R4]: the filter-param source was historically `$ctx` here — the SAME
//  token that means `ctx.dims` in an ObsQuery filter (a Least-Astonishment name
//  collision). It is now `$param` (the `param` scope), so `$ctx` means ONE thing
//  everywhere (ctx.dims). Stored configs are migrated v4→v5 (config/migration.ts).
//
export type DataLinkParam =
  | { $row: string }      // row scope    — row[field]
  | { $param: string }    // param scope  — filterParams[key]
  | string                // literal constant

// ── NavigateDataLink — navigate to a page or URL ─────────────────────────
export interface NavigateDataLink {
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

// ── FilterDataLink — apply a cross-filter on click (N36) ─────────────────
export interface FilterDataLink {
  /** Display label for the link (shown in context menu). */
  title:     LocaleString

  /** Discriminant: target='filter' triggers a cross-filter action. */
  target:    'filter'

  /**
   * The filter param key to update (e.g. 'regionId').
   * Also used as the default field to read from the clicked row when
   * fromField is omitted.
   */
  filterKey: string

  /**
   * Which field on the clicked row supplies the filter value.
   * Defaults to filterKey (reads row[filterKey]).
   */
  fromField?: string
}

// ── DataLinkDef — discriminated union of link types ───────────────────────
export type DataLinkDef = NavigateDataLink | FilterDataLink

// ── ResolvedLink — runtime-resolved link (ready to render) ────────────────
//
//  action discriminates between the two resolution outcomes:
//    'navigate' — href + target + openIn are present; render as <a>
//    'filter'   — filterKey + filterValue are present; dispatch a filter action
//
export type ResolvedLink =
  | {
      action:  'navigate'
      title:   string
      target:  'page' | 'url' | 'external'
      href:    string
      openIn:  'self' | 'tab'
    }
  | {
      action:      'filter'
      title:       string
      filterKey:   string
      filterValue: import('../sdmx').DimVal | undefined
    }
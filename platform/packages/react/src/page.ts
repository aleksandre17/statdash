// ── Navigation types ───────────────────────────────────────────────────
//
//  Sidebar navigation entry — declared per PageConfig.nav, aggregated
//  by SiteProvider into NavEntry[] and injected into context.
//

import type { LocaleString } from '@statdash/engine'

export type NavIconKey = string

export interface NavSubItem {
  /** Anchor label — LocaleString; resolved to the active locale at the nav shell. */
  label:  LocaleString
  /** In-page element id for smooth scroll */
  anchor: string
}

export interface NavItemDef {
  /** Sidebar label for this page — LocaleString; resolved at the nav shell. */
  label: LocaleString
  /** Icon token — renderer resolves to SVG via NAV_ICONS registry */
  icon:  NavIconKey
  /** In-page section anchors shown when the entry is expanded */
  items: NavSubItem[]
}
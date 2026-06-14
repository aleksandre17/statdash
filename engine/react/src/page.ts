// ── Navigation types ───────────────────────────────────────────────────
//
//  Sidebar navigation entry — declared per PageConfig.nav, aggregated
//  by SiteProvider into NavEntry[] and injected into context.
//

export type NavIconKey = string

export interface NavSubItem {
  label:  string
  /** In-page element id for smooth scroll */
  anchor: string
}

export interface NavItemDef {
  /** Sidebar label for this page */
  label: string
  /** Icon token — renderer resolves to SVG via NAV_ICONS registry */
  icon:  NavIconKey
  /** In-page section anchors shown when the entry is expanded */
  items: NavSubItem[]
}
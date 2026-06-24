// ── LinkDef — methodology / reference link primitive ──────────────────
//
//  Live: consumed by the `links` panel plugin (LinksNode.items: LinkDef[]).
//  LinkIconKey is also live — resolved to SVG via LINK_ICONS in @statdash/react.
//  100% JSON-serializable — Constructor (phase 2) authors these without code.
//

import type { LocaleString } from '../i18n/types'

/** Icon token for methodology links — renderer resolves to SVG via LINK_ICONS. */
export type LinkIconKey = 'doc' | 'info' | 'ext'

/** One methodology / reference link. */
export interface LinkDef {
  href:  string
  label: LocaleString
  icon:  LinkIconKey
}

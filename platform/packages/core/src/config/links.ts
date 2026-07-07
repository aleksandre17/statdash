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
  /**
   * Target URL. LocaleString — a plain string (single-locale, the common case) OR
   * a `{ ka, en }` bilingual map when the RESOURCE itself is locale-specific (e.g. a
   * methodology page served at a different path per language). Resolved to the active
   * locale by the LinksShell via resolveLocaleString (a plain string passes through
   * untouched — Postel), the same boundary that resolves `label`.
   */
  href:  LocaleString
  label: LocaleString
  icon:  LinkIconKey
}

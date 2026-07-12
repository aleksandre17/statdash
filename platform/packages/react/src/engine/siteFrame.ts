// ── siteFrame — the SITE-FRAME element (ADR-041 R4 · S6 chrome unification) ──────
//
//  The app-shell chrome regions (header / sidebar / footer …) are the CONSTITUENT
//  PARTS of ONE bounded element: the SITE FRAME. Their data lives in `site.chrome[slot]`
//  (a site-level keyed map) and their shells in the separate `chromeRegistry` (keyed
//  `slot::key`) — a keyed projection of an EXTERNAL SSOT with a per-part contract
//  resolved by an adapter (`chromeRegistry.getMeta(slot,key).schema`). That is,
//  byte-for-byte, the `sourced` residence — the SAME shape the filter-bar's controls
//  take (`band:{source:'page-filters'}`). So the site-frame DECLARES its chrome regions
//  as ONE `sourced` PartField via `band`, and `partFieldsOf` projects it with ZERO engine
//  change; the app-owned `chromeParts` adapter (registered under source `'site-chrome'`)
//  enumerates `site.chrome × chromeRegistry` and writes through `updateChromeConfig`.
//
//  Residence is `sourced`, NOT `slot` (ADR-041 line 34 left it open; the S6 brief said
//  slot — a category error): `slot` residence means child NODE instances in `element[field]`
//  under the node-children reducer, which would force a config migration of `site.chrome`
//  into a node field (violates the zero-config-migration invariant). Chrome is a keyed
//  external projection → `sourced`, the second consumer of that residence (after filters).
//
//  This is the DECLARATION half (app-agnostic, engine-side). The `chromeParts` adapter
//  (enumerate / write, touching the app-owned `site.chrome` SSOT) lives in `apps/panel`,
//  registered under the SAME residence-source-keyed Part port — packages/react stays
//  app-agnostic (Law 3), exactly as the filter-bar META declares `page-filters` here while
//  `sourcedParts` lives in the app.
//
import type { ObjectMeta } from './slice-meta'

/**
 * The STABLE synthetic node id of the site-frame element. Chrome parts are addressed
 * `{ nodeId: SITE_FRAME_ID, partPath: 'chrome.<slot>' }` — the ONE `PartAddress` grammar,
 * so a chrome selection is a Part selection like any other (no `kind:'chrome'` arm). The
 * site frame is not a page-tree node; this id names it as the owning element of chrome parts.
 */
export const SITE_FRAME_ID = 'site-frame'

/**
 * The site-frame element META — declares its chrome regions as ONE `sourced` band
 * (source `'site-chrome'`). `partFieldsOf(SITE_FRAME_META)` emits a single sourced
 * PartField `{ field:'site-chrome', residence:'sourced', source:'site-chrome' }`, which
 * the port routes to the `chromeParts` adapter. Deliberately minimal: the site frame is a
 * synthetic shell element (not registered in `nodeRegistry`, no schema/slots of its own) —
 * its ONLY parts are the sourced chrome regions.
 */
export const SITE_FRAME_META: ObjectMeta = {
  band: { source: 'site-chrome' },
}

/**
 * The `partPath` prefix a chrome part takes under the site-frame element. A chrome
 * region is addressed `{ nodeId: SITE_FRAME_ID, partPath: 'chrome.<slot>' }` — the
 * `sourced`-residence stable-key convention (ADR-041 Delta 1), where the stable key is
 * the chrome slot name. This is the ONE place the convention lives; the `chromeParts`
 * adapter (enumerate/write) and the store's `selectChrome` ergonomic wrapper both build
 * their address through it, so the grammar can never drift between reader and writer.
 */
export const CHROME_PART_PREFIX = 'chrome'

/** Build the `partPath` for a chrome region's Part address (`chrome.<slot>`). */
export function chromePartPath(slot: string): string {
  return `${CHROME_PART_PREFIX}.${slot}`
}

/**
 * The inverse of {@link chromePartPath}: the chrome slot a `partPath` addresses, or
 * `null` when the path is not a chrome part (a filter/value part, or malformed). Strict
 * on the `chrome.` prefix so a non-chrome address is never mis-parsed as a slot.
 */
export function chromeSlotOfPartPath(partPath: string | undefined): string | null {
  if (!partPath) return null
  const dot = partPath.indexOf('.')
  if (dot < 0 || partPath.slice(0, dot) !== CHROME_PART_PREFIX) return null
  const slot = partPath.slice(dot + 1)
  return slot || null
}

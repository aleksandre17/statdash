// ── Link icon registry ─────────────────────────────────────────────────
//
//  Maps LinkIconKey token (from PageDef.links[].icon) to an SVG component.
//  This is a renderer detail — the config stores the token, the renderer
//  resolves it here.  Adding a new icon variant:
//    1. Add token to LinkIconKey in page.ts
//    2. Add SVG component + entry here
//    Zero changes needed anywhere else.
//
//  Pattern: Grafana panel type registry (token → panel component).
//
import type { LinkIconKey } from '@geostat/engine'

function DocIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <path d="M14 2v6h6"/>
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 16v-4M12 8h.01"/>
    </svg>
  )
}

function ExtIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
      <path d="M15 3h6v6M10 14L21 3"/>
    </svg>
  )
}

export const LINK_ICONS: Record<LinkIconKey, () => React.ReactNode> = {
  doc:  DocIcon,
  info: InfoIcon,
  ext:  ExtIcon,
}
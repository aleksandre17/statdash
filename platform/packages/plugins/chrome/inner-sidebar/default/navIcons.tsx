// ── navIcons — token → SVG registry for the sidebar nav ───────────────
//
//  A REGISTERED map (token → component), mirroring how the platform registers
//  every other capability (nodeRegistry, chromeRegistry, the PresentationProjector
//  registry): the shell looks an entry up by its `NavIconKey` token rather than
//  branching on icon names. A new icon = one entry here + one `icon:` token in the
//  page's nav config → ZERO shell code (OCP). `resolveNavIcon` is the single read
//  seam; it falls back to a neutral glyph so an unknown/missing token never throws
//  or renders an empty box.
//

import type { ReactNode }   from 'react'
import type { NavIconKey }  from '@statdash/react'

// ── Glyphs — each a self-contained 16×16 stroked SVG ──────────────────

function BarChartIcon(): ReactNode {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="10" width="4" height="11" rx="1"/>
      <rect x="9" y="6" width="4" height="15" rx="1"/>
      <rect x="16" y="2" width="4" height="19" rx="1"/>
    </svg>
  )
}

function DocumentIcon(): ReactNode {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <path d="M14 2v6h6M9 13h6M9 17h4"/>
    </svg>
  )
}

function PinIcon(): ReactNode {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      <circle cx="12" cy="9" r="2.5"/>
    </svg>
  )
}

// ── The registry — token → glyph factory ──────────────────────────────

const NAV_ICONS: Record<string, () => ReactNode> = {
  'bar-chart': BarChartIcon,
  'document':  DocumentIcon,
  'pin':       PinIcon,
}

/** The fallback glyph when a token is absent from the registry. */
const FALLBACK_ICON = BarChartIcon

/**
 * Resolve a NavIconKey token to its glyph factory. Unknown/missing tokens fall
 * back to a neutral glyph so the sidebar never renders an empty slot or throws.
 */
export function resolveNavIcon(key: NavIconKey): () => ReactNode {
  return NAV_ICONS[key] ?? FALLBACK_ICON
}

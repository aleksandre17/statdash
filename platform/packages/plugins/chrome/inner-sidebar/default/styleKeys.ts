// ── styleKeys — the inner-sidebar slice's typed class-name SSOT ────────
//
//  The static BEM-ish block/element class names live in EXACTLY ONE place, so a
//  CSS rename is a single typed edit (not silent dead strings scattered across
//  TSX). Mirrors the section slice's styleKeys.ts: data-attribute scoping for
//  state (`is-active` stays a state class here — it is NOT a variant) plus this
//  typed constant for the static skeleton. No hashed names → byte-identical with
//  the existing global `.sidebar-*` selectors and the `--sc` token cascade.
//

export const SIDEBAR = {
  root:         'inner-sidebar',
  brand:        'sidebar-brand',
  brandText:    'sidebar-brand-text',
  sectionLabel: 'sidebar-section-label',
  navSection:   'sidebar-nav-section',
  navItem:      'sidebar-nav-item',
  navLabel:     'sidebar-nav-label',
  icon:         'sidebar-icon',
  chevron:      'sidebar-chevron',
  sub:          'sidebar-sub',
  subItem:      'sidebar-sub-item',
  subDot:       'sidebar-sub-dot',
  subTitle:     'sidebar-sub-title',
  footer:       'sidebar-footer',
  /** State modifiers — runtime state, not authored variants. */
  isActive:     'is-active',
  isOpen:       'open',
} as const

// ── Collapse-height heuristic ──────────────────────────────────────────
//
//  The sub-nav animates open via a max-height transition (height:auto can't be
//  transitioned). We approximate the open height from the item count: each row
//  occupies one ROW_HEIGHT_REM "slot" (≈ the sub-item's line box + vertical
//  padding from inner-sidebar.css). A floor of 1 row keeps a single-item list
//  from collapsing to zero. Slightly over-estimating is intentional — the cap is
//  a ceiling for the animation, never a hard clip (overflow is hidden only while
//  closed).
//
const SUB_ITEM_ROW_HEIGHT_REM = 2.6

/** Max-height (rem) for an expanded sub-nav holding `itemCount` rows. */
export function subNavOpenHeightRem(itemCount: number): number {
  return Math.max(itemCount, 1) * SUB_ITEM_ROW_HEIGHT_REM
}

// ── Section key + style helpers ───────────────────────────────────────
//
//  De-magicked constants/helpers for SectionShell. Keeping them named and
//  co-located makes the shell read declaratively and gives the GlobalState
//  key + the accent override a single source of truth.
//

import type { CSSProperties } from 'react'

/**
 * GlobalState key for a section's persisted view-toggle (chart/table) choice.
 * Persists the active role across navigations (see GlobalStateProvider).
 *
 * Falls back to `'anon'` when the section has no resolved id so the key is
 * still stable & well-formed; such sections simply share one anonymous slot.
 */
export function sectionViewStateKey(resolvedId: string | undefined): string {
  return `section:view:${resolvedId ?? 'anon'}`
}

/**
 * Per-section accent override of the page-level `--sc` cascade.
 *
 * `--sc` is normally set once at the page wrapper (the presentation projector
 * maps page color → `--sc`); a section may override it locally via `def.color`
 * so its accent bar / label / active toggle pick up the section's own colour.
 * Returns `undefined` when no override is authored, so the page cascade wins.
 *
 * NOTE: this is an intentional *local* override and does not route through the
 * page presentation projector. If section colour ever needs to participate in
 * the same projection pipeline as page colour, unify it there — out of scope here.
 */
export function sectionAccentStyle(color: string | undefined): CSSProperties | undefined {
  return color ? ({ '--sc': color } as CSSProperties) : undefined
}

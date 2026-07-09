// ── FF-STRATA-CONTRAST — the Strata chrome text is WCAG 2.1 AA (Law 9) ─────────
//
//  The owner-visible bug this guards against: "terrible font colors". A theme
//  preset that sets accent/heading tones but leaves the text roles unstated (or
//  retunes a text/surface pair below threshold) can ship illegible or low-contrast
//  chrome. This fitness test computes the ACTUAL WCAG contrast ratio for every
//  text/background token pair the Studio chrome renders UNDER the Strata preset,
//  and fails CI if any drops below AA. So a future preset edit that breaks legibility
//  cannot merge green (the theme-is-data seam stays honest AND accessible).
//
//  Effective-value model: the shell root carries `buildThemeVars(STRATA_PRESET, …)`,
//  so a token resolves to its STRATA_PRESET value if set, else the platform default.
//  Every FOREGROUND role Strata renders is now pinned in the preset (real data —
//  the thing under test); the only non-preset side is the light SURFACE backgrounds,
//  fixed brand-neutral platform primitives mirrored from @statdash/styles tokens.css
//  `:root` (SURFACE_DEFAULTS). vitest strips CSS `?raw` to empty, so we cannot read
//  tokens.css at test time — these three primitives are extremely stable and any
//  change to them is a packages-level edit gated by tokens.parity.test.ts. The
//  preset MAY override a surface too, so we overlay preset-over-default.
//
//  Companion to FF-CHROME-TOKEN-DRIVEN (no brand literal leaks into chrome code) and
//  FF-THEME-EDIT-DATA (the preset is pure data): those prove the seam is data; this
//  proves the data is accessible.
import { describe, it, expect } from 'vitest'
import { STRATA_PRESET } from './strata-preset'
import { TOKENS_CATALOG } from '@statdash/styles'

// The fixed light-theme SURFACE backgrounds the Strata text sits on. SSOT =
// @statdash/styles tokens.css `:root` (--color-surface / -raised / -sunken) +
// the accent-active tint the preset itself pins. Kept in sync by tokens.parity
// on the packages side; the preset never darkens these today (overlay handles it
// if it ever does).
const SURFACE_DEFAULTS: Record<string, string> = {
  'color.surface':        '#FFFFFF',
  'color.surface-raised': '#FAFBFB',
  'color.surface-sunken': '#F5F7F7',
}

/** Effective hex of a TOKENS_CATALOG key under Strata: preset value, else default. */
function effective(tokenKey: string): string | undefined {
  return STRATA_PRESET[tokenKey] ?? SURFACE_DEFAULTS[tokenKey]
}

// ── WCAG relative-luminance contrast (2.1) ────────────────────────────────────
function channel(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}
function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}
export function contrastRatio(a: string, b: string): number {
  const l1 = luminance(a), l2 = luminance(b)
  const hi = Math.max(l1, l2), lo = Math.min(l1, l2)
  return (hi + 0.05) / (lo + 0.05)
}

// ── The chrome text/background pairs (see studio.css) ─────────────────────────
// fg / bg are TOKENS_CATALOG keys; `min` is the WCAG AA floor for that text size:
//   4.5 — normal body/label text
//   3.0 — large text (≥18.66px bold or ≥24px) and non-text UI graphics
interface Pair { name: string; fg: string; bg: string; min: number }
const CHROME_PAIRS: Pair[] = [
  // .studio-shell — body text on the base surface
  { name: 'shell body text',        fg: 'color.text-primary',    bg: 'color.surface',        min: 4.5 },
  // .studio-wordmark — display-tone wordmark on the top bar (font-size-lg bold = large)
  { name: 'top-bar wordmark',       fg: 'color.heading-display', bg: 'color.surface-raised', min: 3.0 },
  // .studio-rail__btn[data-active] — azure label on the azure active-slot tint (both preset)
  { name: 'active rail label',      fg: 'color.accent',          bg: 'color.accent-bg',      min: 4.5 },
  // .studio-bottom — secondary status text on the bottom strip
  { name: 'bottom-strip status',    fg: 'color.text-secondary',  bg: 'color.surface-raised', min: 4.5 },
  // Muted/faint helper text used across the docks + live canvas (descend from the
  // shell root, so they wear the Strata text spine too).
  { name: 'muted helper (surface)', fg: 'color.text-muted',      bg: 'color.surface',        min: 4.5 },
  { name: 'muted helper (sunken)',  fg: 'color.text-muted',      bg: 'color.surface-sunken', min: 4.5 },
  { name: 'faint text (surface)',   fg: 'color.text-faint',      bg: 'color.surface',        min: 4.5 },
  // Accent used AS text (links / active affordances) on the base surface.
  { name: 'accent-as-text (link)',  fg: 'color.accent',          bg: 'color.surface',        min: 4.5 },
]

describe('FF-STRATA-CONTRAST — chrome text meets WCAG 2.1 AA under Strata (Law 9)', () => {
  it.each(CHROME_PAIRS)('$name — $fg on $bg is ≥ AA', ({ fg, bg, min }) => {
    const fgHex = effective(fg)
    const bgHex = effective(bg)
    expect(fgHex, `${fg} must resolve to a hex (preset or default)`).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(bgHex, `${bg} must resolve to a hex (preset or default)`).toMatch(/^#[0-9a-fA-F]{6}$/)
    const ratio = contrastRatio(fgHex as string, bgHex as string)
    expect(ratio, `${fg} on ${bg} = ${ratio.toFixed(2)}:1 (needs ≥ ${min}:1)`).toBeGreaterThanOrEqual(min)
  })

  it('the guard actually bites — a low-contrast pair fails', () => {
    // A near-tint azure text on the azure active slot would be illegible.
    expect(contrastRatio('#8FB4DC', '#E7EFF8')).toBeLessThan(4.5)
    // Sanity: the ratio math is correct at the extremes.
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0)
  })

  it('every Strata TEXT role is explicitly owned by the preset (identity is intentional)', () => {
    for (const key of ['color.text-primary', 'color.text-secondary', 'color.text-muted', 'color.text-faint']) {
      expect(STRATA_PRESET[key], `${key} must be pinned in the Strata preset`).toBeDefined()
      expect(TOKENS_CATALOG[key], `${key} must be a real catalog key`).toBeDefined()
    }
  })
})

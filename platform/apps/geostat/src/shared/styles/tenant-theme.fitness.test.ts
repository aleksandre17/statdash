// ── tenant-theme.fitness.test.ts — FF-TENANT-DARK-COMPLETE ────────────────────
//
//  packages/styles' own tokens.css is guarded by FF-DARK-COMPLETE (tokens.
//  parity.test.ts): every semantic color role the DEFAULT theme defines must
//  also have a dark-mode value, or the app-tier CANNOT introduce a NEW class
//  of "frozen light role" bug once a tenant stylesheet starts rebinding
//  those same roles with its own [data-tenant="…"] block — a plain
//  [data-theme="dark"] override is beaten by an unconditional
//  [data-tenant="geostat"] rule at equal specificity, purely by cascade
//  source order (packages/styles loads before the app's own CSS). That is the
//  root cause the theme-contrast sweep (2026-07) found: geostat's tenant
//  block pinned --color-accent/-hover/-muted/-bg/-chip-border and the trend
//  pair UNCONDITIONALLY, so every accent-colored link/chip/button rendered at
//  ~4.17:1 (or worse) against the dark surface — an AA failure invisible
//  unless you read BOTH themes side by side.
//
//  This fitness makes that class of regression structural for THIS tenant
//  stylesheet, mirroring tokens.parity.test.ts's own dual-block pattern:
//
//    1. Every --color-* custom property the base [data-tenant="geostat"]
//       block defines must be redefined by BOTH dark selector forms (system-
//       preference @media + explicit [data-theme="dark"]) — unless it is in
//       the documented PINNED allowlist (a role whose only consumer sits on
//       non-adaptive, config-authored artwork, not the app surface).
//    2. The two dark blocks must stay byte-identical to each other (a value
//       added to one and forgotten in the other is a half-dark tenant).
//    3. A WCAG 2.1 AA spot-check on the exact pairs the bug manifested in:
//       accent-on-dark-surface, and the trend pair against BOTH the light
//       surface (white) and the dark surface.
//
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync }         from 'node:fs'
import { fileURLToPath }        from 'node:url'
import { dirname, resolve }     from 'node:path'

// Vitest 4.x injects __dirname as the WORKSPACE root, not this file's
// directory — resolve from import.meta.url instead (see project memory
// feedback_vitest_workspace_dirname).
const here = dirname(fileURLToPath(import.meta.url))

// Block comments are stripped to spaces (preserving line/offset structure) BEFORE
// any regex scan below. Without this, a comment that documents a token BY NAME
// followed by a colon — e.g. "/* --color-foo: deliberately not overridden … */" —
// is itself shaped like a real declaration and the value-consuming regex
// (`[^;]+;`) would run on past it looking for the next semicolon, splicing a
// bogus entry into the parsed map. (Caught live: a rationale comment on the
// removed --color-breadcrumb-separator override produced exactly this false
// positive during manual verification of this fitness function.)
const stripComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))

const cssPath    = resolve(here, 'index.css')
const css        = stripComments(readFileSync(cssPath, 'utf8'))
const tokensPath = resolve(here, '../../../../../packages/styles/src/css/tokens.css')
const tokensCss  = stripComments(readFileSync(tokensPath, 'utf8'))

// Roles whose ONLY consumer sits on non-adaptive, config-authored artwork
// (HeroCardDef.pageBg — a per-card gradient/image), never on --color-surface,
// so they must NOT flip with the app theme. Mirrors tokens.css's own
// PINNED_NO_FLIP rationale on --color-heading-display.
const PINNED_NO_FLIP = new Set<string>(['--color-heading-display'])

function parseBlockAt(src: string, from: number): Map<string, string> {
  const open = src.indexOf('{', from)
  let depth = 0
  let end   = open
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break } }
  }
  const block = src.slice(open + 1, end)
  const map = new Map<string, string>()
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g
  let m: RegExpExecArray | null
  while ((m = re.exec(block)) !== null) map.set(m[1], m[2].replace(/\s+/g, ' ').trim())
  return map
}

const baseMap  = parseBlockAt(css, css.indexOf('[data-tenant="geostat"] {'))
const mediaMap = parseBlockAt(css, css.indexOf('prefers-color-scheme: dark'))
const attrMap  = parseBlockAt(css, css.lastIndexOf('[data-tenant="geostat"][data-theme="dark"]'))

const baseColorProps = [...baseMap.keys()].filter(k => k.startsWith('--color-'))

describe('FF-TENANT-DARK-COMPLETE — geostat tenant CSS colors are dark-safe', () => {
  it('parses a non-empty base tenant block and dark blocks (guard against a silently-empty scan)', () => {
    expect(baseColorProps.length).toBeGreaterThan(3)
    expect(mediaMap.size).toBeGreaterThan(3)
    expect(attrMap.size).toBeGreaterThan(3)
  })

  it('every --color-* role the tenant pins is either dark-overridden (both selector forms) or on the documented PINNED_NO_FLIP allowlist', () => {
    const missing: string[] = []
    for (const prop of baseColorProps) {
      if (PINNED_NO_FLIP.has(prop)) continue
      if (!mediaMap.has(prop)) missing.push(`${prop}: missing from @media (prefers-color-scheme: dark)`)
      if (!attrMap.has(prop))  missing.push(`${prop}: missing from [data-tenant="geostat"][data-theme="dark"]`)
    }
    expect(
      missing,
      `${missing.length} geostat tenant color role(s) stay FROZEN at their light value in dark mode:\n  ` +
        missing.join('\n  ') +
        `\n\nAdd a dark value to BOTH selector forms, or add the role to PINNED_NO_FLIP with a documented ` +
        `reason (its only consumer must sit on non-adaptive artwork, not --color-surface).`,
    ).toHaveLength(0)
  })

  it('the @media and [data-theme="dark"] tenant blocks are byte-identical', () => {
    const diffs: string[] = []
    for (const [k, v] of mediaMap) {
      if (!attrMap.has(k)) diffs.push(`${k}: in @media but missing from [data-theme="dark"]`)
      else if (attrMap.get(k) !== v) diffs.push(`${k}: @media=${v} vs attr=${attrMap.get(k)}`)
    }
    for (const k of attrMap.keys()) {
      if (!mediaMap.has(k)) diffs.push(`${k}: in [data-theme="dark"] but missing from @media`)
    }
    expect(diffs, `Geostat tenant dark blocks diverged:\n  ${diffs.join('\n  ')}`).toHaveLength(0)
  })

  it('every PINNED_NO_FLIP role really is absent from both dark blocks (the allowlist is not stale)', () => {
    const stale = [...PINNED_NO_FLIP].filter(p => mediaMap.has(p) || attrMap.has(p))
    expect(
      stale,
      `${stale.length} PINNED_NO_FLIP role(s) ARE overridden in a dark block — the allowlist entry is stale, remove it: ${stale.join(', ')}`,
    ).toHaveLength(0)
  })

  // WCAG 2.1 AA (Law 9) — the exact pairs the 2026-07 sweep found broken.
  it('WCAG AA: dark-mode accent clears 4.5:1 against the dark app surface', () => {
    const darkSurface = readDarkToken(tokensCss, '--color-surface')
    const darkAccent  = attrMap.get('--color-accent')!
    expect(contrast(darkAccent, darkSurface)).toBeGreaterThanOrEqual(4.5)
  })

  it('WCAG AA: light-mode trend pair clears 4.5:1 against the light app surface (white)', () => {
    expect(contrast(baseMap.get('--color-trend-positive')!, '#FFFFFF')).toBeGreaterThanOrEqual(4.5)
    expect(contrast(baseMap.get('--color-trend-negative')!, '#FFFFFF')).toBeGreaterThanOrEqual(4.5)
  })

  it('WCAG AA: dark-mode trend pair clears 4.5:1 against the dark app surface', () => {
    const darkSurface = readDarkToken(tokensCss, '--color-surface')
    expect(contrast(attrMap.get('--color-trend-positive')!, darkSurface)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(attrMap.get('--color-trend-negative')!, darkSurface)).toBeGreaterThanOrEqual(4.5)
  })
})

// ── WCAG contrast helpers (relative luminance, WCAG 2.1 §1.4.3 formula) ────

function readDarkToken(tokensSrc: string, name: string): string {
  const attrBlockStart = tokensSrc.lastIndexOf('[data-theme="dark"]')
  const open = tokensSrc.indexOf('{', attrBlockStart)
  let depth = 0
  let end   = open
  for (let i = open; i < tokensSrc.length; i++) {
    if (tokensSrc[i] === '{') depth++
    else if (tokensSrc[i] === '}') { depth--; if (depth === 0) { end = i; break } }
  }
  const block = tokensSrc.slice(open + 1, end)
  const m = new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{6})`).exec(block)
  if (!m) throw new Error(`dark value for ${name} not found as a direct hex in tokens.css`)
  return m[1]
}

function lin(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// ── FF-CHROME-TOKEN-DRIVEN + FF-THEME-EDIT-DATA — rebrand-is-data guards ───────
//
//  Two invariants the M1.4 brand seam depends on, encoded as red-on-regression
//  gates (SPEC-authoring-reconception-M1 §6):
//
//  FF-CHROME-TOKEN-DRIVEN — the Studio SHELL CHROME (the frame that gets skinned:
//    top bar, activity rail, docks, shell layout + its stylesheet) carries NO
//    hardcoded brand colour. Every colour must come from a `@statdash/styles`
//    token, so "make the tool look like Strata" is a token preset (data), not a
//    chrome edit. Brand colour literals may live ONLY in declarative token DATA
//    (strata-preset.ts / themeOverrides) — never in a component. A planted literal
//    must fail this test (proven below), so the invariant cannot silently regress.
//    (Scope = the chrome FRAME; editor CONTROLS like the colour-picker swatch are
//    dock content, not skinned chrome, and are out of scope by design.)
//
//  FF-THEME-EDIT-DATA — a theme edit produces ONLY data (Law 2): the Strata preset
//    is a plain tokenKey→string map over real catalog keys, no function / code path.
//
import { describe, it, expect } from 'vitest'
import { STRATA_PRESET, BRAND_TOKEN_GROUPS } from './strata-preset'
import { TOKENS_CATALOG } from '@statdash/styles'

// The chrome FRAME — the components + stylesheet that render the skinned shell.
// Loaded as raw source (Vite ?raw) so this stays browser-graph typed (the panel
// tsconfig excludes @types/node) — no filesystem dependency.
const FRAME_SOURCES = import.meta.glob(
  ['./studio.css', './StudioShell.tsx', './StudioTopBar.tsx', './ActivityRail.tsx', './RightDock.tsx'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

// Strip comments first (block always; line for TS/TSX) so a hex mentioned in prose
// can't false-positive — the CSS-fitness comment-stripping discipline.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

// Brand colour literals: hex, rgb()/rgba(), hsl()/hsla(). Token refs are var(--…).
const BRAND_LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/

/** Find hardcoded brand colour literals in a source (comments stripped). */
export function findBrandColorLiterals(src: string): string[] {
  const clean = stripComments(src)
  return clean.match(new RegExp(BRAND_LITERAL, 'g')) ?? []
}

describe('FF-CHROME-TOKEN-DRIVEN — the shell chrome is token-driven', () => {
  it('resolves the chrome frame sources (guard is actually scanning files)', () => {
    expect(Object.keys(FRAME_SOURCES)).toHaveLength(5)
  })

  for (const [path, src] of Object.entries(FRAME_SOURCES)) {
    it(`${path.split('/').pop()} has no hardcoded brand colour literal`, () => {
      expect(findBrandColorLiterals(src)).toEqual([])
    })
  }

  it('the guard actually bites — a planted literal is detected', () => {
    expect(findBrandColorLiterals('.x { background: #ff0000 }')).not.toEqual([])
    expect(findBrandColorLiterals('sx={{ color: "rgb(1,2,3)" }}')).not.toEqual([])
    expect(findBrandColorLiterals('border: 1px solid hsl(200 50% 40%)')).not.toEqual([])
  })
})

describe('FF-THEME-EDIT-DATA — the brand preset is pure declarative data (Law 2)', () => {
  it('Strata is a plain tokenKey→string map (no function / code path)', () => {
    for (const [key, value] of Object.entries(STRATA_PRESET)) {
      expect(typeof value, `${key} must be a string value`).toBe('string')
    }
  })

  it('every Strata key is a real TOKENS_CATALOG key (no invented tokens)', () => {
    for (const key of Object.keys(STRATA_PRESET)) {
      expect(TOKENS_CATALOG[key], `${key} must exist in TOKENS_CATALOG`).toBeDefined()
    }
  })

  it('every Strata key falls within the brand-editor group scope (retunable live)', () => {
    for (const key of Object.keys(STRATA_PRESET)) {
      expect(BRAND_TOKEN_GROUPS).toContain(TOKENS_CATALOG[key].group)
    }
  })
})

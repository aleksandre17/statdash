// ── FF-MUI-THEME-BOUND — MUI stays bound to the DTCG token spine (ADR-021) ─────
//
//  The owner-visible bug this guards: MUI controls rendering on the factory default
//  primary #1976d2 (bright blue), clashing with Strata's azure — the bulk of the
//  "terrible font colors". This test fails CI if a future edit unbinds MUI from the
//  tokens: reverts the seed to the default blue, drops a brand alias, or lets an
//  alias drift off a real token. Mirrors FF-STRATA-CONTRAST's DATA-first style — it
//  reads the alias map from the TS MODULE export, never by scanning `.css` (vitest
//  strips CSS `?raw` to empty, which would make a scan-based guard vacuous).
//
//  Three legs (ADR-021 §Fitness guard): (1) not-the-default-blue seed, (2) alias
//  coverage on the token spine, (3) the CSS-vars provider actually mounts.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { studioTheme, MUI_TOKEN_ALIASES, muiAliasVars } from './muiTheme'
import { cssVarName } from './themeVars'
import { STRATA_PRESET } from './strata-preset'
import { TOKENS_CATALOG } from '@statdash/styles'
import { App } from '../App'
import { logout } from '../lib/auth'

const MUI_DEFAULT_PRIMARY = '#1976d2'

describe('FF-MUI-THEME-BOUND — the Studio MUI theme is bound to the DTCG tokens (ADR-021)', () => {
  // ── (1) The seed killed the default blue and IS the Strata azure ────────────
  it('the theme primary is NOT MUI\'s default blue — it is the Strata accent', () => {
    const primaryMain = studioTheme.colorSchemes?.light?.palette.primary.main
    expect(primaryMain, 'light scheme palette.primary.main must be seeded').toBeDefined()
    expect(primaryMain).not.toBe(MUI_DEFAULT_PRIMARY)
    // The seed is the live Strata accent (not a re-typed literal that could drift).
    expect(primaryMain).toBe(STRATA_PRESET['color.accent'])
  })

  it('the guard actually bites — the raw MUI default WOULD fail leg (1)', () => {
    // Sanity: if someone reverted the seed to the factory blue, the assertion above trips.
    expect(MUI_DEFAULT_PRIMARY).not.toBe(STRATA_PRESET['color.accent'])
  })

  // ── (2) Alias coverage — every brand slot maps to a REAL token, live-projected ─
  const REQUIRED_BRAND_VARS = [
    '--mui-palette-primary-main',
    '--mui-palette-primary-dark',
    '--mui-palette-primary-light',
    '--mui-palette-primary-contrastText',
    '--mui-palette-secondary-main',
    '--mui-palette-text-primary',
    '--mui-palette-text-secondary',
    '--mui-palette-background-default',
    '--mui-palette-background-paper',
    '--mui-palette-divider',
    '--mui-palette-error-main',
  ] as const

  it('covers every required brand palette var', () => {
    for (const v of REQUIRED_BRAND_VARS) {
      expect(MUI_TOKEN_ALIASES[v], `${v} must be in the alias map`).toBeDefined()
    }
  })

  it('every alias references a REAL @statdash/styles token (no drift off the spine)', () => {
    for (const [muiVar, { token, seed }] of Object.entries(MUI_TOKEN_ALIASES)) {
      // The token is a real catalog key with a resolvable CSS variable…
      expect(TOKENS_CATALOG[token], `${muiVar} → unknown token "${token}"`).toBeDefined()
      const dtcg = cssVarName(token)
      expect(dtcg, `${token} must resolve to a --css-var`).toMatch(/^--[\w-]+$/)
      // …and the emitted alias is the LIVE projection: var(--token, strataSeed).
      expect(muiAliasVars[muiVar]).toBe(`var(${dtcg}, ${seed})`)
      // The seed is a real hex literal (so decomposeColor never sees a var() — part 1).
      expect(seed, `${muiVar} seed must be hex`).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  // ── (3) The provider mounts — a CSS-vars scope is live in the App tree ──────
  beforeEach(() => logout()) // no token → App stays on login (no async boot, deterministic)
  afterEach(() => logout())

  it('App mounts a CSS-vars MUI theme scope (the provider is not deleted)', () => {
    render(<App />)
    // Two independent signals that the CSS-vars theme mounted: MUI's color-scheme
    // attribute on the document root, OR the emitted `--mui-palette-*` variables
    // (the alias block renders inside the provider). Either proves the scope is live.
    const scheme = document.documentElement.getAttribute('data-mui-color-scheme')
    const styleText = Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent ?? '')
      .join('')
    const emittedMuiVar = styleText.includes('--mui-palette-primary-main')
    expect(
      scheme === 'light' || emittedMuiVar,
      'a CSS-vars MUI theme scope must be mounted (color-scheme attr or --mui-* emitted)',
    ).toBe(true)
  })
})

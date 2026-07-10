// ── muiTheme — bind MUI to the DTCG token spine (ADR-021) ─────────────────────
//
//  The panel mounts NO MUI theme today, so every control falls to MUI's factory
//  primary #1976d2 (bright blue) — the clash under Strata the owner reads as
//  "terrible font colors". This module fixes it apps-only, WITHOUT baking a frozen
//  copy of the tokens: it splits the two concerns MUI conflates.
//
//    1. Derivation on HEX (this file's `studioTheme`). `extendTheme` runs
//       `decomposeColor()` on every `main` to derive -light/-dark/-mainChannel/
//       contrastText. `decomposeColor()` THROWS on a `var()` string, so the seed
//       must be real literals — pulled from STRATA_PRESET for the brand keys, and
//       a small pinned neutral/status set mirrored from @statdash/styles tokens.css
//       `:root`. SEED ONLY — the runtime truth is the CSS-var alias (part 2).
//
//    2. Runtime resolution in the BROWSER (the `muiAliasVars` block, mounted at
//       `:root` by App). It re-points MUI's generated `--mui-palette-*` vars at the
//       live DTCG `--color-*` / `--status-*` vars, each with a Strata fallback. Once
//       aliased, MUI's SOLID fills track a live Style-editor edit by pure CSS
//       cascade — the `var()` is resolved by the engine, never by MUI's JS parser.
//
//  Single authored artifact = MUI_TOKEN_ALIASES: `tokenKey` drives BOTH the seed
//  hex (part 1) and the CSS var (part 2, via themeVars.cssVarName), so a renamed
//  token surfaces in ONE place and the two halves can never drift (Law 6).
//
//  Named trade-off (ADR-021): MUI's alpha overlays read `-mainChannel` (space-RGB),
//  which stays at the SEEDED value until reload — solid fills go live immediately,
//  hover tints lag one reload. Bounded/cosmetic; a live channel would need a
//  packages-level `--color-accent-channel` token (out of this apps-only scope).

import { extendTheme } from '@mui/material/styles'
import { STRATA_PRESET } from './strata-preset'
import { cssVarName } from './themeVars'

// Neutral + status seeds NOT owned by the Strata preset (the preset pins only the
// brand/foreground spine; these fall through to the platform defaults). Mirrored
// from @statdash/styles tokens.css `:root` — SEED ONLY; runtime truth = the alias.
const NEUTRAL_SEED = {
  textInverse:    '#FFFFFF', // --color-text-inverse
  surface:        '#FFFFFF', // --color-surface
  surfaceRaised:  '#FAFBFB', // --color-surface-raised
  border:         '#E8EEED', // --color-border
  dangerFg:       '#dc2626', // --color-danger-fg
  statusPositive: '#1b7a43', // --status-positive-fg
  statusWarning:  '#8a5a00', // --status-warning-fg
  statusInfo:     '#0b4a82', // --status-info-fg
} as const

/** One MUI palette var ⇄ its live DTCG token + its Strata seed hex. */
interface Alias {
  /** TOKENS_CATALOG key — drives the live `var(--…)` (part 2) via cssVarName. */
  readonly token: string
  /** Resolved Strata hex — the `decomposeColor`-safe seed (part 1) + CSS fallback. */
  readonly seed: string
}

/**
 * The authored mapping (exported as DATA so FF-MUI-THEME-BOUND can assert on it).
 * Brand seeds come from STRATA_PRESET (not re-typed); neutral/status from NEUTRAL_SEED.
 */
export const MUI_TOKEN_ALIASES: Readonly<Record<string, Alias>> = {
  '--mui-palette-primary-main':         { token: 'color.accent',           seed: STRATA_PRESET['color.accent'] },
  '--mui-palette-primary-dark':         { token: 'color.accent-hover',     seed: STRATA_PRESET['color.accent-hover'] },
  '--mui-palette-primary-light':        { token: 'color.accent-bg',        seed: STRATA_PRESET['color.accent-bg'] },
  '--mui-palette-primary-contrastText': { token: 'color.text-inverse',     seed: NEUTRAL_SEED.textInverse },
  '--mui-palette-secondary-main':       { token: 'color.accent-secondary', seed: STRATA_PRESET['color.accent-secondary'] },
  '--mui-palette-text-primary':         { token: 'color.text-primary',     seed: STRATA_PRESET['color.text-primary'] },
  '--mui-palette-text-secondary':       { token: 'color.text-secondary',   seed: STRATA_PRESET['color.text-secondary'] },
  '--mui-palette-text-disabled':        { token: 'color.text-faint',       seed: STRATA_PRESET['color.text-faint'] },
  '--mui-palette-background-default':   { token: 'color.surface',          seed: NEUTRAL_SEED.surface },
  '--mui-palette-background-paper':     { token: 'color.surface-raised',   seed: NEUTRAL_SEED.surfaceRaised },
  '--mui-palette-divider':              { token: 'color.border',           seed: NEUTRAL_SEED.border },
  '--mui-palette-error-main':           { token: 'color.danger-fg',        seed: NEUTRAL_SEED.dangerFg },
  '--mui-palette-success-main':         { token: 'status.positive-fg',     seed: NEUTRAL_SEED.statusPositive },
  '--mui-palette-warning-main':         { token: 'status.warning-fg',      seed: NEUTRAL_SEED.statusWarning },
  '--mui-palette-info-main':            { token: 'status.info-fg',         seed: NEUTRAL_SEED.statusInfo },
} as const

/** Terse seed accessor for building the palette (single source = the alias map). */
const seed = (muiVar: string): string => MUI_TOKEN_ALIASES[muiVar].seed

/**
 * The apps-only Studio theme — one static, light-scheme CSS-vars theme. Seeded
 * with resolved Strata hex so `decomposeColor()` is happy and MUI emits a complete
 * `--mui-*` variable set; the live projection onto the token spine is `muiAliasVars`
 * (mounted at `:root` by App), NOT this frozen seed. Module-level constant — no
 * store dependency, so the provider never re-renders on a theme edit (part 2 carries
 * live edits by CSS cascade). Single `light` scheme by design (ADR-021 §1, YAGNI);
 * dark is a later additive scheme aliasing the same tokens.
 */
export const studioTheme = extendTheme({
  colorSchemes: {
    light: {
      palette: {
        primary: {
          main:         seed('--mui-palette-primary-main'),
          dark:         seed('--mui-palette-primary-dark'),
          light:        seed('--mui-palette-primary-light'),
          contrastText: seed('--mui-palette-primary-contrastText'),
        },
        secondary: { main: seed('--mui-palette-secondary-main') },
        text: {
          primary:   seed('--mui-palette-text-primary'),
          secondary: seed('--mui-palette-text-secondary'),
          disabled:  seed('--mui-palette-text-disabled'),
        },
        background: {
          default: seed('--mui-palette-background-default'),
          paper:   seed('--mui-palette-background-paper'),
        },
        divider: seed('--mui-palette-divider'),
        error:   { main: seed('--mui-palette-error-main') },
        success: { main: seed('--mui-palette-success-main') },
        warning: { main: seed('--mui-palette-warning-main') },
        info:    { main: seed('--mui-palette-info-main') },
      },
    },
  },
  shape: { borderRadius: 10 }, // crisper Strata card radius (radii.card = 10px)
})

/**
 * The CSS alias block (part 2) as a plain style object: `--mui-palette-*` →
 * `var(--dtcg-token, strataSeed)`. Mounted by App at `:root:root` (doubled pseudo
 * bumps specificity so it deterministically beats MUI's own `:root` `--mui-*`
 * regardless of stylesheet insertion order). The DTCG var reference is derived from
 * the SAME token key that seeded the palette, via themeVars.cssVarName — one SSOT.
 */
export const muiAliasVars: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(MUI_TOKEN_ALIASES).map(([muiVar, { token, seed: fallback }]) => {
    const dtcg = cssVarName(token)
    return [muiVar, dtcg ? `var(${dtcg}, ${fallback})` : fallback]
  }),
)

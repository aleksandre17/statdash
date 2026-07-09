// ── Strata brand preset — the panel's own skin, as PURE TOKEN DATA ────────────
//
//  "Rebrand = DATA, not code" (AR-49 vision). Strata is expressed as a plain map
//  of TOKENS_CATALOG key → CSS value — NOT a component, NOT a stylesheet, NOT a
//  code path (Law 2). StudioShell applies this map as inline custom properties on
//  the shell root (`buildThemeVars`), so the ENTIRE tool (chrome + the live canvas,
//  both descendants of that root) wears Strata by default. A `SiteDef.themeOverrides`
//  edit layers ON TOP of this base (author overrides win), so the owner retunes
//  Strata LIVE through the Style editor — reset a token → it falls back to Strata.
//
//  This is the single legitimate home for brand colour literals: the platform's
//  own tokens.css stays deliberately BRAND-NEUTRAL (a tenant/app rebinds the role
//  values — see tokens.css §"packages/ is brand-agnostic"), and the panel is one
//  such consumer. FF-CHROME-TOKEN-DRIVEN asserts NO brand literal leaks into the
//  shell chrome components; they may live ONLY here, as declarative data.
//
//  Tone (SPEC-authoring-reconception-M1 §6, vision §9): "institutional trust ×
//  modern clarity" — a deep, confident azure carrying the institutional weight, a
//  clarifying teal secondary, a near-navy display tone for gravitas, and a slightly
//  crisper card radius for the modern, precise feel. Owner may retune any of these
//  live in the editor (they are just data). All keys are TOKENS_CATALOG keys.
//
//  TEXT / FOREGROUND (added AR-49 M0 — "terrible font colors" owner feedback).
//  Before, the preset set ONLY accent + heading tones, so every body/label/muted
//  text role fell through to the brand-NEUTRAL tokens.css defaults. Those pass AA
//  on the (white) surfaces, but they are a HUE-INDEPENDENT slate — they do not
//  read as part of the azure/navy Strata identity. Strata now OWNS its foreground
//  spine: a navy-shifted near-black body, a navy-slate secondary/muted/faint, each
//  measured ≥ WCAG 2.1 AA (Law 9) on all three light surfaces AND on the azure
//  active-rail tint (#E7EFF8) — so the whole tool reads as ONE cohesive institutional
//  palette, not neutral text bolted onto an azure accent. Ratios (fg / surface,
//  computed in strataContrast.fitness.test.ts, the CI guard):
//    text-primary   #16223A → 15.9:1 (white) … 13.7:1 (azure tint)   [body ≥4.5 ✓]
//    text-secondary #3C4A63 → 8.9:1  … 7.7:1                          [body ≥4.5 ✓]
//    text-muted     #526074 → 6.4:1  … 5.5:1                          [body ≥4.5 ✓]
//    text-faint     #5C6A7E → 5.5:1  … 4.7:1                          [body ≥4.5 ✓]
//    heading-display#0B2E52 → 13.8:1 … 11.9:1                         [large ≥3   ✓]
//    accent (as link/active text) #14508C → 8.2:1 … 7.1:1            [body ≥4.5 ✓]
//  accent-secondary (#2A9D8F, teal) is a SECONDARY-ACCENT FILL/graphic (3.3:1 on
//  white — clears the WCAG 1.4.11 3:1 non-text floor) and is intentionally NOT a
//  small-text role; the chrome never renders it as body text.

/** tokenKey (TOKENS_CATALOG key) → CSS value. Applied as the shell's base skin. */
export const STRATA_PRESET: Readonly<Record<string, string>> = {
  // Colour roles — the institutional-azure accent family + a modern teal.
  'color.accent':           '#14508C', // deep, trustworthy azure — the primary brand hue
  'color.accent-hover':     '#0E3C6B', // one step deeper for hover/active
  'color.accent-bg':        '#E7EFF8', // soft azure tint (active rail slot / selected state)
  'color.accent-muted':     '#E7EFF8', // muted azure background (hover/selected surfaces)
  'color.accent-secondary': '#2A9D8F', // clarifying teal — the secondary accent (fill, not small text)
  'color.heading-display':  '#0B2E52', // near-navy hero/display + wordmark tone (gravitas)
  // Text / foreground roles — the navy-slate spine (all measured ≥ AA, see header).
  'color.text-primary':     '#16223A', // navy-shifted near-black body text — the institutional voice
  'color.text-secondary':   '#3C4A63', // navy-slate secondary (bottom strip, captions)
  'color.text-muted':       '#526074', // navy-slate muted/helper (≥4.5 on every Strata surface)
  'color.text-faint':       '#5C6A7E', // navy-slate faint/placeholder (kept ≥4.5 — real text, not decoration)
  // Radius — a touch crisper than the neutral default (14px → 10px): modern clarity.
  'radii.card':             '10px',
}

// ── Brand-editor token scope (M1.4) ───────────────────────────────────────────
//
//  The Style surface is a BRAND editor, not the exhaustive per-token editor (that
//  is the Refine lens, M3). It surfaces the brand-defining token GROUPS only, so
//  the author edits identity (colour / typography / radius) without wading through
//  z-index or breakpoint tokens. Data-driven (a group allow-list), so Law 8 holds:
//  a NEW token in an included group auto-appears with the right control, no code
//  change; widening to the full catalog in M3 = deleting this filter.
export const BRAND_TOKEN_GROUPS: readonly string[] = [
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'radii',
]

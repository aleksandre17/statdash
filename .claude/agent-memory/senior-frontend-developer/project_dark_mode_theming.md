---
name: dark-mode-theming
description: "Dark mode = a token-override layer covering the WHOLE Tier-2 semantic color set (two fitness gates make 'forgot dark mode' structurally impossible) + the tenant-cascade gap where a tenant stylesheet can silently break the flip mechanism by source order. Consolidated distillate."
metadata:
  type: project
---

> Consolidated 2026-07-22 from 2 sibling files (dark-mode-completeness-and-fitness,
> geostat-tenant-dark-cascade-gap).

## Dark mode is a token-override layer
`@media prefers-color-scheme:dark` + `[data-theme="dark"]`, both in
`packages/styles/src/css/tokens.css` — redefines Tier-2 semantic color roles; spacing/radii/
type/motion stay theme-neutral. See [[project_semantic_token_spine]] for the token-spine mechanism.

**The failure class (owner-found):** dark blocks originally covered only a SUBSET of roles;
~30 roles stayed frozen at light values (`--color-surface-frame`, accent extras, heading-display,
trend-*, chart-frame/grid, SDMX status families, error family, skeleton, surface-hover). Root fix:
give EVERY semantic role an explicit dark value or derive it via `var()` from one that flips.

**Two fitness gates enforce both-modes correctness:**
- **FF-DARK-COMPLETE** (`packages/styles/src/tokens.parity.test.ts`): every `--color-*/--status-*/
  --chart-color-*` role in default `:root` must be dark-safe (redefined in both dark blocks OR
  transitively `var()`-derived from one that is); the two dark blocks must be byte-identical (no
  half-dark drift); key control pairs clear WCAG AA 4.5:1 computed on the DARK hex values.
- **FF-NO-UNTHEMED-COLOR** (`packages/plugins/__tests__/no-unthemed-color.fitness.test.ts`): no raw
  hex/rgb/hsl/named-color literal in any color-bearing property in `packages/plugins/**` +
  `packages/react/src/**` CSS (shadows exempt; `packages/styles/src/css/**` excluded — the
  definition site). **Blind spot:** this scan does NOT cover `apps/panel/**` — see
  [[project_panel_ui_kit_and_rail]] (`--insp-*` undefined tokens).

**How to apply:** new semantic color token → dark value in BOTH blocks or FF-DARK-COMPLETE fails.
Any component color → `var(--color-…)`, never a literal, or FF-NO-UNTHEMED-COLOR fails. A token
that only references a flipping role needs no explicit dark value (transitively safe).

**Future/best improvement (flagged, not done):** the two dark blocks duplicate every rule (CSS has
no cross-media-boundary DRY). The systemic fix is CSS `light-dark()` — one definition per token
carrying both modes, drift-impossible by construction. Deferred (browser-baseline + parity-harness
rewrite); the two fitness gates close the drift risk meanwhile.

## The tenant-cascade gap — a tenant CAN silently break the flip mechanism
Two DISTINCT root causes found chasing "white hero text on a light card" in dark mode — worth
knowing apart before touching theming again.

**A — a role that should NEVER flip:** `--color-heading-display` had a dark override like every
other Tier-2 role, but its ONLY consumer (`hero.css .hero__title`) sits on a per-card
config-authored gradient background (`HeroCardDef.pageBg`), never `--color-surface` — that
backdrop doesn't participate in the app theme, so the text color must not either. Fix: remove the
dark override, document as **`PINNED_NO_FLIP`** (an explicit allowlist entry in
`tokens.parity.test.ts`'s FF-DARK-COMPLETE check — legitimately absent from dark, not forgotten).

**B — a role that SHOULD flip but a tenant stylesheet broke the mechanism BY SOURCE ORDER, not
missing values.** `apps/geostat/src/shared/styles/index.css`'s `[data-tenant="geostat"]` block
pins `--color-accent` (+ its family) and the trend pair UNCONDITIONALLY, no dark selector at all.
`[data-tenant]` and `[data-theme=dark]` have EQUAL CSS specificity (both single-attribute
selectors); because `packages/styles` tokens.css loads BEFORE the tenant stylesheet in the Vite
bundle, the tenant rule wins by SOURCE ORDER regardless of theme — `--color-accent` stayed pinned
at the light value even in dark mode (an AA failure invisible unless you diff both themes
side-by-side; a pre-existing LIGHT-mode AA failure on the trend pair was caught by the same sweep).

**Fix pattern for B (reusable):** add BOTH `@media(prefers-color-scheme:dark){[data-tenant=X]
:not([data-theme=light]){...}}` AND `[data-tenant=X][data-theme=dark]{...}` (mirrors tokens.css's
own dual-block idiom), values derived by copying the DEFAULT theme's own light→dark HSL delta onto
the tenant's own hue (computed numerically, not eyeballed — see the WCAG assertions in
`apps/geostat/src/shared/styles/tenant-theme.fitness.test.ts`, FF-TENANT-DARK-COMPLETE, the
tenant-scoped mirror of FF-DARK-COMPLETE).

**Gotcha worth repeating:** don't assume a tenant stylesheet's dark behavior from reading
tokens.css alone — a tenant can silently override the whole mechanism by pinning a Tier-2 role
unconditionally with no dark selector; the bug is invisible until you compute contrast against the
DARK surface for whatever the tenant pinned. See also
[[project_css_fitness_comment_stripping_gotcha]] for a parser bug found while building this gate.

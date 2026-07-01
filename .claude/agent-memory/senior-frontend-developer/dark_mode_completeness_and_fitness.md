---
name: dark-mode-completeness-and-fitness
description: Dark theme is a token-OVERRIDE layer that must cover the WHOLE Tier-2 semantic color set; two fitness gates (FF-DARK-COMPLETE, FF-NO-UNTHEMED-COLOR) make "we forgot dark mode" structurally impossible
metadata:
  type: project
---

Dark mode on this platform is a **token-override layer** (`@media prefers-color-scheme:dark` + `[data-theme="dark"]`, both in `packages/styles/src/css/tokens.css`) — it redefines Tier-2 semantic color roles; spacing/radii/type/motion stay theme-neutral. See [[semantic-token-theming-spine-p0]] + [[semantic-token-spine-complete]] for the token-spine mechanism.

**The failure class (owner-found defect, 2026-07):** the dark blocks originally covered only a SUBSET of roles (surface/text/border/status/chart). ~30 roles stayed frozen at their LIGHT values — `--color-surface-frame`, the accent extras (`-hover/-bg/-secondary/-chip-border`), `--color-heading-display`, `--color-trend-*`, `--color-chart-frame/-grid`, the SDMX `--status-obs-*` + `--status-total-*` families, the `--color-error-*` family, `--color-skeleton`, `--color-surface-hover` (was a black-darken; on dark must lighten). The perspective/time switcher rendered as a frozen light box because its track bg = `--color-surface-frame` never flipped while its label text (`--color-text-secondary`) did. Root fix: give EVERY semantic role an explicit dark value (or derive it from one that flips via `var()`).

**Why it slipped:** all verification was LIGHT-mode only. The fix is process, not memory:

**Two fitness gates now enforce both-modes correctness:**
- **FF-DARK-COMPLETE** (`packages/styles/src/tokens.parity.test.ts`): every `--color-*/--status-*/--chart-color-*` role in default `:root` must be "dark-safe" — redefined in the dark blocks OR transitively derived (via `var()`) from roles that are. Bare hex not redefined in dark = red test. Plus: the `@media` and `[data-theme="dark"]` blocks must be byte-identical (no half-dark drift), and key control pairs (incl. switcher text-on-track) must clear WCAG AA 4.5:1 computed on the DARK hex values.
- **FF-NO-UNTHEMED-COLOR** (`packages/plugins/__tests__/no-unthemed-color.fitness.test.ts`): no raw hex/rgb/hsl/named-color literal in any color-bearing property in `packages/plugins/**` + `packages/react/src/**` CSS. Shadows (box-shadow/text-shadow/filter) are exempt (effect alpha, not surface color). Scope EXCLUDES `packages/styles/src/css/**` (the token definition site).

**How to apply:** adding any new semantic color token → add a dark value in BOTH dark blocks or FF-DARK-COMPLETE fails. Any component color → use `var(--color-…)`, never a literal, or FF-NO-UNTHEMED-COLOR fails. When adding a token that only references a flipping role (e.g. `var(--color-surface)`), no explicit dark value is needed (transitively safe).

**Future/BEST improvement (flagged, not done):** the two dark blocks are duplicated (CSS has no cross-media-boundary DRY). The truly systemic fix is CSS `light-dark()` — one definition per token carrying both modes, drift-impossible by construction. Deferred: larger rewrite + browser-baseline + would touch the existing parity harness; the fitness gates close the drift risk in the interim.

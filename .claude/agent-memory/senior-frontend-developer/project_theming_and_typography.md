---
name: theming-and-typography
description: "The theming SSOT (data-theme attr + semantic-token override) and how ctx.theme threads to it, plus the typography role spine — FiraGO (the current self-hosted platform default, Latin+Georgian) superseding the earlier de-brand-to-system-ui rule. Consolidated distillate."
metadata:
  type: project
---

> Consolidated 2026-07-22 from 3 sibling files (theming-seam, font-debrand-role-spine,
> platform-typeface-firago).

## Theming seam (SSOT)
`data-theme` on the outermost element + semantic-token override in CSS — NOT per-element styles.
The single mechanism for dark mode and high-contrast. `packages/styles/src/css/tokens.css`
defines all semantic tokens in `:root`; a theme is a selector block (`[data-theme="dark"]`,
`[data-theme="high-contrast"]`, `@media prefers-contrast`, `@media forced-colors`) overriding ONLY
those tokens — spacing/radii/type/motion stay theme-neutral, so `tokens.parity.test.ts` (every
`var(--*)` needs a `:root` def) keeps passing as themes are added.

**Runtime threading:** `RenderContext.theme?: 'default'|'high-contrast'` (optional, additive) →
`NodePageRenderer({page,theme})` emits a `display:contents` wrapper `<div data-theme=...>` only
when set; `StaticRenderContext.theme` → `renderPageToHTML` sets it on the snapshot div. The real
visual root `.app-shell` lives in `packages/plugins/chrome/AppChrome.tsx` (packages/react cannot
touch it, Law 3), hence the wrapper. High-contrast palette: bg `#000`/text `#FFF`/borders-links-
accent `#FFFF00` (21:1 / 19.6:1).

**How to apply:** to add/adjust a theme, edit only the token-override block in `tokens.css` —
never add element selectors. See [[project_dark_mode_theming]] for the dark-specific gates and the
tenant-cascade trap.

## Typography role spine — FiraGO is the CURRENT platform default
**This supersedes the earlier de-brand rule below** ("keep tokens.css = system-ui, never put
Georgian there") — that rule was about not leaking a TENANT brand font; FiraGO is the platform's
own neutral canonical face, so packages/ may name it.

- **Where it lives:** `packages/styles/src/css/fonts.css` (4 `@font-face`, `font-display:swap`)
  imported FIRST in `css/index.css`; woff2 + vendored `OFL.txt` under `css/fonts/`.
  `tokens.css` `--font-family-base`/`--font-family-display` LEAD with `'FiraGO'` then a
  brand-neutral fallback (`system-ui, -apple-system, 'Segoe UI', …`). Charts pick it up via
  `getComputedStyle('--font-family-base')`.
- **Fitness (`brand-neutral-fonts.fitness.test.ts`) has TWO halves:** NEGATIVE (original
  FF-BRAND-NEUTRAL-FONTS) still bans `'BPG Arial'/'Noto Serif Georgian'/'Noto Sans Georgian'`
  substrings anywhere in packages/ — even as a fallback name. POSITIVE (FF-PLATFORM-TYPEFACE)
  requires both roles lead with FiraGO + all 4 weights served + the woff2 files exist.
- **Producing the woff2 (repeatable):** `npm pack @fontsource/firago` ships Latin-only — do NOT use
  it. Get full TTFs from `github.com/bBoxType/FiraGO@master/Fonts/FiraGO_TTF_1001/Roman/`, subset
  via `python -m fontTools.subset FiraGO-X.ttf --unicodes='<latin+U+10A0-10FF georgian+punct
  +U+20A0-20BF currency>' --layout-features='*' --flavor=woff2` (keeps kern/tnum, incl. ₾ U+20BE).
  `pyftsubset` isn't on PATH — use the module form.
- **Geostat runner:** removed its never-loaded `'Noto...'` tenant override; migrated shell
  body/h1-h6 onto `var(--font-family-*)`; tightened CSP (dropped Google Fonts origins). Still-open
  smell: `tailwind.config fontFamily.heading/body` still names BPG fonts but is used 0 times (dead
  config, no render effect).

### The retired de-brand rule (context, still true for anything that ISN'T the platform default)
Geostat brand stacks (a real TENANT choice, distinct from the platform default) live ONLY in
`apps/geostat/src/shared/styles/index.css` `[data-tenant="geostat"]`, alongside the accent rebind
— e.g. an earlier wave set `--font-family-display`/`-base` to Noto Serif/Sans Georgian there. The
principle that still holds: **L0 tokens.css must carry the PLATFORM's own neutral default, never a
TENANT's brand font** — a tenant rebinds the role under `[data-tenant]` (OCP, unchanged seam).
**`chart.css .donut-legend` is deliberately NOT unified onto either role** — its stack
`'BPG Arial', Roboto, sans-serif` is a unique third value; collapsing it into base/display would
change the rendered legend font (a byte-identity regression). The chart plugin's ApexCharts JS-side
`fontFamily` literals (cartesian.ts/base.ts/pie.ts/DonutChart.tsx — can't reliably consume CSS
`var()` in SVG) still need a holistic de-brand pass together with any future chart typography wave.

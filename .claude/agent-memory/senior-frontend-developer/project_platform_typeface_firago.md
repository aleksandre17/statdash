---
name: platform-typeface-firago
description: Canonical self-hosted platform typeface — FiraGO (Latin+Georgian, OFL) wired at tokens.css SSOT; supersedes the system-ui default; how the fonts were subsetted + the brand-neutral-vs-lock fitness seam
metadata:
  type: project
---

The platform default font is now **FiraGO** — a libre (OFL-1.1) Fira Sans super-family covering Latin + Latin-ext + full modern **Georgian (Mkhedruli, 48 glyphs)** with matching weights 400/500/600/700 and OpenType `tnum` tabular figures. Landed on branch `feat/platform-typography` (un-merged).

**Where it lives (SSOT):**
- `packages/styles/src/css/fonts.css` — 4 `@font-face` rules, `font-display:swap`, `src: url('./fonts/firago-*-normal.woff2')`. Imported FIRST in `css/index.css` (before tokens.css).
- `packages/styles/src/css/fonts/` — the 4 self-hosted woff2 (~72 KB each) + vendored `OFL.txt`. `package.json files:["dist","src/css"]` already ships them; woff2 reached via relative url() from the css, no export entry needed.
- `packages/styles/src/css/tokens.css` — `--font-family-base` / `--font-family-display` now LEAD with `'FiraGO'` then a brand-NEUTRAL fallback (`system-ui, -apple-system, 'Segoe UI', …`). Every consumer already reads the role (Law 1); the chart layer resolves it via `getComputedStyle('--font-family-base')`, so charts pick FiraGO up automatically.

**This SUPERSEDES [[font-debrand-role-spine]]'s "keep tokens.css = system-ui, do NOT put Georgian in tokens.css".** That rule was about not leaking a tenant BRAND font. FiraGO is the platform's NEUTRAL canonical face, not a brand — so packages/ may name it. A real tenant can still rebind the roles under `[data-tenant]` (OCP, unchanged seam).

**Fitness — `packages/plugins/__tests__/brand-neutral-fonts.fitness.test.ts` now has TWO halves:**
- NEGATIVE (original FF-BRAND-NEUTRAL-FONTS): still bans `'BPG Arial' / 'Noto Serif Georgian' / 'Noto Sans Georgian'` substrings in packages/. So **you may NOT use those names even as a fallback** in tokens.css — the neutral fallback stack must stay brand-free.
- POSITIVE (new FF-PLATFORM-TYPEFACE): tokens.css must LEAD both roles with `FiraGO`, fonts.css must serve it with swap + all 4 weights, and the 4 woff2 must exist. Guards against a silent regression back to Georgian-less system-ui.

**Geostat runner changes (it's the de-tenanted runner, so it inherits the platform face):** removed the never-loaded `'Noto …'` tenant `--font-family` override in `apps/geostat/src/shared/styles/index.css`; migrated its shell `body`/`h1-h6` off hardcoded `system-ui` onto `var(--font-family-*)`; tightened `apps/geostat/index.html` CSP (dropped `fonts.googleapis.com`/`fonts.gstatic.com`). **Still-open smell (flagged, not fixed):** `apps/geostat/tailwind.config` `fontFamily.heading/body` still name BPG fonts — but they're used **0 times** (dead config), so no render effect; remove in a cleanup.

**How the woff2 were produced (repeatable):** `npm pack @fontsource/firago` ships ONLY the latin subset (no Georgian) — do NOT use it for Georgian. Get the full TTFs from `github.com/bBoxType/FiraGO@master/Fonts/FiraGO_TTF_1001/Roman/FiraGO-{Regular,Medium,SemiBold,Bold}.ttf`, then `python -m fontTools.subset FiraGO-X.ttf --unicodes='<latin+U+10A0-10FF georgian+punct+U+20A0-20BF currency>' --layout-features='*' --flavor=woff2` (keeps kern/tnum; includes ₾ U+20BE Lari). `pyftsubset` isn't on PATH — use `python -m fontTools.subset`.

**Verify gotcha:** worktree has NO node_modules and deep-path MAX_PATH blocks the vitest CLI ([[project_windows_longpath_vitest_worktree_block]]) — verify fitness logic via a plain-node replica of the assertions. Printing Georgian to the Windows console needs `PYTHONIOENCODING=utf-8` (cp1252 crashes otherwise).

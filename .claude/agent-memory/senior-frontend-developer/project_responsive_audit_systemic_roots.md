---
name: responsive-audit-systemic-roots
description: 2026-06 full-ladder responsive audit + fix wave — three systemic roots (sr-only table leak, header flex overflow, container-measure mismatch) fixed in-system (tokens/clamp/min()/flex), zero magic numbers; the permanent reflow fitness guard and the real-browser proof method.
metadata:
  type: project
---

Full-ladder responsive audit (54 screenshots) → FIXED, all in-system (tokens/clamp/min()/flex
guards), zero magic numbers. Constructor panel (auth-gated) was NOT audited — a real limitation.

**Three systemic roots (each fix resolved many findings):**
- **R1 (P0, WCAG 1.4.10) — the sr-only table leak.** `ChartDataTable.tsx` rendered its
  accessibility-tree mirror as `<table className="sr-only">`. For a `<table>`, `.sr-only`'s
  `width:1px` is only a *minimum* and its `white-space:nowrap` forces full min-content width
  (~1328px); the deprecated paint-only `clip` property doesn't actually clip layout → the table
  leaked into `document.scrollWidth`, causing phantom horizontal scroll on EVERY dashboard at most
  widths. **Fix:** wrap the table in a `.sr-only` DIV (the div clips, the table inside is free to
  be wide) + harden the `.sr-only` utility with `clip-path:inset(50%)` (replaces deprecated
  `clip`). **Permanent guard:** `packages/react/src/components/data/ChartDataTable.reflow.fitness.test.tsx`
  — structural (jsdom has no layout engine, so a live scrollWidth check would be vacuous): asserts
  the div wrapper exists + the `.sr-only` rule keeps `width:1px/overflow:hidden/clip-path`.
- **R2 (P1) — header flex overflow.** `.app-header__inner` used `flex space-between` +
  `flex-shrink:0` on both brand and actions with no `min-width:0` anywhere → overflow + a clipped
  locale button in the ~960–1100px band. **Fix:** `min-width:0` on brand/nav + tagline
  truncate/breakpoint.
- **R3 (P1) — container-measure mismatch.** `page-layout.css` content variants disagreed:
  `centered`=800px (too narrow on ultrawide), `full-width`/default=uncapped (over-stretch on
  2560/3440), while the header WAS capped at 1280. **Fix:** wire the existing
  `--size-container-wide` token into `.page-content` via a new **`--page-measure`** custom
  property (defaults to `--size-container-wide`) — the OCP seam any page can override to
  re-measure itself; sidebar variant goes full-bleed (`margin-inline:0`) but stays capped.
- **F5 (filter bar):** `.filter-select` gained `min-width:0; max-width:min(100%,
  var(--size-container-narrow))` (the same shrink-trap class documented in
  [[project_panel_ui_kit_and_rail]] for the multi-select trigger).

**Follow-up perfection pass (same wave, four more in-system root-causes):**
- **Header nav overlap (Georgian only, ~960–1100 band):** the nav-collapse breakpoint was too low
  — long Georgian labels overran the social icons at 1024 (EN labels fit). Moved the collapse to
  **xl (1280)**, authored mobile-first; 1280 aligns with the inner-sidebar's own
  rail↔horizontal-tab-bar breakpoint, so nothing is lost below xl (the tab-bar/hero cards expose
  the same destinations). This node is now the mobile-first CSS reference pattern.
- **Treemap blank at ≤1280:** `chart.css` sets `chart-wrap{height:auto}` on mobile; the
  flexbox-based `TreemapChart` root is `height:100%`, which collapses to 0 with no definite parent
  height. Fixed with a new token **`--size-panel-min-height:14rem`** as a `minHeight` floor —
  robust to any container, inert on desktop.
- **Ultrawide sidebar dead-space (≥~1536):** the sidebar-layout rail+content pinned LEFT with a
  huge right void because the parent (`main.app-shell__content`) is plain block, not flex. Fixed
  with `justify-content:center` gated `@media(min-width:1536px)` — inert below that (content
  flex-grows, no free space). Does NOT contradict R3 (R3 rejected content floating away from the
  rail; this keeps rail+content together as one centered unit).
- **Section-header title wrapping one-word-per-line at narrow widths:** `.section` already has
  `container-type:inline-size`; added `@container(max-width:30rem)` to drop the actions row below
  the title (`order:1;flex-basis:100%` + flex-wrap on head) — container-first, so it also fixes
  narrow COLUMNS, not just narrow windows.

**Real-browser proof method (reusable when a live deploy of local edits isn't possible):** a
controlled Chromium harness loads the ACTUAL on-disk CSS files, reconstructs the shell DOM
(including the app's global `box-sizing:border-box` reset), sets a viewport, and measures
`documentElement.scrollWidth - clientWidth` before/after (before-baseline pulled via
`git show HEAD:…`). `npx playwright@latest screenshot --viewport-size=W,H --wait-for-timeout=3500
URL out.png` works as a CLI-only capture tool even when the playwright module isn't importable.

**The design system was already sound** — these were surgical fixes, not a rebuild. It ships
fluid type clamp tokens (`--font-size-fluid-*`), a full `@media`+`@container` responsive cascade
(`node-styles.css`), container-typed cards, breakpoints 480/640/768/1024/1280/1536. See
[[reference_render_path_browser_verify]] for the live-server verify topology.

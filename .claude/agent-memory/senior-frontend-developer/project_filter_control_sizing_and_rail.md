---
name: filter-control-sizing-and-rail
description: Filter-bar control sizing seams (multi-select/year-select) + the --shadow-rail overlay token
metadata:
  type: project
---

CRAFT wave (card 0078, 2026-07-17) — sizing/elevation seams for the portal filter bar + inner-sidebar rail.

**Multi-select in the filter bar** (`plugins/nodes/filter-bar/default/filter-bar.css`):
The owned `.ui-multiselect__trigger` (packages/react MultiSelect.css, `@layer sd-components`) defaults to `width:100%` — correct for a form/inspector field, WRONG in the filter bar where it ate the whole row. Since the Radix popover `min-width = --radix-dropdown-menu-trigger-width` (= trigger width), a full-width trigger opened the dropdown edge-to-edge as a featureless slab (owner „საშინელებაა", light AND dark).
- Fix seam: `.filter-control__multiselect` (UNLAYERED → beats the layered base without a specificity fight) sizes the trigger to content + caps `max-width: min(100%, --size-container-narrow)`; `.filter-control__multiselect .ui-multiselect__value { flex-wrap:nowrap; overflow:hidden }` keeps the summary one line.
- `MultiSelectShell.tsx` caps visible chips to `MAX_TRIGGER_CHIPS=2` + appends a `+N` overflow chip (`.ui-multiselect__chip--count`, muted neutral). "+N" is locale-neutral — no i18n entry.

**Year select clipped ("20…")** — the shared `.filter-select` has `min-width:0` (lets long SELECT labels ellipsise) which let a greedy neighbour squeeze the year select. Dedicated `.filter-control__year-select` class (on YearSelectShell only) = `flex-shrink:0; width:auto; min-width:fit-content`. Later source than `.filter-select` → wins at equal specificity. SelectShell keeps the capping behaviour (long labels).

**Rail overlay elevation** — `inner-sidebar.css` expanded-panel shadow was a hardcoded `rgba(0,0,0,0.06)` (near-invisible, black-on-dark = same-plane sheet). Now `var(--shadow-rail)` — a NEW directional (rightward `6px 0 28px`) token added to ALL THREE token blocks in `styles/src/css/tokens.css` (`:root` light + `[data-theme=dark]` + `@media prefers-color-scheme:dark`), theme-adaptive alpha (0.10 light / 0.62 dark). The left rail expands OVER content as an overlay (>1280px only; ≤1280 = horizontal tab bar), so it needs a RIGHTWARD shadow, not the downward `--shadow-overlay`.

**Local verify harness:** `apps/geostat/e2e/craftScreens.e2e.ts` boots real vite + replays `e2e/fixtures/api-fixtures.json` (same route-intercept as `rangeSliderBrush.e2e.ts`), toggles theme via `.theme-switcher__btn`, screenshots each surface light+dark → `work/portal-walk/craft-*.png`. GOTCHA: playwright `devices['Desktop Chrome']` forces 1280px viewport (= tab-bar mode) — call `page.setViewportSize({width:1680,...})` to see the desktop rail. `waitUntil:'networkidle'` HANGS on pages whose data misses fixtures (404 retry loop) — use `domcontentloaded` + explicit waits. Fixtures only cover the dynamics-view data recorded for the rangeSlider walk; linear-view sections 404 (harmless for chrome-surface shots).

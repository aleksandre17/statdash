---
name: scrollbar-utility-and-table-overflow
description: AR-15 — .scroll-fancy is the SSOT themed-scrollbar utility; flex min-width:auto is the table-clip root-cause; where/how to apply scrollbars consistently
metadata:
  type: project
---

AR-15 (owner, 2026-07-01): tables clipped with no scrollbar + wanted beautiful themed scrollbars everywhere.

**SSOT for scrollbar look:** `packages/styles/src/css/scrollbar.css` (imported in `css/index.css`). Defines `--scrollbar-*` shape+colour vars (colour DERIVED from `--color-border-strong`/`-interactive`/`-frame` → auto light+dark+tenant, NO hex, NOT in tokens.css), the page-root `html` scrollbar, and the reusable `.scroll-fancy` class. Covers WebKit `::-webkit-scrollbar*` (rounded pill, inset transparent border + `background-clip:padding-box`) AND Firefox `scrollbar-width:thin`+`scrollbar-color` (which inherits app-wide from `html`).

**How to apply:** add `scroll-fancy` className to ANY new bounded scroll region (`overflow:auto` pane) so scrollbars stay consistent. Already on: `.data-table__wrap` (Simple/PivotTable), panel `.canvas-root`, `.cmdk-list`. Inner-sidebar was converged IN-PLACE onto the same `--scrollbar-*` vars (NOT the class) on purpose — its mobile scrollbar-hide media rule lives in the same file, so keeping its own selector guarantees the hide wins by source order (a cross-file `.scroll-fancy` vs `.inner-sidebar` tie is bundler-order-fragile).

**Table-clip root cause (reusable lesson):** `.data-table__wrap` is a flex item inside the AR-8 band's `[data-view=visible]{flex-direction:column}` chain; default `min-width:auto` refuses to shrink below the table's min-content width → a WIDE table pushes past the card with no scrollbar. Fix = `overflow:auto; min-width:0; max-width:100%` in the plugin's own `data-table.css`. `min-width:0` is the load-bearing bit. This does NOT fight `node-styles.css` (the AR-8 lane) which layers band/mobile `overflow-y` + the sticky header — that file stays untouched.

Fitness: `packages/styles/src/scrollbar.fitness.test.ts`. See [[semantic_token_theming_spine_p0]] for the token spine the colours ride, and [[panel_sizing_cqi_model]] for the AR-8 band this scroll container lives inside.

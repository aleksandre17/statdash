---
name: panel-canvas-craft-batch
description: Studio canvas craft punch-list (P3/P5/P6/P7/L2) — the reusable seams each landed on (governed dim labels, RightDock siteContext, outline subtitle, canvas dark-preview via data-theme, double-chevron collapse) + live-verified observations.
metadata:
  type: project
---

**Studio canvas craft batch (DONE 2026-07-16, branch feat/ar49-m0-metric-first-authoring; apps/panel only, arrow held, ZERO object-model change).** Reference-class (Figma/Builder.io) polish on the four-moment shell. Builds on [[panel-four-moment-shell]] + [[panel-concern-refine]].

## The seams (reuse these, don't re-derive)
- **P3 governed dimension labels (04aa931):** `cubeEnumOptions.dimensionOptions(profile, resolveGovernedLabel?)` — dropped the `${code} (${conceptRole})` echo (conceptRole is a plumbing token, AR-52). The governed bilingual label comes from `semanticCatalogOptions.governedDimensionLabels(catalog.dimensions, locale)` (NEW helper — inverts the catalog to `cube-code → label(locale)`). Two render sites consume it: `EnumRefField` `cube.dimensions` branch (has `catalog` via useMetricCatalog) + `fieldChips(profile, locale, resolveLabel?)` (FieldWells builds it). Fallback = bare code (never blank).
- **P5 no doubled context (c798e15):** RightDock gained `siteContext?: boolean`. When a project-scope LEFT surface (`style` | `pages-site`) owns the dock AND scope==='page' (nothing selected), it renders a NEW discriminated empty-state `kind='site-context'` (StudioEmptyState — respects FF-ONE-EMPTYSTATE/OCP; the oneEmptyState.fitness kind list must include it) instead of the page-config tree. A deliberate element selection still wins. StudioShell passes `siteContext={activeSurface==='style'||activeSurface==='pages-site'}`.
- **P6 outline sibling disambiguation (02bce72):** `OutlineRow.subtitle?` = the node's bound measure, derived generically (Law 1) from `props.data.query.measure` (the canonical bind location — where Inspector/MetricPalette/DATA facet all write, per `dataFacetModel.bindMeasureToSpec`). OutlineItem now wraps label+subtitle in a `min-width:0` `.outline__text` column (both ellipsize) + a native `title` tooltip on the label (truncation recovery).
- **P7 dark-mode canvas preview (9da7ba0) — THE reusable dark-preview mechanism:** a Studio toggle in `CanvasToolbar` (light|dark radiogroup, `data-testid=canvas-theme-preview`) flips `data-theme="dark"` on `canvas-root` — the ONE sanctioned dark scope (tokens.css `[data-theme="dark"]`, same attr the runner sets on `<html>`). Applied on the SAME element as the brand inline props (`themeVars`) so brand tokens still win and the unbranded rest goes dark — byte-identical to how the runner composes brand+dark (NO parallel path). Only canvas-root darkens; Studio chrome (rail/docks/top bar) is outside it and stays light. View-state local (like `mode`), default light. Live-proven: dark → `--color-surface` resolves `#15151f` (the exact dark token).
- **L2 collapse affordance (96010cd):** RightDock header/collapsed-strip now use `KeyboardDoubleArrowRight/Left` (»/«) — the conventional collapse/expand-PANEL idiom — instead of single ChevronRight/Left (which read as a disclosure caret beside the "Inspector" label).

## P4 — NON-REPRO (reported, no commit)
Data-dictionary "no left gutter" did NOT reproduce on live :5173. `.studio-focusview__body` has `padding: var(--spacing-md)` since SL-2 (f141b3c) and wraps the whole dictionary; Playwright geometry probe measured EVERY element (intro, stat row, header, all cards) at left=16px. The owner's screenshot was the stale :3013 deploy (brief itself flags :3013 as not reflecting this work).

## Observations (live :5173, mock canvas — for the lead)
- **KpiStrip crash (packages/plugins):** `KpiStripShell.tsx:76` throws `Cannot read properties of undefined (reading 'map')` when the live canvas renders the mock kpi-strip (no data). Caught by NodeErrorBoundary (fail-soft honest error card, Law 11 OK) but the shell has a real null-guard gap. Recurs on every canvas boot with the e2e mock.
- **Raw i18n keys in rendered page:** the canvas empty-state renders literal `empty.title` / `empty.desc` (unresolved keys) — a Law 4 gap in the rendered page/chrome empty state (or the e2e mock i18n catalog lacks them). Verify on real data.
- **LayersSurface Law-4:** `studio/surfaces/LayersSurface.tsx` overline is hardcoded Georgian-only `"სტრუქტურა"` (no bilingual t()). Single-locale = Law-4 violation per [[project_law4_i18n_check]].

## Gate
tsc -b apps/panel 0; eslint apps/panel/src 0 errors (3 pre-existing react-refresh/exhaustive-deps warns, none mine — baseline drifted from the "2 warns" in [[reference_panel_gate_commands]]); vitest touched dirs (canvas/studio/outline/discovery/inspector/data-layer) 98 files / 745 PASS / 0 fail. Live-verified P5/P6/P7 via Playwright on :5173 (mock-API harness).

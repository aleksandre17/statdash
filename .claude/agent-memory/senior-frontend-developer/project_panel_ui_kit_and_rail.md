---
name: panel-ui-kit-and-rail
description: "The MUI→Radix Strangler direction + ratchet, the inspector's off-token-spine native controls (--insp-* undefined), filter-bar control sizing, and the expanding-rail cell+overlay pattern. Consolidated distillate."
metadata:
  type: project
---

> Consolidated 2026-07-22 from 4 sibling files (mui-radix-migration, insp-tokens-undefined,
> filter-control-sizing-and-rail, rail-cell-panel-pattern).

## MUI → Radix Strangler (owner-committed direction)
Pattern: an OWNED compound = unstyled `radix-ui` behavior + `@layer components` DTCG-token CSS +
a compound API, living AGNOSTIC in `packages/react/src/components/ui/**` (a second tenant restyles
it free). MUI + Radix COEXIST — both project the one DTCG spine, no dual-theming clash.
**Wave 0071 done:** owned `Select` swapped into `SelectControl` + EventsField's 3 selects.
`FieldControlRegistry.ts` UNTOUCHED (the OCP proof). Guards: `FF-RADIX-TOKEN-ONLY`,
`FF-RADIX-A11Y-INTACT`, `FF-NO-NEW-MUI`.
**Ratchet baselines** (`apps/panel/src/inspector/muiSelectRatchet.fitness.test.ts`): inspector
MUI-Select === 0 (locked); app-wide MUI-Select <= a shrinking cap — LOWER as waves land, never
raise. Remaining swaps are mechanical replication (same owned Select, same token CSS) across
`features/data-layer/**`, `ChromeCompositionPanel`, `SourceAuthoringPanel`, `AddControl`,
`VisibilityBuilder`, `studio/model/{CalcBuilder,ExprTreeEditor,MetricEditor}`.
**Gotcha to carry forward:** Radix Select FORBIDS an empty-string `Item` value — route a
"clear/none" option through a sentinel and map back (`primitives.tsx CLEAR_VALUE`). Testing:
[[feedback_radix_jsdom_polyfills]].

## The inspector's native controls are OFF the DTCG token spine (unfixed, flag before a repaint)
`apps/panel/src/inspector/Inspector.css` paints via `var(--insp-border,#cbd5e1)`,
`var(--insp-control-bg,#fff)`, `var(--insp-fg,#1e293b)`, `var(--insp-focus,#2563eb)` etc. — but
**NONE of the `--insp-*` tokens are defined anywhere** (grep empty). Every native control renders
on its hardcoded hex fallback: cannot flip in dark mode or per tenant. This is exactly the defect
class `FF-NO-UNTHEMED-COLOR` exists to catch, but that gate scans `packages/plugins/**`+
`packages/react/src/**` only, NOT `apps/panel/**` — the inspector's erosion is unguarded.
**How to apply:** do not extend the `--insp-*` fallback pattern; bind directly to global DTCG
tokens (`--color-border`, `--color-surface`, `--color-text-primary`, `--font-size-sm`≈matches the
current fallback, `--radius-sm`, `--spacing-*`). The owned Radix `Select` already does this and is
therefore dark-correct while surrounding native controls are not. Proper fix = either alias
`--insp-*` onto global tokens in one `:root` block, or extend FF-NO-UNTHEMED-COLOR to scan
`apps/panel/**`. Flag to the architect before a broad inspector repaint.

## Filter-bar control sizing seams
- **Multi-select trigger:** the owned `.ui-multiselect__trigger` defaults to `width:100%` (correct
  for a form field, wrong in the filter bar where it ate the whole row — Radix popover min-width =
  trigger width). Fix: `.filter-control__multiselect` (UNLAYERED, beats the layered base without a
  specificity fight) sizes to content, capped; `MultiSelectShell.tsx` caps visible chips to
  `MAX_TRIGGER_CHIPS=2` + a locale-neutral `+N` overflow chip.
- **Year-select clipping:** the shared `.filter-select` has `min-width:0` (lets long labels
  ellipsize), which let a greedy neighbour squeeze it. A dedicated `.filter-control__year-select`
  (`flex-shrink:0;width:auto;min-width:fit-content`) wins by source order at equal specificity.
- **Rail overlay elevation:** the expanded-panel shadow was a hardcoded near-invisible
  `rgba(0,0,0,0.06)` (same-plane on dark). Now `var(--shadow-rail)` — a new directional token
  (rightward, alpha 0.10 light/0.62 dark) added to all three token blocks in `tokens.css`.
- **Local verify harness:** `apps/geostat/e2e/craftScreens.e2e.ts` boots real vite + replays fixed
  API fixtures, screenshots each surface light+dark. Gotchas: Playwright's default device profile
  forces a 1280px viewport (tab-bar mode) — set viewport explicitly to see the desktop rail;
  `waitUntil:'networkidle'` hangs on pages whose data misses fixtures — use `domcontentloaded`.

## Rail cell + panel pattern — expanding chrome never transitions an in-flow width
The geostat inner sidebar is a CELL+PANEL split: `.inner-sidebar-cell` (sticky flex child, fixed
`--inner-sidebar-w`) owns the layout allocation; `aside.inner-sidebar` is `position:absolute` over
it and hover/focus-within-expands 78→260 as an overlay (z-40, above page-header/filter-bar, below
app header). **Why:** the first hover-expand implementation transitioned the rail's own in-flow
width — the whole layout reflowed ("texts dance", a real owner defect). Also `justify-content:
center` on the sidebar layout had centred the RAIL+content pair off the viewport edge; fixed by
re-centring only `.page-content` (`margin-inline:auto` at ≥2xl), the rail stays flush at x=0.
**How to apply:** any expanding chrome (rails, docks, drawers) — the flex/grid child the page
composes against keeps a CONSTANT size; expansion is always an absolutely-positioned overlay.
Mobile ≤1280 collapses both boxes to static flow.

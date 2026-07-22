---
name: feedback-ui-craft-taste
description: "Two owner-blessed panel-wide UI taste rules — contextual-relevance (show only the active item's everything, drill-in disclosure, never all-expanded) and the chart legend contract (bottom, single-line ellipsis, ONE font token, wrapped/multi-column rejected). Consolidated distillate."
metadata:
  type: feedback
---

> Consolidated 2026-07-22 from 2 sibling files (contextual-relevance-canon,
> legend-aesthetic-owner-verdict). Both are standing taste verdicts — apply without re-litigating.

## Contextual-relevance canon — drill-in disclosure, never all-expanded
Hard UI canon: **"only what's needed / only the ACTIVE one's everything shows."** A collection of
rich items is NEVER rendered with every item's full editor expanded at once. Instead: a LIST of
collapsed summary rows → click one → a focused per-item editor + a breadcrumb back; others stay
hidden. Recursion drills "maximally all the way in" (nested array/object sub-fields are drill
rows, one unified breadcrumb per root, arbitrary depth) — only the deepest active level is
rendered.

**Why:** the owner enforces this progressive-disclosure principle EVERYWHERE (both docks, canvas
selection, the nested-item editor) — the same principle Sanity Studio / Framer array controls /
Figma "enter instance" use. An all-expanded editor dumping every field of every item is a concept
regression caught on sight.

**How to apply:** any UI editing a collection of non-trivial items (array-of-objects, repeatable
groups, multi-panel selections) defaults to drill-in disclosure, never simultaneous expansion.
Drill state is component-local UI state (like canvas selection), never config. Keep add/remove/
reorder at the list level; move focus into the drilled level; give the breadcrumb keyboard-reachable
crumb buttons navigating up (WCAG 2.1 AA). Realized architecturally by
[[project_panel_studio_map]]'s breadcrumb-promotion + overflow-escalation seams.

## Chart legend contract (R2-3, 2026-07-16, owner-blessed)
Legends are bottom-placed, single-line ellipsized (16ch cap, centered rows, native `title` tooltip
for the full name), rendering at ONE size everywhere via the `--chart-legend-font-size` token
(tokens.css, 12px). Never a local px value, never a scaled font-size for legends, never a
breakpoint override.

**Why:** owner verdict, verbatim: "არ მინდა მარჯვნივ. როგორც იყო ისე დატოვე, ლამაზად იყო…" — an
earlier "full wrapping labels" experiment (two-line labels) read as ragged right-hand columns, and
per-chart scaled fonts + breakpoint overrides made legends visibly differ chart-to-chart on one
page. Legibility complaints are solved by raising the token's floor INSIDE the existing layout,
never by re-layout.

**How to apply:** any legend work (Apex buildLegend/pie/hbar-diverging options via
`cssVar('--chart-legend-font-size','12px')`, `.donut-legend__label`/`.apexcharts-legend-text` in
chart.css, custom DOM legends) must keep reading the token; the `.apexcharts-legend-text
!important` rule is the hard invariant — don't remove it. If a long label is a problem: ellipsis +
tooltip, never wrapping.

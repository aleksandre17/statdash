---
id: "0088"
title: "ESSENTIALS UP FRONT, DEPTH INSIDE — the DATA facet carries the 80% gestures inline (owner-guided correction of 0086)"
status: QUEUED (2026-07-18, owner verbatim: «იქნებ წინ ძირითადები დარჩეს და სიღრმისეული შიგნით?» — the frequency-layering canon; fires after 0084 lands, before/with 0087)
class: S
priority: P0
owner: lead → build agent (Opus)
implements: progressive disclosure by FREQUENCY (Figma inspector · Power BI fields-well · Airtable/Notion filter chips) — 0086 overshot to summary-only; the essentials return inline, the ONE-door depth stays
links:
  - platform/apps/panel/src/inspector/controls/DataFacetField.tsx   # 0086's summary+door — gains the inline essentials
  - work/items/0086-one-model-two-zooms.md                          # the base this corrects (one model / one editor stands)
---
**The arrangement (decided):** the author-plane DATA facet =
1. **Metric, changeable inline** — the governed metric name with a one-click switch (the MetricPalette popover — the most frequent gesture; today quick-bind exists only for UNBOUND, extend to bound).
2. **Active filter CHIPS** — each pipe filter condition as a governed-labeled chip («პერიოდი: 2010 ✕»), one-click remove (writes through the ONE workbench model); chip add/edit escalates to the workbench (or a light popover reusing MemberPicker if trivially cheap).
3. **The honest state line** (rows · steps · loading/no-data/unbound per Law 11).
4. **ONE door** «გახსენი ვორქბენჩი» — steps/derive/expr/raw/wire stay inside (0086's unification holds: one model, one editor, never two).

**Boundaries.** All writes go through `toWorkbenchModel`/`fromWorkbenchModel` (the ONE model — no facet-local spec surgery) · P-OFFER (chips governed-labeled, nothing typed) · plane law (steward raw view untouched) · WCAG · bilingual · honest states.

**DoD.** Live: bound element → metric visible + switchable inline; a filter added in the workbench appears as a chip; removing the chip updates the grid/canvas; depth door works; zero console errors; panel gate green (vitest parsed + tsc + lint). Screenshots. The facet's concept-count for a first-time author: metric · filters · door — THREE things, nothing else.

**Pre-note (0087 finding, 2026-07-18):** the `role` seam is universal — the facet's inline pickers (metric switch, chips) should ride the SAME role-projection (FieldPicker/MemberPicker are pipeline-step-local today; the declaration is not). One projection, every surface.

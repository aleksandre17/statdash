---
id: "0041"
title: "LV-4: Choropleth region-click re-scopes sector donut + comparison + area; agrees with KPI base"
status: needs_live_verify
class: VERIFY
priority: P1
owner: —
implements: SPEC.DELTA §4 LV-4, §2 E5 / §E10-note
verifies: ["0026", "0035"]
links:
  - platform/work/SPEC-render-pipeline-target.DELTA-6-14.md
---
**Live check (headless-browser pass)** — On the annual regional sectoral sub-page, does clicking a region on the choropleth re-scope the sector donut + regional-comparison + sectoral-structure area, and does the re-scoped state agree with the KPI base?

**How to verify** — Load the regional sectoral sub-page; click a region on the map; confirm the `region` param updates (selected feature gets `FILL_SELECTED`/`WEIGHT_SELECTED`), and that the sector donut, comparison bar, and area all re-scope to the selection consistently with the headline KPI.

**Feeds / gates** — Confirms the E5 (0026) region-select interaction wiring and the O-12 (0035) KPI-base coupling; informs the E10-family regional elements.

**Reversibility** — Two-way (read-only observation of the filter cascade).

**Acceptance** — [ ] Region-click updates `region` + highlight; [ ] donut/comparison/area re-scope; [ ] re-scoped panels agree with the KPI base; [ ] any divergence flagged to the owning element item.

**Standing DoD (applies to the dependent build items)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — Run before the regional sub-page elements CLOSE. `needs_live_verify`.

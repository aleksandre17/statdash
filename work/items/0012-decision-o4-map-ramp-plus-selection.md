---
id: "0012"
title: "DECISION O-4: Map — always value-ramp + selection overlay"
status: backlog
class: DECISION
priority: P0
owner: —
implements: SPEC §5 O-4, §1 C4
blocks: ["0018", "0026"]
links:
  - platform/work/SPEC-render-pipeline-target.md
---
**Decision needed** — Whether the choropleth value ramp is always active (all regions shaded by GVA in every view), or only in the annual "all regions" view with a flat-plus-selection look in a filtered multi-region view.

**Reasoned DEFAULT (build this unless told otherwise)** — **Always ramp by value; selection adds opacity/stroke on top.** Fill COLOR = value (sequential ramp); fill OPACITY + stroke WEIGHT = selection/hover — two orthogonal encodings living simultaneously. Most information-dense and the reference-platform norm (Mapbox/Vega). `img_5`'s two dark regions are the selection highlight on a 2-region filter (correct), NOT the value ramp.

**Alternative** — Ramp only in "all regions"; flat elsewhere (loses information in filtered views).

**Reversibility** — Two-way door (encoding composition in the geograph node; toggleable).

**Blocks** — 0018 (C4 choropleth consolidation), 0026 (E5 choropleth map).

**Owner action (~2 min)** — Confirm always-ramp + selection overlay, or restrict the ramp to the all-regions view.

**Standing DoD (applies to the dependent build items):** rendered result must match `scriness/` achieved ONLY through highest-concept architecture — no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

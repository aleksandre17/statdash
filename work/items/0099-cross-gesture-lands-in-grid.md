---
id: "0099"
title: "THE CROSS-GESTURE LANDS IN THE GRID, NOT JSON — «დაათვალიერე workbench-ში» must show the 200-row browse, not a raw JSON editor (0089 finding #2)"
status: QUEUED-HOT (2026-07-18 — a broken-experience gap that directly defeats 0091's whole point; the owner would click «browse in workbench» and see raw JSON)
class: S-M
priority: P0
owner: lead → build agent (Opus)
implements: the unification law (one model, one editor = the WORKBENCH grid; 0086) · Law 11 (the promised browse must actually render as the browse) · closes 0089 architect finding #2
links:
  - work/items/0089-cross-cube-browse-scope.md    # finding #2 — pipeline spec routes to JsonFallback
  - work/items/0091-data-home-four-floors.md       # the cross-gesture this completes
  - platform/apps/panel/src/features/data-layer/DataSpecEditor.tsx  # routes `pipeline` → JsonFallback today
---
**The gap (0089 architect, live-verified routing is correct but the SURFACE is wrong):** the Sources «დაათვალიერე workbench-ში» cross-gesture (0091) seeds a `pipeline` spec via `withStewardCube` and selects it in `DataModelingPanel` → `DataSpecEditor`, which routes a `pipeline` discriminant to **`JsonFallback`** (raw JSON), NOT the three-pane workbench grid (`usePipelineSourceRows`, reached via the inspector Data facet / 0086's «გახსენი ვორქბენჩი» door). So the owner asks to BROWSE a cube and gets a JSON editor — the store routing is right (0089: `dataset=<picked>`), but the promised grid never appears.

**The fix (decided direction — the unification law):** the cross-gesture must land on the WORKBENCH (the three-pane grid surface, THE editor since 0086), not the `DataSpecEditor` JSON fallback. Either (a) the Sources handoff opens the workbench directly seeded with the steward head (preferred — one editor, the grid is the point), or (b) `DataSpecEditor` routes a `pipeline` spec to the workbench/grid instead of `JsonFallback` (kills a legacy JSON escape hatch — Strangler-aligned, but must not strand the steward's raw-JSON last resort: keep it behind the steward «advanced» disclosure). Pick per the workbench's actual mount seam; the browse grid + steps + generated-query pane are what «დაათვალიერე» promises.

**Boundaries.** One editor (the workbench) · plane law (steward raw-JSON stays a last-resort disclosure, never the default landing) · no new grammar · honest states.

**DoD.** Live: Sources → pick REGIONAL_GVA → «დაათვალიერე workbench-ში» → the **200-row browse GRID** renders (governed headers, the cube's own rows per 0089), steps addable, generated-query pane live — NOT a JSON editor; zero console errors; panel gate green; screenshots.

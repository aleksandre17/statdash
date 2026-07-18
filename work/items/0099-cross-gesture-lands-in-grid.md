---
id: "0099"
title: "THE CROSS-GESTURE LANDS IN THE GRID, NOT JSON — «დაათვალიერე workbench-ში» must show the 200-row browse, not a raw JSON editor (0089 finding #2)"
status: DONE (2026-07-18 — the cross-gesture lands on the three-pane WORKBENCH GRID, not JsonFallback; commit `70d0ff6` + probe `9095cb7` on main; gates green; live-proven on :3013 — 200-row browse, wire dataset=REGIONAL_GVA)
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

---

**RESOLVED (2026-07-18).** **Mount-seam finding:** the workbench (`DataWorkbench`) is a controlled `value`/`onChange` component — it mounts standalone with NO canvas element (proven live). Its two live-binding hosts are: (1) the inspector DATA-facet → `useFocusEscalation` → full-screen `FocusView` (node-field escalation); (2) — the gap — the Sources handoff lands a `pipeline` DataSpec ENTITY in `DataModelingPanel` (Region 3 of ModelSurface, the steward's raw modeler). The escalation host (`FocusEscalationContext`) exists ONLY around the compose-shell dock, NOT inside the Sources/Model focus-view screens — so a fresh standalone escalated focus-view is NOT reachable from the handoff without new host plumbing.

**Option chosen: (a), realized at the existing landing.** `DataModelingPanel` routes any **workbench-shaped** spec (native `pipeline` — what the handoff seeds — OR legacy `query`, via its desugared view) to the **`DataWorkbench`** (mounted standalone, bound to the spec entity via `updateDataSpec`), taking over the panel FULL-WIDTH so the three panes breathe (the CRAFT room W-P2 gave it). This is the SAME editor the facet escalation opens (0086 — one editor, no fork), fixes the defect at the exact seam the handoff already lands on, and needs no new surface/route/escalation-host (lower-risk than a brand-new `workbench` focus-view surface, which would touch the `StudioSurface` union + rail + route validation). Rejected: (b) routing `pipeline`→workbench inside `DataSpecEditor.SpecBody` — `DataSpecEditor` is ALSO the facet's steward raw-editor accordion, where a pipeline element already has the escalation door; routing it there would double the workbench + strand the raw-JSON escape. The raw `DataSpecEditor` survives as a **collapsed steward last-resort disclosure** below the workbench (plane law).

**Build (`70d0ff6`):** `DataModelingPanel` — `isWorkbenchShaped` gate → lazy `DataWorkbench` full-width branch + `workbench-raw-advanced` disclosure + scroll-into-view on arrival; `data-modeling-panel.css` `--workbench` focus layout. Tests (`DataModelingPanel.test.tsx`): a query/pipeline spec opens the GRID (not JsonFallback, raw-JSON collapsed); the Sources handoff seeds a steward `pipeline` head declaring its store home + lands on the grid; non-workbench specs keep the `DataSpecEditor`.

**Gates:** panel vitest **1170/1170** (0 failed) · `tsc -b apps/panel` EXIT 0 · eslint 0 errors/0 new warnings. **LIVE (`probe-0099-cross-gesture-grid.mjs`, `9095cb7`, :3013):** Sources → REGIONAL_GVA → «დაათვალიერე workbench-ში» → **200 rows** in `pipeline-grid`, wire **dataset=REGIONAL_GVA** (0089 routing intact), generated-query pane live, raw-JSON a collapsed disclosure, `jsonFallbackIsLanding=false`, steps addable; the 0086 facet-door still opens (no regression); **0 non-rate-limit console errors** (35× HTTP 429 = the probe's 169-request rapid-fire tripping the live-preview rate limiter, a known volume artifact, not a JS/render error). Shots → `work/authoring-truth/0099/`.

**Ledger (pre-existing, not in scope):** the live grid still shows duplicate measure header (value+measure) + member codes in cells — the W-P3 `columnLabels`/cell-localization debt (project_panel_data_workbench_wp2), untouched here.

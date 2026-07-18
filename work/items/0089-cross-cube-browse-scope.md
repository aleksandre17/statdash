---
id: "0089"
title: "CROSS-CUBE BROWSE SCOPE — a picked raw cube must read ITS OWN store, not the page's (0084 finding #1)"
status: QUEUED (2026-07-18 — the 0083 store-routing class resurfacing for steward heads; fires with/right after 0088; architect decides the seam, then a small build)
class: S-M
priority: P0
owner: lead → architect (seam decision) → build agent
implements: Law 11 (a browse that shows ANOTHER cube's data is a lying grid) · the ONE store-resolution cascade (renderNode:252) extended to steward heads
links:
  - work/items/0084-raw-source-get-entry.md    # finding #1 — the live browse is page-store-scoped
  - platform/apps/panel/src/features/data-layer/workbench/workbenchModel.ts   # withStewardCube — where the picked cube is known
---
**The gap (live-proven, flagged not papered):** a steward `source(query)` head carries no dataset/dataSource → `resolveStore` falls to the page's store → picking REGIONAL_GVA from a GDP page browses GDP rows under a REGIONAL title. The cube LIST + debt inventory are correct; only the live BROWSE is page-scoped.

**The decision needed (architect, ≥2 alts):** (a) the steward head names its dataset (`query.dataset` or a head-level `dataSource`) honored by the ONE cascade — mirrors how governed heads route via the metric's declared home (the semantic twist, SSOT-pinned by 0083); or (b) session-scoped store descriptors (the picked cube joins the live store map for the session). Bias per our canon: the HEAD should declare its home (config carries the truth; a session-side map is state the config can't replay) — but the architect rules, incl. expand-contract for stored specs.

**DoD.** Pick ANY cube from ANY page → the browse shows THAT cube's rows (live, wire `dataset=<picked>`); promotion still roundtrips; FF pinning the routing (a steward-head fixture with page-store ≠ picked-store); gates green; zero console errors.

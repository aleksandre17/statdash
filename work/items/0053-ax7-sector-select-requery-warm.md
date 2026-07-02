---
id: "0053"
title: "BI-AX7: Regional sector-select re-query interaction + warm contract"
status: backlog
class: G
priority: P1
owner: —
implements: SPEC.DELTA-new12 §3 axis-7, §5 FF-SECTOR-REQUERY-WARM
depends_on: ["0017", "0035", "0047"]
links:
  - platform/work/SPEC-render-pipeline-target.DELTA-new12.md
---
**Goal** — Selecting a sector on the Regional page re-scopes every sector-scoped panel (choropleth, sector donut, regional-comparison, dynamics) to that sector, with the KPI/SUM re-basing (img_7 all = 80 882.7 → img_8 manufacturing = 6 758.1), and every re-scoped read is warm (no cold read on sector change).

**Implements** — SPEC.DELTA-new12 §3 axis-7. Interaction + warm contract; no new node type (reuses the `select` ParamDef + `$ctx` binding).

**Interaction contract** — A top `select` filter (`paramKey:'sector'`; img_8 manufacturing, img_11 transport) pins the `sector` dim into every regional panel's query (`sector:{$ctx:'sector'}`, prov. 3887-3889). Selecting a sector → param mutation → every sector-scoped region panel re-reads (conditional re-query). `_T` = all/rollup (wildcard). Region-select (choropleth click) and sector-select **compose**: img_11 = Tbilisi ∧ transport → region tables re-scope to Tbilisi within the transport sector.

**Warm contract** — Because `sector` is a filter param (not a perspective), all panels warm at the CURRENT `sector` value; changing it re-warms on the next render pass. Sector-scoped reqs must be in the warm set for the ACTIVE sector (C2). Warm-set folds the `sector` pin into `dims` (or drops it for `_T`).

**Files / modules touched**
- Mostly config: confirm `sector:{$ctx:'sector'}` bindings on all sector-scoped panels (prov. 3887-3889 and siblings); ensure `_T` = wildcard/rollup is honored.
- C2 warm coverage (0017): the warm-set generator includes the sector pin in each sector-scoped read key at the active sector value.

**Dependencies** — 0017 (C2 warm-contract guard — the warm-set must fold the sector pin); 0035 (O-12: sector-selector semantics + KPI re-base); 0047 (LV-6: which right-column panels are sector-scoped). Composes with region-select and with BI-B2 (0050, which exposed the time-not-rolled-up bug under sector select).

**Acceptance criteria (incl. fitness functions)**
- [ ] Selecting a sector re-scopes choropleth + donut + comparison + dynamics; KPI/SUM re-bases (all → sector; e.g. 80 882.7 → 6 758.1).
- [ ] `_T` = all/rollup; region-select ∧ sector-select compose correctly.
- [ ] **FF-SECTOR-REQUERY-WARM**: with a sector pinned, every sector-scoped panel's read key includes the sector pin and is in `warmSet` (no cold read on sector change).
- [ ] `npx tsc --noEmit` EXIT=0.

**Standing DoD (applies)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — Reuses the `select` ParamDef + `$ctx` binding — no new node type (platform-level: dependent selectors / cross-filter cascades ride the same seam). Two-way door.

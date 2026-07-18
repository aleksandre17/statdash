---
id: "0084"
title: "RAW WORK IN THE WORKBENCH — the steward raw-cube Get entry + the promotion loop (owner directive)"
status: QUEUED-HOT (2026-07-18, owner verbatim: «იქნებ ნედლი დატაზე მინდა მუშაობა?» + «არ გადადო» — fires the moment the in-flight P-OFFER wave lands; serialized ONLY for file-collision safety)
class: M
priority: P0
owner: lead → senior/apex build agent (Opus)
implements: the two-audience canon (see anchors) · ADR-046 (the source head's THREE variants — the steward `query` variant EXISTS in grammar, unsurfaced in UI) · E2 promotion rule · pulls the W-P6 front-door forward
links:
  - docs/architecture/decisions/ADR-046-pipeline-as-spine.md
  - docs/architecture/proposals/SPEC-query-pipeline-data-home.md   # §2 four floors · §3.4 plane law
---
**The international canon (Law 4 — adopt whole, name in code comments):** every reference leader gives raw access as a ROLE, never a default, with a PROMOTION loop upward: Power Query (connect-to-source → shape → lands in the model) · Superset (SQL Lab → publish as dataset) · Looker (SQL Runner → LookML model) · dbt (raw → staging → marts). Three-part principle: (1) raw work EXISTS and is strong; (2) it is PLANE-gated (published pages consume only governed facts — reader trust is never spent); (3) raw→governed promotion is the loop that FEEDS the semantic layer.

**The build (grammar is ready — this is surface + loop):**
1. **Get gains two offered tabs in the STEWARD lens:** «მეტრიკები» (existing MetricPalette) | «ნედლი კუბები» — the cube/dataset list (Floor 1 vocabulary: dataset code + governed title + dim summary from the cube profile/describeApp). Picking a cube emits the EXISTING steward head `{op:'source', query:{...}}` (ADR-046 variant 2 — no new grammar) → the browse grid shows the raw observations (the same one-derivation grid; steward plane may show raw codes per the plane law). The AUTHOR lens keeps metrics-only (FF-AUTHOR-NO-QUERY untouched).
2. **The promotion loop (E2 made flesh):** a workbench whose head is raw/steward gains «მეტრიკად დაწინაურება» — proposes a governed metric from the shaped read (name ka/en, unit, the coordinate); steward blesses → the catalog gains the metric (the existing semanticCatalog/steward metric-definition seam — REUSE, no new pipeline) → the head is REPLACED by the governed ref. `FF-PROMOTE-ROUNDTRIP` (registered pending in W-P0) flips to a biting gate: the promoted head resolves byte-identically to the raw one it replaced.
3. **P-OFFER holds everywhere:** the cube list, its dims, everything is offered — nothing typed.
4. **Honest states:** a cube with no obs → declared empty; no cubes → declared, never a blank tab.

**Hard boundaries.** No new DataSpec grammar (variant 2 exists) · plane law verbatim (ADR-041 §PLANE; author never sees the raw tab) · one derivation path (the grid/query-pane read the same model) · Law 9 WCAG · bilingual · the DQ floor and the full four-floor IA stay W-P6 (do not scope-creep into ingest).

**DoD.** Live walk (:3013, steward lens): Get → «ნედლი კუბები» → pick REGIONAL_GVA → raw browse renders → shape with steps → «მეტრიკად დაწინაურება» → the blessed metric appears in the catalog AND the head becomes governed → FF-PROMOTE-ROUNDTRIP green · author lens shows NO raw tab (fitness) · gates: panel vitest + tsc + lint · screenshots · zero console errors.

---
name: worldclass-authoring-ui
description: AR-49 M4.3 — the unified world-class authoring UI (Summary-Card Inspector · the Stage · Data-Flow Spine); completes the Placement Law; ADR-037
metadata:
  type: project
---

`docs/architecture/proposals/SPEC-worldclass-authoring-ui.md` + `docs/architecture/decisions/ADR-037-summary-card-inspector-and-stage.md` (I am sole author, 2026-07-11; owner-commissioned independent benchmark study of the whole reference class).

**Root-cause verdict on "the right side doesn't fit" (post SL-0..5):** three findings — the Placement Law is a *negative* law (eviction became invisibility; rich types `DataSpec`/`ChartDef`/opaque array/object default to raw-JSON `JsonControl` in the dock); the focus-view terminal carries no live subject (form in a void — every reference platform keeps the artifact visible at workspace depth: Grafana panel editor, Superset/Looker Explore, Figma/Framer enter-component); weight is derived from knowingly-incomplete schemas (chart = 3 real fields + SCHEMA_TODO, so a workspace-intent subject weighs "form").

**The three moves (ADR-037 = the two corollaries):**
1. **Summary Corollary** — dock ALWAYS shows `summarize(subject)` (constant-size populated card, per-rich-type `summarize()` registry + generic fallback) for everything in scope; `place()` locates only the *editor*. Dock becomes constant-weight by construction (FF-DOCK-CONSTANT-WEIGHT, FF-SUMMARY-EVERYWHERE, FF-NO-RAW-JSON-DEFAULT). RightDock's ad-hoc stack (VisibilitySection/nodeContextEditors/page panes) is absorbed into a dock **section registry**.
2. **Stage Contract** — focus-view realization gains a mandatory live-subject slot: `stage = {subject, editor, breadcrumb}`; registry targets declare `renderSubject`+`renderEditor` (FF-STAGE-HAS-SUBJECT). Owner's routed-separate-screen decision UNCHANGED. Named stages: Chart Studio (flagship — reuses fieldwells/ShowMe/DataSpecEditor which today are steward-Model-only), Filters (live FilterBar), Perspectives, Metric Calc, Model.
3. **Data-Flow Spine** — Model stage home = flow map `source → spec → metric → used-by` projected from existing registries (`computeMetricImpact` reverse index; FF-FLOWMAP-IS-PROJECTION, never stored) + a lineage summary card in every data-bound element's Data section (FF-LINEAGE-AT-POINT-OF-USE). Fixes "pipelines buried" at the point of use; M3 honesty boundary preserved (visibility ≠ editability).

**Phases:** W-A Summary-Card Inspector (acute fix FIRST, apps-only) → W-B Stage contract → W-C Chart Studio (scalar schema drain now; nested rides already-gated D7/ADR-022 — the ONLY packages-touching piece) → W-D Flow Spine → W-E coherence sweep. All reversible; no new one-way door.

**Dedup audit (owner's "scattered"):** metric-bind = one write path, two presentations → unify presentation (card IS the picker); DataSpec split-brain (rich editors steward-only vs node raw JSON) → fixed by reuse in Chart Studio; `ChartGroups` references non-existent schema fields (`view.legend`/`view.tooltip` — silent drop) → FF-GROUP-FIELDS-EXIST; page-in-two-homes is the CORRECT site-vs-page scope split, not duplication.

**Owner gates:** D-W1 SummaryCard default (rec yes), D-W2 stage editor-on-right (rec yes), D-W3 dbl-click-chart enters Chart Studio (rec yes), D-W4 flow map as Model home (rec yes).

**How to apply:** at Leader's Scans this is the authoring-UI SSOT layered over [[project-shell-placement-law]] (kernel kept; §3.4 form-only realization + SL-5 bespoke affordance superseded). The synthesis thesis: all six surfaces (palette, inspector, summaries, placement, flow map, guidance) are PROJECTIONS of the config tree + registries — the structural moat no reference platform has.

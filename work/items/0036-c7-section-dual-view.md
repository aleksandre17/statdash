---
id: "0036"
title: "C7: Section dual-view (chart↔table) as a first-class conditional axis — invariant I-6"
status: backlog
class: M
priority: P1
owner: —
implements: SPEC.DELTA §C7, §5 FF-DUALVIEW-ONE-DATA / FF-TABLE-FOOTER-MEAN
depends_on: ["0032", "0016", "0017"]
links:
  - platform/work/SPEC-render-pipeline-target.DELTA-6-14.md
  - platform/work/SPEC-render-pipeline-target.md
---
**Goal** — Every panel section carries two sibling view children — `{type:'chart', view:{role:'chart', label:'დიაგრამა'}}` and `{type:'table', view:{role:'table', label:'ცხრილი'}}` — and SectionBlock toggles which renders. User-driven, orthogonal to perspective and to filters (prov. 1595–1644 is the canonical pair).

**Implements** — SPEC.DELTA §C7. This is a refine-existing capability: the `SectionBlock` chart/table toggle already exists (`packages/plugins/CLAUDE.md`: "Chart / Table toggle ✅ SectionBlock"); this item makes the data-on-section invariant (I-6) structural and covers it with fitness functions.

**Invariant I-6 (data-on-section, views-are-pure)** — The **section owns `data`**; both view children are **pure re-encodings of the SAME resolved rows** — the table is not a second query. Therefore warm covers the pair **once, at the section**, regardless of which view is active (C2 unaffected — no per-view warm branch). The chart↔table switch is a lossless round-trip of the same tidy rows; the C1 axis↔table magnitude agreement is *guaranteed by construction* (both read one `data`), not merely tested.

**Files / modules touched**
- `view.role: 'chart'|'table'` discriminant on section children; SectionBlock holds the active-view UI state and passes the section's `interpretSpec` rows to BOTH children. No conditional in config — the toggle is renderer behaviour keyed on `view.role`.
- Active-view state serialization per O-9 (0032): chart-first default, encoded in the URL per section (permalink). Confirmed live by LV-2 (0039).
- Table footer `sum`/`mean` (img_14 `საშუალო`) is a table `transforms`/rollup reduction — its mean semantics align with C5 (`mean` reduction, base-year policy per O-5), never CAGR.

**Dependencies** — 0032 (O-9: default view + URL-encoding), 0016 (C1: both views format through the SSOT), 0017 (C2: warm-once-at-section, no per-view branch). Can run in parallel with C4/C5/C6.

**Acceptance criteria (incl. fitness functions)**
- [ ] Section owns `data`; both `view.role` children re-encode the same `interpretSpec` rows; no child issues its own store read.
- [ ] SectionBlock toggles the active view; default per O-9 (chart-first); active-view state URL-encoded per section (Law 9) — LV-2 (0039) confirms restore-on-reload/share.
- [ ] Numbers in BOTH views funnel through C1 (`getFormatter`/`fmtNum`/`compact`) — the axis↔table magnitude agreement holds by construction.
- [ ] **FF-DUALVIEW-ONE-DATA**: a section with `role:'chart'`+`role:'table'` children resolves exactly ONE `data` at the section; neither child issues a store read; both format through C1.
- [ ] **FF-TABLE-FOOTER-MEAN**: a table `საშუალო`/mean footer uses the C5 `mean` reduction (arithmetic mean, base-year policy per O-5), never CAGR.
- [ ] Warm: no new warm keys vs the section's existing reads (C2 unaffected).
- [ ] `npx tsc --noEmit` EXIT=0.

**Standing DoD (applies)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — C7 is a prerequisite for the table-view of E3 (0024), E4 (0025), E6 (0027), E7 (0028), and E9 (0037); E8 (0029) is the pivot table view of E9. Refine EXISTING SectionBlock — do not build a parallel toggle. Two-way door.

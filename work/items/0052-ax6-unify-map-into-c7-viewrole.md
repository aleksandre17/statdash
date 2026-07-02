---
id: "0052"
title: "BI-AX6: Unify the geograph map↔table toggle into the C7 `view.role:'map'` registry"
status: backlog
class: M
priority: P1
owner: —
implements: SPEC.DELTA-new12 §3 axis-6, §5 FF-ONE-VIEWTOGGLE
depends_on: ["0046", "0036", "0018"]
links:
  - platform/work/SPEC-render-pipeline-target.DELTA-new12.md
---
**Goal** — One active-view toggle mechanism for the whole platform. The geograph map↔table toggle stops being a bespoke second path (`PanelLayout` `views` + `defaultViewIndex`) and becomes `view.role:'map'` under the SAME SectionBlock C7 mechanism every other section uses.

**Implements** — SPEC.DELTA-new12 §3 axis-6 (per O-16). Retire the SSOT drift: two toggle implementations for one concept collapse to one.

**Root cause / current state** — GeographShell (`GeographShell.tsx:74-108`) renders a map + a table child and toggles them via `PanelLayout` `views` array + `defaultViewIndex` — a separate mechanism from the SectionBlock `view.role` discriminant (C7). Two code paths for one concept = SSOT drift. I-6 already holds for geograph (the section owns one warmed `rows`; the choropleth and the region table both read those same rows), so `map` is simply a third view-role.

**Files / modules touched**
- Register `map` as a first-class `view.role` alongside `chart`/`table` (the C7 view-role registry / SectionBlock discriminant).
- Migrate GeographShell to author its map + table as C7 `view.role` children (map & table = pure re-encodings of the section's warmed `rows`); retire the `PanelLayout.views`/`defaultViewIndex` bespoke toggle (Strangler — fold into the existing seam, do not build a parallel one).
- Active-view state serialization for `map` follows O-9 (URL-encoded per section) like chart/table.

**Dependencies** — 0046 (O-16: unify vs defer — DEFAULT unify); 0036 (C7 mechanism); 0018 (C4 choropleth consolidation — the map node it toggles). Do after C4 so there is one choropleth to view-role.

**Acceptance criteria (incl. fitness functions)**
- [ ] `map` is a registered `view.role`; GeographShell toggles map↔table through the SectionBlock C7 mechanism (no `PanelLayout.views` toggle remaining).
- [ ] Map and table re-encode the SAME warmed `rows` (I-6); no per-view re-query; no new warm keys.
- [ ] Active-view state URL-encoded per section (O-9), consistent with chart/table.
- [ ] **FF-ONE-VIEWTOGGLE**: exactly one active-view mechanism exists; `map` is a registered `view.role`; no second toggle path.
- [ ] `npx tsc --noEmit` EXIT=0.

**Standing DoD (applies)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — A new `view.role` = a new capability, interface unchanged (OCP). If unification proves leaky, O-16's `D-MAP-VIEWROLE` defer is the fallback. Two-way door.

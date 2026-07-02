---
id: "0046"
title: "DECISION O-16: Unify the geograph map↔table toggle into the C7 `view.role:'map'` registry vs keep the bespoke toggle (D-MAP-VIEWROLE)"
status: backlog
class: DECISION
priority: P0
owner: —
implements: SPEC.DELTA-new12 §3 axis-6, §4 O-16
blocks: ["0052"]
links:
  - platform/work/SPEC-render-pipeline-target.DELTA-new12.md
---
**Decision needed** — GeographShell renders a map + a table child and toggles them via its OWN mechanism (`PanelLayout` `views` array + `defaultViewIndex`), while every other section's chart↔table toggle goes through the SectionBlock `view.role` discriminant (C7). That is two toggle implementations for one concept (SSOT drift). Unify the map into the C7 `view.role` registry now, or keep the bespoke geograph toggle and defer unification (`D-MAP-VIEWROLE`)?

**Reasoned DEFAULT (build this unless told otherwise)** — **Unify now.** Make `map` a first-class `view.role` under the SAME SectionBlock C7 mechanism. I-6 already holds for geograph (the section owns one warmed `rows`; the choropleth and the region table are pure re-encodings of it), so the map is simply a third view-role alongside `chart`/`table`. A new `view.role` is Open/Closed (a new capability, interface unchanged) and removes the second toggle path — one active-view mechanism, guarded by FF-ONE-VIEWTOGGLE.

**Alternative** — Keep the geograph's bespoke `PanelLayout.views` toggle and defer unification behind `D-MAP-VIEWROLE` (lower immediate churn, but leaves the SSOT drift and a second code path in place).

**Reversibility** — Two-way door (a renderer-side consolidation onto an existing discriminant; the bespoke path can be reinstated if unification proves leaky).

**Blocks** — 0052 (BI-AX6). Couples to 0036 (C7) and 0018 (C4 choropleth consolidation).

**Owner action (~2 min)** — Confirm unify-now (`map` = registered `view.role`), or defer via `D-MAP-VIEWROLE`.

**Standing DoD (applies to the dependent build items):** rendered result must match `scriness/` achieved ONLY through highest-concept architecture — no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics (visibleWhen/perspective/effects) covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

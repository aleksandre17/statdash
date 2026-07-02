---
id: "0035"
title: "DECISION O-12: Regional sector-selector semantics (KPI re-base + comparison-bar scope)"
status: backlog
class: DECISION
priority: P0
owner: —
implements: SPEC.DELTA §3 O-12, §E10-note
blocks: ["0038"]
links:
  - platform/work/SPEC-render-pipeline-target.DELTA-6-14.md
---
**Decision needed** — On the Regional pages, does the top `sector` `select` default to `_T` (all sectors), and does choosing a sector **re-base the KPI** (img_12/13 KPI = 579 is government-only, not the region total)? Coupled: what is the regional-comparison bar's scope under a region+sector selection?

**Reasoned DEFAULT (build this unless told otherwise)** — The `sector` selector defaults to `_T` (total); selecting a sector **re-bases** the sector-scoped KPIs and panels to that sector (KPI = the selected sector's value, e.g. 579 for government in Imereti). The regional-comparison `hbar` should **rank all regions for the selected sector, highlighting the selected region** (not collapse to a single bar) — pending **LV-1 (0038)** to confirm whether the live single-bar is intended focus or the C6 degeneracy/filter family.

**Alternative** — Sector select does not re-base KPIs (KPIs always show the region total), or the comparison bar legitimately shows one region. LV-1 disambiguates.

**Reversibility** — Two-way door (selector default + filter scope are config; the comparison-bar behaviour couples to O-8/LV-1).

**Blocks** — 0038 (LV-1 verification); informs the E10-family regional elements (sector donut, comparison hbar, sectoral-structure area/pivot).

**Owner action (~2 min)** — Confirm `_T` default + KPI re-base + all-regions comparison with one highlighted, or specify otherwise; LV-1 confirms live.

**Standing DoD (applies to the dependent build items):** rendered result must match `scriness/` achieved ONLY through highest-concept architecture — no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics (visibleWhen/perspective/effects) covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

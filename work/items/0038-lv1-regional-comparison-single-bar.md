---
id: "0038"
title: "LV-1: Regional-comparison `hbar` single-bar collapse under region+sector select — intended focus vs C6 degeneracy"
status: needs_live_verify
class: VERIFY
priority: P1
owner: —
implements: SPEC.DELTA §4 LV-1, §E10-note
verifies: ["0035"]
links:
  - platform/work/SPEC-render-pipeline-target.DELTA-6-14.md
---
**Live check (headless-browser pass)** — On the Regional pages, the regional-comparison `hbar` (prov. 3643) collapses to a **single Imereti bar (= 579)** under a region+sector selection (img_12/13). Determine live: is this the **intended single-region focus**, or the **C6 degeneracy/filter family** (the chart should rank ALL regions for the selected sector and merely highlight the selected one)?

**How to verify** — Load the Regional annual page with `region=Imereti` + `sector=სახელმწიფო მმართველობა`; observe whether the comparison `hbar` shows one bar or all regions with one highlighted. Separately confirm the broken x-axis ticks there (5,1,15,2,25…) are the C1 duplicate-tick bug (0016), not a data issue.

**Feeds / gates** — Resolves O-12 (0035); gates the regional-comparison element scope. The x-axis defect is fixed by C1 (0016), verified live by LV-5 (0042).

**Reversibility** — Two-way (read-only observation; informs a config-level scope decision).

**Acceptance** — [ ] Live behaviour captured and classified (intended focus vs degeneracy); [ ] O-12 (0035) comparison-bar scope resolved on the evidence; [ ] x-axis tick defect confirmed as C1.

**Standing DoD (applies to the dependent build items)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — Run before the regional-comparison element CLOSES. `needs_live_verify`.

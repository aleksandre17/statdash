---
id: "0047"
title: "LV-6: Regional right-column slot — sector donut (img_5) vs sectoral-structure bar (img_6): distinct section or state swap"
status: needs_live_verify
class: VERIFY
priority: P1
owner: —
implements: SPEC.DELTA-new12 §1 (img_6), §4 LV-6
verifies: ["0053"]
links:
  - platform/work/SPEC-render-pipeline-target.DELTA-new12.md
---
**Live check (headless-browser pass)** — On the Regional annual page (KA, sector=all), img_5 shows a **sector donut** (center 70 329) in the right column while img_6 shows a **"Sectoral structure — regional comparison" bar** in what appears to be the same right-column slot. Determine live: is this **two distinct section slots** (both present, stacked/scrolled) or a **single slot that swaps by state** (perspective/interaction/sub-page)?

**How to verify** — Load the Regional annual page and capture the right column in each observable state (sector=all vs a selected sector; annual vs any sub-page nav). Record whether donut and comparison-bar coexist or replace each other, and what state drives the swap.

**Feeds / gates** — Informs BI-AX7 (0053) sector-select re-query scope and the E10-family regional element layout (which panels are sector-scoped and re-query). If it is a state swap, the swapping condition must be an explicit `visibleWhen`/perspective discriminant (no implicit re-typing).

**Reversibility** — Two-way (read-only observation).

**Acceptance** — [ ] Right-column behaviour captured and classified (distinct slots vs state swap); [ ] the swap condition (if any) identified as an explicit conditional; [ ] feeds the AX7/E10 panel inventory.

**Standing DoD (applies to the dependent build items)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — Run before the sector-scoped regional panels CLOSE. `needs_live_verify`.

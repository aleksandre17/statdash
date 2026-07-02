---
id: "0043"
title: "DECISION O-13: Range-mode \"by region\" ranking semantics — terminal-year snapshot vs windowed sum"
status: backlog
class: DECISION
priority: P0
owner: —
implements: SPEC.DELTA-new12 §2 Bug 2, §4 O-13
blocks: ["0050"]
links:
  - platform/work/SPEC-render-pipeline-target.DELTA-new12.md
---
**Decision needed** — When the Regional page is in **range (dynamics)** perspective, what does the "GDP — by region" ranking table/bar mean per region across the 2010–2025 window? Two coherent readings: (a) **terminal-year snapshot** — the value at `toYear` (`by:["geo"]`, pin `time=toYear`); (b) **windowed sum** — GVA summed over the whole window (`by:["geo"]`, agg sum, `time` rolled up).

**Reasoned DEFAULT (build this unless told otherwise)** — **Terminal-year snapshot** (`by:["geo"]`, pin `time=toYear`). It matches the KPI "toYear total" and the img_7 annual meaning (one comparable value per region), so the range table reads consistently with the annual table. Either way the group key becomes `by:["geo"]` only — the fix for Bug 2 (the phantom per-(geo,year) rows) does not depend on this choice; O-13 only picks which single value each region shows.

**Alternative** — Windowed sum (cumulative GVA over the window) if the NSO wants the range table to express total activity across the span rather than an end-of-window level.

**Reversibility** — Two-way door (a config-level `time` pin/rollup choice on the ranking pipe; swappable without touching the engine).

**Blocks** — 0050 (BI-B2 ranking group-key normalization). BI-B2 can proceed on the DEFAULT (terminal-year snapshot); O-13 only fixes the semantic of the single retained value.

**Owner action (~2 min)** — Confirm terminal-year snapshot, or select windowed sum.

**Standing DoD (applies to the dependent build items):** rendered result must match `scriness/` achieved ONLY through highest-concept architecture — no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics (visibleWhen/perspective/effects) covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

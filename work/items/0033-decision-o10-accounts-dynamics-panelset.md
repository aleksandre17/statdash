---
id: "0033"
title: "DECISION O-10: `/accounts` dynamics-mode panel set (unseen in shots)"
status: backlog
class: DECISION
priority: P0
owner: —
implements: SPEC.DELTA §3 O-10, §E9
blocks: ["0037"]
needs_live_verify: true
links:
  - platform/work/SPEC-render-pipeline-target.DELTA-6-14.md
---
**Decision needed** — What panel set the SNA `/accounts` page shows in **dynamics** mode. The screenshots only capture `/accounts` in annual mode (img_10); the dynamics grid was not captured.

**Reasoned DEFAULT (build this unless told otherwise)** — Assume the dynamics grid **mirrors the GDP dynamics pattern**: a time-series of the SNA closing balances (B1G/B2G/B5G/B6G/B8G/B9 over the year window), `perspective-is range`-gated, alongside per-account trends. The annual `hbar-diverging` sequence chart is `perspective-is year`.

**Alternative** — A distinct dynamics layout (e.g. stacked contributions per account group over time). Unknown until captured.

**Confirmed by live capture** — **LV-3 (0040)** captures `/accounts` in dynamics mode and finalizes E9's dynamics grid. Until then, build E9's annual sequence on the DEFAULT and treat the dynamics grid as LV-gated.

**Reversibility** — Two-way door (perspective-gated node set is config; adding/retyping dynamics nodes is a config edit).

**Blocks** — 0037 (E9). E9's annual sequence proceeds now; its dynamics grid closes after LV-3.

**Owner action (~2 min)** — Confirm "mirror GDP dynamics" as the working assumption, or describe the intended dynamics layout; either way LV-3 confirms live.

**Standing DoD (applies to the dependent build items):** rendered result must match `scriness/` achieved ONLY through highest-concept architecture — no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics (visibleWhen/perspective/effects) covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

---
id: "0045"
title: "DECISION O-15: Dark/light theme persistence — localStorage + prefers-color-scheme, NOT URL-encoded"
status: backlog
class: DECISION
priority: P0
owner: —
implements: SPEC.DELTA-new12 §3 axis-5, §4 O-15
blocks: ["0051"]
links:
  - platform/work/SPEC-render-pipeline-target.DELTA-new12.md
---
**Decision needed** — The root-level theme toggle (☀/☾, visible top-right in all 12 shots) is a new UI-state axis. Where is the chosen theme persisted, and is it part of the permalink (URL) like view-state (O-9)?

**Reasoned DEFAULT (build this unless told otherwise)** — Theme is a **client display preference**, not a data/view coordinate: persist to **`localStorage`**, and on first visit respect the OS **`prefers-color-scheme`**. It is **NOT URL-encoded** (unlike the active-view state of O-9), because a shared link should render in the recipient's own preference, not the sharer's. Applied synchronously before first paint (no-FOUC — already done for the initial theme, commit `fd7a5a0`).

**Alternative** — URL-encode the theme too (makes a shared link reproduce the exact theme) — rejected by default because it couples a personal display choice to the data permalink and fights `prefers-color-scheme`.

**Reversibility** — Two-way door (persistence target is a small client concern; can add URL-encoding later if a stakeholder wants theme in the permalink).

**Blocks** — 0051 (BI-AX5 theme axis). AX5 can build on the DEFAULT persistence model.

**Owner action (~2 min)** — Confirm localStorage + prefers-color-scheme, not URL-encoded.

**Standing DoD (applies to the dependent build items):** rendered result must match `scriness/` achieved ONLY through highest-concept architecture — no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics (visibleWhen/perspective/effects) covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

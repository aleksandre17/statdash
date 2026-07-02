---
id: "0032"
title: "DECISION O-9: Section dual-view default (chart-first) + URL-encoding of active view"
status: backlog
class: DECISION
priority: P0
owner: —
implements: SPEC.DELTA §C7 O-9
blocks: ["0036"]
links:
  - platform/work/SPEC-render-pipeline-target.DELTA-6-14.md
---
**Decision needed** — For the per-section chart↔table toggle (C7), (a) which view renders by default per section, and (b) whether the active-view choice is encoded in the URL.

**Reasoned DEFAULT (build this unless told otherwise)** — **Chart-first** per section (ONS progressive-disclosure norm), with the active-view state **encoded in the URL per section** so a shared/reloaded link restores exactly what the user saw (Law 9 — URL = permalink).

**Alternative** — Table-first default (data-table-first agencies), and/or ephemeral view state (not URL-encoded — simpler, but breaks permalink parity).

**Reversibility** — Two-way door (default and URL-serialization are both config/renderer concerns, swappable later).

**Blocks** — 0036 (C7 section dual-view). C7 can proceed on the DEFAULT; the URL-persist behaviour is confirmed live by **LV-2 (0039)** before C7 closes.

**Owner action (~2 min)** — Confirm chart-first + URL-encoded per section, or select an alternative.

**Standing DoD (applies to the dependent build items):** rendered result must match `scriness/` achieved ONLY through highest-concept architecture — no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics (visibleWhen/perspective/effects) covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

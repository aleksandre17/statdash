---
id: "0039"
title: "LV-2: Section chart↔table active-view persisted in URL + restored on reload/share"
status: needs_live_verify
class: VERIFY
priority: P1
owner: —
implements: SPEC.DELTA §4 LV-2, §C7
verifies: ["0032", "0036"]
links:
  - platform/work/SPEC-render-pipeline-target.DELTA-6-14.md
---
**Live check (headless-browser pass)** — Is the per-section chart↔table active-view state persisted in the URL (Law 9 — permalink) and restored on reload / when a shared link is opened?

**How to verify** — Toggle a section to its table view; confirm the URL updates; reload and open the URL in a fresh context; confirm the table view is restored per section (and other sections keep their own state).

**Feeds / gates** — Drives O-9 (0032); confirms the C7 (0036) URL-encoding acceptance criterion before C7 closes.

**Reversibility** — Two-way (read-only observation; confirms a config/renderer behaviour).

**Acceptance** — [ ] URL reflects per-section active view; [ ] reload/share restores it; [ ] O-9 (0032) URL-encoding default confirmed; [ ] C7 (0036) URL criterion satisfied.

**Standing DoD (applies to the dependent build items)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — Run before C7 (0036) CLOSES. `needs_live_verify`.

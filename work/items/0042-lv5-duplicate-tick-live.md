---
id: "0042"
title: "LV-5: C1 duplicate-tick bug fires on GDP-dynamics `combo` y-axis + regional-comparison x-axis"
status: needs_live_verify
class: VERIFY
priority: P1
owner: —
implements: SPEC.DELTA §4 LV-5, §1 C1
verifies: ["0016"]
links:
  - platform/work/SPEC-render-pipeline-target.DELTA-6-14.md
  - platform/work/SPEC-render-pipeline-target.md
---
**Live check (headless-browser pass)** — Confirm the C1 duplicate/non-monotonic-tick bug fires live on BOTH the GDP-dynamics production `combo` y-axis (img_7: "12 000, 1 000…") and the regional-comparison x-axis (img_12/13: 5,1,15,2,25…) — and that BOTH are fixed by the single C1 compact-formatter seam (0016), proving one seam covers both surfaces.

**How to verify** — Before C1: capture both axes and record the duplicate/out-of-order ticks. After C1 (0016) lands: re-capture; confirm ticks are strictly monotonic compact values on both, and that FF-AXIS-MONOTONIC (0016) is green.

**Feeds / gates** — Validates C1 (0016) end-to-end on the live app across two distinct axis surfaces (proves the single-seam claim). Complements the unit-level FF-AXIS-MONOTONIC.

**Reversibility** — Two-way (read-only observation, before/after C1).

**Acceptance** — [ ] Bug reproduced live on both axes pre-fix; [ ] both axes strictly monotonic post-C1; [ ] FF-AXIS-MONOTONIC (0016) green; [ ] single-seam claim confirmed.

**Standing DoD (applies to the dependent build items)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — Run before/after C1 (0016) CLOSES. `needs_live_verify`.

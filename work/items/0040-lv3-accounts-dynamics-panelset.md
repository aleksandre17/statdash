---
id: "0040"
title: "LV-3: `/accounts` in dynamics mode — capture the panel set (unseen in shots)"
status: needs_live_verify
class: VERIFY
priority: P1
owner: —
implements: SPEC.DELTA §4 LV-3, §E9
verifies: ["0033", "0037"]
links:
  - platform/work/SPEC-render-pipeline-target.DELTA-6-14.md
---
**Live check (headless-browser pass)** — Capture the SNA `/accounts` page in **dynamics** mode. The screenshots only cover annual mode (img_10); the dynamics panel set was never captured, so E9's dynamics grid is currently built on the "mirror GDP dynamics" assumption (O-10).

**How to verify** — Load `/accounts`, switch to dynamics (`დინამიკა`); record the panel set, chart types, and which closing balances are shown over the year window; compare against the O-10 (0033) DEFAULT assumption.

**Feeds / gates** — Finalizes O-10 (0033); closes the dynamics-mode portion of E9 (0037). E9's annual sequence does NOT block on this.

**Reversibility** — Two-way (read-only observation; feeds a config-level node set).

**Acceptance** — [ ] Dynamics panel set captured; [ ] O-10 (0033) assumption confirmed or corrected; [ ] E9 (0037) dynamics grid finalized on the evidence.

**Standing DoD (applies to the dependent build items)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — Run before E9 (0037) dynamics grid CLOSES. `needs_live_verify`.

---
id: "0034"
title: "DECISION O-11: Income treemap `=GDP` tile + data-driven signs on bridge/income identity"
status: backlog
class: DECISION
priority: P0
owner: —
implements: SPEC.DELTA §3 O-11, §1 E6 / §E9
blocks: ["0027", "0037"]
links:
  - platform/work/SPEC-render-pipeline-target.DELTA-6-14.md
---
**Decision needed** — Two coupled questions: (a) does the income-formation **treemap** carry a `=GDP` total tile, or only the components? (b) Are the `+`/`−`/`=` signs on the expenditure bridge and the income identity **data-driven** (from an `isTotal`/sign field on the row) or **encoding-driven** (computed by the renderer)?

**Reasoned DEFAULT (build this unless told otherwise)** — Signs + totals are **data-driven**: the `isTotal` field (prov. 1743/384) marks the closing/total row and its sign, so the chart↔table dual-view (C7) round-trips the +/−/= semantics losslessly (img_9 shows the bridge as a table with `import = −55 669.6` and `=GDP = 104 598.1` rows). The **treemap must NOT double-count** the `=GDP` total tile — it shows the components; the total is the treemap's implicit whole, not a sibling tile.

**Alternative** — Treemap includes an explicit `=GDP` tile (would double the area). Rejected unless the design intends it.

**Reversibility** — Two-way door (a data-field flag + a renderer switch; both config/registry).

**Blocks** — 0027 (E6 income treemap + expenditure bridge) and 0037 (E9 SNA closing-balance signs). Both build on the DEFAULT; FF-BRIDGE-CLOSES asserts the signed components sum to the `isTotal` bar.

**Owner action (~2 min)** — Confirm data-driven signs + no `=GDP` tile in the treemap, or specify otherwise.

**Standing DoD (applies to the dependent build items):** rendered result must match `scriness/` achieved ONLY through highest-concept architecture — no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics (visibleWhen/perspective/effects) covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

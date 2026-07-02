---
id: "0037"
title: "E9: SNA `/accounts` `hbar-diverging` T-account sequence + per-account sub-charts (E8 pivot = table view)"
status: backlog
class: G
priority: P2
owner: —
implements: SPEC.DELTA §E9, §2, §5 FF-BRIDGE-CLOSES / FF-DIVERGING-TREE-ORDERED
depends_on: ["0016", "0017", "0031", "0033", "0034", "0036", "0029"]
links:
  - platform/work/SPEC-render-pipeline-target.DELTA-6-14.md
  - platform/work/SPEC-render-pipeline-target.md
---
**Goal** — The SNA `/accounts` page renders the T-account **sequence** (I. Production → II. Generation of income → III. Primary distribution → IV. Secondary distribution → V. Use of income → VI. Capital) as a hierarchical two-sided **`hbar-diverging`** bar (Resources/Uses), with per-account sub-charts; the E8 pivot (0029) is this page's table view (img_10).

**Implements** — SPEC.DELTA §E9. `hbar-diverging` already registers to `HBarDivergingChart` in `chart-renderers.tsx` (prov. 377) — this is config-wiring against an existing renderer, not a new chart type.

**Files / modules touched** — `/accounts` page config (sequence node, per-account sub-charts, account `select`, perspective gating); no new renderer.

**Encoding** — `series` = Resources(R)/Uses(U) from the `side` dim (two-colour diverging: რესურსები / გამოყენება) · `label` = flow label + code (P1/D1/B1G…) · `isSeparator` = account-group header row (I–VI) · `isTotal` = closing-balance bar (B1G/B2G/B5G/B6G/B8G/B9) · `level`/`parentId` = tree · negative balances extend left (B9 = −2 836).

**DataSpec** — `query` over accounts + pipe: `join account codelist (order)` → `join aggregates codelist (isClosing)` → `sort by order → side[R,U] → seqPos → isClosing` → shape to diverging rows (prov. 379–437). Warmed (query+pipe).

**Dependencies** — 0016 (C1: balances via SSOT), 0017 (C2: warm per (account,code,side) at the pinned year), 0031 (O-8: signed `isTotal` encoding shared with E6), 0033 (O-10: dynamics-mode panel set — annual sequence builds now; dynamics grid closes after LV-3/0040), 0034 (O-11: data-driven signs, no double-count), 0036 (C7: the table view), 0029 (E8 pivot = this page's table view).

**Acceptance criteria (incl. fitness functions)**
- [ ] Annual sequence renders as `hbar-diverging` (`perspective-is year`): 6 account groups I–VI as `isSeparator` rows, `series` = Resources/Uses, `isTotal` closing balances, hierarchical (`level`/`parentId`), negative balances extend left.
- [ ] Sorted account `order` → side[R,U] → `seqPos` → closing; no orphan `parentId`.
- [ ] Per-account sub-charts (production P1/P2/B1G · income B1G/D1/…/B2G · capital B8G/D9R/P5/B9) render; KPIs B5G 196 071 · B6G 215 562 · B8G 3 871 · B9 −2 836.
- [ ] E8 pivot (0029) is wired as this page's C7 table view (dual-view of the same warmed rows).
- [ ] **FF-BRIDGE-CLOSES**: the SNA closing balances equal their component sum (the identity holds numerically; shared with E6).
- [ ] **FF-DIVERGING-TREE-ORDERED**: `hbar-diverging` rows are ordered account→side(R,U)→seqPos→closing with group separators present; no orphan `parentId`.
- [ ] Balances via C1 (FF-FORMAT-SSOT); warm per (account,code,side) at the pinned year (FF-WARM-COVERS-RENDER).
- [ ] Account `select` ("ყველა" = all groups) + time binding per perspective react correctly; empty account → empty sequence with group separators retained.
- [ ] Dynamics-mode grid finalized after LV-3 (0040); annual sequence does not block on it.
- [ ] `npx tsc --noEmit` EXIT=0.

**Standing DoD (applies)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — Config-wiring against an existing renderer (`HBarDivergingChart`), not a new chart type. Two-way door at config level.

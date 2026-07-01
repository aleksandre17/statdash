---
id: "0028"
title: "E7: Real growth bar + contribution bar + per-capita line (wiring + verification)"
status: backlog
class: G
priority: P2
owner: —
implements: SPEC §2 E7, §3
depends_on: ["0016", "0017", "0020"]
links:
  - platform/work/SPEC-render-pipeline-target.md
---
**Goal** — Real GDP growth bars (% axis, negatives below zero), contribution-to-growth bars (no clipped labels), and a per-capita line where 2014 is NOT 483.

**Implements** — SPEC §2 E7 + §3.

**Files / modules touched** — GDP dynamics chart config (real-growth bar, contribution bar, per-capita line).

**Dependencies** — 0016 (C1), 0017 (C2), 0020 (C6-d — per-capita row-selection). Note: the `mean` of the real-growth series feeds the E1 avg-real-growth KPI (0019/0022), not this chart directly.

**Acceptance criteria (incl. fitness functions)**
- [ ] Real growth bar: vertical bars per year, y = % (`sign_pct`), `axes.y.decimals:1` → uses `fmtNum(v,1)` NOT compact (a rate axis wants `10, 5, 0, -5`); negative bars render below zero (`img_3` 2020 = −6.3).
- [ ] Contribution bar: per-year % contribution; `hideOverlappingLabels` + responsive rotate (AR-14) so year labels never clip.
- [ ] Per-capita line: x=year y=usd (`img_3`/`img_4`: 3 281→10 297); **the 2014 point must NOT be 483** (FF-ROW-UNAMBIGUOUS, 0020) — or, if O-7 finds a seed-data error, routed to database-architect. Axis → compact or honest.
- [ ] Filter/locale/warm as E3 (window enumeration, per-year warm, locale glyphs); FF-WARM-COVERS-RENDER (0017) green.
- [ ] `npx tsc --noEmit` EXIT=0.

**Standing DoD (applies)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — Rate axis explicitly opts OUT of compact (decimals:1). Two-way door.

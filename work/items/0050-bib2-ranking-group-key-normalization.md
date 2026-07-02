---
id: "0050"
title: "BI-B2: duplicated/collapsed region labels — ranking aggregate group key = the ranked dim only (roll up `time`)"
status: backlog
class: G
priority: P0
owner: —
implements: SPEC.DELTA-new12 §2 Bug 2, §5 FF-RANKING-ONE-ROW-PER-CATEGORY
depends_on: ["0043", "0016"]
links:
  - platform/work/SPEC-render-pipeline-target.DELTA-new12.md
---
**Goal** — The "GDP — by region" table/bar must show one row per region (10 distinct regions), never a region repeated (img_10 pairs) or every row identical (img_11 all Tbilisi). img_7 (annual, all-sector, SUM 80 882.7) is the correct baseline this violates once the range perspective is active.

**Implements** — SPEC.DELTA-new12 §2 Bug 2. Same dimension-underspecification family as C6/DRIFT-4 (a decomposition that keeps an un-rolled-up dim). Root-cause fix.

**Root cause** — `apps/api/provisioning/geostat.provisioning.json:3854-3896` (the `geo-map-range` node data). The pipe aggregates:
```jsonc
{ "agg":"sum", "by":["geo","time"], "op":"aggregate" }   // line 3857-3862
```
with query `time:{"$ctx":"toYear"}`. **`time` is retained in the group key.** For a per-region ranking the group key must be `["geo"]` only. When the range perspective leaves `toYear` unpinned (or the window binding folds multiple years into the read), the fetched rows span N years → `aggregate by [geo,time]` emits **one row per (geo,year)** → the `label:"label"` encoding shows only the region name → duplicate/collapsed labels (img_11 = one region × N years = all-same label). The `lookup`+label join is correct; the extra unpinned dim in the group key manufactures the phantom rows.

**Files / modules touched**
- `apps/api/provisioning/geostat.provisioning.json:3857` — ranking group key = `by:["geo"]` (the ranked dim only); roll up `time` per O-13 (0043): DEFAULT = pin `time=toYear` (terminal-year snapshot) so exactly one year is read, OR sum over the window if O-13 selects windowed sum.
- Cross-check the annual "by region" spec (prov. ~3300s): if it also uses `by:["geo","time"]` and only coincidentally yields one row because annual pins a single `time`, normalize BOTH to `by:["geo"]` (make illegal states unrepresentable, not accidentally-correct).

**Dependencies** — 0043 (O-13: which single value each region shows — terminal snapshot vs windowed sum); 0016 (C1: the x-axis ticks on this ranking also route through the compact formatter). Config-only fix (no engine change).

**Acceptance criteria (incl. fitness functions)**
- [ ] Range-mode "by region" shows exactly the distinct region count (10), each region once, correct localized labels (via BI-B1), values per O-13.
- [ ] Group key on the ranking pipe = `["geo"]`; no unpinned secondary dim retained; annual "by region" normalized to the same shape.
- [ ] **FF-RANKING-ONE-ROW-PER-CATEGORY**: a ranking/breakdown pipe's post-aggregate row count == distinct category count; a repeated category fails.
- [ ] `npx tsc --noEmit` EXIT=0 (provisioning schema validates).

**Standing DoD (applies)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — Composes with region-select ∧ sector-select (img_11 = Tbilisi ∧ transport exposes this). Land after BI-B1 so the (now single) row's label is also localized. Two-way door.

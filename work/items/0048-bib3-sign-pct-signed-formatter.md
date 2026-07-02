---
id: "0048"
title: "BI-B3: `sign_pct` dropped negative sign — signed-formatter SSOT (drop `Math.abs`)"
status: backlog
class: G
priority: P0
owner: —
implements: SPEC.DELTA-new12 §2 Bug 3, §5 FF-SIGN-PRESERVED; extends SPEC §C1 FF-FORMAT-SSOT
depends_on: ["0016"]
links:
  - platform/work/SPEC-render-pipeline-target.DELTA-new12.md
---
**Goal** — The real-growth table must show `2020 = -6.3%` (not `6.3%`), agreeing with the chart (img_2 plots −6.3 below zero). Smallest, highest-visibility fix in this delta — **land first**; it gates trustworthy verification of every other new state.

**Implements** — SPEC.DELTA-new12 §2 Bug 3 (C1 signed-formatter SSOT). Root-cause fix, not a symptom patch.

**Root cause** — `packages/core/src/data/transform/formatters.ts:9`, the `sign_pct` formatter:
```ts
const fmtSign = (n) => `${n > 0 ? '+' : ''}${fmtNum(Math.abs(n), 1)}%`   // sign_pct
```
`Math.abs(n)` strips the sign, and the ternary only prepends `+` for positives → `−6.3` becomes `"" + "6.3"` = `"6.3%"`. The table column uses `format:"sign_pct"` (prov. 2250); the chart path uses `axes.y.decimals:1` → `fmtNum(v,1)` which renders `-6.3` — hence table and chart disagree. `fmtPct` (line 10) has the identical `Math.abs` — fine for provably-non-negative shares, wrong the moment a signed datum flows through it.

**Files / modules touched**
- `packages/core/src/data/transform/formatters.ts:9` — `sign_pct` becomes signed: `const fmtSign = (n) => `${n > 0 ? '+' : ''}${fmtNum(n, 1)}%`` → `+7.9%` · `-6.3%` · `0%`. `fmtNum` carries the minus.
- Audit `fmtPct` (line 10): leave magnitude-only ONLY if every `pct` column is provably non-negative (shares); any signed column must use `sign_pct`.

**Dependencies** — 0016 (C1): this extends the C1 formatter SSOT and FF-FORMAT-SSOT with the signed case. Trivial; no data/DB input.

**Acceptance criteria (incl. fitness functions)**
- [ ] `getFormatter('sign_pct')(-6.3) === '-6.3%'`; `(7.9) === '+7.9%'`; `(0) === '0%'`.
- [ ] No `Math.abs` inside `sign_pct`.
- [ ] Chart and table format the SAME signed datum identically (both read the C1 registry).
- [ ] **FF-SIGN-PRESERVED**: `getFormatter('sign_pct')(−x)` renders a leading `-`; extends FF-FORMAT-SSOT with a signed round-trip case.
- [ ] `npx tsc --noEmit` EXIT=0.

**Standing DoD (applies)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — One-line seam, wide trust impact. Land before BI-B1/BI-B2 so verification of the new states is trustworthy. Two-way door.

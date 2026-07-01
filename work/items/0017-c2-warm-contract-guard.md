---
id: "0017"
title: "C2: Warm-contract guard — extractRequirements coverage + FF-WARM-COVERS-RENDER"
status: backlog
class: M
priority: P0
owner: —
implements: SPEC §1 C2, §4 FF-WARM-COVERS-RENDER / FF-NO-EMPTY-REQS-FOR-READING-SPEC
depends_on: ["0010"]
links:
  - platform/work/SPEC-render-pipeline-target.md
  - platform/work/effect-variable-architecture-drift.md
  - platform/work/static-era-regression.md
---
**Goal** — Make the warm===render requirement contract *enforced, not conventional*. Every data-reading node/KPI contributes its exact read-set; no spec warms `[]` while reading. Convert the standing static→async cold-crash vector into a caught-at-CI defect.

**Implements** — SPEC §1 C2. Invariant I-2 (Warm===Render). Protects every element.

**Root cause** — The async `ApiStore` throws on cold `querySync`; the old sync `ExternalStore` never did (the `5881a5b`/`ba9d1a9` failure family). Two latent gaps: (1) `pivot` and `transform` DataSpec types return `[]` from `extractRequirements` (`spec.ts:228-230`) → any panel lowering to `transform`/`pivot` warms nothing → cold-crash on async; (2) no structural gate asserts every registered node/KPI spec contributes to the warm set — new features re-regress silently (the #1 recurring trap).

**Files / modules touched**
- `packages/core/src/data/spec.ts` (~228-230) — `extractRequirements` covers every read-issuing spec type. For `pivot`/`transform`: emit the requirements of the upstream `query`/base read the pipe consumes. Genuinely read-free specs must be *provably* read-free (asserted by C2-c), not defaulted to `[]`.
- `packages/react/src/engine/targets/warm.ts` (`collectRequirements`) — shares the SAME visibility gate (`visibilityGate.ts`) AND the SAME extractor as `interpretSpec`. Confirm the geograph node's `data.query` is walked (`node['data']` → `extractRequirements`).
- KPI side: `extractKpiRequirements` already covers `t-1`, `cagr` from+to, `share` num+denom, `metric` components — keep.
- New fitness test (per §4).

**Dependencies** — 0010 (O-2: transform/pivot warm = nested query reqs; owner names any pipe op that hits the store directly). Prerequisite for trustworthy verification of C4/C5/C6/E#.

**Acceptance criteria (incl. fitness functions)**
- [ ] C2-a: `extractRequirements` emits the nested-query reqs for `pivot`/`transform`; no read-issuing spec returns `[]`.
- [ ] C2-b: warm walk and render read share one visibility gate and one extractor (warm===render SSOT).
- [ ] **FF-WARM-COVERS-RENDER**: per page × perspective × locale — build `warmSet`, then render against a store that THROWS on any `querySync` key ∉ `warmSet`; a cold read = build failure. (The single highest-value guard after C1.)
- [ ] **FF-NO-EMPTY-REQS-FOR-READING-SPEC**: no DataSpec type that issues a store read returns `[]` from `extractRequirements` — covering ALL read-issuing branches that can return `[]`: `pivot`/`transform` (`:230`) AND the `'all'`/unbounded reads of `point-series` (`:130`), `timeseries` (`:154`), and `growth` (`:163`). Each is either covered (emit an unbounded req, the way the `query` `rangeMode` branch does at `:220`) or provably read-free — the three `'all'` branches must NOT be left unaddressed (else false-red on legit branches, or a naive whitelist masks a real cold path).
- [ ] C2-d registration rule recorded as a binding acceptance criterion on every new data-reading node/KPI (see each E# item).
- [ ] `npx tsc --noEmit` EXIT=0.

**Standing DoD (applies)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — C2-d is binding on C3/C5/C6 and every E#: a new data-reading type is not "done" until it (1) registers reads and (2) honours the visibility gate. Prerequisite. Two-way door.

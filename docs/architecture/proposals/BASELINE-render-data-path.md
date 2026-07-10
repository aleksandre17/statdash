# BASELINE — Render / Data-Path Invalidation (AR-49 V0 honesty gate)

> **Status:** RECORDED · **Date:** 2026-07-10 · **For:** ADR-024, the non-regression baseline the V3 render-switch proves against.
> **Reproduce:** `pnpm vitest run apps/api/src/provisioning/extractDeps-corpus.fitness.test.ts --disableConsoleIntercept` (emits `[AR-49 V0 BASELINE]`). The test also LOCKS the honesty invariant (exact busiest fan-out `<` total nodes), so a regression is a red gate, not a stale doc.

## Why measure first

"Measure before you change" (SPEC §4 honesty gate). The reactive-graph case does **not** rest on today's frame times — today's pages are dozens of nodes over in-memory stores, so coarse re-render is likely not yet a user-visible latency problem. The case rests on: (a) the shipped-bug record of the shadow graph (N34c, AR-36 staleness) — correctness-by-construction; (b) the Constructor-era load profile (per-keystroke live edit) + the ApiStore network era (exact invalidation = planned prefetch); (c) 60fps cross-filter interaction. The number that matters for V3 non-regression is therefore the **invalidation fan-out**, not wall-clock latency — how many nodes re-evaluate per state change.

## The current invalidation model (code-grounded)

On any filter / perspective / locale change, `NodePageRendererInner` rebuilds `RenderContext` and **re-walks the entire node tree**; `resolveNodeRows` re-runs per data node. Cost/correctness are rescued by the hand-rolled cache constellation (ADR-024 §1). Net: the effective invalidation fan-out of EVERY source is **coarse = all renderable nodes**. Exactness is approximated per-node by `specDimKey` (dims only — it never captured params/vars/perspective/locale/store as first-class axes).

## Measured baseline — geostat provisioning corpus

| Metric | Value |
|---|---|
| Renderable nodes | **170** |
| Data-bearing nodes (carry a measure) | 18 |
| Distinct dependency sources named | 19 |
| Locale-dependent nodes | 122 |
| **Coarse fan-out per state change (TODAY)** | **170** (whole tree) |

**Exact fan-out per source** (nodes whose `extractDeps` set actually contains the source — what the graph will re-evaluate):

| Source | Exact dependents | vs coarse (170) |
|---|---|---|
| `toYear` | 35 | 4.9× fewer |
| `fromYear` | 29 | 5.9× |
| `sector` | 16 | 10.6× |
| `geo` | 14 | 12.1× |
| `time` | 13 | 13.1× |
| `perspective` | 10 | 17× |
| `account` | 4 | — |
| `year` | 3 | — |
| `_regionTitle` | 3 | — |
| `measure`, `spanFrom`, `spanTo` | 2 each | — |
| `region`, `_byDims`, `_sortBy`, `_sortDir`, `_xDim`, `_seriesDim`, `_mark` | 1 each | — |

## Interpretation

A single `geo` cross-filter selection re-evaluates **14** nodes, not 170 — the coarse path over-fires ~**12×**. The range-mode time bounds (`toYear`/`fromYear`) are the widest sources (35/29) — they gate the largest sub-trees. The derived vars (`_byDims`, `_xDim`, …) each fan out to exactly 1 node (the AR-36 runtime pivot), confirming the graph's per-node grain is meaningful.

## The V3 non-regression contract

After the render-switch, for each source S the LIVE re-evaluation count must satisfy: `count(S) ≤ 170` (never worse than coarse) **AND** `count(S) == exactFanout[S]` recorded above (the graph fires exactly its dependents). `FF-EXACT-INVALIDATION` (scaffolded) enforces the equality; the golden-DOM corpus enforces output identity. Writing an equal value must re-evaluate **zero** nodes.

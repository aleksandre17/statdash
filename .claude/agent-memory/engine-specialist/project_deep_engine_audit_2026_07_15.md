---
name: deep-engine-audit-2026-07-15
description: Deep-expedition engine-core findings (2026-07-15) — the honest-state Cell seam design for W1, and the claimed-but-unbuilt lineage/provenance gaps in AR-50
metadata:
  type: project
---

Read-only deep study of packages/core/expr/contracts, delivered to
`docs/architecture/audit/DEEP-2026-07-15-engine-core.md` (one of 5 parallel lenses;
lead synthesizes). The invisible truth: **the engine computes almost everything
needed for statistics-grade honesty + lineage, then throws it away at three seams.**

**The non-obvious findings (code-cited, verified against live tree):**
- **Honest-state grammar exists but is discarded.** `QueryResult.state`
  (loading/done/error, store.ts:110) dies at `querySync` (bare EngineRow[]);
  `storeVal ?? 0` (store.ts:195) collapses genuine-0 / no-data / unbound / cold-cache
  into one `0`. `interpretKpi` formats to a STRING (kpi.ts:82) before any honest-state
  decision can be made. This is the ENGINE origin of "the canvas lies" — a react-only
  veil would be a symptom patch.
- **Lineage/provenance = most-repeated ADR claim, NOT built.** MetricResolver emits no
  provenance (metric-resolver.ts:114). `withMetricProvenance` fills from ONE metric,
  never walks `calc.inputs` (metric.ts:367). Reactive graph has NO `metric:` source —
  `deps.measures` extracted (extractDeps.ts:88) but `depsToSources`/SRC (compilePage.ts:51)
  map only dim/param/var/perspective/classifier/store/locale. Editing a MetricDef.calc
  invalidates NOTHING.
- **Additivity guard is path-dependent, not measure-dependent.** `guardNoSumOfRatio`
  (metric-grain.ts:79) protects only `evalMeasureAtGrain`; the pervasive `storeVal`
  OLAP-cell sum + `readMeasure` code-sum (kpi.ts:56) sum ratios across unpinned ambient
  dims unguarded. FF-NO-SUM-OF-RATIO bites a door almost nobody walks through yet.
- **The `metric` DataSpec (AR-50 keystone) has ZERO authored consumers** — only editors
  + e2e; no page config binds `type:'metric'`. Built noun, no sentence written in it.
- OBS_STATUS `c` (confidential) is a decorative badge — value never masked (F7).
- Kernel is mid-Strangler: honest kernel = ~3 nouns (query/metric/transform);
  growth/ratio-list still bespoke resolvers, demotion is the parked ⛔ one-way door.

**My recommended W1 seam (PM-1) — the honest-state Cell:** a new `core/data/cell.ts`
leaf: `ValueState = ok|no-data|unbound|loading|error|masked`, `Cell {value:number|null,
state, status?}`. Add `storeCell` BESIDE `storeVal` (leave storeVal byte-identical),
decide `unbound` BEFORE the store read, add optional `KpiDef.state`. Additive, reversible,
arrow-clean. Do NOT retype EngineRow→Cell[] big-bang (that's a later accretion).

**Ranked power moves:** PM-1 (honest-state seam, W1 dep) + PM-2 (one `SRC.measure`
graph edge → lineage-as-read) are highest-leverage, cheap, reversible. PM-3 (additivity
to resolution SSOT) = correctness, behavior-changing, gate it. PM-4 (provenance
composition) = design-now/build-when-W2-gives-a-consumer. PM-5 (dialect collapse) = dead
last, gate-fired, after W5.

**How to apply:** if W1 asks for the engine honest-state seam, PM-1 above is the design.
If AR-50 M-SQ continuation resumes, F3 (lineage edge) and F5 (adoption) are the real gaps,
not more algebra — the engine is AHEAD of its consumers; refuse building more unreachable
power. See [[ar50-semantic-layer]], [[reactive-graph-track]], [[reference_measure_ref_seam]].

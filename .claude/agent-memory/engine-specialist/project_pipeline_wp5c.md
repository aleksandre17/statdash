---
name: pipeline-wp5c
description: ADR-046 W-P5c LANDED — grain-∅ governed source head now BROWSES (base crack CLOSED live); calc-browse coordinate seam ESCALATED; ⛔ door held
metadata:
  type: project
---

ADR-046 "the pipeline is the spine" (card `work/items/0082`). **W-P5c LANDED 2026-07-18**
(commit `37bf4fd` on main; card log `c29f8cd`). Implements **ADR-046 Addendum 2** (the lead's
DECIDED browse semantics — supersedes the W-P5b Get-grain options with: a grain-∅ governed head
IS the metric's observation browse, NO injected default grain). Builds on [[pipeline-wp5a]].

**The browse lowering (`registry/pipeline-resolver.ts`).** `readSource`'s governed branch forks on
`hasSourceGrain` (exported SSOT grain predicate): **NO grain ⇒ `browseMetrics`**; explicit grain ⇒
the unchanged shaped M2 read. `browseBaseMetric` delegates to the `query` resolver via
`{query:{measure: ref}}` — resolveMeasureRef-expanded, **byte-identical to the STEWARD obs read**
(SPEC §9 E1). `browseCalcMetric` enumerates the metric's time-axis members (a TIME-unbounded
component obs scan) and evaluates **`resolveMetricValue` per member** — year-by-year values,
**honest null at the first-period edge** (`value: v ?? null`, ADR-045, never a fabricated 0).

**Warm ⊇ read — ONE head→obs SSOT `sourceHeadObs` (exported).** Steward head warms its `query`;
a governed BROWSE head warms `{measure: metrics}` (base codes / calc component codes) under the SAME
`queryReadObs` key both react warms align to — `useNodeRows.specHeadObs` + the panel
`usePipelineSourceRows` (de-forked from its steward-only `'query' in head` check).
`pipelineRequirements` warms the grain-∅ browse as the TIME-unbounded superset (strip TIME_DIM —
mirrors the point-series/query-rangeMode branch). See [[reference_source_kind_spectrum]],
[[reference_measure_ref_seam]], [[reference_desugar_seam]].

**Gate:** tsc -b EXIT 0 · full vitest **3806 passed | 0 failed** (493 files, panel incl.) · panel
pipeline-preview+workbench 80/80 (FF-JOURNEY-PIPE) · eslint clean 6 files · dist rebuilt.
FF-PIPELINE-EQUIV apps/api shadow 11/11 (committed baseline byte-identical — browse changes no
stored contract) + 6 new browse fixtures (base ≡ steward · browse ≠ scalar · calc 12.5/11.111 +
honest first-period null · browse+filter composes) · FF-BIND-PARITY 8/8 · warm-covers/warm-key.

**LIVE (:3013, `probe-wp5c-journey.mjs`) — BASE crack CLOSED, calc leg BLOCKED.** GREEN: Get
`accounts.compensation` → **200 REAL observation rows**, governed headers, rawLeaks `[]`,
consoleErrors `[]`; Filter+Aggregate flow; calc `gdp.growthYoy` renders a 2010–2023 column with an
**honest `—` first period**. Shots → `work/authoring-truth/wp5c/`.

**⛔ FINDING (ESCALATED, not papered) — the CALC growth VALUE reads -100 live; 0081's last leg NOT
closed → the ⛔ door did NOT fire (demotion un-committed, legacy editors untouched).** Root cause:
`gdp.growthYoy` is NATIONAL (component `gdp.current`, no geo), but the probe element is on the
regional page whose ctx pins `geo=adjara`. `resolveMetricValue` honors that FOREIGN pin →
`storeValAt(gdp.current, {geo:adjara,time:y}) = 0` → the expr folds `0/prev` (and `0/0`) to **-100**
(a Law-11 lie). The engine lowering is CORRECT where the metric HAS data at the coordinate (the gate
proves 12.5/11.111 + null on GDP@GE). Two architect-owned decisions: **(1)** should a grain-∅ browse
strip a FOREIGN element pin (a dim the metric doesn't range over)? — needs the metric's DECLARED
natural dims (AR-49 `DimensionDef`/`manifest.dimensions`) to tell natural from foreign, AND a
metric-natural warm ctx (the react per-req warm `reqCtx = {...ctx.dims, ...r.dims}` **re-merge wall**
means a requirement alone can NEVER strip a ctx pin — a hazard class worth remembering); **(2)**
`resolveMetricValue` cannot distinguish genuine-0 from no-data (storeValAt returns 0 for both), so a
no-data component folds to -100 not honest null — the `storeCell`/`ValueState` honest-state seam
([[reference_cell_honest_state_seam]]) is the deeper cure. Recommendation to architect: (a)
metric-natural browse via the declared-dims catalog, with (b)'s honest-null as the Law-11 floor.

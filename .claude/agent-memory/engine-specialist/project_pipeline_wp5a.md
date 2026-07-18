---
name: pipeline-wp5a
description: ADR-046 W-P5a LANDED — desugarToPipeline WIRED live for query/transform/pivot; timeseries/growth/ratio-list BLOCKED on a value-cell source variant (escalated)
metadata:
  type: project
---

ADR-046 "the pipeline is the spine" (card `work/items/0082`). **W-P5a LANDED 2026-07-18**
(commit `2efc36b` on main), the ENGINE half of W-P5. Builds on [[pipeline-wp4]] (shadow-only
desugar). The ⛔ default-EMISSION flip + workbench conversion are W-P5b (panel, NOT engine).

**The live switch (task 1) — `desugarToPipeline` wired into the live `desugar()`**
(`packages/core/src/data/desugar.ts`) for `query`/`transform`/`pivot`. Stored configs now
resolve through the ONE `pipeline` spine at read/warm time (never rewritten — expand-contract).
Byte-identical BY CONSTRUCTION: the requirement contract is the SAME shared kernel
(queryRequirements / read-free), so the apps/api FF-PIPELINE-EQUIV **committed baseline still
matches** post-switch. pivot lowers via `desugarToPipeline(desugarPivot(spec))` (transform→pipeline).

**⛔ THE FINDING (task 2 only PARTIALLY dischargeable) — escalated to the architect.**
timeseries/growth/ratio-list CANNOT byte-identically lower to the pipeline spine. They are the
store-aware VALUE-CELL specs: timeseries→`point-series` (per-coord storeValAt sum + a `pct` row),
growth→YoY via storeVal(atTime) prev/cur, ratio-list→per-pair storeVal scalar ratio. NONE is
expressible as a `{metrics|query|rows}` `source` head + a pure tail — proven empirically:
timeseries legacy `{id,label,value,pct}` vs a metrics-source `{…,series,metric}` (no pct);
growth's 2 YoY rows vs a query-source's raw obs; ratio-list's 1 computed row (value:250) vs raw obs.
The MetricResolver emits `{...tuple,id,label,series,metric,value}`; PointSeriesResolver emits
`{id,label,value,pct}` — structurally different. Folding them needs a **4th store-aware
`SourceStep` variant** (a value-cell/point read) — a Class-M contract change on the union, owned by
the architect, NOT a build-wave decision. Kept on their direct/point-series resolvers; the mission's
EXIT-FAST-on-any-crack discipline FORBIDS forcing them. **W-P5b MUST NOT flip Constructor emission
for these three to pipeline** until that variant lands, or it cracks row parity. My recommendation:
keep them as permanent convenience front-doors (YAGNI) until a journey demands a value-cell pipeline
head; the ⛔ FF-PIPELINE-EQUIV-over-all-configs gate must exclude/special-case them.

**Row-parity test RE-ARMED (a reusable trick).** Once the live switch lands, `interpretSpec(query)`
routes through the spine, so `interpretSpec(spec)` vs `interpretSpec(desugarToPipeline(spec))`
collapses to pipeline-vs-pipeline (trivially green — loses meaning). Re-armed
`pipeline-desugar.fitness.test.ts` to compare the spine against the UNTOUCHED legacy resolver
dispatched DIRECTLY from `defaultRegistry.spec(spec.type).resolve(...)` (QueryResolver/
TransformResolver don't desugar → the independent pre-spine oracle). `desugar.fitness.test.ts`
updated: pivot now → `pipeline`; query/transform no longer identity; growth/ratio-list still
identity. The FF-DESUGAR-EQUIV pivot corpus now resolves THROUGH the spine + stays byte-identical =
the empirical pivot proof.

**Task 3 — `useNodeRows` exact-obs warm generalized** (`packages/react/src/engine/useNodeRows.ts`):
new `specHeadObs(spec)` extracts the warm obs key (`queryReadObs`) from a `query` OR a `pipeline`
STEWARD `source.query` head; a governed `source.metrics` head needs no extra warm (generic per-req
warm covers it — the live-proof path); inline/pure = read-free.

**Gate:** tsc -b EXIT 0 · full vitest **3784 passed | 0 failed** (492 files; baseline 3780 → +4) ·
eslint clean on 5 changed · engine dist rebuilt. Parity block green: FF-BIND-PARITY 8/8 ·
FF-PIPELINE-EQUIV apps/api shadow 11/11 · rows net + pivot corpus · warm-covers + warm-read-key.
**LIVE SMOKE blocked on infra** (no container runtime this session, :3013 unreachable) — the switch
is indistinguishable by construction (identical rows); deferred with W-P5b. See
[[reference_desugar_seam]], [[reference_measure_ref_seam]], [[reference_source_kind_spectrum]].

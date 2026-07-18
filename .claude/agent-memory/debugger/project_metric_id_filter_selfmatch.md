---
name: metric-id-filter-selfmatch
description: A metric-id-migration text substitution silently zeroed queries by leaking the metric-id into a raw filter.measure key that the engine never resolves — diagnosed 2026-07-17
metadata:
  type: project
---

Commit `04b39af` ("migrate the corpus onto governed metric handles") did a naive
find-replace of every `"measure": "<rawCode>"` string in
`platform/apps/api/provisioning/geostat.provisioning.json`, including inside
`filter: {...}` blocks that already carried a redundant self-referential
`"measure"` key (pre-migration this was harmless — filter.measure duplicated
the top-level measure, both raw codes). Post-migration `filter.measure` held
the ungoverned metric-id literal (`'gdp.current'`, `'regional.gva'`, ...).

The asymmetry that breaks this: `resolveQueryMeasures`/`resolveMeasureRef`
(`packages/core/src/data/metric.ts`) resolves the TOP-LEVEL `spec.measure` to
its raw SDMX code — but `matchesFilter` (`packages/core/src/data/store-filter.ts`)
treats every `filter.<dim>` value as a LITERAL dimension-equality pin, with NO
metric-id resolution pass. A `filter.measure` holding a metric-id therefore
never equals any observation's stored raw code — 0 rows, for ANY backing store
(golden fixture in tests AND the live postgres-backed API alike — confirmed via
curl against the live `/api/bootstrap` payload on the deploy host, which carried
the identical 20 redundant `filter.measure` duplicates before the fix landed).

This one root cause presented as TWO seemingly-unrelated symptoms: a "golden
drift" (parity test's "closest rendered number" pool had only 3 unrelated
stray values once the real GDP data vanished, coincidentally landing near the
golden target and looking like a data revision) AND a regional-page KPI
"honest no-data" state in studio. Falsifying "golden drift" required reading
the actual console log line the parity harness emits
(`[engine] query[gdp.current] → 0 rows`) — the rendered "104598" was never
derived from GDP data at all.

**Why:** the existing guard against this defect class
(`platform/apps/api/src/provisioning/config-cube-contract.fitness.test.ts`,
CHECK 2) explicitly resolves `filter.measure` through the metric catalog
before its codelist-existence check ("mirrors the engine's resolveMeasureRef"
— see its own comment) — but the REAL engine does NOT resolve filter values.
The gate's validation-time semantics diverge from run-time semantics, so it
stayed green through the whole regression. This divergence is an open
architectural question (should the engine extend metric-id resolution to
`filter.<measureDim>` uniformly, or should the gate stop being generous and
validate filter values as literal codes only) — flagged to the owner rather
than decided unilaterally, since it changes semantic-layer contract behavior
(ADR-045 territory), not just this one config file.

**How to apply:** when a "measure-ref migration" or similar governed-metric
adoption touches provisioning JSON, grep for `"filter":\s*\{[^}]*"measure"`
(structurally, not textually — nested `{$ctx}` values inside filter blocks
make naive line regex unreliable; a brace/string-aware walker is safer) and
verify every `filter.<dim>` pin is a RAW code, never a metric-id — the engine
never resolves filter values through the metric catalog. See also
[[project_hydrate_append_vs_replace_and_selector_scoping]] for another case
where a plausible "data" hypothesis was falsified by a duplicate/mismatch
mechanism found via evidence, not narrative.

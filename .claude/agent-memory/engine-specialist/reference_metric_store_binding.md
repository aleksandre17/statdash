---
name: metric-store-binding
description: M1 metric→store middle tier — specDataSource (data/metric-store.ts) walks a DataSpec→storeKey; MetricDef.dataSource (Cube.dev pattern); effective-store precedence wired in react
metadata:
  type: reference
---

The Cube.dev "measure names its store" middle tier sits on the live multi-store
routing spine (`buildStoreManifest`/`resolveStore`/node `storeKey`).

- `MetricDef.dataSource?: string` (`packages/core/src/data/metric.ts`) — the
  storeKey a metric lives in. Was an orphan field `datasource` (R1, unused);
  renamed → `dataSource` (camelCase, Cube convention). No live config used it ⇒
  byte-identical. `resolveMeasureRef` now carries it on `ResolvedMeasure`
  (first-metric-wins, same as unit/methodology/agg).
- `data/metric-store.ts` (SSOT for the binding): `specDataSource(spec)` walks a
  DataSpec's measure refs (local `measureRefs`, switch is TOTAL with a `default:
  return []` — a malformed spec like `{kind:'row-list'}` must NOT throw; the
  a11y test passes such stubs through renderNode), resolves each via the one
  `resolveMeasureRef` seam, returns the FIRST metric-declared `dataSource` as a
  plain string. Arrow-clean: react consumes the string, no core→react import.
- React wiring: `effectiveStoreKey(node)` in `resolveNodeRows.ts` (exported, pure,
  testable without a React harness) = `node.storeKey ?? specDataSource(node.data)`.
  `renderNode.ts` (~line 252) sets it as `pageStoreKey` for the node + descendants.
  PRECEDENCE: explicit node storeKey > metric dataSource > page pageStoreKey > 'default'.
- Three seeded cubes (gdp/accounts/regional) — `apps/api/scripts/seed-data-sources.ts`.
- Fitness: FF-METRIC-NAMES-STORE (`metric-store.fitness.test.ts` core +
  resolveNodeRows.test.ts react), FF-MULTISTORE-ROUTES + FF-CONFIG-ROUNDTRIP.
- Note: `resolveStore` caches lazily — in tests call it BEFORE reading `_storeCache`
  (arg-eval order: `expect(_storeCache.get(x)).toBe(resolveStore(...))` reads the
  WeakMap before resolveStore populates it ⇒ undefined). See [[measure-ref-seam]].

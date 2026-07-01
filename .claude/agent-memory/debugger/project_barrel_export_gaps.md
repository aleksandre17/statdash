---
name: barrel-export-gaps
description: "@geostat/engine barrel (engine/core/src/index.ts) had functions defined but not re-exported — surfaces as 'X is not a function' caught inside try/catch and mis-reported as data errors
metadata:
  type: project
---

The `@geostat/engine` public surface is the single barrel `engine/core/src/index.ts`. Several functions existed in their source modules but were never re-exported from the barrel, so consumers importing them from `@geostat/engine` got `undefined` → `TypeError: X is not a function` at call time.

Found missing (added 2026-06-17): `listExportFormats`/`getExportFormat`/`registerExport` (`./data/export`, whose import also runs the side-effect that registers built-in csv/sdmx-json formats), `listTransformOps`/`getTransformStep`/`registerTransformStep` (`./data/transform/step-registry`), `listMetricDefs` + the metric registry (`./data/metric`), `deriveFieldSchema` (`./data/fieldSchema` — barrel exported only the `FieldMeta` *type*, not the function), `registeredKinds` (this one was genuinely missing from `./storeManifest` and was added).

**Why these are insidious:** the missing call often sits inside a try/catch (e.g. `api.ts` walkNode wraps interpretSpec + deriveFieldSchema). The `is not a function` throw is swallowed and reported as `status: 'error'` / a data notice — so the test fails with "expected 'ok' to be 'error'", hiding the real cause. Always read the *captured notice text*, don't trust the rolled-up status.

**How to apply:** When a `@geostat/engine` symbol is "not a function," grep the source for `export (function|const) <name>` — if it exists, it's a barrel-omission; add the re-export to `engine/core/src/index.ts` next to the sibling line for that submodule (additive, two-way-door, 09-B clean). A `./data/export`-style re-export also re-runs registration side-effects, so listX() becomes non-empty. Related: [[vitest4-workspace-removed]].

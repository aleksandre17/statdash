---
name: project-panel-dataspec-editor
description: The Constructor (apps/panel) DataSpec visual editor — its source-of-truth types and the two contract mismatches that surfaced building it
metadata:
  type: project
---

The Constructor app `apps/panel` has a visual DataSpec Query Builder at `apps/panel/src/features/data-layer/` that replaces a toy JSON preview. It produces `DataSpec` objects consumed by the engine renderer.

**Source-of-truth types (all from `@statdash/engine`):** `DataSpec` (9-variant discriminated union, keys in `SPEC_CATALOG`), `TransformStep`, `EncodingSpec`, `ObsQuery`. The editor must emit shapes the engine `interpretSpec`/`applyPipeline` actually accept — see `packages/core/src/config/section.ts`, `data/transform.ts`, `data/encoding.ts`, `sdmx.ts`.

**Why:** Constructor-readiness (root Law 2): config the panel emits must be declarative and engine-valid, no functions, no invented fields.

**How to apply:** When editing/extending the data-layer feature, read the engine types first; the catalog `SPEC_CATALOG` (9 specs) drives the type picker. Two real-config quirks the editors handle: `ObsQuery.measure` is `string | string[]` (normalize), `sort.by` has simple (`by:string,dir`) AND compound (`by:[{field,dir}]`) forms. See [[feedback-conform-engine-types]].

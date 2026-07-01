---
name: transform-split-phase2
description: transform.ts split into transform/ sub-module; Phase 2.1 RawRow=EngineRow alias confirmed
metadata:
  type: project
---
transform.ts (822 lines) was split into 5 files under engine/core/src/data/transform/:
- types.ts       ΓÇö RawRow (= EngineRow alias, Phase 2.1), DeriveExpr, TransformStep, PipelineContext
- formatters.ts  ΓÇö fmtNum, private helpers, FORMATTERS, getFormatter
- steps.ts       ΓÇö all apply* implementations, evalExpr, ExprParser, parseDeriveExpr, aggFn, normalizeAggregate
- pipeline.ts    ΓÇö applyStep, applyPipeline (public API)
- index.ts       ΓÇö barrel re-exporting the full public surface
transform.ts is now a 7-line thin barrel: `export * from './transform/index'`
All callers import from './transform' or '../data/transform' ΓÇö paths unchanged, no caller edits needed.
**Why:** File exceeded 400-line ceiling; Phase 2.1 (RawRow = EngineRow de-duplication) was bundled atomically.
**How to apply:** tsc --noEmit exits 0; 31 engine/core tests pass. The engine/react test suite failure (cannot resolve @geostat/engine) is pre-existing ΓÇö it requires a built dist, not a source issue.
**Critical lesson:** The Write tool does not preserve ┬á (non-breaking space) faithfully when writing from memory ΓÇö it substitutes regular space. Always use PowerShell Set-Content reading from the source file to copy exact bytes when moving code between files. Never reconstruct formatter/i18n strings from memory.

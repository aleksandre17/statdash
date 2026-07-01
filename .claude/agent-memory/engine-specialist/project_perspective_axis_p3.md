---
name: perspective-axis-p3
description: Landed state for P3 of the perspective-axis refactor — the dead by-mode DataSpec capability DELETED wholesale (engine + schema + Constructor + tests), grep-zero across packages/apps. Builds on P2.
metadata:
  type: project
---

# Perspective-axis refactor, PHASE P3 (landed 2026-06-27, builds on [[perspective-axis-p2]])

DELETED the `by-mode` DataSpec capability everywhere. Verified DEAD (0 config uses; the live year/range difference is `when`-gating + node-local `value.type`, NOT by-mode). Byte-identical to render (nothing referenced it). Plan: `platform/work/VISION-mode-as-perspective-axis.v3-PLAN.md` §P3 + analysis §4 E7.

**How to apply:** `by-mode` is gone. DataSpec union is now 9 members: query, row-list, timeseries, growth, ratio-list, pivot, transform, custom (SPEC_CATALOG has 7 — custom is non-constructorReady JSON-only, by-mode removed). Do not re-add it; the perspective spine (P4+) replaces it.

## Deleted sites (full set)
- ENGINE: `data-spec.ts` union member + `ModeId` import (now orphaned, removed) + comment; `resolvers.ts` ByModeResolver class + registration + orphaned `emitDiagnostic`/`diagWarning` imports + PivotResolver comment; `data/spec.ts` _specTag case (dropped now-unused `ctx` param + callsite) + extractRequirements case; `metric-store.ts` measureRefs case + docblock; `validation/pipeline.ts` case + now-unused `mergeResults` helper; `spec-catalog.ts` entry; `discriminant-manifest.ts` DATASPEC_DISCRIMINANTS tuple (the `Exact` guard forced it); `mode/types.ts` ModeDef.dataKey COMMENT only (dataKey FIELD stays — live via contracts manifest + provisioning JSON, P6 territory); `desugar.ts` comment.
- SCHEMA: `contracts/schema/page-config.schema.json` by-mode oneOf branch. **NOTE: this JSON is GENERATED** by `react/scripts/emit-page-config-schema.ts` (gen:schema) from `manifest.specTypes = SPEC_CATALOG`. Removing the catalog entry makes regen omit it; ran `pnpm gen:schema` to confirm hand-edit == generated output.
- CONSTRUCTOR (panel): deleted `ByModeEditor.tsx` + `.test.tsx`; removed from `data-layer/index.ts` barrel, `DataSpecEditor.tsx` (import + defaultSpec case + SpecBody case + comment count 9→7), `coverage.fitness.test.ts` DATASPEC_EDITORS set + 2 comments, `setupCanvasRegistry.ts:42` comment. Panel reuses engine DATASPEC_DISCRIMINANTS (no separate panel manifest).
- TESTS: removed by-mode cases from `spec.test.ts`, `metric-store.fitness.test.ts`, `desugar.fitness.test.ts`, `roundtrip-dataspec.fitness.test.ts` (+ describe-label rename), `constructor.test.ts`, `constructor.fitness.test.ts` EXPECTED_SPEC_TYPES.
- DOC: `packages/CLAUDE.md` DataSpec-types line.

## Gate state (all green)
- geostat typecheck clean; panel `tsc -b --noEmit` clean; lint 0 errors (43 pre-existing react-refresh warnings); check-laws clean; `pnpm build:engine` clean.
- **Full suite 1711 passed / 66 skipped / 0 failed** (1777). −8 vs P2's 1719 = exactly the deleted by-mode test cases.
- grep `by-mode|byMode|ByMode|bymode` over packages/ + apps/ = ZERO. Only `platform/work/*` historical docs retain matches (non-load-bearing).

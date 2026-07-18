---
name: metric-natural-seam
description: ADR-047 Wave A — data/metric-natural.ts closes the calc-browse −100 lie; foreign ctx pins neutralized to empty-wildcard '', DERIVED from obs not declared
metadata:
  type: reference
---

**`packages/core/src/data/metric-natural.ts`** (ADR-047 Wave A / DECISION 1, commit `00125b5`). Closes the W-P5c −100 FINDING: a grain-∅ calc browse of a NATIONAL metric on a page pinning a FOREIGN dim (geo=<region>) read `storeValAt(code,{geo:region})=0` → expr `0/prev` → −100 (a Law-11 lie). Now reads the metric's NATURAL table → real series + honest first-period null.

**The rule = DERIVED, never declared (Law 5).** Naturality is NOT a `MetricDef` field (the ADR's surprise: nothing declared it, but it's obs-derivable free). `metricNaturalDims(obs, code)` = dims with ≥1 **concrete (non-`_T`) member**. `naturalBrowseCtx(obs, code, ctx)` neutralizes a FOREIGN pin (concrete ctx dim NOT natural AND member absent from obs) to `''`; a NATURAL pin (regional metric) is KEPT; a pin ON `_T` is kept. Returns `{ctx, neutralized}`.

**ONE `''` mechanism, TWO consumers (warm ≡ read across the react re-merge wall `{...ctx.dims,...r.dims}`; `''` wins the spread, matcher+`obsAtCoord`+`isUnsetTime('')` all read `''` unpinned):**
- READ (`pipeline-resolver.ts` `browseCalcMetric`/`browseBaseMetric`): scan whole table via `browseScanCtx(ctx)` (every pin `''` so a FOREIGN pin doesn't zero the ASYNC fetch), derive `naturalBrowseCtx`, per-year `resolveMetricValue` at natCtx.
- WARM (`spec.ts` `pipelineRequirements` grain-∅): warm the whole-table SUPERSET via `browseScanDims(ctx)` = **every** pin `''` (NOT stripped — an omitted dim inherits its ctx pin across the re-merge wall). The prior strip-time-only warm was a latent async cold.

**Hazard learned:** a WARM requirement (no store) can't derive per-metric naturality → it warms the whole-table `''` superset (⊇ the foreign-neutralized read); `orderedMembers` (relative-coord) already frees the navigated dim + drops `''` dims, so the per-year obs read hits the whole-table warm (no cold on ApiStore). `resolveCachedPointRead` resolves the per-year val from the unbounded warm slice (superset).

Gates: FF-BROWSE-METRIC-NATURAL · FF-BROWSE-WARM-COVERS-NATURAL · FF-NATURAL-DERIVED-NOT-DECLARED (`metric-natural.fitness.test.ts`, ApiStore async path incl.). Wave B ([[reference_cell_honest_state_seam]] — `storeCellAt` + `MetricInput.coalesce`) is the honest-null calc floor; the ⛔ demotion door re-opens with Wave A but FIRES only after B. Supersedes the −100 FINDING in [[pipeline-wp5c]].

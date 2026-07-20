---
name: project-panel-workbench-view-activation-stepa
description: ADR-046 Add.5 / ADR-051 DU4 Step A — folded data kinds OPEN the three-pane workbench via a self-maintaining accept-list; value-cell head is read-only
metadata:
  type: project
---

Step A of the ADR-046 Add.5 activation (ADR-051 DU4 line): folded data kinds now OPEN the three-pane pipeline workbench instead of the DU3 fallback lane.

**The gate is the desugar SSOT (self-maintaining):** `toWorkbenchModel` (workbench/workbenchModel.ts) runs any non-`pipeline` spec through `desugarToPipeline` and accepts iff the result is actually a `pipeline`. So `query`/`transform`/`pivot`/`timeseries`/single-code `growth` open the panes; not-yet-folded kinds (multi-code growth, ratio-list, row-list, metric) return identity → non-pipeline → `null` → fallback lane. No hand-kept kind list to drift.

**Value-cell head (`{op:'source', over, code, coords}`, Add.4) is READ-ONLY in the workbench.** timeseries/single-code-growth fold to it. `sourceMeasure`/`sourceGrainDims`/`isHeadBound` extended to recognize it (measure=`code`, grain dims=`over`+`at` keys). New helpers `isValueCellHead`/`valueCellSummary`. The Get card shows a read-only source summary (measure label + axis + coords) instead of the GetHead picker for these heads; author edits the TAIL. Full head editing is the sequenced follow-up.

**Why:** first owner-VISIBLE payoff of DU4 — the owner sees timeseries/growth as an editable pipeline (Source step 0 + live grid + generated query), not the fallback lane.

**How to apply:** This is a REVERSIBLE read-time VIEW + the existing `query` convert-on-edit (`fromWorkbenchModel`). Do NOT flip the engine `desugar()` runtime resolve switch or default emission (that's DU5, one-way). Revert = shrink the accept-list. The `cells` head (Add.5 ratio-list/row-list fold) is NOT in the engine SourceStep union yet — only the `over`-form exists. See [[project_panel_pipeline_emission_flip_wp5b]], [[project_panel_one_data_workspace]].

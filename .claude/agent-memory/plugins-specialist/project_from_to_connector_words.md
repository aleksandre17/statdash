---
name: from-to-connector-words
description: from→to range-picker connector words must live in slice-meta i18n catalog, not provisioning suffix — INV1 locale-completeness blocks the empty English trailing slot
metadata:
  type: project
---

The dynamics/range year picker renders as two `type:"select"` dropdowns (fromYear/toYear) writing to two separate ctx dims. Making it read "[from] დან [to] მდე" (ka) / "from [x] to [y]" (en) via provisioning `suffix` is BLOCKED.

**Why:** `apps/api/src/provisioning/authoring-locale-complete.fitness.test.ts` INV1 (line ~89) fails ANY LocaleString bag with an empty/whitespace locale value (`{ka:"მდე", en:""}` → partialBag → red). The trailing Georgian postposition **მდე has no non-empty English counterpart** (English "from x to y" ends after the year), and the leading English "from" has no Georgian counterpart. Pure suffix(after)/label(before) slots in the artifact cannot render both reading conventions AND keep every locale slot non-empty. Rendering the current non-empty `{en:"from"/"to"}` suffixes produces garbled English ("2000from 2024to").

This is exactly why RangeShell puts its lead/mid/trail connector words in the SLICE catalog `controls/range/default/meta.ts` (`rangeI18n`, empty ka-lead / empty en-trail) — INV1 only scans the provisioning artifact, NOT slice meta.ts, so empty positional slots are legal there.

**Also blocked:** switching the picker to `type:"range"` (RangeShell). RangeShell is a single-key `"from,to"` number-input control; geostat reads fromYear/toYear as two deeply-wired ctx dims (perspective window binding `$ctx:fromYear`/`$ctx:toYear` + targetKeys writeback, growth `fromDim`/`toDim`, ~40 KPI/chart `$ctx` reads, onExit). type:range breaks that ctx wiring AND downgrades options-driven year dropdowns to raw number inputs.

**How to apply:** the clean fix is a NEW pattern (escalate to architect): an options-driven from→to select-pair control that writes to two ctx keys and pulls lead/mid/trail connector words from a slice catalog (RangeShell's proven empty-slot model). Do NOT try to render `suffix` in SelectShell to get the words — it can't pass INV1 + read correctly in en. See [[merged_vs_defview_label]], [[action_field_ref_seam]].

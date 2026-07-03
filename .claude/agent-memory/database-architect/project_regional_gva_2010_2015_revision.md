---
name: project-regional-gva-2010-2015-revision
description: The 2026-07-03 GeoStat regional source revised REGIONAL_GVA history 2010-2015; deferred under 0-drift pending a re-vintage decision
metadata:
  type: project
---

The 2026-07-03 GeoStat regional workbook (`DATA/3.რეგიონული მშპ.xlsx`) REVISES REGIONAL_GVA history for **2010-2015** — all 111 obs/year differ from the current canonical. **2016-2023 are identical (0 drift)**, and 2024 is genuinely new.

The `feat/data-refresh-featured` branch (commit on this branch, un-merged) applied ONLY the additive +2024 (111 obs) and left 2010-2015 at their existing canonical values, so REGIONAL_GVA is now a hybrid (2010-2015 old basis, 2016-2024 new basis). Vintage left at 2026-06-26.

**Why:** Root project law is 0-drift ("existing observations keep their exact value; only ADD"). Applying a historical revision is a governed re-vintage event (ties to the ADR-0025 `stats.release` / vintage machinery), not a silent refresh.

**How to apply:** If the owner decides to accept the 2010-2015 revision, cut a NEW REGIONAL_GVA vintage (full rebuild from source) + a `stats.release` publication event — do not hand-patch. Until then, treat the 2015/2016 basis discontinuity as known. The validated source→canonical mapping (region GDP-by-region table → Rx/_T and _T/_T; per-region sector blocks → Rx/sector; sector sums are NOT the region total) reproduces 2016-2023 exactly. See [[project_db_state]].

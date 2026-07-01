---
name: decision-c-unit-measure
description: Decision C — SDMX UNIT_MEASURE attaches at the measure-classifier level, with dataset as dataset-wide default; resolution view stats.measure_unit_resolved
metadata:
  type: project
---

Decision C: SDMX UNIT_MEASURE / UNIT_MULT / DECIMALS attach at the **measure-classifier level** (`stats.classifier` where `dim_code='measure'`), implemented in `V20__classifier_unit.sql`. The V16 `stats.dataset` unit columns are **demoted to a dataset-wide DEFAULT**, not the primary home. The `obs_attribute` UNIT_MEASURE override path (named in V8's comment) is **retired** — V20 rewrites the `stats.observation.obs_attribute` comment to say UNIT_MEASURE is NOT resolved from the bag.

Resolution order, per field, independent: **measure-classifier (V20) -> dataset default (V16) -> NULL**, encoded ONCE in the view `stats.measure_unit_resolved` (`V21__measure_unit_resolved.sql`) so no consumer re-implements it. Grain: one row per (dataset_code, measure_code). `base_period` stays dataset-only (never added to classifier).

**Why:** Unit/scale/precision are series-SUBKEY attributes of the SDMX INDICATOR concept = a measure classifier, not the whole dataflow. SSOT: one authoritative home per datum.

**How to apply:** Read-surface for the cube-profile endpoint is `stats.measure_unit_resolved`. The measure↔dataset bridge is `stats.dataset_dimension` (classifiers are dataset-agnostic; a measure classifier is shared across every dataset declaring the measure axis — the within-measure cartesian in V21's join is intentional). Legacy unit code normalization in the backfill: `'PCT' -> 'PERCENT'`. See [[v20-v21-backfill-failfast]].

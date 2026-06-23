---
name: unit-attachment-level
description: UNIT_MEASURE attaches at the measure-classifier level (not dataset, not a series_attribute table); resolution order measure-classifier -> dataset default -> NULL
metadata:
  type: project
---

UNIT_MEASURE / UNIT_MULT / DECIMALS attach at the **MEASURE-classifier** level, NOT
the dataset level (as V16 built it) and NOT a series_attribute(dim_key_hash) table.

**Why:** Unit varies by `measure`, which is a classifier and a sub-key of the series
key — not by the whole series and not constant per dataset. GDP_ANNUAL is genuinely
mixed-unit: GEL_MN levels + PERCENT rates (GDP_GROWTH/GDP_DEFLATOR/NOE_SHARE) + USD
(GDP_PER_CAPITA) all on one `measure` axis. Every observation of a given measure shares
its unit regardless of geo/side/account/time. So unit = a coded attribute on the SDMX
INDICATOR concept = a `stats.classifier` measure row. A series_attribute table would
re-denormalize the same unit across every (geo×sector) series of a measure.

**Decision (C, not A or B):** promote unit to first-class validated columns on
`stats.classifier` (unit_code FK to stats.unit_measure, unit_mult, decimals);
`stats.dataset` columns (V16) demote to the dataset-wide DEFAULT; the
`obs_attribute->>'UNIT_MEASURE'` override is RETIRED (no real callers — only V8/V16
comments). Resolution order, each field independently:
measure-classifier column -> dataset default column -> NULL.

**The conflict was three-way, not two-way:** seed.ts already attaches unit at the
measure-classifier level via `unitFor()` -> `classifier.metadata` (Gap-3 "Option B",
unvalidated JSONB). V16 added a 2nd home (dataset). obs_attribute was a 3rd. Decision C
consolidates onto the classifier and makes that JSONB blob into validated columns
(Strangler-Fig). See [[seed-units-codelist-mismatch]].

**How to apply:** New migrations V20 (classifier unit columns + CHECKs) and V21
(`stats.measure_unit_resolved` view encoding the COALESCE once). The cube-profile
endpoint (does not exist yet) must expose unit as per-measure
`measures[].unit = {unit_code, symbol, unit_mult, decimals, base_period}` from the
resolver view — never a single dataset scalar. Do NOT edit V16 (immutable).

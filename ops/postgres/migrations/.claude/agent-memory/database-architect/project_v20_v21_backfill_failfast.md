---
name: v20-v21-backfill-failfast
description: V20 classifier-unit backfill aborts fail-fast if a legacy metadata unit code is missing from the stats.unit_measure seed — confirm seed coverage before live apply
metadata:
  type: project
---

V20's backfill `UPDATE stats.classifier SET unit_code = ...` resolves a measure member's `metadata->>'unit_measure'` against the FK to `stats.unit_measure(code)`. If a measure carries a legacy code that is neither `PCT` (normalized to `PERCENT`) nor present in the V16 seed, the FK rejects the UPDATE and **aborts the whole migration** (fail-fast, by design — halt beats writing an invalid unit).

**Why:** Migrations run once on a live volume; a halt is recoverable, a silently-wrong unit is not (a chart that renders GEL 12,000 next to GEL 12,000,000,000).

**How to apply:** Before applying V20 to the live volume, confirm the V16 `stats.unit_measure` seed covers every in-use legacy `metadata->>'unit_measure'` value. The backfill is idempotent (`WHERE unit_code IS NULL` guard), so a fixed seed + re-apply converges. Related: [[decision-c-unit-measure]].

---
name: concept-role-ssot
description: Seed dimensions' SDMX concept_role and the V27 backfill dependency; category acyclicity gap closed in V30
metadata:
  type: project
---

The 7 seed dimensions (measure/time/geo from V5; approach/account/side/sector
from V7) were seeded with NULL concept_role, so V27's concept backfill (one
stats.concept per role-typed dimension, then bind) seeded ZERO concepts —
stats.concept was empty and the P1-A concept SSOT was inert.

Fix: V30__seed_concept_role.sql (additive, NOT an edit to applied V5/V7) sets
concept_role then RE-RUNS the V27 backfill+bind idempotently. Role assignment:
measure→'measure', time→'time', geo→'geo', and approach/account/side/sector→
'classification' (they are KEY dims in dim_key that partition facts → SDMX
'classification', NOT 'attribute' which is a non-key qualifier).

**Why:** editing V5/V7 in place breaks Flyway checksum on the live volume AND
would not re-trigger the already-run V27 backfill. A new migration that both sets
roles and re-runs the idempotent backfill is the only correct path.
**How to apply:** to add/change a dimension's concept_role, do it in a NEW
migration that also re-runs the V27-style backfill (read concept_role DATA, never
hardcode concept names — Law 1). cube-profile resolves role via
COALESCE(concept.role, dim.role) — the concept SSOT must win.

V30 also closes a V29 gap: stats.category had no cycle-prevention trigger (only a
direct-self-parent CHECK), so re-parenting a node into its own descendant
(A→B→A) slipped past the path build. V30 §4 adds trg_category_no_cycle mirroring
V18's trg_classifier_no_cycle (code-chain variant). See [[db-gated-fixtures]].

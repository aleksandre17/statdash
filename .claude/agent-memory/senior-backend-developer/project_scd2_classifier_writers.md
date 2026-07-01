---
name: scd2-classifier-writers
description: Which code paths write stats.classifier as SCD-2 history vs in-place, and the is_current invariants that every classifier reader/writer must honor post-V18
metadata:
  type: project
---

After V18 dropped the blanket `UNIQUE (dim_code, code)`, `stats.classifier` is SCD-2: a revision is a NEW row (new surrogate id, `is_current=true`) while the old row goes `is_current=false`. Only `uq_classifier_current (dim_code, code) WHERE is_current` remains unique. Predicate is exactly `WHERE is_current` (V6 line 145) — no `= true`; ON CONFLICT inference must match it verbatim.

**Writer roles (do not conflate):**
- `platform/apps/api/src/ingest/upsert.ts` `upsertClassifier` — the ONLY true SCD-2 writer: close-old + insert-new + re-point children (`parent_id` FK → surrogate id; V4 LTREE path built from id-chain, so children must follow the new parent id within the same txn). NOTE: re-pointing DIRECT children alone is insufficient for ≥3-level hierarchies — V4's `trg_classifier_path` fires only on `UPDATE OF parent_id`, so a grandchild (parent_id unchanged) keeps a STALE path embedding the old ancestor id. Step 3b runs a recursive-CTE path rebuild over the whole subtree (formula `parent.path || self.id`, same as the trigger). Two bugs lived here: ON CONSTRAINT against the partial index (throws — partial unique INDEX has no pg_constraint row, must use inference form), and the grandchild stale-path. Fitness fn: `src/ingest/upsert.scd2.test.ts` (live-DB, skips without DATABASE_URL).
- `platform/apps/api/scripts/seed-helpers.ts` `upsertClassifier` — INTENTIONALLY in-place (no history). Uses `ON CONFLICT (dim_code, code) WHERE is_current DO UPDATE`. Seed = idempotent convergence from source; history not needed.
- `platform/apps/api/src/provisioning/upsert.ts` — does NOT touch stats.classifier at all (only `config.page` / `config.data_source` / `config.nav_item`). A trace naming it as a classifier ON CONFLICT site is WRONG; verify before acting.

**is_current invariant for readers:** any parent/member/obs resolver against stats.classifier must filter `AND is_current = true` or it can match a retired revision (validate.ts codelist loads, publish.ts parent lookup, validateDisplays member resolution all now do). Gold V22 trigger (owned separately) adds the same filter to `validate_observation_dim_key`.

**Why:** the "version vs identity" defect cluster — surrogate id changes per revision, so anything assuming one-row-per-(dim_code,code) breaks.
**How to apply:** when editing any stats.classifier query, decide reader (needs is_current filter) vs SCD-2 writer (re-point children) vs in-place writer (partial-index conflict target); never assume a single current row without the filter.

---
title: Classifier hierarchy on the code-chain (LTREE over the business key)
status: Accepted (design; Strangler-Fig V23 EXPAND + V24 CONTRACT)
date: 2026-06-XX
authors: architect / database-architect
migrated_from: project_classifier_code_path_adr (orig. ADR-0023)
---

# ADR-0023 — Classifier code-path hierarchy [orig. ADR-0023]

**Status:** Accepted (design). Rollout is Strangler-Fig: V23 EXPAND (additive) + V24 CONTRACT (one-way). Part of the backend/DB ADR family (see ADR-0025, ADR-016, ADR-017, ADR-018).

## Context

The `stats.classifier` hierarchy edge + materialized LTREE `path` currently hang off the churning surrogate `id`. SCD-2 (V6/V18) mints a NEW surrogate id per revision, so a single id-space + id-chain path cannot honour both identity fidelity (child → current parent) and temporal fidelity (child → the co-existing parent revision) at once. The runtime writer today re-points children and rebuilds subtree paths (`upsert.ts` Step 3/3b) to keep the LIVE tree correct — but that writes temporally-incoherent historical edges (masked only by `is_current=true` filters everywhere). Root cause: an identity-model error. SDMX identifies codelists by CODE, not by surrogate key (Law 1). Codes are stable across revisions.

**Decisive blast-radius fact:** observations reference classifiers ONLY by `(dim_code, code)` business codes (`dim_key` JSONB + the V4 validate trigger), NEVER by surrogate id. The fact-table blast radius is therefore ZERO; `id` is used internally only by `parent_id`, `path`, and `classifier_display.member_id`.

## Decision

- Move the hierarchy edge + LTREE path from the surrogate `id` to the stable `(dim_code, code)` business key: a new `parent_code TEXT` edge + a new `code_path LTREE` (chain of sanitised codes). Because codes are stable across revisions, a code-chain path NEVER changes on revision — the runtime re-point/rebuild (`upsert.ts` Step 3/3b) vanishes, and as-of read becomes a pure validity-window filter (`valid_from<=D AND (valid_to IS NULL OR valid_to>D)` ORDER BY `code_path`), which was IMPOSSIBLE under the id-chain.
- Keep the surrogate `id` as the row PK + `classifier_display.member_id` only.
- **Fitness function:** invert the `upsert.scd2.test` Bug-A assertion from "path CHANGES to a new id-chain" to "`code_path` is byte-identical (`B.B1.B1G`) before and after a revision".

## Rejected Alternatives

1. **Keep the surrogate-id chain (status quo).** REJECTED: one id-space + one id-chain path cannot satisfy both identity and temporal fidelity; it forces the temporally-incoherent Step 3/3b re-point on every revision and leaks history that only `is_current` filters hide.
2. **Three migrations V23/V24/V25 (the intake summary's plan).** REJECTED: the `is_current=true` validation fix already exists on disk as `V22__scd2_validation_integrity.sql`, so the third migration is a DUPLICATE and is dropped. Final numbering = V23 EXPAND + V24 CONTRACT (two, not three); V22 stays valid verbatim.
3. **A DB FK on `parent_code → (dim_code, code)`.** REJECTED: post-V18, `(dim_code, code)` is not unique (SCD-2 revisions), so no DB FK is possible; integrity is the writer's + the cycle-guard's job.

## Consequences

- Positive: revisions no longer re-point children or rebuild subtree paths (Step 3/3b deleted); as-of tree reconstruction becomes a validity-window filter; the model matches SDMX code identity (Law 1).
- Negative / cost: a Strangler-Fig migration touching `upsert.ts`, `publish.ts`, `classifiers.ts` (3 routes + /display, aliasing `code_path::text AS path` to preserve the wire contract), `validate.ts`, and `seed-helpers.ts`; the `parent_code` edge has no DB FK (writer-enforced).
- Fitness: `upsert.scd2.test` Bug-A inverted to assert `code_path` stability across a revision.

---

## Detailed Record (preserved verbatim from architect memory)

> Migrated from `.claude/agent-memory/architect/`. Backend/DB ADR family (see ADR-0025, ADR-016, ADR-017, ADR-018).


ADR-0023 (Accepted): the `stats.classifier` hierarchy edge + materialized LTREE `path` move from the churning surrogate `id` to the stable `(dim_code, code)` business key. New `parent_code TEXT` edge + new `code_path LTREE` (chain of sanitised codes). Surrogate `id` kept only as row PK + `classifier_display.member_id`.

**Why:** SCD-2 (V6/V18) mints a new surrogate id per revision, so one id-space + one id-chain path cannot honour both identity fidelity (child→current parent) and temporal fidelity (child→co-existing parent revision). The runtime writer re-points children + rebuilds subtree paths (upsert.ts Step 3/3b) to keep the LIVE tree correct, but this writes temporally-incoherent historical edges (filtered away today by is_current=true everywhere). Root cause = identity-model error; SDMX identifies codelists by code, not surrogate key (Law 1). Codes are stable across revisions, so a code-chain path NEVER changes on revision — Step 3/3b vanish, as-of read becomes a pure validity-window filter.

**Decisive blast-radius fact:** observations reference classifiers ONLY by (dim_code, code) business codes (`dim_key` JSONB + V4 validate trigger `WHERE dim_code/code`), NEVER by surrogate id. Fact table blast radius = zero. id used internally only by parent_id, path, classifier_display.member_id.

**How to apply:** Strangler-Fig rollout — FINAL numbering is V23 EXPAND + V24 CONTRACT (NOT three). The is_current=true validation fix that the summary called "V24/V25" ALREADY EXISTS on disk as V22__scd2_validation_integrity.sql (CREATE OR REPLACE validate_observation_dim_key, step-3 lookup gains `AND c.is_current=true`) — so that migration is a DUPLICATE and is DROPPED; V22 stays valid verbatim (keys on code, untouched by the code-path move). V23 EXPAND = add parent_code TEXT (nullable, NO DB FK — post-V18 (dim_code,code) not unique) + code_path LTREE (sanitised-code chain via new trg_classifier_code_path), backfill from parent_id edge top-down, parity DO block; two-way. V24 CONTRACT = re-point V18 prevent_classifier_cycle from parent_id→parent_code chain FIRST, then drop trg_classifier_path/refresh_classifier_path()/path/idx_classifier_path/parent_id; one-way. id surrogate REMAINS (row PK + classifier_display.member_id). upsert.ts: DELETE Step 3 + 3b entirely (the whole `if (oldId!=null && inserted[0])` block), signature parentId→parentCode, drop oldId/RETURNING-id. publish.ts publishClassifiers: drop the surrogate-id resolution (idByCode map + gold id lookup); keep a code-based topo ordering (parent-before-child) for the code_path trigger; pass r.parent_code through. classifiers.ts 3 routes + /display: parent_id/path→parent_code/code_path (alias `code_path::text AS path` to keep wire contract), add missing is_current=true filter. validate.ts: verify-then-likely-skip (its parent check is already code-based). seed-helpers.ts is the byte-identical sibling writer — same signature+INSERT change, add `parent_code=EXCLUDED.parent_code` to DO UPDATE. As-of-date tree = validity-window filter (valid_from<=D AND (valid_to IS NULL OR valid_to>D)) ORDER BY code_path — was IMPOSSIBLE under id-chain. Fitness function: invert upsert.scd2.test Bug-A from path-CHANGES-to-new-id-chain to code_path-STABLE (byte-identical 'B.B1.B1G' before+after revision).

Related: [[project_db_layer]] [[project_ingestion_architecture]] [[project_i18n_db]]

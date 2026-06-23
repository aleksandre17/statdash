---
name: project-v13-v21-review
description: Findings from the system-wide coherence review of DB migrations V13–V22 + backend ingest changes (2026-06), incl. the V22 confirmation pass
metadata:
  type: project
---

System-wide review of the V13–V22 migration batch + backend ingest/publish/validate changes.

**Why:** A large batch of DB + backend work shipped together; the user wanted a cross-cutting review that individual implementers could not do because each saw only their slice. Standard: "work of art."

**How to apply:** Re-check these before SCD-2 revisions begin in production. They are not apply-order failures (V1→V22 apply clean), they are runtime/correctness defects that surface only once codelist revisions exist.

Confirmed-clean: apply order V13→V22 has no forward references; V1..V22 sequence is complete with no duplicate numbers (single V16, single V19). V19 file header now correctly says V19 (cosmetic mislabel fixed). V22 correctly CREATE OR REPLACEs validate_observation_dim_key reproducing V4's body verbatim + only `AND c.is_current = true` on the step-3 lookup; DSD set-equality preserved; pre-flight DO block is read-only; no trigger re-binding. validate.ts all three loads now filter is_current=true. publish.ts gold-parent lookup now filters is_current=true.

**The 2026-06 change-set CLOSED:** Fix 2 (publish.ts is_current), Fix 4 (validate.ts ×3 is_current), Fix 5 (V22 trigger), the V19 header cosmetic. Fix 1 (re-point children) is PARTIALLY done — see open bug A. Fix 3 is correct for seed-helpers but exposed bug B.

**2026-06-22 SCD-2 closure pass:** Bug A (multi-level LTREE path stale) and Bug B (ON CONFLICT ON CONSTRAINT vs partial index) are both CONFIRMED CLOSED in upsert.ts. Bug B → inference form `ON CONFLICT (dim_code, code) WHERE is_current` (upsert.ts:95), predicate matches V6:143-145. Bug A → Step 3b recursive CTE (upsert.ts:135-152) rebuilds subtree path top-down with V4's formula. New integration test upsert.scd2.test.ts gates both (skipped without DATABASE_URL). uq_classifier_current invariant holds (Steps 3/3b never touch is_current/dim_code/code).

**NEW ESCALATION — SCD-2 hierarchy identity model needs an ADR (architect, one-way door).** Step 3/3b have no is_current filter, so they re-point/repath HISTORICAL child rows too. parent_id is only ever written to a CURRENT id (publish.ts:213/224), so a historical row's parent_id/path get rewritten to the CURRENT ancestor id-chain — identity-faithful but TEMPORALLY incoherent (a [t0,t1) snapshot points at a parent revision born at t2). LATENT: no as-of-time consumer reads historical parent_id/path today (all reads filter is_current=true), so harmless now. Root cause: one surrogate-id space + one materialized path column serve BOTH the live tree AND temporal history; SCD-2 id-per-revision forces every descendant to choose identity- vs time-fidelity. NOT fixable by adding is_current filters. ADR options: (a) business-key FK (child → parent dim_code/code, kills the re-point dance), (b) split live-tree vs temporal-history representations, (c) explicitly accept + document + fitness-function forbidding as-of consumers of historical parent_id/path. Must be recorded before any temporal-reconstruction feature.

**OPEN BUGS after the confirmation pass (still NOT a work of art):**

A. **Multi-level LTREE path goes stale after a parent revision (CORRECTNESS, NEW/UNCLOSED).** upsert.ts Step 3 re-points only DIRECT children: `UPDATE classifier SET parent_id=newId WHERE parent_id=oldId`. That fires V4 trg_classifier_path for each direct child, recomputing the child's path from new parent. But grandchildren's parent_id is unchanged (they point at the child's id, which did not change), and V4's trigger fires only `BEFORE INSERT OR UPDATE OF parent_id` (V4:79). So a grandchild's stored LTREE `path` is never recomputed and keeps the OLD ancestor id-chain → descendants(`~*`)/subtree queries through the revised root return stale/incorrect results in any hierarchy ≥3 levels. Root cause: LTREE path is materialized from the id-chain and Postgres does not cascade a parent's path change to descendants. Fix options: (a) after re-pointing, recompute the whole affected subtree's paths (recursive UPDATE walking descendants), or (b) re-point by a no-op `UPDATE ... SET parent_id = parent_id` cascade is insufficient — must touch each descendant. Cleanest: a trigger/function that, on a parent_id change, recomputes the subtree, or a recursive CTE re-path in upsert after Step 3.

B. **upsert.ts `ON CONFLICT ON CONSTRAINT uq_classifier_current` is invalid SQL at runtime (RUNTIME FAILURE).** uq_classifier_current is a PARTIAL UNIQUE INDEX (V6:143 `CREATE UNIQUE INDEX ... WHERE is_current`), never a named table constraint — no pg_constraint row exists. `ON CONFLICT ON CONSTRAINT <name>` only accepts pg_constraint entries; a partial unique index is reachable ONLY via the inference form `ON CONFLICT (dim_code, code) WHERE is_current`. upsert.ts:86 throws `constraint "uq_classifier_current" ... does not exist` on first revision insert. The prior review (this file, earlier) wrongly blessed upsert.ts's ON CONSTRAINT form as "already correct" — that diagnosis was wrong. Fix 3 correctly used the inference form in seed-helpers.ts:75; upsert.ts must use the SAME inference form. The two writers are currently INCONSISTENT.

Non-bugs verified: V17 double-bump harmless (monotonic). publishFacts double-bump fine.

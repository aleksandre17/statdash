---
name: canonical-partial-failure-retry
description: The canonical ingest route publishes reference data (codelists/displays) BEFORE facts; a mid-orchestration crash (after codelists publish, before facts) leaves the upload non-idempotent — the retry 409s ALREADY_PUBLISHED at the codelist re-submit, before reaching the mint/facts.
metadata:
  type: project
---

# Canonical route: partial-failure leaves a retry-blocking published codelist

The canonical route (`apps/api/src/routes/ingest/canonical.ts`) orchestrates in order:
codelists → displays → version-mint → facts. Reference data (codelists/displays) is
driven FULLY to PUBLISHED gold via `submitToGold` BEFORE facts are submitted (so classifier
members exist before `validateObs`). Facts are left STAGED for the curator's
`POST /api/ingest/jobs/:id/publish`.

**The trap:** if the route CRASHES after the codelists publish but before facts (e.g. the
old version-mint 500), the codelist submission stays `published`. The Idempotent Receiver in
`createSubmission` (`ingest/submit.ts`) keys a 409 on `(content_hash, status='published',
dataset_code)`. On RETRY the route regenerates the SAME codelist payload (same hash, same
`dataset_code=NULL`) → `AlreadyPublishedError` → **409 ALREADY_PUBLISHED at the codelist
step, before the mint/facts ever run**. So a legitimate facts retry is blocked by the prior
run's orphaned (facts-less) published codelist.

**Why this is correct-but-incomplete:** the Idempotent Receiver is RIGHT about the codelist
(identical members already in gold — re-publish is a no-op). But the route treats the upload
as atomic-from-codelists, so it cannot resume just the missing mint+facts tail.

**Recovery used on staging 2026-06-26 (safe, reversible, gold untouched):** the orphaned
codelist's gold effect (the `approach` classifier members + the `stats.dimension` axis row)
is already durably landed and is re-confirmed harmlessly on re-publish (additive, compat-
gated). So DELETE the orphaned codelist submission HEADER only
(`DELETE FROM stats_stage.submission WHERE id=<orphan>` — cascades to `submission_blob`),
which clears the Idempotent-Receiver match. The retry then re-runs codelists (gold no-op) →
mint → facts cleanly. Never deletes gold (`stats.classifier`/`stats.dimension`/
`stats.observation`); never touches the live stack.

**RESOLVED (2026-06-26) — converged-no-op chosen over resumable-bundle.** `submitToGold`
(now in `apps/api/src/routes/ingest/canonical-fsm-drive.ts`, extracted from the route for the
400-line bloat ceiling) CATCHES `AlreadyPublishedError` for the reference kinds and treats an
identical already-published reference payload as a CONVERGED NO-OP: it adopts the existing
published job (`KindJob.converged=true`) and continues to the mint/facts tail instead of
bubbling the 409. Rationale over the resumable/correlation-id bundle: the reference re-publish
IS genuinely a no-op (additive, compat-gated members already in gold) so the Idempotent
Receiver is right to refuse a NEW submission but wrong to abort the orchestration; the bundle
approach is a much larger contract change (new release/bundle entity + FSM) — YAGNI for this
loose end. Convergence is SCOPED to reference kinds + `AlreadyPublishedError` only; facts stay
behind the curator publish gate, and a full already-published-facts re-POST still 409s (F-2).
Tests: `canonical-fsm-drive.test.ts` (DB-free, real createSubmission throws the real error →
converges) + the `(g)` partial-failure→retry→converge case in `canonical-ingest.e2e.test.ts`
(DB-gated: orphan the published codelist, retry → 202 not 409, facts land). The manual
stage-table cleanup below is no longer needed for this case (kept for historical recovery).

Related: [[project_versioned_ingestion]] · [[version-mint-locale-incomplete-label]].

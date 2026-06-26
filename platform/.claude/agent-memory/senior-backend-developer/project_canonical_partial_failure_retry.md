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

**Platform improvement worth flagging to the architect (not yet built):** the route should
make the whole canonical upload resumable/atomic — e.g. tie the codelist+facts submissions of
one upload into a bundle (a `release`/correlation id) so a retry resumes the tail instead of
409-ing on already-landed reference data; or make `submitToGold` treat an identical already-
published reference payload as a converged no-op (skip, not throw) WITHIN a canonical upload.
Today it is a manual stage-table cleanup.

Related: [[project_versioned_ingestion]] · [[version-mint-locale-incomplete-label]].

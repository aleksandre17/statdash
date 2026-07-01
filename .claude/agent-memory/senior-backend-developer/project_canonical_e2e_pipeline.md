---
name: canonical-e2e-pipeline
description: The EXACT FSM + preconditions to drive a canonical-workbook submission to gold is_current — the non-obvious publish gate, dataset-status, and DSD pre-existence facts
metadata:
  type: project
---

Driving the canonical ingest (ADR-0031 Wave 5a) end-to-end to published gold — the load-bearing facts the e2e proof (`apps/api/src/ingest/canonical/canonical-ingest.e2e.test.ts` + its `.e2e-harness.ts`; live twin `work/ingest-canonical-e2e.sh`) encodes.

**Why:** the canonical route returns at the BRONZE write (202); getting facts to gold `is_current=true` is a multi-step FSM with non-obvious preconditions that are NOT auto-handled by the pipeline. Miss one and facts silently reject or the serve path 404s.

**How to apply (the FSM — NOT auto-publish):**
- `POST /api/ingest/canonical` (raw octet-stream .xlsx) → up to 3 submissions `received` IN ORDER: codelists → displays → facts. Worker fires via `setImmediate` (poll, don't assume sync).
- `worker.ts` (`runIngestionWorker`) drains `received → staged` (or `rejected` on error-severity) ONLY. It does NOT publish.
- Publish is a SEPARATE curator action: `POST /api/ingest/jobs/:id/publish` → `publishSubmission` (publish.ts) → `published`. Auto-opens a SINGLETON `stats.release`, stamps `observation.release_id`, bumps `stats.dataset_version`. Re-asserts `status='staged'` internally. Drive each job: poll→staged, POST publish, poll→published. (Bundled multi-submission vintages go via `POST /api/stats/releases/:id/publish` instead — not needed for the single-workbook path.)
- Mirror `scripts/seed-pipeline.ts` (`submitAndPublish`) — the proven submit→wait(staged)→publish→wait(published) cycle. Don't invent a harness.

**Preconditions the pipeline does NOT create (must pre-exist / converge):**
- The 3 datasets + their DSD (`stats.dataset_dimension`) ship from the **V7 migration** — the canonical pipeline never creates `stats.dataset`/DSD from STRUCTURE. `validateObs` rejects facts with `UNKNOWN_DATASET`/`DIM_KEY_MISMATCH` if absent. The e2e converges them idempotently from the parsed STRUCTURE.
- Dataset must be `status='published'` (via `stats.set_dataset_status(code,'published')`) — the V28 `stats.dataset_published` projection gates cube-profile/current-cube serve; a `draft` dataset 404s from discovery. Default is `draft`.
- `config.locale` ka+en `is_active=true` — the classifier label completeness gate (`MISSING_LABEL`).
- Codelist members: the canonical route submits codelists FIRST and they publish to gold before facts validate (covered by the in-order publish). Members are SCD-2 + cross-dataset shared with the seed corpus — converge, don't wipe `stats.classifier`.

**Verified anchors (probed from the real DATA/canonical fixtures):** obs counts published 1:1 (every DATA key distinct) → GDP_ANNUAL=288, ACCOUNTS_SEQUENCE=415, REGIONAL_GVA=1554. GDP 2010 total: `measure='gross-domestic-product-at-current-prices', approach='_Z', geo='GE'` ≈ 22148.65 (NOT coded `B1GQ`). REGIONAL `geo=_T,sector=_T,measure=GVA,2010` ≈ 21821.57. ACCOUNTS account `allocation-of-primary-income-account` carries ka+en in CL_ACCOUNT.

**e2e harness note:** needs a REAL `pg.Pool` (worker + publish own their own `connect()`-scoped txns and COMMIT to gold) — canNOT use the single-rolled-back-client trick the route-contract suite uses. It commits + cleans up (`freshState` deletes the 3 datasets' observations/releases/canonical submissions; FK CASCADE clears blob/staging/issues). DB-gated: skips when DATABASE_URL unset or `postgres://test`.

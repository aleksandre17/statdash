---
name: project-codelist-label-revision-path
description: How a display-label-only correction (codes UNCHANGED) propagates to gold via re-ingesting a canonical workbook; why it updates (not no-ops) and why facts 409 is EXPECTED.
metadata:
  type: project
---

# Codelist display-label revision via canonical re-ingest (codes unchanged)

To fix a typo'd DISPLAY LABEL on an already-published code WITHOUT renaming the code
(SDMX: a published code is a stable series-key id), re-ingest the corrected canonical
workbook through `POST /api/ingest/canonical`. This IS the canonical update path — it
does NOT no-op.

**Why it updates and is not blocked by the Idempotent Receiver:**
- The codelist submission payload is `{ classifiers: bronze.classifiers }`; `RawClassifierRow`
  carries `label {ka,en}` (apps/api `ingest/types.ts`). A changed label → different
  `content_hash` (SHA-256 of the JSON payload, `ingest/submit.ts contentHash`) → NO match
  in the Idempotent Receiver's `(content_hash, status='published', dataset_code)` guard →
  a FRESH codelist submission is created → worker → `upsertClassifier` (`ingest/upsert.ts`).
- `upsertClassifier` is SCD-2 (V6): Step 1 closes the current row IFF
  `label IS DISTINCT FROM $3` (so an unchanged label is a true no-op, no churn), Step 2
  inserts a NEW current row with the new label. The OLD label survives as a non-current
  history row (`is_current=false`) — never destroyed. `upsertDisplay` likewise updates the
  per-locale overlay via `ON CONFLICT DO UPDATE`.
- Labels live in `stats.classifier.label` (en/ka JSONB), keyed by `(dim_code, code, is_current)`.
  `dim_code='measure'` is SHARED across datasets (GDP_ANNUAL slugs like `net-taxes` +
  ACCOUNTS_SEQUENCE SDMX codes like `D5` coexist in one classifier table; codes are disjoint
  so no collision). Served at `GET /api/stats/classifiers/:dim_code`.

**Why the HTTP response is 409 (EXPECTED, not an error — F-2):** the route drives codelists
(then displays) FULLY to published gold BEFORE submitting facts (`canonical.ts` order at
~L207/L219/L251). The FACTS payload is `{ obs }` (codes/values only, NO labels) → byte-
identical → `createSubmission` throws `AlreadyPublishedError` → route catches → 409 for the
whole request. The codelist label update ALREADY LANDED in gold before that 409. So
**409 ALREADY_PUBLISHED is the correct outcome of a label-only re-ingest, and the labels
still update.** (Distinct from the converged-no-op fix, which only applies to a RETRY of the
SAME upload with an IDENTICAL reference payload — see [[project_canonical_partial_failure_retry]].)

**Invariants a label-only re-ingest preserves (verified on live 2026-06-26):** DSD
(`stats.dataset_dimension`), obs counts (GDP 288 / ACCOUNTS 415), and current member count
are UNCHANGED; only `stats.classifier.label` revises + one SCD-2 history row per corrected
code. Render path unaffected (`GET /api/stats/observations?dataset=` still returns full data).

**Source-of-truth for the corrected labels:** the converter
`work/legacy-to-canonical/build-*.js` now carries a per-dataset display-correction map
(`*_MEASURE_CORRECTIONS`) applied via `makeCodelist().applyCorrections({code:{name_en,name_ka}})`
(`primitives.js`) AFTER codes are derived — so regeneration stays correct and codes never move.

**Live ops recipe (no published api port; api binds 127.0.0.1:3001 in `statdash-api`):** ssh
`geostat-deploy` (`ops/config/ssh/config`), bootstrap admin via `docker exec statdash-api
printenv ADMIN_USERNAME/ADMIN_PASSWORD`, drive uploads with a node-`http` script run INSIDE
the container (only `wget`+`node` present, no curl). Login = `POST /api/auth` → `data.token`.

Related: [[project_versioned_ingestion]] · [[project_geostat_source_quirks]] · [[version-mint-locale-incomplete-label]].

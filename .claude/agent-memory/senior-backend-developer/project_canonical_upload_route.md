---
name: canonical-upload-route
description: ADR-0031 Wave 3a/3b canonical-workbook upload route wiring — the seams it reuses and the non-obvious test technique
metadata:
  type: project
---

The canonical-workbook upload route (`apps/api/src/routes/ingest/canonical.ts`, ADR-0031 Wave 3a) and its publish-side metadata mapping (Wave 3b).

**Why:** the PRIMARY steady-state ingest — curator POSTs a .xlsx, the route parses at the boundary (worker never sees Excel; `format:'canonical-xlsx'` is a provenance LABEL, not a worker branch) and lands up to 3 ordered submissions (codelists → displays → facts) into the existing Staged Submission Pipeline.

**How to apply (seams to REUSE, do not reinvent):**
- Active locales SSOT is `fetchActiveLocales(db)` — was private in `ingest/validate.ts`, now exported there + re-exported from `ingest/index.js`. Query: `SELECT code FROM config.locale WHERE is_active = true ORDER BY ord`. Never duplicate this query.
- DSD-compat GATE: `precheckContractCompat(db, declared)` (route-facing, no submissionId, returns pure `ContractChange`) lives beside the worker-stage `checkContractCompat(db, submissionId, declared)` in `ingest/validate-integrity.ts`. Both share the private `loadGoldDsdSnapshot`. Route blocks on an unversioned `DSD_INCOMPATIBLE` (error) → 400 BEFORE submitting; codelist warns are carried forward.
- Metadata→V31 (Wave 3b): `recognizeReferenceMetadata(meta)` (`ingest/reference-metadata-map.ts`) maps ONLY non-LocaleString provenance keys BAKE-NOW: `methodology_ref→methodology_url`, `last_update→last_updated`. A plain-string `source`/`vintage` must NOT enter a LocaleString content column (the completeness trigger rejects half-translations). Full ESMS tree is SEAM-DEFER. The recognized projection rides the FACTS bronze payload as `referenceMetadata`; `publishReferenceMetadata` (`ingest/publish-reference-metadata.ts`, extracted to keep publish.ts < 400-line hard ceiling) lands the SCD-2 row at the publish point, dataset-scoped, graceful-degrades if V31 table absent.
- xlsx is confined to `ingest/canonical/read-workbook.ts` (F-3 eslint). Added `writeWorkbook` there (the only xlsx WRITER) so tests/converter produce .xlsx bytes without leaking `import xlsx`. NEVER import xlsx elsewhere — eslint blocks it.

**Non-obvious test technique:** binding `app.pg` to a single per-test txn client makes `createSubmission`'s `setImmediate` worker drain no-op (single client has no `.connect`; the failure is caught/logged, fire-and-forget) — but the bronze submission rows are written SYNCHRONOUSLY before the 202, so kind/order/format/provenance/sourceDigest are all assertable in a rolled-back txn. DB-gated tests skip when `DATABASE_URL` is unset OR equals the dummy `postgres://test`. Wave 5 e2e (real Pool, boot+poll the job FSM) still owns the full publish→gold render proof.

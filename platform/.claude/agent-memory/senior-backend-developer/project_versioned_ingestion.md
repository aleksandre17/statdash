---
name: project-versioned-ingestion
description: How a versioned DSD-change is accepted + minted on POST /api/ingest/canonical (the RESOLVABLE DSD gate); which existing version vehicles were reused vs deliberately NOT.
metadata:
  type: project
---

# Versioned-ingestion governance (ADR-0031 §4 improvement 5, resolution half)

A canonical workbook that CHANGES the DSD (e.g. GDP_ANNUAL adds `approach` over the
registered `[time,measure,geo]`) is `400 DSD_INCOMPATIBLE` by default (the gate). It is
RESOLVABLE via a declared version → a new dataset VERSION (a new vintage; existing data
untouched).

**The contract the panel calls:** `POST /api/ingest/canonical?datasetVersion=<label>`
(or header `x-dataset-version`, or a STRUCTURE `dataset_version` row — query wins, then
header, then STRUCTURE). A declared version flips compat.ts's `DSD_INCOMPATIBLE` from
error→warn (the `versioned` branch already existed). Success = `202` with a `versionMint`
extension on the body: `{ datasetCode, datasetVersion, addedDims[], version }`. Absent on
every non-versioned / routine / codelist-only ingest.

**Why:** the SDMX-canonical response to a structural change is a new version, not a 400.
The gate must hold WITHOUT a version (governance) and resolve WITH one (the curator
explicitly mints the new structure).

**How to apply / the load-bearing seams (do not re-derive):**
- The mint happens in the ROUTE, between reference-data-→-gold and facts-submit, because
  BOTH `validateObs` (silver) AND the V4 `trg_observation_validate_dim_key` (gold) enforce
  dim_key SET-EQUALITY vs `stats.dataset_dimension`. A `+approach` fact is rejected
  `DIM_KEY_MISMATCH` until the DSD is widened — so the widen MUST be committed BEFORE the
  facts submission is created. `mintDatasetVersion` (apps/api `ingest/version-mint.ts`)
  owns its own atomic txn; the route awaits it.
- REUSED version vehicles (no parallel store): `stats.dataset_dimension` (widen additively,
  STRUCTURE order, ON CONFLICT DO NOTHING) · `stats.dimension` (a new dim is a ROW, Law 1) ·
  `stats.bump_dataset_version` (V6 ETag counter = the "new version row") · `stats.dataset.
  metadata` JSONB (records the version LABEL + structural_versions history — no new column).
- DELIBERATELY NOT used: `set_dataset_status('superseded')` / V28 `replaced_by`. That chain
  is the RENAME-to-a-new-code path (GDP_ANNUAL → GDP_ANNUAL_2025) and needs a distinct
  target code. The additive same-code DSD widen keeps status `published`; the new vintage is
  the bumped counter + the publish path's auto-opened release. The supersession door stays
  open for a true code rename (YAGNI until it arrives).
- Idempotent: re-ingest of the same versioned workbook converges (dim already present →
  addedDims empty, no dup row). A non-versioned ingest never calls the mint → byte-identical
  to before.

Related: [[project_canonical_upload_route]] · [[project_canonical_e2e_pipeline]].

---
name: version-mint-locale-incomplete-label
description: RESOLVED (commit 8e9cb27) — the stats.dimension {en:code} fallback insert in mintDatasetVersion is now guarded by `if (isNew)`, so an existing time/measure/geo axis is never re-inserted with a locale-incomplete label. Was the 500 on versioned GDP ingest.
metadata:
  type: project
---

# RESOLVED — version-mint locale-incomplete label (was an unhandled 500)

The historic defect: `mintDatasetVersion` (apps/api `ingest/version-mint.ts`) inserted
`stats.dimension (code,label)` with an `{ en: dim.dimCode }` fallback for EVERY dim in the
plan. For an EXISTING axis (`time`/`measure`/`geo`), the `config.enforce_locale_string`
BEFORE-INSERT trigger fires on the candidate row BEFORE `ON CONFLICT DO NOTHING` arbitration
and RAISEs P0001 (`locale_string_invalid`: needs a non-empty entry for every active locale,
ka+en) → unhandled 500 on `POST /api/ingest/canonical?datasetVersion=`.

**Fixed in commit `8e9cb27`:** the `INSERT INTO stats.dimension` is now wrapped in
`if (isNew) { … }` (version-mint.ts ~line 118). `isNew = !known.has(dim.dimCode)` where
`known` is the pre-read `stats.dataset_dimension` set. So an existing axis is left exactly
as registered (its seed bilingual label preserved); only a genuinely NEW non-time dim
(`approach`, which carries a bilingual ka/en label from CL_APPROACH) is inserted. The
`dataset_dimension` widen (the actual DSD change) stays unguarded + `ON CONFLICT DO NOTHING`.

**Proven on staging 2026-06-26 (ADR-0032 dress-rehearsal):** governed GDP ingest with the
fix → `202 versionMint { addedDims:["approach"], version:2 }`, publish → 288 obs in gold,
DSD widened to 4-dim set `{time,approach,measure,geo}`. No 500. The earlier staging 500 was
a STALE IMAGE built from pre-`8e9cb27` source — see [[project_versioned_ingestion]] and the
staging build/recovery learnings below.

Related: [[project_versioned_ingestion]] · [[v7-dsd-vs-canonical-shape]].

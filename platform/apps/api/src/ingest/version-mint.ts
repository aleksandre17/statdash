// ── Ingest — versioned-DSD mint (the GOVERNED structural change) ──────────────
//
// ADR-0031 §4 improvement 5, the RESOLUTION half of the DSD gate. compat.ts already
// CLASSIFIES a structural change as warn-governed WHEN a dataset_version is declared
// (the `versioned` branch); THIS module APPLIES it — it is the chain the gate hangs on.
//
// THE PROBLEM IT SOLVES. A canonical workbook may change the DSD (e.g. GDP_ANNUAL adds
// the `approach` dimension vs the registered `[time,measure,geo]`). Without a version
// that is DSD_INCOMPATIBLE (the gate, correctly 400). WITH a `?datasetVersion=<label>`
// it is the SDMX-canonical response to a structural change: a NEW dataset VERSION — a
// new vintage whose series key includes the new dim(s). Existing observations are
// untouched (as-of preserved: SCD-2/V25/V28); only the dataset's STRUCTURE widens.
//
// WHY HERE (before facts validate), not at publish. BOTH validate.ts::validateObs
// (silver) AND the V4 trg_observation_validate_dim_key (gold) enforce dim_key SET
// EQUALITY against stats.dataset_dimension. A `+approach` fact would therefore be
// rejected DIM_KEY_MISMATCH at validate and never reach 'staged' — so the DSD must be
// realigned BEFORE the facts submission is created. The canonical route is the
// orchestrator that already drives reference-data→gold before facts; it calls this
// between those steps when the pre-pass classified a VERSIONED dsd-change.
//
// REUSES the existing version vehicles (no parallel store, per the ADR):
//   · stats.dataset_dimension      — the SDMX DSD (V4); widened additively, in STRUCTURE
//                                    order, ON CONFLICT DO NOTHING (idempotent).
//   · stats.dimension              — the axis registry (V4/V7); a new dim is a ROW, never
//                                    a schema change (Law 1). Upserted so the FK holds.
//   · stats.bump_dataset_version   — the V6 monotonic ETag counter (the "new version row");
//                                    bumped so caches invalidate + a version row exists.
//   · stats.dataset.metadata       — the existing JSONB slot records the declared version
//                                    LABEL (dataset_version) + the structural history. No
//                                    new column, no parallel table (V28 has no label col;
//                                    metadata is the SSOT slot the dataset already owns).
//
// NOT minting a NEW dataset CODE / set_dataset_status('superseded'): that supersession
// (V28 replaced_by) is the RENAME-to-a-new-code path (GDP_ANNUAL → GDP_ANNUAL_2025) and
// requires a distinct target code — out of scope for an ADDITIVE same-code DSD widening.
// Here the maintainable artefact is the SAME, evolving: status stays 'published', the new
// vintage is the bumped counter + a fresh release (the publish path auto-opens one). The
// supersession-chain door stays OPEN for a true code rename (YAGNI until that arrives).

import type { Queryable } from './types.js'

/** One ordered DSD dimension as the canonical STRUCTURE declares it. */
export interface DsdDimension {
  /** The dimension code (∈ STRUCTURE.dimensions). */
  dimCode: string
  /** STRUCTURE order (the series-key order — Law 1: read, never assumed). */
  ord: number
  /** True for the melted time axis (no CL sheet). */
  isTimeDim: boolean
}

/** The mint plan the route builds from the parsed CanonicalDsd + the classified change. */
export interface VersionMintPlan {
  datasetCode: string
  /** The declared version label (`?datasetVersion` / x-dataset-version / STRUCTURE row). */
  datasetVersion: string
  /** The full ORDERED DSD as the workbook declares it (time + non-time). */
  dimensions: DsdDimension[]
  /** Optional per-dim label bag (from CL name_<lang> / dimension axis), for a new axis row. */
  dimLabels?: Record<string, Record<string, string>>
}

/** The outcome — what the mint changed (for the route's 202 body + audit). */
export interface VersionMintResult {
  datasetCode: string
  datasetVersion: string
  /** The non-time dims ADDED to the DSD this mint (empty on a converged re-ingest). */
  addedDims: string[]
  /** The new ETag counter value (the "version row" — proof a new version exists). */
  version: number
}

/**
 * Apply a VERSIONED structural change as a new dataset version — ATOMIC (one txn).
 *
 * Idempotent + safe (the ADR invariant): re-running the same versioned workbook
 * CONVERGES — the dims already exist (ON CONFLICT DO NOTHING adds nothing), the label
 * is already stamped, only the ETag counter bumps (which is itself a no-op-equivalent
 * cache signal). A NON-versioned ingest never calls this, so today's path is byte-
 * identical. Old observations are never read or written here — as-of is preserved.
 *
 * Runs in its OWN transaction over a Pool (it needs connect()); the route awaits it
 * BEFORE submitting facts, so the widened DSD is committed and visible to validateObs.
 */
export async function mintDatasetVersion(
  db: Queryable,
  plan: VersionMintPlan,
): Promise<VersionMintResult> {
  if (!db.connect) {
    // The mint owns its transaction boundary (DSD widen + version bump must be atomic).
    throw new Error('mintDatasetVersion requires a Queryable with connect() (a pool)')
  }
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    // The non-time dims already declared for this dataset (the prior version's key).
    const { rows: existing } = await client.query<{ dim_code: string }>(
      `SELECT dim_code FROM stats.dataset_dimension WHERE dataset_code = $1`,
      [plan.datasetCode],
    )
    const known = new Set(existing.map((r) => r.dim_code))

    const addedDims: string[] = []
    for (const dim of plan.dimensions) {
      // The newly-added set is derived from the pre-read `known` snapshot — a dim absent
      // before this mint is genuinely new.
      const isNew = !known.has(dim.dimCode)

      // 1. The axis row must exist (FK dataset_dimension.dim_code → stats.dimension), but
      //    insert it ONLY for a genuinely NEW dim. Re-validating an EXISTING axis' label
      //    would fail the locale-completeness CHECK on stats.dimension.label (every active
      //    locale required) — e.g. `time` has no codelist, so no bilingual label is derivable
      //    and the {en:code} fallback is locale-incomplete. A new NON-time dim carries a
      //    bilingual label from its codelist (built into dimLabels); existing axes are left
      //    exactly as registered (DO NOTHING preserves the seed label/ord).
      if (isNew) {
        const label = plan.dimLabels?.[dim.dimCode] ?? { en: dim.dimCode }
        await client.query(
          `INSERT INTO stats.dimension (code, label) VALUES ($1, $2::jsonb)
           ON CONFLICT (code) DO NOTHING`,
          [dim.dimCode, JSON.stringify(label)],
        )
      }

      // 2. Widen the DSD: add the dim to the series key in STRUCTURE order. ON CONFLICT
      //    DO NOTHING makes a re-ingest converge (the dim is already there) and leaves an
      //    existing dim's ord untouched — only genuinely new dims are appended.
      await client.query(
        `INSERT INTO stats.dataset_dimension (dataset_code, dim_code, is_time_dim, ord)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (dataset_code, dim_code) DO NOTHING`,
        [plan.datasetCode, dim.dimCode, dim.isTimeDim, dim.ord],
      )
      if (isNew && !dim.isTimeDim) addedDims.push(dim.dimCode)
    }

    // 3. Record the declared version LABEL + structural history on the dataset's metadata
    //    JSONB slot (the existing SSOT slot — no new column, no parallel store). The label
    //    is the curator's vintage marker; structuralVersions accrues the audit trail. Use
    //    jsonb_set so other metadata keys (snaFramework, sdmxId, …) are preserved.
    await client.query(
      `UPDATE stats.dataset
          SET metadata = jsonb_set(
                           jsonb_set(
                             COALESCE(metadata, '{}'::jsonb),
                             '{dataset_version}', to_jsonb($2::text), true),
                           '{structural_versions}',
                           COALESCE(metadata->'structural_versions', '[]'::jsonb)
                             || jsonb_build_object(
                                  'version', $2::text,
                                  'dimensions', to_jsonb($3::text[]),
                                  'at', to_jsonb(now())),
                           true)
        WHERE code = $1`,
      [plan.datasetCode, plan.datasetVersion, plan.dimensions.map((d) => d.dimCode)],
    )

    // 4. Bump the V6 monotonic ETag counter — the "new version row" (create=1 else +1).
    //    This both proves a new version exists (stats.dataset_version) and invalidates
    //    every cached cube/ETag for the dataset (the structure changed).
    const { rows: bumped } = await client.query<{ version: string }>(
      `SELECT stats.bump_dataset_version($1)::text AS version`,
      [plan.datasetCode],
    )
    const version = Number(bumped[0]?.version ?? '0')

    await client.query('COMMIT')
    return { datasetCode: plan.datasetCode, datasetVersion: plan.datasetVersion, addedDims, version }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

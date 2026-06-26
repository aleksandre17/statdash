// ── Publish — metadata slot → V31 reference_metadata (ADR-0031 §6 / Wave 3b) ───
//
// The dataset-scoped publish-time write of the canonical workbook's recognized
// reference metadata. Extracted from publish.ts (one concern per file): publishFacts
// calls publishReferenceMetadata once per published dataset, inside the SAME publish
// transaction — so a dry-run ROLLBACK discards the report with the gold writes and a
// publish failure leaves no orphan report.
//
// WHAT IS WRITTEN: the canonical route projects CanonicalDsd.meta's recognized keys
// (methodology_ref → methodology_url, last_update → last_updated — the non-LocaleString
// provenance columns V31 accepts BAKE-NOW; the full ESMS tree is SEAM-DEFER, owned by
// reference-metadata-map.ts) onto the facts bronze blob as `referenceMetadata`. This
// reader recovers that projection from the immutable blob (the SSOT for the submitted
// payload) and lands an SCD-2 report row.
//
// GRACEFUL DEGRADATION (rolling migration): if stats.reference_metadata is not yet
// applied on this DB, the write is skipped (the 404-on-read posture the serve route
// already uses) rather than failing the whole publish — the facts still land.

import type { QueryableClient } from './types.js'
import { relationExists } from '../lib/relation-exists.js'
import {
  recognizeReferenceMetadata, type RecognizedReferenceMetadata,
} from './reference-metadata-map.js'

// The default ESMS-lite metadataflow (seeded by V31). A non-default flow is a
// SEAM-DEFER concern (the full SIMS/ESMS tree); the BAKE-NOW slot is single-flow.
const DEFAULT_METADATAFLOW = 'ESMS_LITE'

/**
 * Write the recognized reference-metadata report for one published dataset, SCD-2.
 * No-op when the workbook declared no recognized metadata (an omitted report is valid —
 * the serve route 404s a dataset with none) or when V31 is not yet applied here.
 */
export async function publishReferenceMetadata(
  client: QueryableClient,
  submissionId: string,
  datasetCode: string,
): Promise<void> {
  const rm = await readBlobReferenceMetadata(client, submissionId)
  if (!rm) return // nothing recognized to write.

  if (!(await relationExists(client, 'stats.reference_metadata'))) return // V31 absent.

  // SCD-2 revise: close the current dataset report (if any), then insert the new one as
  // current with the next revision. Mirrors the V31 fitness test's close-old/insert-new
  // path; the partial unique index (one is_current per dataset) is respected.
  const { rows: prior } = await client.query<{ revision: number }>(
    `UPDATE stats.reference_metadata
        SET is_current = false, valid_to = now()
      WHERE dataset_code = $1 AND target_type = 'dataset' AND is_current
      RETURNING revision`,
    [datasetCode],
  )
  const nextRevision = (prior[0]?.revision ?? 0) + 1

  await client.query(
    `INSERT INTO stats.reference_metadata
       (metadataflow_code, target_type, dataset_code, methodology_url, last_updated, revision)
     VALUES ($1, 'dataset', $2, $3, $4, $5)`,
    [DEFAULT_METADATAFLOW, datasetCode, rm.methodologyUrl ?? null, rm.lastUpdated ?? null, nextRevision],
  )
}

/**
 * Recover the recognized reference-metadata projection from the facts bronze blob.
 * Accepts EITHER a pre-recognized `referenceMetadata` object (what the canonical route
 * stamps) OR a raw `meta` bag (defensive — re-recognize if a future caller passes the
 * unprojected slot). Returns null when neither is present or nothing maps (Postel).
 */
async function readBlobReferenceMetadata(
  client: QueryableClient,
  submissionId: string,
): Promise<RecognizedReferenceMetadata | null> {
  const { rows } = await client.query<{ raw_content: string }>(
    `SELECT raw_content FROM stats_stage.submission_blob
      WHERE submission_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [submissionId],
  )
  if (!rows[0]) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(rows[0].raw_content)
  } catch {
    return null // a malformed blob would already have failed the worker; never block publish here.
  }
  if (parsed == null || typeof parsed !== 'object') return null
  const blob = parsed as { referenceMetadata?: unknown; meta?: unknown }

  if (blob.referenceMetadata && typeof blob.referenceMetadata === 'object') {
    const rm = blob.referenceMetadata as RecognizedReferenceMetadata
    const out: RecognizedReferenceMetadata = {}
    if (typeof rm.methodologyUrl === 'string' && rm.methodologyUrl.trim()) out.methodologyUrl = rm.methodologyUrl.trim()
    if (typeof rm.lastUpdated === 'string' && rm.lastUpdated.trim()) out.lastUpdated = rm.lastUpdated.trim()
    return Object.keys(out).length > 0 ? out : null
  }
  if (blob.meta && typeof blob.meta === 'object') {
    return recognizeReferenceMetadata(blob.meta as Record<string, string>)
  }
  return null
}

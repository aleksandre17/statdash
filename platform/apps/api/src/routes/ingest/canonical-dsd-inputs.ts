// ── canonical route — version-aware DSD input builders (pure) ─────────────────
//
// ADR-0031 §4 improvement 5 (versioned-ingestion governance), the route's PURE input
// layer. Extracted from canonical.ts (one-body hygiene, `05`/`09`): these three builders
// turn the parsed CanonicalDsd + the per-request version into the two structures the
// route's governance chain consumes —
//   · declaredSnapshot   → the DsdSnapshot the compat pre-pass (precheckContractCompat)
//                          diffs against gold; carrying datasetVersion flips a DSD change
//                          from a 400 gate (error) to a governed warn (compat.ts).
//   · resolveDeclaredVersion → the precedence rule for WHERE the version comes from.
//   · buildMintPlan      → the VersionMintPlan mintDatasetVersion applies (widen the DSD).
//
// PURE (no DB, no Fastify): the route owns the IO/orchestration; this owns the data
// shaping, so each is unit-testable in isolation (Dependency Inversion).

import type { RawClassifierRow, DsdSnapshot, VersionMintPlan } from '../../ingest/index.js'
import type { CanonicalDsd } from '../../ingest/canonical/types.js'

/**
 * Resolve the declared dataset VERSION for this upload — the vehicle that turns a DSD
 * change from a 400 gate into a governed new vintage. PRECEDENCE (query param wins):
 *   1. ?datasetVersion=<label>     (the explicit per-request override)
 *   2. x-dataset-version: <label>  (the header form, for non-query transports)
 *   3. STRUCTURE `dataset_version` row (the workbook's self-declared version)
 * Returns undefined when none is present → an UNVERSIONED ingest (the gate holds: a
 * DSD change is 400 as today). A blank/whitespace value is treated as absent (Postel).
 */
export function resolveDeclaredVersion(
  dsd: CanonicalDsd,
  queryVersion: string | undefined,
  headerVersion: string | undefined,
): string | undefined {
  const q = (queryVersion ?? '').trim()
  if (q) return q
  const h = (headerVersion ?? '').trim()
  if (h) return h
  const s = (dsd.meta.dataset_version ?? '').trim()
  return s || undefined
}

/**
 * Build the DECLARED DsdSnapshot for the compat pre-pass from the parsed DSD + the
 * emitted classifier rows. dims + measure come from STRUCTURE; members are the codes
 * this workbook declares per dim (so the classifier can diff them against gold). The
 * resolved `datasetVersion` (query/header/STRUCTURE) lets a governed DSD change pass —
 * compat.ts flips DSD_INCOMPATIBLE from error to warn when it is set.
 */
export function declaredSnapshot(
  dsd: CanonicalDsd,
  classifiers: RawClassifierRow[],
  datasetVersion: string | undefined,
): DsdSnapshot {
  const members: Record<string, string[]> = {}
  for (const c of classifiers) {
    ;(members[c.dimCode] ??= []).push(c.code)
  }
  return {
    datasetCode: dsd.datasetCode,
    dimensions: dsd.dimensions,
    measureConcept: dsd.measureConcept,
    members,
    datasetVersion,
  }
}

/**
 * Build the mint plan from the parsed DSD: the FULL ordered series key (STRUCTURE order,
 * Law 1) + per-dim labels harvested from the declared classifier rows (a new axis row's
 * label). The mint widens stats.dataset_dimension to this key, so the new version's facts
 * validate against the new structure. time is the melted axis (is_time_dim).
 */
export function buildMintPlan(
  dsd: CanonicalDsd,
  classifiers: RawClassifierRow[],
  datasetVersion: string,
): VersionMintPlan {
  const dimLabels: Record<string, Record<string, string>> = {}
  for (const c of classifiers) {
    // First label per dim is representative enough for the axis row; the per-MEMBER
    // labels live in stats.classifier (the codelists submission). This is only the
    // fallback axis label for a never-before-seen dimension.
    if (!dimLabels[c.dimCode] && c.label && Object.keys(c.label).length > 0) {
      dimLabels[c.dimCode] = c.label
    }
  }
  return {
    datasetCode: dsd.datasetCode,
    datasetVersion,
    dimensions: dsd.dimensions.map((dimCode, ord) => ({
      dimCode,
      ord,
      isTimeDim: dimCode === 'time',
    })),
    dimLabels,
  }
}

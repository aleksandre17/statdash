// ── Ingest — CONFORM filter (bronze raw → silver-ready) ───────────────────────
//
// Pipe-and-Filter stage 2 (parse → CONFORM → validate). Responsibilities:
//   1. Surrogate id → natural code translation (Kimball boundary: facts may carry
//      surrogate ids; the cube stores CODES). Lookup against stats.classifier.
//   2. obs_status normalization (uppercase + trim → A/P/E/R/M).
//   3. time_period format validation (SDMX regex == V9 CHECK constraint).
//   4. dim_key KEY normalization (lowercase + trim).
//
// PARTIAL SUCCESS (the key improvement over seed.ts, which throws on row 1):
// a bad row produces a ValidationIssue and the good rows still proceed. Conform
// NEVER silently drops an unresolved surrogate — it emits a `warn` and passes the
// (normalized) row through; the validate filter then surfaces it as an `error` if
// the code truly does not exist in gold. The approver sees exactly which ids are
// unknown, with row numbers.

import type {
  Queryable, RawObsRow, StagedObsRow, ValidationIssue,
} from './types.js'
import {
  isValidTimePeriod, normalizeObsStatus, normalizeDimKey,
  looksLikeSurrogateId, makeIssue,
} from './util.js'

/** A classifier member as the conform lookup needs it: code + its open metadata bag. */
interface MemberRow {
  code: string
  metadata: Record<string, unknown>
}

/**
 * Conform raw observation rows to silver-ready staged rows.
 *
 * The surrogate-id resolution does ONE batch query per distinct dimension in the
 * inbound rows (`SELECT code, metadata FROM stats.classifier WHERE dim_code = $1`),
 * builds an in-memory code→member and surrogate→code map, then conforms each row
 * against the maps — no per-row DB round-trip (N+1 avoided).
 */
export async function conformObsRows(
  db: Queryable,
  submissionId: string,
  datasetCode: string,
  raw: RawObsRow[],
): Promise<{ rows: StagedObsRow[]; issues: ValidationIssue[] }> {
  const rows: StagedObsRow[] = []
  const issues: ValidationIssue[] = []

  // 1. Discover every dimension referenced by the (normalized) inbound rows, then
  //    load each dimension's codelist once. A surrogate id is resolvable when the
  //    member's metadata carries a `surrogate_id` (or `sourceId`) matching the
  //    inbound value — the conform-time mapping a registry/Kimball load records.
  const dimCodes = new Set<string>()
  for (const r of raw) {
    for (const k of Object.keys(normalizeDimKey(r.dimKey))) dimCodes.add(k)
  }

  const byDim = new Map<string, { codes: Set<string>; surrogateToCode: Map<string, string> }>()
  for (const dim of dimCodes) {
    const { rows: members } = await db.query<MemberRow>(
      `SELECT code, metadata FROM stats.classifier WHERE dim_code = $1`,
      [dim],
    )
    const codes = new Set<string>()
    const surrogateToCode = new Map<string, string>()
    for (const m of members) {
      codes.add(m.code)
      const sid = m.metadata?.surrogate_id ?? m.metadata?.sourceId
      if (sid != null) surrogateToCode.set(String(sid), m.code)
    }
    byDim.set(dim, { codes, surrogateToCode })
  }

  // 2. Conform each row independently (fail-soft per row).
  for (const r of raw) {
    // time_period format (SDMX) — report but still pass through (validate + the
    // gold CHECK are the final authority; the approver wants to see the bad value).
    if (!isValidTimePeriod(r.timePeriod)) {
      issues.push(makeIssue(submissionId, 'conform', 'error', 'INVALID_TIME',
        { timePeriod: r.timePeriod }, r.rowIndex))
    }

    // dim_key: normalize keys, then resolve any surrogate-looking value to a code.
    const normalized = normalizeDimKey(r.dimKey)
    const conformedKey: Record<string, string> = {}
    for (const [dim, value] of Object.entries(normalized)) {
      const lookup = byDim.get(dim)
      if (lookup && lookup.codes.has(value)) {
        // Already a natural code — nothing to translate.
        conformedKey[dim] = value
      } else if (lookup && looksLikeSurrogateId(value) && lookup.surrogateToCode.has(value)) {
        // Surrogate id with a recorded mapping → translate to the natural code.
        conformedKey[dim] = lookup.surrogateToCode.get(value) as string
      } else if (lookup && looksLikeSurrogateId(value)) {
        // Looks like a surrogate but resolves to nothing — pass through, warn.
        conformedKey[dim] = value
        issues.push(makeIssue(submissionId, 'conform', 'warn', 'UNKNOWN_SURROGATE',
          { dim, value }, r.rowIndex))
      } else {
        // A non-surrogate value not (yet) in the codelist — pass through; validate
        // decides if it is a genuine UNKNOWN_CODE error against gold.
        conformedKey[dim] = value
      }
    }

    rows.push({
      datasetCode,
      timePeriod: r.timePeriod,
      dimKey: conformedKey,
      obsValue: r.obsValue,
      obsStatus: normalizeObsStatus(r.obsStatus),
      obsAttribute: r.obsAttribute,
      rowIndex: r.rowIndex,
    })
  }

  return { rows, issues }
}

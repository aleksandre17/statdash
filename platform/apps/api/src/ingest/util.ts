// ── Ingest — pure utilities (no IO, no DB) ────────────────────────────────────
// Shared, trivially unit-testable helpers for the conform/validate filters. No
// dependency on the DB port — these are the deterministic parts of the pipeline.

import type {
  IssueCode, IssueLayer, IssueSeverity, ValidationIssue,
} from './types.js'

// ── SDMX TIME_PERIOD format ───────────────────────────────────────────────────
// SSOT-mirror of the V9 CHECK constraint obs_time_period_fmt_chk:
//   '^\d{4}(-S[12]|-Q[1-4]|-W\d{2}|-\d{2}(-\d{2})?)?$'
// Validating here (conform) means a bad time_period is reported as a per-row issue
// instead of being rejected by the gold CHECK on row 1 at publish. The regex is
// kept verbatim so the two layers cannot drift; the DB constraint remains the
// final authority (defense in depth).
export const SDMX_TIME_PERIOD_RE = /^\d{4}(-S[12]|-Q[1-4]|-W\d{2}|-\d{2}(-\d{2})?)?$/

export function isValidTimePeriod(p: string): boolean {
  return SDMX_TIME_PERIOD_RE.test(p)
}

// ── obs_status normalization ──────────────────────────────────────────────────
// Mirror of seed-helpers.normalizeStatus: the cube accepts A/P/E/R/M (V4 CHECK).
// Conform uppercases + trims; an unknown status falls back to 'A' (normal) rather
// than failing the row — the V4 obs_status_chk would otherwise reject the whole
// publish transaction. Postel: liberal in what we accept, conservative in what we
// write to gold.
const VALID_STATUS = ['A', 'P', 'E', 'R', 'M'] as const

export function normalizeObsStatus(s: string | undefined): string {
  if (s == null) return 'A'
  const up = s.trim().toUpperCase()
  return (VALID_STATUS as readonly string[]).includes(up) ? up : 'A'
}

// ── dim_key key normalization ─────────────────────────────────────────────────
// Dimension codes are lowercase by convention (measure/geo/sector). Normalizing
// the KEYS (not the values — codes are case-sensitive business identifiers, V4
// note: "geo:GE vs measure:GE differ") makes conform tolerant of inbound casing.
export function normalizeDimKey(dimKey: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(dimKey)) {
    out[k.trim().toLowerCase()] = typeof v === 'string' ? v.trim() : v
  }
  return out
}

/** A value that looks like a surrogate id (pure digits) — the Kimball boundary cue. */
export function looksLikeSurrogateId(v: string): boolean {
  return /^\d+$/.test(v)
}

// ── Issue factory ─────────────────────────────────────────────────────────────
// One constructor so every issue carries the submissionId + a structured detail
// bag (never an interpolated string — the approver UI renders code + detail).
export function makeIssue(
  submissionId: string,
  layer: IssueLayer,
  severity: IssueSeverity,
  code: IssueCode,
  detail: Record<string, unknown>,
  rowIndex?: number,
): ValidationIssue {
  return { submissionId, layer, severity, code, detail, rowIndex }
}

export function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** Canonical dim_key serialization matching the V4 dim_key_hash (md5(dim_key::text)). */
export function canonicalDimKey(dimKey: Record<string, string>): string {
  // jsonb sorts keys; mirror that so an impact-preview lookup hashes identically.
  const sorted = Object.keys(dimKey).sort().reduce<Record<string, string>>((acc, k) => {
    acc[k] = dimKey[k]
    return acc
  }, {})
  return JSON.stringify(sorted)
}

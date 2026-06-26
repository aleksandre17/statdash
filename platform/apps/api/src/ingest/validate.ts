// ── Ingest — VALIDATE filter (silver rows → per-row conformance report) ───────
//
// Pipe-and-Filter stage 3 (conform → VALIDATE → staged). Mirrors the gold-layer
// invariants (the V4 dim_key validation trigger, the V9 time_period CHECK, the V4
// obs_status CHECK) but produces a FULL issue report instead of aborting on row 1.
// The DB triggers remain the final authority at publish (defense in depth); this
// stage is the approver-facing preview so a submission is fixed before it touches
// gold.
//
// Each validator does its lookups as BATCH queries (the DSD, the codelists, the
// existing observations for the impact preview) — no per-row round-trip.

import type {
  Queryable, StagedObsRow, StagedClassifierRow, StagedDisplayRow,
  ValidationIssue, PublishPreview,
} from './types.js'
import { isValidTimePeriod, makeIssue, canonicalDimKey } from './util.js'
import { loadAllowedRegion, firstRegionViolation } from './region.js'

// ── Locale registry (SSOT) ────────────────────────────────────────────────────

/**
 * The active locale codes from config.locale — the SAME registry the gold
 * config.validate_locale_string() trigger reads. Silver's label/locale rules
 * MUST derive from this, never a hardcoded constant, or the approval gate lies
 * about what gold will accept. Called once per validator and shared across rows
 * (no per-row round-trip).
 */
export async function fetchActiveLocales(db: Queryable): Promise<string[]> {
  const { rows } = await db.query<{ code: string }>(
    `SELECT code FROM config.locale WHERE is_active = true ORDER BY ord`,
  )
  return rows.map((r) => r.code)
}

// ── Preview helpers ───────────────────────────────────────────────────────────

function severityCounts(issues: ValidationIssue[]): { errorCount: number; warnCount: number } {
  let errorCount = 0
  let warnCount = 0
  for (const i of issues) {
    if (i.severity === 'error') errorCount++
    else if (i.severity === 'warn') warnCount++
  }
  return { errorCount, warnCount }
}

function emptyImpact(): { newRows: number; revisedRows: number; unchangedRows: number } {
  return { newRows: 0, revisedRows: 0, unchangedRows: 0 }
}

// ── OBS validation ────────────────────────────────────────────────────────────

/**
 * Validate staged observation rows against the dataset's DSD + codelists, and
 * classify each row as new / revised / unchanged for the impact preview.
 *
 * Checks (mirror of the V4 trigger):
 *  - dataset_code exists in stats.dataset                       (UNKNOWN_DATASET)
 *  - dim_key keys == the dataset's non-time DSD (set equality)  (DIM_KEY_MISMATCH / UNKNOWN_DIM)
 *  - each dim_key value exists as a stats.classifier member     (UNKNOWN_CODE)
 *  - the dim_key COMBINATION is inside the dataset's allowed     (ILLEGAL_COMBINATION)
 *    cube region, if the dataset has a role='allowed' constraint (ADR-0027)
 *  - time_period matches the SDMX regex                         (INVALID_TIME)
 *  - obs_value is numeric or null                               (INVALID_VALUE)
 */
export async function validateObs(
  db: Queryable,
  submissionId: string,
  datasetCode: string,
  rows: StagedObsRow[],
): Promise<{ issues: ValidationIssue[]; preview: PublishPreview }> {
  const issues: ValidationIssue[] = []
  const impact = emptyImpact()

  // 1. dataset exists?
  const { rows: ds } = await db.query<{ code: string }>(
    `SELECT code FROM stats.dataset WHERE code = $1`, [datasetCode],
  )
  if (!ds[0]) {
    issues.push(makeIssue(submissionId, 'validate', 'error', 'UNKNOWN_DATASET', { datasetCode }))
    // Without a DSD nothing else can be validated meaningfully; return early.
    return { issues, preview: buildPreview(issues, impact) }
  }

  // 2. The dataset's non-time DSD dimensions (the expected dim_key key set).
  const { rows: dsd } = await db.query<{ dim_code: string }>(
    `SELECT dim_code FROM stats.dataset_dimension
      WHERE dataset_code = $1 AND is_time_dim = false
      ORDER BY ord`,
    [datasetCode],
  )
  const expectedDims = new Set(dsd.map((d) => d.dim_code))

  // 3. Codelists for each expected dim — one batch query per dim, code-set in memory.
  const codesByDim = new Map<string, Set<string>>()
  for (const dim of expectedDims) {
    // is_current = true: post-V18 SCD-2 keeps historical rows; the approval preview
    // must validate against LIVE codes only — matching what gold will enforce once
    // the V22 trigger adds the same filter to validate_observation_dim_key's EXISTS.
    const { rows: members } = await db.query<{ code: string }>(
      `SELECT code FROM stats.classifier WHERE dim_code = $1 AND is_current = true`, [dim],
    )
    codesByDim.set(dim, new Set(members.map((m) => m.code)))
  }

  // 4. Existing observations for the impact preview — one batch query, keyed by
  //    (time_period, canonical dim_key). new / revised / unchanged classification.
  const existing = await loadExistingObs(db, datasetCode)

  // 5. The dataset's allowed cube region (ADR-0027) — loaded ONCE into an in-memory
  //    predicate. null = no role='allowed' constraint (unconstrained: the
  //    combination check is opt-in per dataset, so it is a no-op here). Mirrors the
  //    DB authority stats.dim_key_in_allowed_region exactly so the silver gate and
  //    the gold fitness function cannot diverge.
  const allowedRegion = await loadAllowedRegion(db, datasetCode)

  for (const r of rows) {
    if (!isValidTimePeriod(r.timePeriod)) {
      issues.push(makeIssue(submissionId, 'validate', 'error', 'INVALID_TIME',
        { timePeriod: r.timePeriod }, r.rowIndex))
    }

    if (r.obsValue !== null && typeof r.obsValue !== 'number') {
      issues.push(makeIssue(submissionId, 'validate', 'error', 'INVALID_VALUE',
        { obsValue: r.obsValue }, r.rowIndex))
    }

    // dim_key set equality vs the DSD.
    const actualDims = Object.keys(r.dimKey)
    const actualSet = new Set(actualDims)
    const missing = [...expectedDims].filter((d) => !actualSet.has(d))
    const extra = actualDims.filter((d) => !expectedDims.has(d))
    if (missing.length > 0 || extra.length > 0) {
      issues.push(makeIssue(submissionId, 'validate', 'error', 'DIM_KEY_MISMATCH',
        { expected: [...expectedDims], actual: actualDims, missing, extra }, r.rowIndex))
    }
    for (const dim of extra) {
      issues.push(makeIssue(submissionId, 'validate', 'error', 'UNKNOWN_DIM',
        { dim }, r.rowIndex))
    }

    // each value resolves to a classifier member.
    let allValuesKnown = true
    for (const [dim, value] of Object.entries(r.dimKey)) {
      const codes = codesByDim.get(dim)
      if (codes && !codes.has(value)) {
        allValuesKnown = false
        issues.push(makeIssue(submissionId, 'validate', 'error', 'UNKNOWN_CODE',
          { dim, value }, r.rowIndex))
      }
    }

    // combination check (ADR-0027): only meaningful once the row is structurally
    // sound — keys match the DSD and every value is a known code. Reporting an
    // illegal COMBINATION on a row that already has UNKNOWN_DIM/UNKNOWN_CODE would
    // be noise (the offending value is the real problem). The region predicate
    // mirrors stats.dim_key_in_allowed_region; a null region is unconstrained.
    const structurallySound = missing.length === 0 && extra.length === 0 && allValuesKnown
    if (structurallySound && allowedRegion) {
      const violation = firstRegionViolation(allowedRegion, r.dimKey)
      if (violation) {
        issues.push(makeIssue(submissionId, 'validate', 'error', 'ILLEGAL_COMBINATION',
          violation, r.rowIndex))
      }
    }

    // impact classification (only meaningful when the row is structurally sound).
    const key = `${r.timePeriod}|${canonicalDimKey(r.dimKey)}`
    const prior = existing.get(key)
    if (prior === undefined) {
      impact.newRows++
    } else if (prior.obs_value !== r.obsValue || prior.obs_status !== r.obsStatus) {
      impact.revisedRows++
    } else {
      impact.unchangedRows++
    }
  }

  return { issues, preview: buildPreview(issues, impact) }
}

interface PriorObs { obs_value: number | null; obs_status: string }

/** Batch-load the dataset's current observations, keyed for impact comparison. */
async function loadExistingObs(
  db: Queryable,
  datasetCode: string,
): Promise<Map<string, PriorObs>> {
  const { rows } = await db.query<{ time_period: string; dim_key: Record<string, string>; obs_value: string | number | null; obs_status: string }>(
    `SELECT time_period, dim_key, obs_value, obs_status
       FROM stats.observation WHERE dataset_code = $1`,
    [datasetCode],
  )
  const map = new Map<string, PriorObs>()
  for (const r of rows) {
    const key = `${r.time_period}|${canonicalDimKey(r.dim_key)}`
    // pg returns NUMERIC as string — normalize for a like-for-like value compare.
    const value = r.obs_value === null ? null : Number(r.obs_value)
    map.set(key, { obs_value: value, obs_status: r.obs_status })
  }
  return map
}

// ── CLASSIFIER validation ─────────────────────────────────────────────────────

/**
 * Validate staged classifier rows.
 *  - dim_code exists in stats.dimension                           (UNKNOWN_DIM_CODE)
 *  - parent_code (if set) exists in-submission OR in stats.classifier (UNKNOWN_PARENT)
 *  - label has a non-empty entry for EVERY active locale           (MISSING_LABEL)
 *
 * MISSING_LABEL mirrors the gold completeness arm of config.validate_locale_string:
 * every active locale must have a non-empty, trimmed entry — not merely one.
 */
export async function validateClassifiers(
  db: Queryable,
  submissionId: string,
  rows: StagedClassifierRow[],
): Promise<{ issues: ValidationIssue[]; preview: PublishPreview }> {
  const issues: ValidationIssue[] = []

  // Live locale registry (shared across all rows) — the gold completeness rule.
  const activeLocales = await fetchActiveLocales(db)

  // Known dimensions (batch).
  const { rows: dims } = await db.query<{ code: string }>(`SELECT code FROM stats.dimension`)
  const knownDims = new Set(dims.map((d) => d.code))

  // Existing classifier members per dim (batch, only for the dims we will check
  // parents against). Build the lookup lazily as dims appear.
  const goldCodesByDim = new Map<string, Set<string>>()
  async function goldCodes(dim: string): Promise<Set<string>> {
    const cached = goldCodesByDim.get(dim)
    if (cached) return cached
    // is_current = true: validate parent/member existence against LIVE codes only,
    // never a retired SCD-2 revision (mirrors validateObs above + gold's V22 trigger).
    const { rows: members } = await db.query<{ code: string }>(
      `SELECT code FROM stats.classifier WHERE dim_code = $1 AND is_current = true`, [dim],
    )
    const set = new Set(members.map((m) => m.code))
    goldCodesByDim.set(dim, set)
    return set
  }

  // Codes present within THIS submission (parent may reference a sibling row).
  const inSubmission = new Map<string, Set<string>>()
  for (const r of rows) {
    if (!inSubmission.has(r.dimCode)) inSubmission.set(r.dimCode, new Set())
    inSubmission.get(r.dimCode)!.add(r.code)
  }

  const impact = emptyImpact()
  for (const r of rows) {
    if (!knownDims.has(r.dimCode)) {
      issues.push(makeIssue(submissionId, 'validate', 'error', 'UNKNOWN_DIM_CODE',
        { dimCode: r.dimCode }, r.rowIndex))
    }

    // Completeness: every active locale must have a non-empty, trimmed entry
    // (mirrors gold config.validate_locale_string — not the weaker "at least one").
    const missingLocales = activeLocales.filter(
      (loc) => typeof r.label?.[loc] !== 'string' || r.label[loc].trim().length === 0,
    )
    if (missingLocales.length > 0) {
      issues.push(makeIssue(submissionId, 'validate', 'error', 'MISSING_LABEL',
        { label: r.label, missingLocales }, r.rowIndex))
    }

    if (r.parentCode != null) {
      const inSub = inSubmission.get(r.dimCode)?.has(r.parentCode) ?? false
      const inGold = (await goldCodes(r.dimCode)).has(r.parentCode)
      if (!inSub && !inGold) {
        issues.push(makeIssue(submissionId, 'validate', 'error', 'UNKNOWN_PARENT',
          { dimCode: r.dimCode, parentCode: r.parentCode }, r.rowIndex))
      }
    }

    // impact: new vs revised relative to gold (no value to compare, so a member
    // already present is counted unchanged — the upsert is idempotent on it).
    const present = (await goldCodes(r.dimCode)).has(r.code)
    if (present) impact.unchangedRows++
    else impact.newRows++
  }

  return { issues, preview: buildPreview(issues, impact) }
}

// ── DISPLAY validation ────────────────────────────────────────────────────────

/**
 * Validate staged display rows.
 *  - (dim_code, code) resolves to a stats.classifier member   (UNKNOWN_MEMBER)
 *  - locale is a registered active locale (config.locale)      (UNKNOWN_LOCALE)
 *  - display is a non-empty object                             (EMPTY_DISPLAY)
 */
export async function validateDisplays(
  db: Queryable,
  submissionId: string,
  rows: StagedDisplayRow[],
): Promise<{ issues: ValidationIssue[]; preview: PublishPreview }> {
  const issues: ValidationIssue[] = []

  // Live locale registry (shared across all rows) — gold's config.locale is SSOT.
  const activeLocales = new Set(await fetchActiveLocales(db))

  // Resolve (dim_code, code) → member id in one batch. Build the set of valid
  // pairs from the dims present in the submission.
  const pairKeys = new Set(rows.map((r) => `${r.dimCode} ${r.code}`))
  const memberPairs = new Set<string>()
  if (pairKeys.size > 0) {
    const dimSet = [...new Set(rows.map((r) => r.dimCode))]
    // is_current = true: a display overlay attaches to the LIVE member (publishDisplays
    // joins on is_current). Without this, the preview would call a (dim_code, code) that
    // exists only as a retired SCD-2 revision "valid", then publish would silently drop
    // it — the preview must match what gold enforces (same version-vs-identity root cause).
    const { rows: members } = await db.query<{ dim_code: string; code: string }>(
      `SELECT dim_code, code FROM stats.classifier WHERE dim_code = ANY($1) AND is_current = true`,
      [dimSet],
    )
    for (const m of members) memberPairs.add(`${m.dim_code} ${m.code}`)
  }

  const impact = emptyImpact()
  for (const r of rows) {
    if (!memberPairs.has(`${r.dimCode} ${r.code}`)) {
      issues.push(makeIssue(submissionId, 'validate', 'error', 'UNKNOWN_MEMBER',
        { dimCode: r.dimCode, code: r.code }, r.rowIndex))
    }
    if (!activeLocales.has(r.locale)) {
      issues.push(makeIssue(submissionId, 'validate', 'error', 'UNKNOWN_LOCALE',
        { locale: r.locale }, r.rowIndex))
    }
    if (r.display == null || typeof r.display !== 'object' || Object.keys(r.display).length === 0) {
      issues.push(makeIssue(submissionId, 'validate', 'error', 'EMPTY_DISPLAY',
        { display: r.display }, r.rowIndex))
    }
    impact.newRows++ // display overlays are an upsert; treated as a write per row.
  }

  return { issues, preview: buildPreview(issues, impact) }
}

// ── Preview builder ───────────────────────────────────────────────────────────

function buildPreview(
  issues: ValidationIssue[],
  impact: { newRows: number; revisedRows: number; unchangedRows: number },
): PublishPreview {
  const { errorCount, warnCount } = severityCounts(issues)
  return {
    ...impact,
    errorCount,
    warnCount,
    canPublish: errorCount === 0,
  }
}

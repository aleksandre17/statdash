// ── Ingest — integrity layer (DQAF rules + data-contract compatibility) ───────
//
// The two ADR-0031 §4 additions that sit AROUND the schema validator (validate.ts):
//   · improvement 3 — DQAF validation-as-data: run declarative RuleSpecs after
//     validateObs (warn-severity; surface, never block).
//   · improvement 5 — data-contract compatibility: a PRE-PASS classifying the DSD/
//     codelist change (codelist OPEN, DSD GOVERNED — the gate).
//
// Kept OUT of validate.ts (one concern per file — the schema validator owns the
// structural error gate; this owns the integrity + governance layers). Each function
// here is the thin DB-reading orchestrator that resolves data, then DELEGATES the
// decision to a PURE module (rules/evaluator.ts, canonical/compat.ts) — Dependency
// Inversion: the pure cores never touch the DB.

import type { Queryable, StagedObsRow, ValidationIssue } from './types.js'
import { makeIssue } from './util.js'
import { resolveRules } from './rules/registry.js'
import { runRules } from './rules/evaluator.js'
import { classifyContractChange, type DsdSnapshot } from './canonical/compat.js'

// ── DQAF integrity rules (validation-as-data — ADR-0031 §4 improvement 3) ─────
//
// Runs AFTER validateObs for kind='facts'. validateObs owns the structural error
// gate; THIS adds the DQAF integrity layer as warn-severity (surface, never silently
// drop): a balance/identity/total gap is reported with the offending rows but does NOT
// block publish — only a schema error does. The rules are pure DATA (resolveRules) and
// the evaluator is the built-in interpreter behind the `runRules` port (a VTL engine
// slots there later, signature unchanged — OCP).

/**
 * Resolve the dataset's RuleSpecs and run them over the staged rows, returning the
 * warn-severity integrity issues. Empty when the dataset declares no rules. No DB read
 * today (the rules are built-in data); the DB rule-table is the deferred seam behind
 * resolveRules, so this call site is unchanged when it arrives.
 */
export function runFactRules(
  submissionId: string,
  datasetCode: string,
  rows: StagedObsRow[],
): ValidationIssue[] {
  const rules = resolveRules(datasetCode)
  if (rules.length === 0) return []
  return runRules(rules, rows, { submissionId })
}

// ── Data-contract compatibility pre-pass (ADR-0031 §4 improvement 5) ──────────
//
// Compares the DECLARED DSD/codelists (from the submission's parsed structure) to the
// REGISTERED gold DSD, classifying the change: routine (silent) / codelist-extend
// (CODELIST_EXTENDED warn, auto) / codelist-deprecate (CODELIST_DEPRECATED warn, SCD-2
// retire) / DSD-change (DSD_INCOMPATIBLE error unless a dataset_version is declared).
// Codelist OPEN (BACKWARD-auto), DSD GOVERNED (FULL-required) — the gate.
//
// This is the DB-reading half: it loads the gold DSD snapshot, then delegates the
// decision to the PURE classifyContractChange (canonical/compat.ts). The caller (the
// worker's facts path) runs it as a PRE-PASS — a DSD_INCOMPATIBLE error blocks publish
// via the same canPublish=false gate as any schema error.

/** Load the registered (gold) DSD as the compat snapshot: ordered dims + measure + current members. */
async function loadGoldDsdSnapshot(db: Queryable, datasetCode: string): Promise<DsdSnapshot | null> {
  const { rows: ds } = await db.query<{ measure: string | null }>(
    `SELECT measure FROM stats.dataset WHERE code = $1`, [datasetCode],
  )
  if (!ds[0]) return null // unregistered dataset — validateObs already raises UNKNOWN_DATASET.
  const measureConcept = ds[0].measure ?? 'OBS_VALUE'

  // Ordered dimensions (include the time dim so dim set/order compares like-for-like
  // with the declared DSD, which lists `time` in STRUCTURE.dimensions — Law 1).
  const { rows: dims } = await db.query<{ dim_code: string }>(
    `SELECT dim_code FROM stats.dataset_dimension
      WHERE dataset_code = $1 ORDER BY ord`,
    [datasetCode],
  )
  const dimensions = dims.map((d) => d.dim_code)

  // Current members per dim (is_current=true — the LIVE codelist gold enforces). Only
  // dims with members are asserted; an empty dim is left un-asserted (Postel — the
  // classifier compares membership only where BOTH sides declare it).
  const members: Record<string, string[]> = {}
  for (const d of dims) {
    const { rows: m } = await db.query<{ code: string }>(
      `SELECT code FROM stats.classifier WHERE dim_code = $1 AND is_current = true ORDER BY code`,
      [d.dim_code],
    )
    if (m.length > 0) members[d.dim_code] = m.map((x) => x.code)
  }

  return { datasetCode, dimensions, measureConcept, members }
}

/**
 * The contract-compat pre-pass. `declared` is the snapshot the upload route builds from
 * the parsed CanonicalDsd (dims + measure + declared members + optional datasetVersion).
 * Returns the classification issues stamped with the submissionId. Empty when the
 * dataset is unregistered (validateObs owns that error) or the change is routine.
 */
export async function checkContractCompat(
  db: Queryable,
  submissionId: string,
  declared: DsdSnapshot,
): Promise<ValidationIssue[]> {
  const gold = await loadGoldDsdSnapshot(db, declared.datasetCode)
  if (!gold) return [] // unregistered (first-ever load) — no prior contract to break.
  const change = classifyContractChange(declared, gold)
  return change.issues.map((i) =>
    makeIssue(submissionId, 'validate', i.severity, i.code, { ...i.detail, contractChange: change.kind }),
  )
}

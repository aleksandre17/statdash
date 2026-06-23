// ── Ingest — allowed cube region (ADR-0027 ContentConstraint) ─────────────────
//
// The silver-side, batch-efficient TWIN of the DB authority stats.dim_key_in_
// allowed_region (V26). One concern: load a dataset's authored role='allowed'
// cube region ONCE into an in-memory predicate, then test every staged dim_key
// against it with zero extra round-trips. validateObs (validate.ts) uses this to
// emit ILLEGAL_COMBINATION.
//
// The reading here mirrors the V26 SQL helper EXACTLY so the silver gate and the
// gold fitness function cannot diverge (the SQL helper is the SSOT the fitness
// test asserts; this is its batch form for the approval preview).

import type { Queryable } from './types.js'

/** One conditional rule: "dim=code is legal ONLY WHEN condDim=condCode". */
export interface RegionCondition { dim: string; code: string; condDim: string; condCode: string }

/**
 * The dataset's allowed cube region as an in-memory predicate.
 *
 *   allowedByDim — unconditional allowed sets: dim → set of legal codes. A dim
 *                  ABSENT is unconstrained (any classifier-valid value passes); a
 *                  dim PRESENT constrains the value to the set.
 *   conditions   — conditional rules, AND-conjoined per (dim, code): every rule
 *                  whose (dim, code) matches the key must have its condition hold.
 */
export interface AllowedRegion {
  allowedByDim: Map<string, Set<string>>
  conditions: RegionCondition[]
}

/**
 * Load the dataset's allowed cube region in ONE query. null when the dataset has
 * no role='allowed' constraint (unconstrained — the combination check is opt-in
 * per dataset). The header join means a missing constraint yields zero rows.
 */
export async function loadAllowedRegion(db: Queryable, datasetCode: string): Promise<AllowedRegion | null> {
  const { rows } = await db.query<{
    dim_code: string; code: string; cond_dim_code: string | null; cond_code: string | null
  }>(
    `SELECT m.dim_code, m.code, m.cond_dim_code, m.cond_code
       FROM stats.content_constraint c
       JOIN stats.content_constraint_member m ON m.constraint_id = c.id
      WHERE c.dataset_code = $1 AND c.role = 'allowed'`,
    [datasetCode],
  )
  if (rows.length === 0) return null

  const allowedByDim = new Map<string, Set<string>>()
  const conditions: RegionCondition[] = []
  for (const r of rows) {
    if (r.cond_dim_code === null) {
      let set = allowedByDim.get(r.dim_code)
      if (!set) { set = new Set(); allowedByDim.set(r.dim_code, set) }
      set.add(r.code)
    } else {
      conditions.push({ dim: r.dim_code, code: r.code, condDim: r.cond_dim_code, condCode: r.cond_code! })
    }
  }
  return { allowedByDim, conditions }
}

/**
 * The first reason `dimKey` falls outside `region`, or null when it is in-region.
 * Returns the structured ILLEGAL_COMBINATION detail (ADR-0027) so the approver UI
 * can explain the exact rule that rejected the row. Evaluation order mirrors the
 * V26 DB helper: unconditional sets first, then the AND-conjoined conditions.
 *
 * Callers should test only structurally-sound rows (keys match the DSD, every
 * value is a known code) — reporting an illegal COMBINATION on a row that already
 * has UNKNOWN_DIM/UNKNOWN_CODE would be noise.
 */
export function firstRegionViolation(
  region: AllowedRegion,
  dimKey: Record<string, string>,
): Record<string, unknown> | null {
  // Unconditional: every constrained dim's value must be in its allowed set.
  for (const [dim, allowed] of region.allowedByDim) {
    const value = dimKey[dim]
    if (value === undefined || !allowed.has(value)) {
      return { dim, value: value ?? null, allowed: [...allowed], actual: dimKey }
    }
  }
  // Conditional (AND): every matching "code only when condDim=condCode" must hold.
  for (const c of region.conditions) {
    if (dimKey[c.dim] === c.code && dimKey[c.condDim] !== c.condCode) {
      return {
        dim: c.dim, value: c.code,
        requires: { dim: c.condDim, value: c.condCode },
        actual: dimKey,
      }
    }
  }
  return null
}

// @vitest-environment node
//
// ── FF-DQ-DECLARED — PENDING gate (ADR-046 · SPEC §2.3 / §8, rec #1 folded) ────
//
//  REGISTERED, NOT YET IMPLEMENTED (wave W-P0 names the obligation in the suite so
//  it is never silent). Lands with W-P6 (the raw-data-home IA + DQ-on-ingest).
//
//  The invariant (SPEC §8): DQ expectation-sets are DECLARATIONS on the
//  `CanonicalDsd` at Floor 1 (raw sources) — not-null · in-range · value-in-codelist
//  · uniqueness · referential · freshness — lowered through the EXISTING two-tier
//  validation floor (no second engine — Law 2/4). They are SDMX-grade (rules speak
//  dimensions/codelists/OBS_STATUS, never raw columns), and a failing expectation
//  produces a Cell HONEST STATE (Law 11 / FF-CANVAS-NEVER-LIES) — never a swallowed
//  error, a fake 0, or a silent blank. The steward sees a validation report at the
//  front door; the reader sees an honest cell.
//
//  ADR owed (SPEC §2.3): the expectation-declaration contract (≥2 alts —
//  VTL-embedded vs an own predicate DSL over @statdash/expr, the latter recommended:
//  arrow-clean, one evaluator). This gate goes live once that contract is decided
//  and threaded through the validation floor. Home: apps/api ingest + packages/contracts.

import { describe, it } from 'vitest'

describe('FF-DQ-DECLARED — DQ expectations declare at Floor 1, fail as honest cells (ADR-046 §2.3)', () => {
  it.todo('an expectation-set is a declaration on the CanonicalDsd, not imperative code (Law 2)')
  it.todo('expectations lower through the EXISTING two-tier validation floor (no second engine)')
  it.todo('rules are SDMX-grade — dimensions/codelists/OBS_STATUS, never raw column names')
  it.todo('a failed expectation surfaces as a Cell honest state, never a swallowed error (Law 11)')
})

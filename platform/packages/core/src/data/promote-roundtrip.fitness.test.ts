// ── FF-PROMOTE-ROUNDTRIP — PENDING gate (ADR-046 · SPEC §9 E2 / §8) ────────────
//
//  REGISTERED, NOT YET IMPLEMENTED (wave W-P0 names the obligation in the suite so
//  it is never silent). Lands with the promotion affordance (E2, W-P2→ semantic
//  layer).
//
//  The ecology rule (ADR-046 E2 / SPEC §9): reusable-across-pages calculations are
//  governed metrics (Floor 2); element-local shaping is a pipeline step (Floor 3).
//  With ADR-045 there are now TWO ways to express e.g. growth — a governed
//  calc-metric (`$prev`) or a pipeline `Derive/window` step — so without a named
//  boundary the old hand-built-growth drift-class re-enters through the pipeline
//  door. The surface therefore gives a Derive step a "promote to governed metric"
//  affordance (author proposes → steward blesses → the step is replaced by a
//  governed ref — the Looker/dbt promotion path).
//
//  The invariant (SPEC §8): a PROMOTED step's governed replacement resolves
//  BYTE-IDENTICALLY to the local Derive step it replaced — promotion is a
//  refactor, never a semantic change (mirrors the FF-PIPELINE-EQUIV discipline one
//  layer up). Home: packages/core (metric registry ⟷ transform derive/window).

import { describe, it } from 'vitest'

describe('FF-PROMOTE-ROUNDTRIP — a promoted Derive step resolves identically to its governed metric (ADR-046 E2)', () => {
  it.todo('a local Derive/window step promotes to a governed calc-metric (author proposes, steward blesses)')
  it.todo('the promoted governed ref resolves BYTE-IDENTICALLY to the replaced local step (a refactor, not a change)')
  it.todo('reusable calc ⇒ Floor-2 metric; element-local shaping ⇒ Floor-3 pipeline step (the ecology boundary held)')
})

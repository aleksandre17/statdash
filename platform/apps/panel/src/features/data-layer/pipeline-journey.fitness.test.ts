// ── FF-JOURNEY-PIPE — PENDING gate (ADR-046 · SPEC §4 J-PIPE / §8) ─────────────
//
//  REGISTERED, NOT YET IMPLEMENTED (wave W-P0 names the program's obligations in
//  the suite so none is silent). This gate proves the pipeline authoring JOURNEY
//  end-to-end, live — it is the ⛔ co-gate (with FF-PIPELINE-EQUIV) on the W-P5
//  default-emission flip: the old tag editors demote ONLY when this is green.
//
//  J-PIPE (SPEC §4): the author picks a governed metric → SEES the raw grid (the
//  browse-first preview, SPEC §9 E1) → adds Filter + Aggregate + Derive → SEES each
//  step's grid change (the live per-step grid, SPEC §3.2, a projection of the
//  reactive graph — never a preview cache, Refusal #6) → SEES the generated query
//  (SPEC §3.3, read-only in the author plane) → binds it to an element → the
//  published page shows the HONEST result (Cell honest states, never a fake 0 —
//  Law 11 / FF-CANVAS-NEVER-LIES).
//
//  Lands with: W-P1 (live grid) → W-P2 (three-pane shell) → walked at/after W-P5.
//  Implementation home: the panel e2e offline bridge (boot.e2e.ts). See SPEC §4.

import { describe, it } from 'vitest'

describe('FF-JOURNEY-PIPE — pipeline authoring journey, live (ADR-046 §4)', () => {
  it.todo('author picks a governed metric → the browse grid is already on screen (SPEC §9 E1)')
  it.todo('adds Filter + Aggregate + Derive → each step’s live grid reflects its output (SPEC §3.2)')
  it.todo('the generated-query pane shows the declarative pipeline, governed nouns only (SPEC §3.3)')
  it.todo('binds to an element → the published page renders the honest result, no fake 0 (SPEC §4)')
})

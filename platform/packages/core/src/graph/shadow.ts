// ── graph/shadow — the shadow-mode parity harness [AR-49 V2 / ADR-024] ────────
//
//  SHADOW MODE (the crux of V2): the reactive graph runs ALONGSIDE the current path,
//  never instead of it, and every transition is diffed. Given a page + a sequence of
//  state changes (geo / sector / toYear / perspective / locale interactions), this
//  harness proves the graph is EQUIVALENT to the current path in OUTPUT while being
//  EXACT in WORK — the evidence the V3 render-switch (the one-way door, D-RRA-2) needs.
//
//  ── What "parity" honestly means (reconciling the coarse baseline with the graph) ──
//  The current path re-walks the WHOLE tree on any state change (V0 baseline: all 170
//  nodes coarse), but ~156 of those re-walks recompute BYTE-IDENTICAL rows — their
//  output did not change. The graph fires EXACTLY the nodes whose output changes (geo →
//  14, not 170). A naive "invalidation set == what the current path touches" would ALWAYS
//  fail — that divergence is the graph's WHOLE POINT (SPEC §3, ~12x over-fire eliminated).
//  So parity is asserted against the current path's EFFECTIVE (output-changing) set:
//
//    changed(Δ)     = { n : currentPathRows_N(n) ≠ currentPathRows_{N-1}(n) }   (the oracle)
//    invalidated(Δ) = graph.setState(Δ).invalidated
//
//    ① NO UNDER-FIRE   changed ⊆ invalidated   — the graph recomputes EVERYTHING that
//                       actually changed. A miss here is a STALENESS BUG (the crux to STOP on).
//    ② VALUE PARITY    ∀n  graph.get(n) == currentPathRows_N(n)  — the nodes the graph
//                       SKIPS serve correct memos; the recomputed ones equal the oracle.
//                       (This corroborates ① from the observable side: a wrongly-kept memo
//                       on a genuinely-changed node surfaces here as a mismatch.)
//    ③ OVER-FIRE       invalidated ∖ changed   — reported, not failed: the graph's OWN
//                       residual over-fire (should be ≤ the coarse baseline; ideally ~0).
//
//  The derivation body is INJECTED (`DeriveFn`) so the harness never forks the render
//  path: the SAME `derive` computes both the graph's cells and the oracle, so any
//  divergence is attributable to the GRAPH's memo/invalidate decisions alone — exactly
//  what shadow mode must isolate. (React injects the real `resolveNodeRows`; the core
//  fitness injects a core-expressible mirror.)

import type { DepNode } from './extractDeps'
import { compilePage, type DeriveFn, type GraphState } from './compilePage'
import { deepEqual, type Equals } from './engine'

/** One interaction in a shadow sequence — a full state snapshot after the change. */
export interface ShadowStep {
  label: string
  state: GraphState
}

/** The parity diff for one transition (state N-1 → N). */
export interface ShadowTransition {
  label: string
  /** Cell ids the graph marked dirty (its invalidation fan-out). */
  invalidated:      string[]
  /** Cell ids whose oracle (current-path) rows actually changed. */
  changed:          string[]
  /** changed ∖ invalidated — MUST be empty (a staleness bug: the graph missed a real change). */
  underFired:       string[]
  /** invalidated ∖ changed — the graph's residual over-fire (reported, not a failure). */
  overFired:        string[]
  /** Cell ids where graph.get(n) ≠ oracle rows — MUST be empty (value parity). */
  valueMismatches:  string[]
  /** Baseline: nodes the coarse current path re-walks (all data cells). */
  coarseWalk:       number
  /** |invalidated| — the graph's exact fan-out. */
  exactInvalidated: number
}

export interface ShadowReport {
  /** true ⇔ every transition has empty `underFired` AND empty `valueMismatches`. */
  ok:          boolean
  nodeCount:   number
  transitions: ShadowTransition[]
  /** The single busiest exact fan-out across the sequence (vs `nodeCount` coarse). */
  busiestExact: number
}

/**
 * Run a page + a state-change sequence in shadow mode and produce the parity diff.
 *
 * The first step SEEDS state 0 (compiled + every memo warmed) and reports no transition;
 * each subsequent step is one diffed transition. `ok` is the FF-GRAPH-PARITY gate.
 */
export function runShadowParity<T>(
  page: unknown,
  derive: DeriveFn<T>,
  sequence: readonly ShadowStep[],
  opts: { perspectiveIds?: readonly string[]; equals?: Equals<T> } = {},
): ShadowReport {
  if (sequence.length === 0) throw new Error('runShadowParity: sequence must have at least the initial state')
  const equals = opts.equals ?? ((a: T, b: T) => deepEqual(a, b))

  const qg = compilePage<T>(page, derive, {
    perspectiveIds: opts.perspectiveIds,
    initialState:   sequence[0]!.state,
    equals,
  })
  qg.evaluateAll()                       // warm every memo at state 0

  const ids = qg.nodeIds
  const nodeOf = (id: string): DepNode => qg.nodeOf(id)

  // Oracle at state 0 — the current path recomputes every node on every walk.
  let oraclePrev = new Map<string, T>()
  for (const id of ids) oraclePrev.set(id, derive(nodeOf(id), sequence[0]!.state))

  const transitions: ShadowTransition[] = []
  let busiestExact = 0

  for (let i = 1; i < sequence.length; i++) {
    const step = sequence[i]!

    // Oracle at state N (the current path: fresh derive for every node).
    const oracleNext = new Map<string, T>()
    for (const id of ids) oracleNext.set(id, derive(nodeOf(id), step.state))

    // Which nodes' OUTPUT actually changed (the effective set to match).
    const changed = ids.filter((id) => !equals(oraclePrev.get(id)!, oracleNext.get(id)!))

    // Advance the graph and read every cell (memoized unless invalidated).
    const { invalidated } = qg.setState(step.state)
    const graphNext = new Map<string, T>()
    for (const id of ids) graphNext.set(id, qg.get(id))

    const invSet     = invalidated
    const changedSet = new Set(changed)
    const underFired = changed.filter((id) => !invSet.has(id))
    const overFired  = [...invSet].filter((id) => !changedSet.has(id))
    const valueMismatches = ids.filter((id) => !equals(graphNext.get(id)!, oracleNext.get(id)!))

    transitions.push({
      label:            step.label,
      invalidated:      [...invSet],
      changed,
      underFired,
      overFired,
      valueMismatches,
      coarseWalk:       ids.length,
      exactInvalidated: invSet.size,
    })
    busiestExact = Math.max(busiestExact, invSet.size)
    oraclePrev = oracleNext
  }

  const ok = transitions.every((t) => t.underFired.length === 0 && t.valueMismatches.length === 0)
  return { ok, nodeCount: ids.length, transitions, busiestExact }
}

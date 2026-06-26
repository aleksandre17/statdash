// ── Canonical op registry — the transform-op extension point (OCP) ────────────
//
// ADR-0031 §3 (op registry, PRIMARY) / Wave 1c. A data-keyed dispatch table
// (Registry pattern: `op name → handler`) — closed for modification (the parser
// never changes), open for extension (a new op = a new registry entry).
//
// BAKE-NOW: the canonical workbook is ALREADY pre-transformed (tidy, coded), so
// the PRIMARY path needs only the `identity` (passthrough) op — there is no melt,
// no code-from-label, no surrogate translation at canonical ingest. Those live in
// the SECONDARY (legacy→canonical) converter (`work/legacy-to-canonical/*`).
//
// SEAM-DEFER: `melt`, `columnsToRows`, `repeatingBlocks`, `fromLabel`, `slug`
// already exist as the converter's `primitives.js`/`build-*.js` functions; promote
// them into this registry when a 2nd legacy template arrives (ADR-0030's YAGNI
// line). The registry shape below is the seam that makes that promotion additive.

import type { Cell } from './read-workbook.js'

/** A transform op: a pure cell-matrix → cell-matrix function (no IO, Law 2). */
export type Op = (rows: Cell[][]) => Cell[][]

/** The identity op — the canonical DATA sheet is already tidy; pass it through. */
export const identityOp: Op = (rows) => rows

/**
 * The op registry: `op name → handler`. Frozen at module scope (the dispatch
 * table is data); `getOp` is the closed-for-modification lookup. A new op is a
 * new entry here, never an edit to the interpreter.
 */
const OPS: Record<string, Op> = {
  identity: identityOp,
}

/** Look up an op by name. Unknown op names fail fast (never a silent passthrough). */
export function getOp(name: string): Op {
  const op = OPS[name]
  if (!op) throw new Error(`Unknown canonical op: "${name}"`)
  return op
}

/** Whether an op name is registered (for the route/registry-dispatch fitness test). */
export function hasOp(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(OPS, name)
}

// ── perspective-effects — reactive param mutation on a perspective transition [C3] ──
//
//  THE FORWARD RECOVERY of the reactive `effects` capability lost at the P5
//  "byte-identical" perspective migration (which modeled only VISIBILITY, silently
//  dropping the param-mutation that made a toggle reconfigure the dashboard). Re-homed
//  as a FIRST-CLASS transition on the perspective seam: each `PerspectiveDef` may carry
//  `onEnter`/`onExit` effects, applied when the axis moves INTO / OUT OF that
//  perspective. "Toggle a mode → the dashboard reconfigures its params" — the Grafana
//  chained-template-variable / Retool onChange pattern, made declarative + Constructor-
//  authorable (Law 2: `set` values are ExprVal/literals/null, never functions).
//
//  Uses the NEW perspective vocabulary — NOT the retired `effects`/`applyEffects` names
//  (the check-laws retirement guards from 4ccd042 stay intact; this is a distinct
//  capability on a distinct seam).
//
//  PURE + DETERMINISTIC (no React, no async, no store). The React toggle (the ONE write
//  point, usePerspectiveContext.set) computes the mutation map here and applies it
//  atomically via FilterContext.setMany alongside the perspective-id write — the URL
//  stays the SSOT, so `perspective = f(state)` still governs RENDER; only the one-shot
//  transition rewrites the affected params.
//
//  REUSE (no new machinery):
//    • perspective-is predicate  — enter/exit are decided by the SAME `perspective-is`
//      op the visibility gate uses (evalVisibility): a def is ENTERED when
//      perspective-is(def.id) holds under the NEXT state but not the PREV, EXITED when
//      it held under PREV but not NEXT. Multi-def-ready, one predicate SSOT.
//    • sandboxed ExprVal evaluator — each `set` value is evaluated by evalExpr against
//      the current filter params (the same sandbox resolveDefaults' Tier-2 defaults use);
//      `null` clears the param (an empty write — FilterContext.setMany deletes on '').
//
//  LAW 1: the axis param + every `set` key is DATA (a Record key), never a branch on a
//  literal dim name.

import { evalExpr } from '@statdash/expr'
import type { ExprScope } from '@statdash/expr'
import type { DimVal }    from '../sdmx'
import type { PerspectiveAxis, PerspectiveEffect } from './perspective-axis'
import { evalVisibility } from './visibility'

/**
 * Fold one `PerspectiveEffect.set` into the mutation map: each value is evaluated by the
 * sandboxed ExprVal evaluator against `scope`; `null` (or an unresolved ref) CLEARS the
 * param (written as '' — setMany deletes empty values, yielding a clean permalink).
 */
function applyEffectSet(
  effect: PerspectiveEffect | undefined,
  scope:  ExprScope,
  out:    Record<string, string>,
): void {
  if (!effect) return
  for (const [key, val] of Object.entries(effect.set)) {
    if (val === null) { out[key] = ''; continue }          // explicit clear
    const resolved = evalExpr<DimVal>(val, scope)
    out[key] = resolved != null ? String(resolved) : ''    // unresolved ⇒ clear
  }
}

/**
 * Compute the reactive param mutations for a perspective transition on ONE axis.
 *
 * Given the axis, its URL param, the resolved PREV + NEXT perspective ids, and the
 * current filter params, returns a `{ key: value }` mutation map for the caller to apply
 * atomically (alongside the perspective-id write). An empty-string value CLEARS a param.
 *
 *   • prevId === nextId  → no transition → `{}` (identity; the caller writes only the id).
 *   • entering `nextId`  → apply that def's `onEnter.set`.
 *   • exiting  `prevId`  → apply that def's `onExit.set`.
 *
 * Enter/exit membership is decided by the `perspective-is` predicate (evalVisibility) —
 * the SAME op the visibility gate uses — evaluated under a `{ [param]: id }` state for
 * PREV and NEXT (ids are pre-resolved by the caller, so default-elision never hides a
 * transition). Pure + deterministic: same inputs ⇒ same map.
 */
export function applyPerspectiveEffects(
  axis:   PerspectiveAxis,
  param:  string,
  prevId: string,
  nextId: string,
  params: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {}
  if (prevId === nextId) return out

  const scope: ExprScope = { dims: { ...params } as Record<string, DimVal>, derived: {} }
  const fr        = params as Record<string, unknown>
  const prevState = { [param]: prevId }
  const nextState = { [param]: nextId }

  for (const def of axis.perspectives) {
    const gate    = { op: 'perspective-is' as const, perspective: def.id, param }
    const wasHere = evalVisibility(gate, fr, prevState)
    const isHere  = evalVisibility(gate, fr, nextState)
    if (isHere && !wasHere) applyEffectSet(def.onEnter, scope, out)  // entered
    if (wasHere && !isHere) applyEffectSet(def.onExit,  scope, out)  // exited
  }

  return out
}

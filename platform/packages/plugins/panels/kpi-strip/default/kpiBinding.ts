// ── kpiBinding — the STATIC "is this card bound?" predicate (W1 · Canon C2) ─────
//
//  The canvas never lies (AR-52 Canon C2 / FF-CANVAS-NEVER-LIES): an UNBOUND KPI —
//  one whose measure/metric was never chosen (the authoring "—" / "not set" state) —
//  must render a DECLARED honest affordance, never a fake `0`. Whether a card is
//  bound is a STATIC property of its KpiSpec shape: it needs NO store read, so the
//  honest state resolves identically in structural, live, and published render.
//
//  This mirrors the value-spec discriminants of the core interpreter (core/data/kpi.ts
//  `resolveValue`): each `KpiValueSpec` kind carries the measure(s) it reads, and a
//  card is bound iff every measure it would read is a non-empty governed ref. Kept
//  co-located with the KPI shell (the Bounded-Element Law: the element knows its own
//  contract) — a raw code vs a governed metric-id is not distinguished here (both are
//  "a chosen measure"); the ONLY thing that reads as unbound is the AUTHORED-EMPTY
//  select. (The canonical zero-drift home for this — a pure `@statdash/engine`
//  predicate shared with the interpreter — is flagged to the lead as the core
//  honest-state seam; until then this is the KPI element's own declaration.)
//
import type { KpiSpec, KpiValueSpec } from '@statdash/engine'

/** A measure/metric ref is "chosen" iff it is a non-empty, non-whitespace string. */
function refChosen(ref: unknown): boolean {
  return typeof ref === 'string' && ref.trim().length > 0
}

/**
 * Is this KPI value-spec bound — i.e. would the interpreter read a real, chosen
 * measure? Mirrors core `resolveValue`'s per-kind reads exactly, so "bound" here ≡
 * "reads a governed observation" there (no drift with the number the card would show).
 */
export function isKpiValueBound(value: KpiValueSpec | undefined): boolean {
  if (!value || typeof value !== 'object') return false
  switch (value.type) {
    case 'point':
    case 'yoy':
    case 'cagr':
    case 'mean':
      return refChosen(value.measure)
    case 'share':
      return refChosen(value.num?.measure) && refChosen(value.denom?.measure)
    case 'expr':
      return Array.isArray(value.codes) && value.codes.length > 0 && value.codes.every(refChosen)
    case 'metric':
      return refChosen(value.metric)
    default:
      // An unknown / absent discriminant is not a readable measure → unbound.
      return false
  }
}

/** Is this KPI card bound to a real measure, or is it the authored-empty (unbound) state? */
export function isKpiSpecBound(spec: KpiSpec): boolean {
  return isKpiValueBound(spec?.value)
}

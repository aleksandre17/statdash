// ── resolveDirectional — the directional cross-filter-pivot LAW, once [AR-42 P2] ──
//
//  AR-38 encoded a directional cross-filter (select a dim → it becomes the stacked
//  FOCUS series, its CO-dimension expands on x; a compound selection resolves by a
//  static priority) as SIX hand-authored `op:if` truth-table derives per page
//  (`_xDim/_seriesDim/_mark/_byDims/_sortBy/_sortDir`). That is the interaction
//  analogue of ADR-041's "four containment grammars": the directional LAW re-asked
//  once per page, answered each time by a locally-lawful hand-derivation.
//
//  This is that law lifted to ONE declared, DIMENSION-BLIND relation (Law 1 — no
//  privileged dim/param name, only the declared `focus`/`co`/`priority`). A single
//  var op `{ op:'directional', focus, co, priority, emit:'axis' }` RETURNS the same
//  six-field encoding-axis assignment the derives produced, riding the existing
//  evalVarMap → resolveEncodingRefs/resolvePipeRefs seams — zero new plane, the
//  consumers (`{$ctx:_xDim}` …) unchanged. New two-dim directional cross-filter =
//  a declaration, not six re-authored `op:if`s (the "next kind is a declaration,
//  not a bridge" property, now for interaction).
//
//  Pure + framework-free (packages/core). The multi-output nature (one var → six
//  named outputs) is a VarMap-level concern, so evalVarMap (react) spreads the
//  returned record into the derived scope via `resolveMultiVar`; the LAW lives here.

import type { DimVal } from '../sdmx'

/**
 * The declared directional cross-filter-pivot relation between two dimensions.
 * Dimension-blind: the op reads ONLY the declared `focus`/`co` dim names and the
 * `priority` param keys — never a hardcoded dim/param literal (Law 1).
 */
export interface DirectionalSpec {
  op: 'directional'
  /**
   * The FOCUS dimension name. When its selection is active it takes the SERIES
   * (stacked) channel and pins the view; its label field is `${focus}Label`, its
   * roll-up axis `${focus}`, its sort-order field `${focus}Order`.
   */
  focus: string
  /**
   * The CO dimension name. It takes the X (expanded) channel when the focus is
   * active, and is the default primary dim on X when nothing is selected.
   */
  co: string
  /**
   * The two SELECTION PARAM keys, POSITIONAL to [focus, co] and in priority order:
   * `priority[0]` is the focus's selection param (and wins compound ties — both
   * active ⇒ the focus is the series), `priority[1]` is the co's selection param.
   * (The param key need not equal the dim name — e.g. the `geo` dim is selected via
   * a `region` param — which is exactly why the mapping is declared, not inferred.)
   */
  priority: readonly string[]
  /** Output emission profile. `'axis'` → the encoding-axis assignment (x/series/mark/by/sort). */
  emit: 'axis'
  /**
   * Additional GRAIN dims always present in the ACTIVE roll-up `by` list (e.g. the
   * time axis), appended after `[focus, co]`. Declared, never hardcoded, so the op
   * stays dimension-blind (Law 1). Default `[]`.
   */
  grain?: readonly string[]
  /**
   * The values that count as "no selection" for BOTH params. A param whose value is
   * in this set is INACTIVE. Default `['']` (the empty sentinel); a page that carries
   * an SDMX total member as an unselected sentinel declares it (e.g. `['', '_T']`) —
   * so the total literal stays in config, out of the engine (Law 2).
   */
  unselected?: readonly string[]
}

/** The six encoding-axis outputs of the `emit:'axis'` profile — generic encoding roles, never dim names. */
export interface DirectionalAxis {
  _xDim:      string
  _seriesDim: string
  _mark:      string
  _byDims:    string
  _sortBy:    string
  _sortDir:   string
}

/** A directional spec discriminant guard (structural, dim-blind). */
export function isDirectionalSpec(v: unknown): v is DirectionalSpec {
  if (v === null || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return o['op'] === 'directional'
    && typeof o['focus'] === 'string'
    && typeof o['co'] === 'string'
    && Array.isArray(o['priority'])
}

// A param value is ACTIVE (a real selection) unless it is one of the declared
// unselected sentinels — the exact `{$ctx:X} nin unselected` test the derives ran.
function isActive(v: DimVal | undefined, unselected: readonly string[]): boolean {
  return !unselected.includes(v == null ? '' : String(v))
}

/**
 * Resolve the directional relation to its `emit:'axis'` encoding assignment.
 *
 * Byte-identical (across the directional state matrix) to the six hand-authored
 * `op:if` derives it replaces — proven by `directional.fitness.test.ts`.
 */
export function resolveDirectional(
  spec:   DirectionalSpec,
  params: Record<string, DimVal>,
): DirectionalAxis {
  const { focus: f, co: c } = spec
  const [focusParam, coParam] = spec.priority
  const unselected = spec.unselected ?? ['']
  const grain      = spec.grain ?? []

  const fA = isActive(params[focusParam ?? ''], unselected)
  const cA = isActive(params[coParam ?? ''],    unselected)
  const bar = fA || cA

  return {
    // FOCUS channel (stacked). Focus wins when active; else the co-dim; else none (donut).
    _seriesDim: fA ? `${f}Label` : cA ? `${c}Label` : '',
    // CO channel (expanded) — the inverse of the focus; the co-dim is the default primary on x.
    _xDim:      fA ? `${c}Label` : cA ? `${f}Label` : `${c}Label`,
    // Bar whenever either dim is active; donut summary when neither.
    _mark:      bar ? 'bar' : 'donut',
    // Roll-up grain: both dims + the declared ambient grain when active; the co-dim alone for the donut.
    _byDims:    bar ? [f, c, ...grain].join(',') : c,
    // Focus active → rank by value desc; co-only → the focus's declared order asc; none → value desc.
    _sortBy:    fA ? 'value' : cA ? `${f}Order` : 'value',
    _sortDir:   fA ? 'desc'  : cA ? 'asc'       : 'desc',
  }
}

/**
 * The MULTI-VAR op front-door for evalVarMap: a var whose expr emits MULTIPLE named
 * outputs (spread into the derived scope) rather than a single value. Returns the
 * emitted record, or `null` when `expr` is an ordinary single-value expr (fall
 * through to evalExpr). Keeps the `op:'directional'` discriminant in core — react
 * dispatches on the null-vs-record result, never on the op literal.
 */
export function resolveMultiVar(
  expr:   unknown,
  params: Record<string, DimVal>,
): Record<string, DimVal> | null {
  if (isDirectionalSpec(expr)) {
    // Widen the typed DirectionalAxis to the generic emitted-var record (all values
    // are DimVal strings) — one entry-copy, no unsafe cast.
    const out: Record<string, DimVal> = {}
    for (const [k, v] of Object.entries(resolveDirectional(expr, params))) out[k] = v
    return out
  }
  return null
}

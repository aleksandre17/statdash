// ── perspective-axis parser + ctx-scoping [VISION #3 / P1] ────────────────────
//
//  ONE internal representation downstream. The engine reads a page's declared
//  `perspectives` (the `PerspectivesByParam` Record) if present; ELSE it DERIVES a
//  single-axis `PerspectiveAxis` from the LEGACY `modeOrder` + `ContextMapping.timeMode`
//  (the Postel desugar) so every un-migrated config flows into the SAME new path
//  unchanged (Strangler-Fig). When NEITHER is present the parser returns `undefined`
//  — no axis instantiated, no registry lookup, no scoping mutation: the N=1-free
//  property (FF-ONE-VIEW-NO-MACHINERY), byte-identical render.
//
//  LAW 1: the axis param is the Record KEY (data); the engine never branches on a
//  literal. LAW 2: the derived axis is pure data (label/timeBinding), no functions.
//
//  ARROW: engine-pure (packages/core). The React layer EXTRACTS the three inputs
//  from its `NodePageConfig` (perspectives, modeOrder, the context timeMode param)
//  and hands them here — core never imports the react page type.

import type { SectionContext }     from '../core/context'
import { TIME_DIM }                from '../core/context'
import type { DimVal }             from '../sdmx'
import type { PerspectiveAxis, PerspectivesByParam, PerspectiveDef } from './perspective-axis'
import { effectiveBounds, isYearsSpec } from '../core/time-dimension'
import { PERSPECTIVE_PARAM }       from './perspective-state'

// ── ParsePerspectiveInput — the three legacy/new inputs, extracted by the caller ──
//
//  The React SiteRenderer / SSR builders read these off `NodePageConfig`:
//    perspectives  — page.perspectives (the new declared axes), if any.
//    modeOrder     — page.modeOrder (legacy ordered mode ids).
//    timeModeParam — page.filterSchema.context.timeMode (the legacy URL param name).
//  Keeping the parser input a plain bag keeps core decoupled from the react page type.
export interface ParsePerspectiveInput {
  perspectives?:  PerspectivesByParam
  modeOrder?:     readonly string[]
  timeModeParam?: string
}

/**
 * Parse a page's perspective axes into ONE internal representation.
 *
 *   1. `perspectives` declared   → returned as-is (the new path).
 *   2. else legacy `modeOrder` (+ a `timeModeParam`) → DERIVE a single-axis
 *      `{ [param]: { perspectives: [...] } }` (the desugar) keyed by the legacy
 *      param name (so `?mode=range` keeps selecting the active id).
 *   3. else `undefined` — no axis (N=1-free; the caller runs the plain path).
 *
 * The derived perspectives carry only `id` + a minimal `label` (id echoed for both
 * locales — legacy mode ids have no authored label here; the legacy `timeModes`
 * labels stay owned by the mode bar). NO `scope` is derived: legacy pages keep
 * binding time imperatively through their own filter params until P5 authors
 * `scope.timeBinding`. The derived axis exists so the SSOT (`perspectiveState`) and
 * the visibility gate flow through the new path; it does not yet relocate the
 * legacy time binding (that is P5's config migration).
 */
export function parsePerspectiveAxes(
  input: ParsePerspectiveInput,
): PerspectivesByParam | undefined {
  if (input.perspectives && Object.keys(input.perspectives).length > 0) {
    return input.perspectives
  }
  const order = input.modeOrder
  if (order && order.length > 0) {
    const param = input.timeModeParam ?? PERSPECTIVE_PARAM
    const perspectives: PerspectiveDef[] = order.map((id) => ({
      id,
      label: { ka: id, en: id },
    }))
    return { [param]: { perspectives } }
  }
  return undefined
}

/**
 * The active perspective id for one axis param — read from the `perspectiveState`
 * SSOT, falling back to the axis default (`perspectives[0].id`, the ONE SSOT for the
 * default — LOW-1) when the URL carries no value. Mirrors the live
 * `available[0] ?? 'year'` fallback exactly.
 */
export function activeIdForAxis(
  axis:             PerspectiveAxis,
  param:            string,
  perspectiveState: Record<string, string> | undefined,
): string | undefined {
  const fromState = perspectiveState?.[param]
  if (fromState !== undefined && axis.perspectives.some((p) => p.id === fromState)) {
    return fromState
  }
  return axis.perspectives[0]?.id
}

/**
 * Find the active `PerspectiveDef` across all of a page's axes — the perspective
 * whose `scope` the ctx-scoping step applies. With one axis today this is the
 * single axis's active perspective; the Record walk is multi-axis-ready (D-MULTIAXIS).
 */
function activeDefs(
  axes:             PerspectivesByParam,
  perspectiveState: Record<string, string> | undefined,
): PerspectiveDef[] {
  const out: PerspectiveDef[] = []
  for (const [param, axis] of Object.entries(axes)) {
    const id  = activeIdForAxis(axis, param, perspectiveState)
    const def = axis.perspectives.find((p) => p.id === id)
    if (def) out.push(def)
  }
  return out
}

// ── scopeCtxByPerspective — the declarative replacement for legacy time-mode ──
//
//  Apply the ACTIVE perspective's `scope.timeBinding` to `ctx.dims` BEFORE
//  `interpretSpec`/`interpretKpi`. This is the declarative replacement for what the
//  legacy time-mode did imperatively (the year-pin vs [from,to] clamp): instead of
//  the renderer mutating filter state on a mode switch, the active perspective's
//  binding is folded into `ctx.dims` at resolve time — `perspective = f(state)`.
//
//  The binding's `dim` value is written into `ctx.dims[dim]` (SYNTHESIS §2): for a
//  single-period pin the resolved year; for a window the resolved [from,to] bounds
//  (under the binding's own `dim` + the conventional from/to convention the legacy
//  resolvers read). Generic over the dim key (Law 1) — no 'time' literal here.
//
//  IDENTITY when there is no active binding: a page with no axes (parse → undefined),
//  or an active perspective with no `scope.timeBinding`, returns `ctx` UNCHANGED
//  (referential-equality preserved) — byte-identical, the N=1-free path. Legacy
//  pages (derived axis, no derived scope) hit exactly this identity branch, so their
//  imperative time binding is untouched until P5 authors `scope.timeBinding`.
//
export function scopeCtxByPerspective(
  ctx:              SectionContext,
  axes:             PerspectivesByParam | undefined,
  perspectiveState: Record<string, string> | undefined,
): SectionContext {
  if (!axes) return ctx

  let dims: Record<string, DimVal> | undefined
  for (const def of activeDefs(axes, perspectiveState)) {
    const tb = def.scope?.timeBinding
    if (!tb) continue
    const dim   = tb.dim || TIME_DIM
    const range = tb.range
    if (range === undefined) continue

    if (isYearsSpec(range)) {
      // A single-period PIN (year perspective): a one-element year list pins that
      // year; a longer list leaves the selection to the resolver (no single pin).
      if (range !== 'all' && range.length === 1) {
        dims ??= { ...ctx.dims }
        dims[dim] = range[0] as DimVal
      }
    } else {
      // A [from,to] WINDOW (range perspective): resolve the ctx-ref/literal bounds
      // through the SAME seam the legacy fromDim/toDim used (effectiveBounds), then
      // write them under the conventional from/to keys so the existing range
      // resolvers read them. `effectiveBounds` reads ctx-ref bounds from ctx.dims.
      const { from, to } = effectiveBounds({ timeDimension: { dim, range } }, ctx)
      dims ??= { ...ctx.dims }
      if (from) dims[`${dim}From`] = from as DimVal
      if (to && to !== Infinity) dims[`${dim}To`] = to as DimVal
    }
  }

  return dims ? { ...ctx, dims } : ctx
}

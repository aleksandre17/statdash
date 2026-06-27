// ── perspective-axis parser + ctx-scoping [VISION #3] ─────────────────────────
//
//  ONE internal representation downstream. The engine reads a page's declared
//  `perspectives` (the `PerspectivesByParam` Record). When absent the parser returns
//  `undefined` — no axis instantiated, no registry lookup, no scoping mutation: the
//  N=1-free property (FF-ONE-VIEW-NO-MACHINERY), byte-identical render. Every page
//  declares its axis explicitly (the legacy `modeOrder`/`timeMode` desugar was
//  retired with System A, VISION #3 / P6).
//
//  LAW 1: the axis param is the Record KEY (data); the engine never branches on a
//  literal. LAW 2: the axis is pure data (label/timeBinding), no functions.
//
//  ARROW: engine-pure (packages/core). The React layer EXTRACTS `perspectives` from
//  its `NodePageConfig` and hands it here — core never imports the react page type.

import type { SectionContext }     from '../core/context'
import { TIME_DIM }                from '../core/context'
import type { DimVal }             from '../sdmx'
import type { PerspectiveOption }  from '../perspective/types'
import { resolveLocaleString }     from '../i18n/types'
import type { PerspectiveAxis, PerspectivesByParam, PerspectiveDef, PerspectiveTimeBinding } from './perspective-axis'
import { effectiveBounds, isYearsSpec, resolveTimePin } from '../core/time-dimension'

// ── ParsePerspectiveInput — the declared axes, extracted by the caller ────────
//
//  The React SiteRenderer / SSR builders read `perspectives` off `NodePageConfig`.
//  Keeping the parser input a plain bag keeps core decoupled from the react page type.
export interface ParsePerspectiveInput {
  perspectives?: PerspectivesByParam
}

/**
 * Parse a page's perspective axes into ONE internal representation.
 *
 *   1. `perspectives` declared → returned as-is.
 *   2. else `undefined` — no axis (N=1-free; the caller runs the plain path).
 */
export function parsePerspectiveAxes(
  input: ParsePerspectiveInput,
): PerspectivesByParam | undefined {
  if (input.perspectives && Object.keys(input.perspectives).length > 0) {
    return input.perspectives
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

// ── perspectiveOptions — the toggle's available list, FROM THE AXIS ───────────
//
//  Decision (B): the perspective axis OWNS its toggle presentation. The switcher
//  (the `perspective-bar` node, which reads `ctx.perspective.available`) derives its
//  options HERE — id + label + icon straight off each `PerspectiveDef`, in array
//  order (= the nav-sort order). The label/icon SSOT is the authored `PerspectiveDef`.
//
//  Returns `PerspectiveOption[]` (the toggle's `available` element type) feeding the
//  `perspective` triad on RenderContext. `PerspectiveDef.label` is a LocaleString →
//  resolved to the active locale here (the one place a locale is in scope);
//  `PerspectiveOption.label` is a plain string. `icon` carries through.
export function perspectiveOptions(
  axis:     PerspectiveAxis,
  locale:   string,
  fallback: string,
): PerspectiveOption[] {
  return axis.perspectives.map((p) => ({
    id:    p.id,
    label: resolveLocaleString(p.label, locale, fallback),
    ...(p.icon !== undefined ? { icon: p.icon } : {}),
  }))
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

// ── perspectiveOwnedParamKeys — the default-resolution ownership seam (P4.5 (c)) ──
//
//  A `timeBinding` OWNS the filter params it binds: the pin's `{$ctx:'<param>'}`
//  source param (the user-tracked year) and the window's `targetKeys` destinations
//  (geostat: `fromYear`/`toYear`). The React default-resolution gate uses this to
//  shift the seam from BAR-visibility to PERSPECTIVE-ownership (Protected Variations):
//  a param owned ONLY by a non-active perspective's binding must NOT resolve its
//  default (range ⇒ `time` unset ⇒ full span), exactly as a hidden bar achieves today
//  — but driven by perspective ownership, not two bars.
//
//  Returns `{ active, all }`: `active` = keys owned by the ACTIVE perspective(s) (these
//  MUST resolve); `all` = keys owned by ANY perspective (a key in `all` but not
//  `active` is owned by a non-active perspective ⇒ must NOT resolve unless some other
//  live default covers it). A page with no axes / no timeBinding yields empty sets ⇒
//  the React gate reduces to the legacy `barShowWhen` branch EXACTLY (additive, inert).
//
//  Engine-pure (packages/core) — the React hook threads `(axes, perspectiveState)` in
//  and reads the two sets, crossing no arrow.
export interface PerspectiveOwnership {
  /** Param keys the ACTIVE perspective's binding owns — these resolve their default. */
  active: ReadonlySet<string>
  /** Param keys ANY perspective's binding owns — a non-active-owned key suppresses its default. */
  all:    ReadonlySet<string>
}

function bindingOwnedKeys(tb: PerspectiveTimeBinding, into: Set<string>): void {
  // The pin's ctx-ref source param (the user-tracked year). A literal pin owns no param.
  if (tb.pin !== undefined && typeof tb.pin === 'object' && '$ctx' in tb.pin) {
    into.add(tb.pin.$ctx)
  }
  // The window's destination keys. When targetKeys are declared they ARE the owned
  // params (geostat fromYear/toYear); else the conventional `${dim}From`/`${dim}To`.
  const range = tb.range
  if (range !== undefined && !isYearsSpec(range)) {
    const dim = tb.dim || TIME_DIM
    into.add(tb.targetKeys?.from ?? `${dim}From`)
    into.add(tb.targetKeys?.to   ?? `${dim}To`)
  }
}

export function perspectiveOwnedParamKeys(
  axes:             PerspectivesByParam | undefined,
  perspectiveState: Record<string, string> | undefined,
): PerspectiveOwnership {
  const active = new Set<string>()
  const all    = new Set<string>()
  if (!axes) return { active, all }

  const activeSet = new Set(activeDefs(axes, perspectiveState))
  for (const axis of Object.values(axes)) {
    for (const def of axis.perspectives) {
      const tb = def.scope?.timeBinding
      if (!tb) continue
      bindingOwnedKeys(tb, all)
      if (activeSet.has(def)) bindingOwnedKeys(tb, active)
    }
  }
  return { active, all }
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
    const dim = tb.dim || TIME_DIM

    // (a) EXPLICIT ctx-ref/literal single-period PIN (P4.5). `pin` resolves through
    // the SAME Ref dispatcher the legacy `{$ctx}` read used (resolveTimePin →
    // resolveRef). A resolved period writes `dims[dim]`; an UNSET/NaN resolution
    // writes NOTHING (the all-years path via the isUnsetTime SSOT). This lets the
    // `year` perspective declaratively pin `time` = the user-tracked year param,
    // byte-identical to the legacy `pick:last` year default while both coexist.
    if (tb.pin !== undefined) {
      const pinned = resolveTimePin(tb.pin, ctx)
      if (pinned !== undefined) {
        dims ??= { ...ctx.dims }
        dims[dim] = pinned
      }
      continue
    }

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
      // write them under the DECLARED target keys (geostat: fromYear/toYear) so the
      // existing range resolvers read them — (b) configurable target-keys (P4.5).
      // ABSENT targetKeys ⇒ the conventional `${dim}From`/`${dim}To` byte-for-byte.
      const { from, to } = effectiveBounds({ timeDimension: { dim, range } }, ctx)
      dims ??= { ...ctx.dims }
      if (from) writeBound(dims, targetKey(tb, dim, 'from'), from)
      if (to && to !== Infinity) writeBound(dims, targetKey(tb, dim, 'to'), to)
    }
  }

  return dims ? { ...ctx, dims } : ctx
}

// ── targetKey — the window's DESTINATION dim key (configurable, P4.5 (b)) ──────
//
//  The declared `targetKeys.{from,to}` when present (geostat declares
//  `{from:'fromYear', to:'toYear'}` so the window drives the EXISTING
//  `{$ctx:'fromYear'}`/`{$ctx:'toYear'}` resolvers via effectiveBounds's
//  fromDim/toDim); ABSENT ⇒ the conventional `${dim}From`/`${dim}To` byte-for-byte
//  (every existing caller — no targetKeys — is unaffected).
function targetKey(tb: PerspectiveTimeBinding, dim: string, side: 'from' | 'to'): string {
  const declared = tb.targetKeys?.[side]
  if (declared) return declared
  return side === 'from' ? `${dim}From` : `${dim}To`
}

// ── writeBound — REPRESENTATION-preserving window write ────────────────────────
//
//  effectiveBounds returns a NUMBER (the clamp arithmetic). But when the target key
//  is an ECHO of a ctx-ref source param the bound was read from (geostat: the window
//  reads `{$ctx:fromYear}` and writes back `fromYear`), the value already lives in
//  `ctx.dims[key]` in its ORIGINAL representation — a STRING, the way the legacy
//  range-bar select wrote it. Re-coercing that echo to a number would diverge from
//  the legacy two-bar render byte-for-byte (ctx.dims.fromYear `"2020"` vs `2020`).
//
//  So: when the dim already holds a value whose numeric form EQUALS the resolved
//  bound (the echo case — the window did not transform it), KEEP the existing value
//  verbatim. Only when the bound genuinely DIFFERS (a literal/clamped window the
//  source did not already carry) do we write the resolved number. This is byte-
//  identical for an echo window AND correct for a transforming one (FF-SNAPSHOT-VIEW-
//  EQUIV / FF-BINDING-TARGET-KEYS).
function writeBound(dims: Record<string, DimVal>, key: string, bound: number): void {
  const existing = dims[key]
  if (existing !== undefined && existing !== '' && Number(existing) === bound) return
  dims[key] = bound as DimVal
}

// ── Ref taxonomy + one resolution dispatcher [R4 — one resolution path] ──────
//
//  THE SSOT for "what is a `$`-reference and who resolves it."
//
//  Before R4 the platform had FIVE `$`-prefixed ref vocabularies resolved by
//  FOUR separate evaluators, with a NAME COLLISION: `$ctx` meant `ctx.dims` in
//  an ObsQuery filter but "filter param" in a DataLink param. Same token, two
//  scopes — a Least-Astonishment violation, no single home for ref resolution.
//
//  R4 unifies them under ONE declared taxonomy with non-colliding tokens and
//  ONE dispatcher (`resolveRef`) that routes by SCOPE. This is the data-axis
//  analogue of "one home per datum": one resolution path for every reference.
//
//  The taxonomy (scope prefix → what it binds):
//    ctx   ($ctx)   — a runtime dim value from SectionContext.dims
//    param ($param) — a filter-param value (DataLink drill-down; was the
//                     colliding DataLink `$ctx`, renamed to remove the collision)
//    row   ($row)   — a field on the clicked datum (DataLink drill-down)
//    dim   ($cl/$d) — a classifier ($cl, structural) / display ($d, UI) view
//    var   ($ref)   — a page-var value (FilterDerive if-else fallback)
//
//  Existing consumers (store-filter, resolvers/extractRequirements, links,
//  codelist, filter-derive) route their `$`-ref resolution THROUGH this seam
//  (Strangler-Fig): one SSOT, no parallel evaluator re-implementing routing.
//  What each ref resolves TO is unchanged — this is DRY, not a behaviour change.
//
//  100% JSON-serializable — refs are declarative strings, never logic (Law 2).
//
//  Pattern parallel: `resolveMeasureRef` (metric.ts) is the single wire point
//  for measure refs [R1]; `resolveRef` is the single wire point for `$`-refs.
//

import type { AttrVal, Classifier, ClassifierEntry, ClassifierView, DimRef, DimVal,
              DisplayMap }                                  from '../sdmx'
import { isDimRef, resolveDimRef }                          from '../data/codelist'

// ── Scope tokens — the canonical, non-colliding prefix set ───────────────────

/** Every ref scope token. The discriminant of a `$`-ref's home. */
export const REF_SCOPES = ['ctx', 'param', 'row', 'dim', 'var'] as const
export type RefScope = (typeof REF_SCOPES)[number]

// ── Ref shapes (per scope) ───────────────────────────────────────────────────

/** ctx — a runtime dim value from SectionContext.dims (ObsQuery filter). */
export type CtxScopeRef   = { $ctx: string }
/** param — a filter-param value (DataLink drill-down). The renamed `$ctx`. */
export type ParamScopeRef = { $param: string }
/** row — a field on the clicked datum (DataLink drill-down). */
export type RowScopeRef   = { $row: string }
/** var — a page-var value (FilterDerive if-else fallback). */
export type VarScopeRef    = { $ref: string }
/** dim — a classifier/display view; the `$cl`/`$d` DimRef union. */
export type DimScopeRef    = DimRef

/** The union every `$`-ref belongs to — the closed taxonomy. */
export type Ref =
  | CtxScopeRef
  | ParamScopeRef
  | RowScopeRef
  | VarScopeRef
  | DimScopeRef

// ── Scope detection — which token does this ref carry? ───────────────────────

/** Returns the scope of a `$`-ref, or null if `v` is not a recognised ref. */
export function refScope(v: unknown): RefScope | null {
  if (typeof v !== 'object' || v === null) return null
  if ('$ctx'   in v) return 'ctx'
  if ('$param' in v) return 'param'
  if ('$row'   in v) return 'row'
  if ('$ref'   in v) return 'var'
  if ('$cl'    in v || '$d' in v) return 'dim'
  return null
}

/** True when `v` is any recognised `$`-ref (any scope). */
export function isRef(v: unknown): v is Ref {
  return refScope(v) !== null
}

// ── Services — the data each scope resolves against ──────────────────────────
//
//  A ref binds against exactly ONE scope's data. `resolveRef` is sync, pure,
//  and never throws — a missing key resolves to undefined (the existing
//  consumers' fallback contracts are preserved at their call sites).
//
export interface RefServices {
  /** ctx scope — SectionContext.dims (the OLAP coordinate). */
  dims?:        Record<string, DimVal>
  /** param scope — current filter params (DataLink drill-down). */
  params?:      Record<string, unknown>
  /** row scope — the clicked datum's fields (DataLink drill-down). */
  row?:         Record<string, DimVal>
  /** var scope — page-var values (FilterDerive if-else fallback). */
  vars?:        Record<string, unknown>
  /** dim scope — structural codelists for `$cl`/`$d` resolution. */
  classifiers?: Record<string, Classifier>
  /** dim scope — display overlay for `$d` resolution. */
  display?:     Record<string, DisplayMap>
  /** dim scope — default classifier view when a `$cl`/`$d` omits `view`. */
  defaultView?: ClassifierView
}

/** Resolution outcome of a dim-scope ref (a classifier/display view). */
export type DimViewResult =
  | Record<string, ClassifierEntry>
  | ClassifierEntry[]
  | Record<string, Record<string, AttrVal>>
  | Record<string, AttrVal>[]

// ── resolveRef — THE one dispatcher ──────────────────────────────────────────
//
//  Routes a `$`-ref to its scope's data. Scalar scopes (ctx/param/row/var)
//  return a DimVal | unknown; the dim scope returns a classifier/display view.
//  This is the SSOT; every `$`-ref in the platform resolves through here.
//
export function resolveRef(ref: Ref, services: RefServices): unknown {
  const scope = refScope(ref)
  switch (scope) {
    case 'ctx':
      return services.dims?.[(ref as CtxScopeRef).$ctx]
    case 'param':
      return services.params?.[(ref as ParamScopeRef).$param]
    case 'row':
      return services.row?.[(ref as RowScopeRef).$row]
    case 'var':
      return services.vars?.[(ref as VarScopeRef).$ref]
    case 'dim':
      return isDimRef(ref)
        ? resolveDimRef(ref, services.classifiers, services.display, services.defaultView ?? 'items')
        : undefined
    default:
      return undefined
  }
}

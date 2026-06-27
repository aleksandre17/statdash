// ── discriminant-manifest.ts — runtime mirrors of authorable unions [V1] ───────
//
//  The Constructor's Coverage Fitness #1 gate ("nothing the renderer renders may
//  be un-authorable") must enumerate every DataSpec discriminant, every ParamDef
//  type, and every VisibilityExpr op FROM THE ENGINE SSOT — not a hand-list that
//  silently drifts when a union grows.
//
//  TransformStep ops already have a true RUNTIME registry (listTransformOps()).
//  DataSpec / ParamDef / VisibilityExpr are pure TYPE unions (no runtime values),
//  so we publish a runtime tuple per union AND prove — at COMPILE TIME — that the
//  tuple is EXACTLY the union's discriminant set:
//
//    • `satisfies readonly Discriminant[]`  → no tuple member outside the union
//    • `AssertExhaustive<...>`              → no union member missing from the tuple
//
//  Adding a union member without adding it here is a TYPE ERROR (the build fails),
//  so the tuple can never silently fall behind the union. The fitness test then
//  enumerates the tuple, confident it is the whole union.
//
import type { DataSpec }        from './data-spec'
import type { ParamDef }        from './filter-params'
import type { VisibilityExpr }  from './visibility'

// ── Exhaustiveness assertion ──────────────────────────────────────────
//  Resolves to `never` (→ a usable type) only when tuple T covers every member
//  of union U and adds none beyond it. Any drift surfaces as a TS error at the
//  `const _assert: AssertExhaustive<…> = true` lines below.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never

/** Discriminant string set of a union, by its discriminant key. */
type Discriminants<U, K extends keyof U> = U[K]

// ── DataSpec.type ─────────────────────────────────────────────────────
export const DATASPEC_DISCRIMINANTS = [
  'query', 'row-list', 'timeseries', 'growth', 'ratio-list',
  'pivot', 'transform', 'custom',
] as const satisfies readonly Discriminants<DataSpec, 'type'>[]

export type DataSpecDiscriminant = (typeof DATASPEC_DISCRIMINANTS)[number]
const _dataSpecExact: Exact<DataSpecDiscriminant, DataSpec['type']> = true
void _dataSpecExact

// ── ParamDef.type ─────────────────────────────────────────────────────
export const PARAMDEF_TYPES = [
  'hidden', 'year-select', 'cascade', 'select',
  'range', 'multi-select', 'chip-select',
] as const satisfies readonly Discriminants<ParamDef, 'type'>[]

export type ParamDefType = (typeof PARAMDEF_TYPES)[number]
const _paramDefExact: Exact<ParamDefType, ParamDef['type']> = true
void _paramDefExact

// ── VisibilityExpr.op ─────────────────────────────────────────────────
export const VISIBILITY_OPS = [
  'eq', 'neq', 'in', 'isset', 'and', 'or', 'not',
  'perspective-is', 'perspective-in', 'perspective-not',
  'mode-is', 'mode-in', 'mode-not',
] as const satisfies readonly Discriminants<VisibilityExpr, 'op'>[]

export type VisibilityOp = (typeof VISIBILITY_OPS)[number]
const _visibilityExact: Exact<VisibilityOp, VisibilityExpr['op']> = true
void _visibilityExact

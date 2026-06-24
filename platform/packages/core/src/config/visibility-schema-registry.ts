// ── VisibilityExpr authoring-surface registry [V4] ────────────────────────────
//
//  Open-for-extension registry of the AUTHORING surface for each VisibilityExpr
//  op (the node-level "show when" condition vocabulary). A VisibilityExpr op
//  CARRIES its authoring surface, registered alongside the union member at module
//  init (visibility-schemas.ts) — OCP: a NEW op = a new union member + an entry
//  here, and it becomes authorable through the Constructor with ZERO ad-hoc code.
//
//  TWO KINDS of surface (the op declares which it is):
//
//    'leaf'      — an atomic condition (eq/neq/in/isset/mode-*). It carries an
//                  authoring PropSchema, rendered through the SAME generic
//                  Inspector (visibilityLeafSchemaSource) — no bespoke per-op
//                  form, exactly the param-schema / op-schema template.
//    'composite' — a boolean combinator (and/or/not). It has NO PropSchema (its
//                  fields are CHILD VisibilityExprs, not scalars); the recursive
//                  VisibilityBuilder renders its sub-tree directly. Registering it
//                  here is the OCP record that the combinator IS surfaced (so the
//                  Coverage Fitness gate counts it as covered).
//
//  WHY only a schema/marker (no evaluator, unlike a runtime registry): the op's
//  runtime behaviour is the pure `evalVisibility` switch (same module family), the
//  SSOT for evaluation. What the Constructor needs — and what this registry owns —
//  is the op's AUTHORING contract. Same split-by-concern discipline as
//  param-schema-registry (schema half) vs the react render half.
//
import type { PropSchema } from './prop-schema'
import type { VisibilityOp } from './discriminant-manifest'

/** How a VisibilityExpr op is authored: an Inspector-rendered leaf, or a recursive combinator. */
export type VisibilityOpKind = 'leaf' | 'composite'

/** The authoring surface registered for one VisibilityExpr op. */
export interface VisibilityOpSurface {
  kind: VisibilityOpKind
  /** Present iff kind === 'leaf' — the PropSchema the generic Inspector renders. */
  schema?: PropSchema
}

const _surfaces = new Map<string, VisibilityOpSurface>()

/**
 * Register the authoring PropSchema for a LEAF VisibilityExpr op. Last-write-wins
 * (a plugin/test may override a built-in). A new leaf op that registers its schema
 * becomes fully authorable with zero Constructor code (Coverage Fitness #1).
 */
export function registerVisibilityLeafSchema(op: VisibilityOp | (string & {}), schema: PropSchema): void {
  _surfaces.set(op, { kind: 'leaf', schema })
}

/**
 * Mark a COMPOSITE VisibilityExpr op (and/or/not) as surfaced. It carries no
 * PropSchema — the recursive VisibilityBuilder renders its child sub-tree — but it
 * IS authorable, so it must be recorded here to satisfy the coverage gate (OCP:
 * a new combinator = one register call, no ad-hoc gate edit).
 */
export function registerVisibilityComposite(op: VisibilityOp | (string & {})): void {
  _surfaces.set(op, { kind: 'composite' })
}

/** The authoring surface for a VisibilityExpr op, or undefined if none is registered. */
export function getVisibilitySurface(op: string): VisibilityOpSurface | undefined {
  return _surfaces.get(op)
}

/** The leaf PropSchema for a VisibilityExpr op (undefined for composites / unregistered). */
export function getVisibilityLeafSchema(op: string): PropSchema | undefined {
  const s = _surfaces.get(op)
  return s?.kind === 'leaf' ? s.schema : undefined
}

/** True if the op has ANY authoring surface (leaf schema OR composite handler). */
export function isVisibilityOpAuthorable(op: string): boolean {
  return _surfaces.has(op)
}

/** Sorted list of VisibilityExpr ops that carry an authoring surface. */
export function listVisibilitySurfaces(): string[] {
  return [..._surfaces.keys()].sort()
}

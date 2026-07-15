// ── binding.ts — dynamic property binding (Builder.io ⚡ / Retool `{{ }}`) ─────
//
//  THE additive value model that lets ANY authorable scalar property be a LITERAL
//  OR a live expression — the "data bindings" superpower of the reference class
//  (Builder.io ⚡ · Retool `{{ }}` · Grafana value mappings). The reference tools
//  bind RAW refs; ours COMPOSES with the governed data model (a binding reads the
//  SAME scope — filter params · derived vars · rows — the rest of the engine reads),
//  so a bound prop never bypasses the semantic layer.
//
//  THE SHAPE (Law 2 — declarative, serializable DATA, never a function):
//    A property value may be a plain literal OR `{ $bind: "<expr>" }`, where the
//    expr is a string in the ONE formula dialect (parseFormula → the ONE @statdash/expr
//    AST → the ONE evalExpr). It is Constructor-serializable, diffable, round-trips
//    losslessly, and carries ZERO code — behaviour lives in the renderer/expr engine,
//    exactly like `view.visibleWhen` and `DataSpec.$ctx` already do. There is NO second
//    evaluator: a binding is just an expr-string this module lowers + evaluates.
//
//  ADDITIVE + OCP (Law 8): a field with NO binding is byte-identical to today — no
//  node-def type changes, no PropField/registry interface change. The resolution is a
//  single structural seam (see resolveBindings) that the render pipeline runs once per
//  node; a prop that isn't a Binding passes through untouched (reference-stable).
//
//  HONEST STATES (root Law 11 — "the canvas never lies"): resolving a binding yields a
//  DECLARED tri-state — `ok` (the computed value, incl. a REAL 0/false), `no-data` (the
//  expr resolved to null/undefined at the current context), or `error` (the expr is
//  malformed or threw). The seam renders no-data/error as an explicit honest state,
//  NEVER a fabricated value or a silent blank.
//
import { parseFormula, evalExpr, isDimVal, ExprEvalError } from '@statdash/expr'
import type { ExprScope, ExprVal, DimVal } from '@statdash/expr'

// ── Binding — the serializable bound-value marker ────────────────────────────
//
//  A discriminated shape (`$bind` present ⇒ a binding), deliberately mirroring the
//  `$ctx` / `$derived` / `$literal` reference markers the expr layer already uses.
//  The value is the expr STRING (authored form); the AST is a render-time detail.
//
export interface Binding {
  $bind: string
}

/** Structural guard: is this value a Binding (`{ $bind: string }`)? */
export function isBinding(v: unknown): v is Binding {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as Record<string, unknown>).$bind === 'string'
  )
}

// ── Resolution result — the declared honest tri-state (Law 11) ───────────────
export type BindState = 'ok' | 'no-data' | 'error'

export interface BindResolution {
  /** ok = show `value` · no-data = null result · error = malformed/threw. */
  state:    BindState
  /** The computed scalar on `ok` (incl. a REAL 0 / false); null on no-data/error. */
  value:    DimVal
  /** Human-readable diagnostic for no-data/error (surfaced in the Inspector preview). */
  message?: string
}

// ── Node-level identifier policy — a bare name → filter-param, else derived var ─
//
//  parseFormula lowers a bare identifier via an injectable policy (Law 1 — the parser
//  knows no privileged names). At the NODE level a bound expr references the author's
//  live selections + page vars, so `year` means "the filter param `year`, else the
//  derived var `year`" — the Retool `{{ params.year }}` intent, spelled bare. A
//  collection/per-row binding would inject a `{ $row }` policy instead (generalization).
//
const nodeFieldPolicy = (id: string): ExprVal => ({
  op: 'coalesce',
  values: [{ $ctx: id }, { $derived: id }],
})

/**
 * Resolve ONE binding against a scope. Never throws — a parse or eval failure is
 * captured as the `error` honest-state (the canvas must never crash on a bad expr).
 */
export function resolveBinding(
  binding: Binding,
  scope:   ExprScope,
  opts?:   { field?: (id: string) => ExprVal },
): BindResolution {
  const expr = binding.$bind
  if (!expr || !expr.trim()) {
    return { state: 'no-data', value: null, message: 'Empty expression' }
  }

  let ast
  try {
    ast = parseFormula(expr, { field: opts?.field ?? nodeFieldPolicy })
  } catch (e) {
    return { state: 'error', value: null, message: `Invalid expression: ${(e as Error).message}` }
  }

  let result: unknown
  try {
    result = evalExpr(ast, scope)
  } catch (e) {
    const message = e instanceof ExprEvalError ? e.message : String(e)
    return { state: 'error', value: null, message }
  }

  // null/undefined ⇒ no-data (a DECLARED honest state, never coerced to 0/''). A REAL
  // 0 or false is a value, not no-data — the "never a fake 0" law, resolved correctly.
  if (result === null || result === undefined) {
    return { state: 'no-data', value: null }
  }
  // A binding must resolve to a SCALAR prop value; an object/array is malformed intent.
  if (!isDimVal(result)) {
    return { state: 'error', value: null, message: 'Expression did not resolve to a scalar value' }
  }
  return { state: 'ok', value: result }
}

// ── resolveBindings — the ONE structural resolution seam over a node's props ───
//
//  Deep-walks `input` (a node def / props object), replacing every `{ $bind }` leaf
//  with its resolved value against `scope`. CONTAINMENT is skipped: child-node subtrees
//  (arrays under `children`/`items`, or any object carrying a string `type`) are left
//  untouched — each child resolves its OWN bindings through its own render pass, against
//  its own scope (the tree stays a tree of independent resolutions).
//
//  Reference-stable: a subtree with no binding is returned by identity (no clone), so a
//  binding-free node is byte-identical and never churns React reference equality.
//
export interface BindingDiagnostic {
  /** Dot-path of the failed binding within the node (e.g. `content`, `view.subtitle`). */
  path:     string
  /** Only failures are recorded — `no-data` or `error` (never `ok`). */
  state:    Exclude<BindState, 'ok'>
  message?: string
}

export interface ResolveBindingsResult<T> {
  /** The node with every own-prop binding replaced by its resolved value. */
  value:       T
  /** One entry per binding that resolved to no-data/error (empty ⇒ all clean). */
  diagnostics: BindingDiagnostic[]
  /** True iff at least one binding was present (of any state). */
  hadBinding:  boolean
}

/** Containment keys the walk never descends into (Parts render independently). */
const CONTAINMENT_KEYS = ['children', 'items'] as const

/** A value that looks like a child node (carries a string discriminant `type`). */
function isNodeLike(v: unknown): boolean {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    typeof (v as Record<string, unknown>).type === 'string'
  )
}

export function resolveBindings<T>(
  input: T,
  scope: ExprScope,
  opts?: { skipKeys?: readonly string[]; field?: (id: string) => ExprVal },
): ResolveBindingsResult<T> {
  const skip = new Set<string>(opts?.skipKeys ?? CONTAINMENT_KEYS)
  const diagnostics: BindingDiagnostic[] = []
  let hadBinding = false

  function walk(node: unknown, path: string): unknown {
    if (isBinding(node)) {
      hadBinding = true
      const r = resolveBinding(node, scope, { field: opts?.field })
      if (r.state !== 'ok') diagnostics.push({ path, state: r.state, message: r.message })
      return r.value
    }
    if (Array.isArray(node)) {
      let changed = false
      const out = node.map((el, i) => {
        if (isNodeLike(el)) return el // a child node — resolved by its own render pass
        const nv = walk(el, `${path}[${i}]`)
        if (nv !== el) changed = true
        return nv
      })
      return changed ? out : node
    }
    if (node !== null && typeof node === 'object') {
      const src = node as Record<string, unknown>
      const out: Record<string, unknown> = {}
      let changed = false
      for (const k of Object.keys(src)) {
        const v = src[k]
        if (skip.has(k) || isNodeLike(v)) { out[k] = v; continue }
        const nv = walk(v, path ? `${path}.${k}` : k)
        out[k] = nv
        if (nv !== v) changed = true
      }
      return changed ? out : node
    }
    return node
  }

  const value = walk(input, '') as T
  return { value, diagnostics, hadBinding }
}

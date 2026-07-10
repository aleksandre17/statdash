// ── graph/compilePage — config → reactive query graph [AR-49 V2 / ADR-024] ────
//
//  The compilation move (Vega's insight at Grafana's scale, over OUR grammar): a
//  fully-declarative page (Law 2 — no functions in config) is STATICALLY ANALYSABLE,
//  so its dataflow graph is DERIVABLE, never hand-wired. `compilePage` walks the tree
//  (`collectNodesDeep`), runs `extractDeps` per data-bearing node (V1 SSOT — the edge
//  set), maps each NodeDeps bucket to a namespaced SOURCE key, and registers one
//  reactive cell per node whose derivation body is INJECTED (`DeriveFn`).
//
//  Why the derivation is injected, not baked here (Law 3 + Law 6): the row body is
//  `resolveNodeRows` — which lives in `packages/react` (it holds the store manifest,
//  CachedStore wrapping, and blend desugar). Core cannot import it (arrow). So core owns
//  the GRAPH (compile + invalidate + memo) and the derivation is supplied by the caller:
//  the React binding injects the real `resolveNodeRows` at the V3 switch; the shadow
//  harness + fitness inject a core-expressible mirror. The engine therefore NEVER forks
//  the render body — it wraps whatever body it is given (SPEC §3.1: "one call site").

import type { NodeDeps, DepScanCtx, DepNode } from './extractDeps'
import { extractDeps } from './extractDeps'
import { collectNodesDeep } from './nodeWalk'
import { ReactiveGraph, deepEqual, type Equals } from './engine'

// ── GraphState — the SOURCES (the MVU Model), one flat derived-state snapshot ──
//
//  NOT a second store: these are the SAME URL params / perspectiveState / locale the
//  CommandBus writes today (SPEC §3.1 — the graph is the derived-state layer of the
//  existing Elm loop, never a rival state atom). A snapshot carries the whole state;
//  `diffState` computes which SOURCE KEYS changed between two snapshots (the exact
//  invalidation trigger), and the injected `DeriveFn` receives the whole snapshot to
//  rebuild a SectionContext.
export interface GraphState {
  /** OLAP dim coordinate (`ctx.dims`) — the filter/perspective-scoped dimension values. */
  dims?:             Record<string, unknown>
  /** Filter params (the URL filter state / `filterParams` visibility surface). */
  params?:           Record<string, unknown>
  /** Derived page vars (`evalVarMap` output — AR-36 `_byDims`/`_xDim`, …). */
  vars?:             Record<string, unknown>
  /** Active perspective id per axis param (`perspectiveState`). */
  perspectiveState?: Record<string, string>
  /** Active UI locale. */
  locale?:           string
  /** Active effective store key (the `pageStoreKey` cascade winner). */
  storeKey?:         string
}

// ── Source-key SSOT — one namespaced encoding of a NodeDeps bucket → source key ─
//
//  A single scheme so the compiler (edges), the state differ (change keys) and any
//  consumer speak the same source vocabulary. Generic over keys (Law 1 — a `dim:geo`
//  string is built from the key, never a hardcoded dimension name).
export const SRC = {
  dim:         (k: string): string => `dim:${k}`,
  param:       (k: string): string => `param:${k}`,
  var:         (k: string): string => `var:${k}`,
  perspective: (k: string): string => `perspective:${k}`,
  classifier:  (k: string): string => `classifier:${k}`,
  store:       (k: string): string => `store:${k}`,
  locale:      'locale',
} as const

/** Lower a node's NodeDeps (V1 edge set) to the flat set of SOURCE keys it subscribes to. */
export function depsToSources(d: NodeDeps): Set<string> {
  const s = new Set<string>()
  for (const k of d.dims)        s.add(SRC.dim(k))
  for (const k of d.params)      s.add(SRC.param(k))
  for (const k of d.vars)        s.add(SRC.var(k))
  for (const k of d.perspective) s.add(SRC.perspective(k))
  for (const k of d.classifiers) s.add(SRC.classifier(k))
  for (const k of d.stores)      s.add(SRC.store(k))
  if (d.locale) s.add(SRC.locale)
  return s
}

// ── diffState — the value-equality change detector (glitch-free trigger) ──────
//
//  Emits the SOURCE keys whose value actually changed between two snapshots. A key
//  present in both with an EQUAL value emits nothing (the "writing the same value
//  re-evaluates zero" property, SPEC §3.1). Objects (vars) compared deeply; scalars
//  (dims/params/locale) by deep-equal too (a dim value may be a string|number|null).
export function diffState(prev: GraphState, next: GraphState): Set<string> {
  const changed = new Set<string>()
  diffBucket(prev.dims,             next.dims,             SRC.dim,         changed)
  diffBucket(prev.params,           next.params,           SRC.param,       changed)
  diffBucket(prev.vars,             next.vars,             SRC.var,         changed)
  diffBucket(prev.perspectiveState, next.perspectiveState, SRC.perspective, changed)
  if ((prev.locale ?? '') !== (next.locale ?? '')) changed.add(SRC.locale)
  // A store re-route changes both the old and the new store-source membership.
  if ((prev.storeKey ?? '') !== (next.storeKey ?? '')) {
    if (prev.storeKey) changed.add(SRC.store(prev.storeKey))
    if (next.storeKey) changed.add(SRC.store(next.storeKey))
  }
  return changed
}

function diffBucket(
  prev: Record<string, unknown> | undefined,
  next: Record<string, unknown> | undefined,
  keyFn: (k: string) => string,
  out: Set<string>,
): void {
  const keys = new Set<string>([...Object.keys(prev ?? {}), ...Object.keys(next ?? {})])
  for (const k of keys) {
    if (!deepEqual(prev?.[k], next?.[k])) out.add(keyFn(k))
  }
}

// ── DeriveFn — the injected derivation body (react's resolveNodeRows at V3) ────
export type DeriveFn<T> = (node: DepNode, state: GraphState) => T

// ── QueryGraph — the compiled page ─────────────────────────────────────────────
export interface QueryGraph<T> {
  /** Cell ids (data-bearing nodes), document order. */
  readonly nodeIds: readonly string[]
  /** The extracted edge set of a node. */
  depsOf(id: string): NodeDeps
  /** The source keys a node subscribes to. */
  sourcesOf(id: string): ReadonlySet<string>
  /** The renderable config a node was compiled from. */
  nodeOf(id: string): DepNode
  /** The current derived-state snapshot. */
  state(): GraphState
  /** Advance state → returns the changed source keys and the invalidated cell ids. */
  setState(next: GraphState): { changed: Set<string>; invalidated: Set<string> }
  /** Pull-lazy read of a node's derived value (memoized). */
  get(id: string): T
  /** Populate every memo at the current state (state-0 warm). */
  evaluateAll(): void
}

export interface CompileOptions<T> {
  /** Known perspective axis ids — precise perspective-carrier detection in extractDeps. */
  perspectiveIds?: readonly string[]
  /** Initial derived-state snapshot (the cells derive against it). Default: empty. */
  initialState?:   GraphState
  /** Value-equality cutoff for the derived value (default: structural deepEqual). */
  equals?:         Equals<T>
  /**
   * Predicate for which walked nodes get a data cell. Default: nodes carrying `data`
   * or `transforms` (the data-bearing renderables — the parity subjects). Override to
   * widen (e.g. include kpi-strips by their own spec surface).
   */
  isDataNode?:     (node: DepNode) => boolean
}

function defaultIsDataNode(node: DepNode): boolean {
  return node['data'] != null || Array.isArray(node['transforms'])
}

/**
 * Compile a page config into a reactive query graph.
 *
 * ```ts
 * const qg = compilePage(page, deriveRows, { perspectiveIds, initialState })
 * qg.evaluateAll()                         // warm every memo at state 0
 * const { invalidated } = qg.setState(s1)  // geo changed → exactly geo's dependents
 * const rows = qg.get(nodeId)              // memoized unless invalidated
 * ```
 *
 * SHADOW-ONLY (V2): nothing consumes the graph for rendering; the render path stays
 * authoritative. The graph is compiled purely to prove parity (FF-GRAPH-PARITY).
 */
export function compilePage<T>(
  page: unknown,
  derive: DeriveFn<T>,
  opts: CompileOptions<T> = {},
): QueryGraph<T> {
  const isDataNode = opts.isDataNode ?? defaultIsDataNode
  const scanCtx: DepScanCtx = opts.perspectiveIds ? { perspectiveIds: opts.perspectiveIds } : {}

  const graph   = new ReactiveGraph<T>()
  const nodeIds: string[] = []
  const nodeById  = new Map<string, DepNode>()
  const depsById  = new Map<string, NodeDeps>()
  const srcById   = new Map<string, Set<string>>()

  // Closure over the live snapshot — a cell derives against whatever state is current.
  // setState updates it BEFORE invalidate, so a subsequent get() recomputes against next.
  let state: GraphState = opts.initialState ?? {}

  for (const { id, node } of collectNodesDeep(page)) {
    if (!isDataNode(node)) continue
    const deps    = extractDeps(node, scanCtx)
    const sources = depsToSources(deps)
    nodeIds.push(id)
    nodeById.set(id, node)
    depsById.set(id, deps)
    srcById.set(id, sources)
    graph.register(id, sources, () => derive(node, state), opts.equals)
  }

  return {
    nodeIds,
    depsOf:    (id) => must(depsById, id),
    sourcesOf: (id) => must(srcById, id),
    nodeOf:    (id) => must(nodeById, id),
    state:     () => state,
    setState(next) {
      const changed = diffState(state, next)
      state = next
      const invalidated = graph.invalidate(changed)
      return { changed, invalidated }
    },
    get:         (id) => graph.get(id),
    evaluateAll: () => graph.evaluateAll(),
  }
}

function must<V>(map: Map<string, V>, id: string): V {
  const v = map.get(id)
  if (v === undefined) throw new Error(`QueryGraph: unknown node id '${id}'`)
  return v
}

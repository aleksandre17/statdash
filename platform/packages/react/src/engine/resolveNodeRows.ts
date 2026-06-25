// ── resolveNodeRows — data resolution for a single node ────────────────
//
//  Phase 1 (simplified):
//    node.data present  → interpretSpec(spec, ctx.sectionCtx, resolvedStore)
//    node.data absent   → inherit ctx.rows (parent cascade)
//
//  Phase 2 (canonical):
//    InterpretResult { status: 'ok'|'blocked'|'empty', rows }
//    'blocked' → [] (required dim is null — sibling nodes unaffected)
//    evalExpr on visibleWhen runs BEFORE this in renderNode()
//
//  Canonical target lives in migration/03-pipeline.md.
//

import { interpretSpec, staticStore, CachedStore, applyEncoding, storeVal, applyPipeline, specDataSource } from '@statdash/engine'
import type { DataRow, DataStore, EncodingSpec, EngineRow, PipelineContext, RawRow, SectionContext, DataSpec, TransformStep } from '@statdash/engine'
import type { NodeBase, RenderContext }                                                     from './types'

// ── effectiveStoreKey — the metric→store precedence [M1] ──────────────
//
//  PRECEDENCE (documented + locked by FF-METRIC-NAMES-STORE):
//    explicit node `storeKey`  >  metric `dataSource`  >  page `pageStoreKey`  >  'default'
//
//  The middle tier (metric dataSource) is derived from the node's DataSpec via
//  specDataSource (core) — a node with NO explicit storeKey whose spec
//  references a metric naming a `dataSource` routes to that store. Returns the
//  storeKey to set as pageStoreKey for this node + its descendants, or undefined
//  to leave the page/default cascade untouched (byte-identical: a spec with no
//  metric-with-dataSource yields undefined ⇒ exactly today's storeKey-only path).
//
//  Pure + framework-free — exported so the precedence is testable without a
//  React render harness (renderNode consumes it inline).
export function effectiveStoreKey(node: Pick<NodeBase, 'storeKey' | 'data'>): string | undefined {
  if (node.storeKey) return node.storeKey
  return node.data ? specDataSource(node.data as DataSpec) : undefined
}

// ── resolveStore — CSS cascade: nearest storeKey wins ─────────────────
//
//  ctx.pageStoreKey → stores[key] → first registered store → staticStore.
//  Renderers that need the active store call this instead of ctx.stores[key].
//
//  Phase 8.3 [N5]: non-static stores are wrapped in CachedStore on first
//  use. The WeakMap keyed on the raw store means the same CachedStore
//  instance is returned for the same raw store across renders — cache
//  persists for the session without explicit invalidation (val cache key
//  already encodes dims, so stale reads across filter changes are impossible).
//
// Exported as a test-only escape hatch (leading-underscore convention): routing
// tests verify which raw store was selected via `_storeCache.get(raw) === result`
// instead of opening up CachedStore.source. Not part of the public store API.
export const _storeCache = new WeakMap<DataStore, CachedStore>()

export function resolveStore(ctx: Pick<RenderContext, 'stores' | 'pageStoreKey'>): DataStore {
  const key = ctx.pageStoreKey ?? 'default'
  const raw = ctx.stores[key] ?? ctx.stores[Object.keys(ctx.stores)[0]] ?? staticStore
  if (raw === staticStore) return raw  // static store: nothing to cache
  // Async-only stores (caps.sync === false) ARE now wrapped: CachedStore became
  // capability-transparent (store-impl.ts) — it inherits the source's caps.sync
  // so the wrapper still reports sync:false to useNodeRows (no masking), AND it
  // implements queryAsync that memoizes into the same cache querySync reads. So
  // the async warm (queryAsync) + the post-resume sync read (querySync) share one
  // CachedStore instance — the Cache-Aside contract (ADR-STORE-001) holds end to
  // end. Wrapping an async source was previously impossible (caps masked); the
  // transparency fix is exactly what lets it be wrapped here.
  // Streaming stores (caps.streaming === true) STILL bypass CachedStore:
  // CachedStore does not proxy subscribe(), which would hide the live-subscription
  // capability from useNodeStream (N34d).
  if (raw.caps?.streaming === true) return raw
  const cached = _storeCache.get(raw)
  if (cached) return cached
  const wrapper = new CachedStore(raw)
  _storeCache.set(raw, wrapper)
  return wrapper
}

// ── resolveStoreByKey — explicit-key store resolution (non-cascade) ───
//
//  The EXPLICIT-key sibling of resolveStore (which walks the pageStoreKey
//  CSS cascade). A `blend` step NAMES its secondary store by key, so it must
//  be fetched by that exact key — never the cascade winner. Falls back to the
//  same staticStore the cascade does when the key is absent (a misconfigured
//  blend then resolves zero secondary rows → a left/inner join is a safe no-op,
//  never a crash).
//
//  Reuses the same _storeCache WeakMap wrapping as resolveStore, so the
//  secondary store is wrapped in the SAME CachedStore instance whether it is
//  reached as a primary (cascade) or a secondary (blend) — no N+1, no double
//  fetch, val cache shared. The async/streaming bypasses mirror resolveStore.
export function resolveStoreByKey(
  ctx: Pick<RenderContext, 'stores'>,
  key: string,
): DataStore {
  const raw = ctx.stores[key] ?? staticStore
  if (raw === staticStore) return raw
  if (raw.caps?.sync === false) return raw
  if (raw.caps?.streaming === true) return raw
  const cached = _storeCache.get(raw)
  if (cached) return cached
  const wrapper = new CachedStore(raw)
  _storeCache.set(raw, wrapper)
  return wrapper
}

// ── resolveBlends — the cross-store desugar (B1, the gap-crossing) ─────
//
//  Lowers every declarative `blend` step in a node's pipeline to the existing
//  `joinByField` engine, resolved HERE in the react binding layer — the only
//  layer that holds the store manifest (ctx.stores), so the arrow holds and
//  core stays single-store (Law 3). For each blend step:
//
//    1. resolve `from.storeKey` against the manifest (resolveStoreByKey)
//    2. interpretSpec the secondary `from.query` against THAT store (exactly
//       as any primary query — same { type:'query', query, encoding } path)
//    3. rewrite the step → { op:'joinByField', by, mode, source: secondaryRows }
//
//  Non-blend steps pass through unchanged (byte-identical to today's pipeline).
//  The rewritten joinByField then runs in the existing applyPipeline — the
//  engine is untouched. This is the Strangler-Fig desugar-in-the-binding-layer
//  move: a declarative cross-store step compiles to the tested join engine.
//
//  `fields`/`rename` shape the secondary rows BEFORE the join (joinByField has
//  no field-projection of its own — A-wins handles clobber, so we project the
//  secondary rows down to the requested fields here). Default: all fields.
export function resolveBlends(
  transforms: TransformStep[],
  ctx: RenderContext,
): TransformStep[] {
  // Fast path: no blend present ⇒ return the array untouched (byte-identical).
  if (!transforms.some((s) => s.op === 'blend')) return transforms

  return transforms.map((step) => {
    if (step.op !== 'blend') return step
    const { from, by, mode, fields, rename } = step

    const secondaryStore = resolveStoreByKey(ctx, from.storeKey)
    const rawSecondary   = interpretSpec(
      { type: 'query', query: from.query, encoding: from.encoding } as DataSpec,
      ctx.sectionCtx,
      secondaryStore,
    )
    const enc = from.encoding
    const resolved = enc
      ? applyEncoding(rawSecondary, enc, (code) => storeVal(secondaryStore, code, ctx.sectionCtx))
      : rawSecondary

    const source = projectSecondary(resolved as EngineRow[], by, fields, rename)

    return { op: 'joinByField', by, mode: mode ?? 'left', source } as TransformStep
  })
}

// projectSecondary — narrow + rename the secondary rows before joinByField.
//  Always keeps the join key `by`. `fields` (when present) restricts which
//  other fields are merged; `rename` maps source field → target field. Pure,
//  non-mutating (mirrors joinByField's own non-mutation contract).
function projectSecondary(
  rows:    EngineRow[],
  by:      string,
  fields?: string[],
  rename?: Record<string, string>,
): EngineRow[] {
  if (!fields && !rename) return rows
  const keep = fields ? new Set([by, ...fields]) : undefined
  return rows.map((row) => {
    const out: EngineRow = {}
    for (const k of Object.keys(row)) {
      if (keep && !keep.has(k)) continue
      const target = k === by ? k : (rename?.[k] ?? k)
      out[target] = row[k]
    }
    return out
  })
}

export function resolveNodeRows(node: NodeBase, ctx: RenderContext): DataRow[] {
  const store = resolveStore(ctx)

  let rows: DataRow[]
  if (node.data) {
    const rawRows = interpretSpec(node.data, ctx.sectionCtx, store)
    const enc     = (node.data as { encoding?: EncodingSpec }).encoding
    rows = enc
      ? applyEncoding(rawRows, enc, (code) => storeVal(store, code, ctx.sectionCtx)) as DataRow[]
      : rawRows as unknown as DataRow[]
  } else {
    rows = ctx.rows ?? []
  }

  // Gap 4: TransformStep pipeline — declarative post-processing after interpretSpec (Grafana Transform panel).
  if (node.transforms?.length) {
    const pipeCtx: PipelineContext = {
      classifiers: store.classifiers,
      display:     store.display,
      section:     ctx.sectionCtx,
    }
    // B1: lower any declarative `blend` step → joinByField HERE (react holds the
    // store manifest, so the second-store fetch lives in the binding layer — core
    // stays single-store, Law 3). A pipeline with no blend returns untouched.
    const lowered = resolveBlends(node.transforms, ctx)
    rows = applyPipeline(rows as unknown as RawRow[], lowered, pipeCtx) as unknown as DataRow[]
  }

  return rows
}

// ── resolveCompareRows — comparison dataset for N37 compare mode ──────
//
//  Clones the panel's SectionContext with one dim overridden to the compare
//  value, runs interpretSpec, and returns the resulting rows + label.
//  Returns empty rows (never throws) so a bad compare config never blocks
//  the primary render path.
//
//  Called by renderNode when node.view.scope.compare is set.
//
export function resolveCompareRows(
  node:     NodeBase,
  panelCtx: SectionContext,
  compare:  { dim: string; value: import('@statdash/engine').DimVal; label: string },
  store:    DataStore,
): { compareRows: DataRow[]; compareLabel: string } {
  if (!('data' in node) || !node.data) return { compareRows: [], compareLabel: compare.label }
  const compareCtx: SectionContext = {
    ...panelCtx,
    dims: { ...panelCtx.dims, [compare.dim]: compare.value },
  }
  try {
    const rows = interpretSpec(node.data as DataSpec, compareCtx, store)
    return { compareRows: rows as unknown as DataRow[], compareLabel: compare.label }
  } catch {
    return { compareRows: [], compareLabel: compare.label }
  }
}
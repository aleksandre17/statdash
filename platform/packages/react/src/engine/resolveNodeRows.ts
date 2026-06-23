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

import { interpretSpec, staticStore, CachedStore, applyEncoding, storeVal, applyPipeline } from '@statdash/engine'
import type { DataRow, DataStore, EncodingSpec, PipelineContext, RawRow, SectionContext, DataSpec } from '@statdash/engine'
import type { NodeBase, RenderContext }                                                     from './types'

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
  // Async-only stores (caps.sync === false) cannot be wrapped in CachedStore:
  // CachedStore.querySync() delegates to the raw store's querySync which may
  // not return meaningful rows, and CachedStore hardcodes caps.sync = true,
  // hiding the async-only flag from useNodeRows (N34c).
  if (raw.caps?.sync === false) return raw
  // Streaming stores (caps.streaming === true) must bypass CachedStore:
  // CachedStore hardcodes caps.streaming = false and does not proxy subscribe(),
  // which would hide the live-subscription capability from useNodeStream (N34d).
  if (raw.caps?.streaming === true) return raw
  const cached = _storeCache.get(raw)
  if (cached) return cached
  const wrapper = new CachedStore(raw)
  _storeCache.set(raw, wrapper)
  return wrapper
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
    rows = applyPipeline(rows as unknown as RawRow[], node.transforms, pipeCtx) as unknown as DataRow[]
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
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

import { interpretSpec, staticStore, applyEncoding, storeVal, applyPipeline } from '@geostat/engine'
import type { DataRow, DataStore, EncodingSpec, PipelineContext, RawRow }       from '@geostat/engine'
import type { NodeBase, RenderContext }                                        from './types'

// ── resolveStore — CSS cascade: nearest storeKey wins ─────────────────
//
//  ctx.pageStoreKey → stores[key] → first registered store → staticStore.
//  Renderers that need the active store call this instead of ctx.stores[key].
//
export function resolveStore(ctx: Pick<RenderContext, 'stores' | 'pageStoreKey'>): DataStore {
  const key = ctx.pageStoreKey ?? 'default'
  return ctx.stores[key] ?? ctx.stores[Object.keys(ctx.stores)[0]] ?? staticStore
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
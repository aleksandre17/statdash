// ── usePipelineSourceRows — the live SOURCE read for the per-step grid ─────────
//
//  W-P1/W-P5b (ADR-046 · SPEC §3.2 / §9 E1, E3, E5). Resolves the rows a pipeline's
//  `source` HEAD produces off the LIVE cube — ONCE — so the per-step grid can derive
//  every tail step's output by pure prefix-run (`pipelinePreview.deriveStepRows`) with
//  NO re-fetch on step selection. This is the ONE derivation path (FF-ONE-DERIVATION-
//  PATH): the read goes through the ENGINE (`interpretSpec` on a SOURCE-ONLY pipeline),
//  never a bespoke preview cache — so a GOVERNED head (`{op:'source', metrics}`) lowers
//  through the metric resolver's grain algebra (a calc/YoY metric resolves to its REAL
//  computed value), and a STEWARD head (`{op:'source', query}`) lowers through the
//  QueryResolver's storeObs + effectiveBounds clamp — each byte-identical to the bound
//  element (PipelineResolver, W-P4).
//
//  Async live stores are WARMED (`queryAsync` over `extractRequirements` — the SAME
//  static analysis the sync engine reads back, both val + obs shapes) debounced +
//  cancel-on-supersede (E3); the read is capped by the grid (E3); loading is a DISTINCT
//  declared state from empty (async-store trap #10).
//
//  Fail-soft: no bound source → 'unbound' (the browse hint); live unavailable → the
//  static fallback with an honest 'unavailable' note; a failed warm → 'error'. The hook
//  NEVER throws (the editor must not crash — the canvas fail-soft law).
//
import { useEffect, useMemo, useState } from 'react'
import type {
  DataStore, EngineRow, PipelineSpec, PipelineContext, Requirement, SectionContext, SourceStep,
} from '@statdash/engine'
import {
  interpretSpec, extractRequirements, queryReadObs, sourceHeadObs, specDataSource,
} from '@statdash/engine'
import { resolveStore } from '@statdash/react/engine'
import { useLivePreviewStores } from '../../../canvas/useLivePreviewStores'
import { useActivePageContext } from '../../../canvas/pageContext'
import { isHeadBound, sourceOnlySpec } from '../workbench/workbenchModel'

/** The declared read state — loading is DISTINCT from empty (async trap #10). */
export type PreviewStatus = 'unbound' | 'loading' | 'ok' | 'error' | 'unavailable'

export interface PipelineSource {
  status:     PreviewStatus
  sourceRows: EngineRow[]
  /** The PipelineContext the derivation runs the tail prefix under (classifiers/display
   *  for $cl/$d joins + the section ctx for $ctx refs) — the SAME shape the
   *  PipelineResolver hands `applyPipeline`. */
  pipeCtx:    PipelineContext
}

const DEBOUNCE_MS = 300
const EMPTY_ROWS: EngineRow[] = []

/** Read the SOURCE rows synchronously off a WARM (or sync) store — through the ENGINE
 *  (`interpretSpec` on the source-only pipeline), so every head variant lowers onto its
 *  canonical read (governed→metric resolver, steward→query resolver, inline→rows). */
function readSource(store: DataStore, spec: PipelineSpec, ctx: SectionContext): EngineRow[] {
  return interpretSpec(spec, ctx, store) as EngineRow[]
}

/**
 * Resolve the live SOURCE rows for a pipeline `source` HEAD. Returns the rows entering
 * the tail (the `Get` step output) plus the PipelineContext for the prefix-run.
 */
export function usePipelineSourceRows(head: SourceStep | undefined, encoding: PipelineSpec['encoding']): PipelineSource {
  const { stores, status: liveStatus } = useLivePreviewStores('live')

  const bound = isHeadBound(head)

  // The SOURCE-ONLY pipeline (the head alone) — the exact spec the engine resolves for
  // the browse rows. Memoized on the head's structural identity so a step-only edit
  // (tail change) does NOT re-fetch the source (E5: tail is a pure re-slice).
  const headKey = head ? JSON.stringify(head) : ''
  const sourceSpec = useMemo<PipelineSpec | null>(
    () => (head ? sourceOnlySpec(head, encoding) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [headKey, encoding],
  )

  // The store the preview reads MUST be the store the governed head's metric DECLARES
  // (M1 `dataSource`) — resolved through the SAME SSOT the renderer routes through
  // (renderNode → effectiveStoreKey → specDataSource → resolveStore), never a second
  // routing rule. Reading the FIRST live-map store (the PAGE's store) read a metric off
  // a FOREIGN dataset → 0 live rows for any metric whose components live in another cube
  // (e.g. a `gdp`-sourced metric browsed on a regional page). resolveStore does the map
  // lookup + CachedStore wrap + fallback (key → first → staticStore) byte-identically to
  // the canvas node, so warm ≡ read and the preview shares the canvas's cache.
  const store = useMemo<DataStore>(
    () => resolveStore({ stores, pageStoreKey: sourceSpec ? specDataSource(sourceSpec) : undefined }),
    [stores, sourceSpec],
  )

  // The page's DEFAULT eval context (0112 R1) — the SAME engine default-dims derivation
  // the canvas renders under (deriveDefaultDims over the page filterSchema), projected
  // panel-side. Replaces the old hard-coded `{ dims: {} }` that starved every `$ctx`
  // ref → 0 preview rows while the canvas showed full data (the divergence class dies).
  const ctx = useActivePageContext()
  const pipeCtx = useMemo<PipelineContext>(
    () => ({ classifiers: store.classifiers, display: store.display, section: ctx }),
    [store, ctx],
  )

  // The identity of THIS read: the source spec ⊕ the store instance. A change in either
  // supersedes an in-flight warm (cancel-on-supersede, E3).
  const queryKey = useMemo(
    () => (bound && sourceSpec ? JSON.stringify(sourceSpec) : ''),
    [bound, sourceSpec],
  )
  const isSync = !store.caps || store.caps.sync !== false

  // Sync / static stores read immediately — no loading flash (byte-identical to the
  // structural canvas). Recomputed only when the source spec or store identity changes.
  const syncRows = useMemo<EngineRow[] | null>(
    () => (bound && isSync && sourceSpec ? readSource(store, sourceSpec, ctx) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bound, isSync, store, queryKey, ctx],
  )

  // Async live stores: warm (debounced + token-guarded), then read. The result is
  // TAGGED with the (queryKey, store) it was built for so a stale settle is ignored.
  type AsyncResult =
    | { key: string; store: DataStore; rows: EngineRow[] }
    | { key: string; store: DataStore; error: true }
  const [asyncResult, setAsyncResult] = useState<AsyncResult | null>(null)

  useEffect(() => {
    if (!bound || isSync || !sourceSpec) return
    // A per-run cancel flag: on supersede (spec/store change) or unmount the old run's
    // cleanup flips it, so a late settle never clobbers the current read (E3) and never
    // setState-after-unmount.
    let cancelled = false
    const qa = store.queryAsync ? store.queryAsync.bind(store) : undefined
    const timer = setTimeout(() => {
      // WARM the exact (code, dims) slices the source read will look up — the SAME
      // static analysis the sync engine reads back (extractRequirements), plus the head
      // obs the source read issues, via the ONE core SSOT `sourceHeadObs`: a STEWARD query
      // head OR a governed GRAIN-∅ BROWSE head (ADR-046 Addendum 2 — `{measure: metrics}`,
      // metric-expanded, no time bound) both warm their aligned obs slice so the base-browse
      // obs read + the calc enumeration/per-year reads all hit a warm cache (warm ⊇ read).
      // Both val AND obs shapes are warmed per req so storeVal (metric grain reads) and
      // storeObs (query/browse reads) both hit a warm cache — mirrors useNodeRows' warm.
      const reqs: Requirement[] = (() => {
        try { return extractRequirements(sourceSpec, ctx) } catch { return [] }
      })()
      const head0 = sourceSpec.pipe[0] as SourceStep | undefined
      const obsQuery = sourceHeadObs(head0)
      const headObs = obsQuery ? queryReadObs(obsQuery) : undefined
      const warm = qa
        ? Promise.all([
            ...reqs.flatMap((r) => {
              const reqCtx = { ...ctx, dims: { ...ctx.dims, ...r.dims } }
              return [qa({ type: 'val', code: r.code }, reqCtx), qa({ type: 'obs', measure: r.code }, reqCtx)]
            }),
            ...(headObs ? [qa(headObs, ctx)] : []),
          ]).then((results) => {
            const failed = results.find((r) => r.state === 'error')
            if (failed) throw new Error(failed.error ?? 'read failed')
          })
        : Promise.resolve()
      warm
        .then(() => {
          if (cancelled) return
          setAsyncResult({ key: queryKey, store, rows: readSource(store, sourceSpec, ctx) })
        })
        .catch(() => {
          if (cancelled) return
          setAsyncResult({ key: queryKey, store, error: true })
        })
    }, DEBOUNCE_MS)
    return () => { cancelled = true; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bound, isSync, store, queryKey, ctx])

  return useMemo<PipelineSource>(() => {
    if (!bound || !sourceSpec) return { status: 'unbound', sourceRows: EMPTY_ROWS, pipeCtx }

    // Live was requested but failed soft (no cube / API down) → the static fallback is
    // mounted; declare it honestly rather than paint an empty grid as "no rows".
    if (liveStatus === 'unavailable') {
      return { status: 'unavailable', sourceRows: EMPTY_ROWS, pipeCtx }
    }

    if (isSync && syncRows) return { status: 'ok', sourceRows: syncRows, pipeCtx }

    const current = asyncResult && asyncResult.key === queryKey && asyncResult.store === store
      ? asyncResult
      : null
    if (current && 'rows' in current) return { status: 'ok', sourceRows: current.rows, pipeCtx }
    if (current && 'error' in current) return { status: 'error', sourceRows: EMPTY_ROWS, pipeCtx }
    return { status: 'loading', sourceRows: EMPTY_ROWS, pipeCtx }
  }, [bound, sourceSpec, liveStatus, isSync, syncRows, asyncResult, queryKey, store, pipeCtx])
}

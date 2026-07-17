// ── usePipelineSourceRows — the live SOURCE read for the per-step grid ─────────
//
//  W-P1 (ADR-046 · SPEC §3.2 / §9 E1, E3, E5). Resolves the rows the query's
//  `Get` read produces off the LIVE cube — ONCE — so the per-step grid can derive
//  every step's output by pure prefix-run (`pipelinePreview.deriveStepRows`) with
//  NO re-fetch on step selection. This is the ONE derivation path (FF-ONE-
//  DERIVATION-PATH): the read goes through the EXACT engine seam the QueryResolver
//  uses (`queryReadObs` → `storeObs` → `effectiveBounds` clamp), never a bespoke
//  preview cache. Async live stores are warmed (`queryAsync`) debounced + cancel-
//  on-supersede (E3), the read is capped by the grid (E3), and loading is a
//  DISTINCT declared state from empty (async-store trap #10).
//
//  Fail-soft: no measure → 'unbound' (the browse hint); live unavailable → the
//  static fallback with an honest 'unavailable' note; a failed warm → 'error'.
//  The hook NEVER throws (the editor must not crash — the canvas fail-soft law).
//
import { useEffect, useMemo, useState } from 'react'
import type {
  DataSpec, DataStore, EngineRow, ObsQuery, PipelineContext, SectionContext, StoreQuery,
} from '@statdash/engine'
import {
  queryReadObs, storeObs, effectiveBounds, staticStore, TIME_DIM,
} from '@statdash/engine'
import { useLivePreviewStores } from '../../../canvas/useLivePreviewStores'
import { useActiveLocales } from '../../../inspector/useActiveLocales'

type QuerySpec = Extract<DataSpec, { type: 'query' }>

/** The declared read state — loading is DISTINCT from empty (async trap #10). */
export type PreviewStatus = 'unbound' | 'loading' | 'ok' | 'error' | 'unavailable'

export interface PipelineSource {
  status:     PreviewStatus
  sourceRows: EngineRow[]
  /** The PipelineContext the derivation runs the pipe prefix under (classifiers/
   *  display for $cl/$d joins + the section ctx for $ctx refs) — the SAME shape the
   *  QueryResolver hands `applyPipeline`. */
  pipeCtx:    PipelineContext
}

const DEBOUNCE_MS = 300
const EMPTY_ROWS: EngineRow[] = []

/** Read the source rows synchronously off a WARM (or sync) store — the exact
 *  QueryResolver composition: resolved obs read → post-fetch time clamp. */
function readSource(store: DataStore, spec: QuerySpec, ctx: SectionContext): EngineRow[] {
  const resolved = queryReadObs(spec.query) as StoreQuery & ObsQuery
  const raw = storeObs(store, { measure: resolved.measure, filter: resolved.filter, orderBy: resolved.orderBy }, ctx)
  const { from, to } = effectiveBounds(spec, ctx)
  if (!from && to === Infinity) return raw as EngineRow[]
  return (raw as EngineRow[]).filter((o) => {
    const t = Number(o[TIME_DIM])
    return (!from || t >= from) && (!to || t <= to)
  })
}

function hasMeasure(query: ObsQuery): boolean {
  const m = query.measure
  return Array.isArray(m) ? m.length > 0 : !!m
}

/**
 * Resolve the live SOURCE rows for a `query` DataSpec. Returns the rows entering
 * the pipe (the `Get` step output) plus the PipelineContext for the prefix-run.
 */
export function usePipelineSourceRows(spec: QuerySpec): PipelineSource {
  const locale = useActiveLocales()[0] ?? 'ka'
  const { stores, status: liveStatus } = useLivePreviewStores('live')

  // The store the preview reads: the first cube-bound store in the live map (the
  // grid is store-key-agnostic in W-P1 — W-P2 threads the node's storeKey). The
  // structural fallback is the empty static store (sync).
  const store = useMemo<DataStore>(
    () => stores[Object.keys(stores)[0] ?? 'default'] ?? staticStore,
    [stores],
  )

  const ctx = useMemo<SectionContext>(() => ({ dims: {}, locale }), [locale])
  const pipeCtx = useMemo<PipelineContext>(
    () => ({ classifiers: store.classifiers, display: store.display, section: ctx }),
    [store, ctx],
  )

  const bound = hasMeasure(spec.query)
  // The identity of THIS read: the resolved obs query ⊕ the store instance. A change
  // in either supersedes an in-flight warm (cancel-on-supersede, E3).
  const queryKey = useMemo(
    () => (bound ? JSON.stringify(queryReadObs(spec.query)) : ''),
    [bound, spec.query],
  )
  const isSync = !store.caps || store.caps.sync !== false

  // Sync / static stores read immediately — no loading flash (byte-identical to the
  // structural canvas). Recomputed only when the query or store identity changes.
  const syncRows = useMemo<EngineRow[] | null>(
    () => (bound && isSync ? readSource(store, spec, ctx) : null),
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
    if (!bound || isSync) return
    // A per-run cancel flag: on supersede (query/store change) or unmount the old
    // run's cleanup flips it, so a late settle never clobbers the current read
    // (cancel-on-supersede, E3) and never setState-after-unmount.
    let cancelled = false
    const qa = store.queryAsync ? store.queryAsync.bind(store) : undefined
    const timer = setTimeout(() => {
      const warm = qa
        ? qa(queryReadObs(spec.query), ctx).then((r) => {
            if (r.state === 'error') throw new Error(r.error ?? 'read failed')
          })
        : Promise.resolve()
      warm
        .then(() => {
          if (cancelled) return
          setAsyncResult({ key: queryKey, store, rows: readSource(store, spec, ctx) })
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
    if (!bound) return { status: 'unbound', sourceRows: EMPTY_ROWS, pipeCtx }

    // Live was requested but failed soft (no cube / API down) → the static fallback
    // is mounted; declare it honestly rather than paint an empty grid as "no rows".
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
  }, [bound, liveStatus, isSync, syncRows, asyncResult, queryKey, store, pipeCtx])
}

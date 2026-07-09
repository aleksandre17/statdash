// ── semanticCatalog.store — the STEWARD's editable governed-catalog copy (M2.2) ─
//
//  AR-49 M2.2 (the "define" half). The Steward authors governed metrics/dimensions
//  in Model mode; this store is the in-memory EDITABLE working copy they mutate
//  before saving it back to the ONE catalog SSOT (config.site_config keys
//  `metrics`/`dimensions`) via saveSemanticCatalog() (→ PUT /api/config/site).
//
//  ── Why a SEPARATE store from metricCatalog.store (FF-CATALOG-ONE-SSOT holds) ──
//  metricCatalog.store is the READ/palette projection of the ENGINE REGISTRY
//  (describeApp().metrics → MetricDef), the exact runner-identical view an author
//  binds against. THIS store is the AUTHORING working copy in the delivered WIRE
//  shape (ManifestMetric[]/ManifestDimension[]) — what we PUT and re-register. Both
//  hydrate FROM and persist TO the SAME site_config catalog; there is still exactly
//  ONE persisted SSOT (the FF's meaning). The two in-memory shapes exist because
//  authoring edits the wire blob while the palette reads the refined registry — the
//  save loop reconciles them (PUT → registerManifest* → palette invalidate).
//
//  ── Hydration ─────────────────────────────────────────────────────────────────
//  Lazy + idempotent (ensure()), mirroring cubeProfile.store.ensure: an author-lens
//  session never opens Model mode, so it never fetches the working copy. The Steward
//  opens the Metric catalog manager → ensure() reads the SAME /api/bootstrap channel
//  bootstrapCatalog primes the registry from (fetchCatalogManifest), so the editable
//  copy is byte-identical to what the runner boots. Fail-soft: an unreachable api
//  yields 'error' with the empty working set, never a crash (Law 9).
//
import { create } from 'zustand'
import type { ManifestMetric, ManifestDimension } from '@statdash/contracts'
import { fetchCatalogManifest } from '../../store/bootstrapCatalog'

/** Async-resource state for the editable catalog (mirrors ProfileEntry's discipline). */
export interface SemanticCatalogState {
  /** Load lifecycle of the working copy. */
  status:     'idle' | 'loading' | 'ready' | 'error'
  /** Populated on 'error' — the fail-soft message (never thrown to render). */
  message?:   string
  /** The editable governed metrics (wire shape — what saveSemanticCatalog PUTs). */
  metrics:    ManifestMetric[]
  /** The editable governed dimensions (preserved verbatim through save until M2.4). */
  dimensions: ManifestDimension[]
  /**
   * True once the working copy diverges from the last hydrated/saved snapshot — the
   * save affordance gates on it (no-op saves are cheap but pointless). Cleared by
   * markSaved() after a successful PUT.
   */
  dirty:      boolean

  /** Idempotent hydrate from /api/bootstrap. No-op once 'loading'/'ready'. */
  ensure:     () => void
  /** Force a fresh re-fetch (e.g. discard local edits back to the persisted catalog). */
  reload:     () => Promise<void>
  /** Insert or replace a metric by id (create + edit converge here). Marks dirty. */
  upsertMetric: (metric: ManifestMetric) => void
  /** Remove a metric by id (the delete-guard is the CALLER's gate). Marks dirty. */
  removeMetric: (id: string) => void
  /** Insert or replace a dimension by id (seam for M2.4). Marks dirty. */
  upsertDimension: (dimension: ManifestDimension) => void
  /** Remove a dimension by id. Marks dirty. */
  removeDimension: (id: string) => void
  /** Mark the working copy clean (called by saveSemanticCatalog after a successful PUT). */
  markSaved:  () => void
}

async function hydrate(set: (partial: Partial<SemanticCatalogState>) => void): Promise<void> {
  set({ status: 'loading' })
  try {
    const manifest = await fetchCatalogManifest()
    set({
      status:     'ready',
      metrics:    manifest.metrics ?? [],
      dimensions: manifest.dimensions ?? [],
      dirty:      false,
      message:    undefined,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'catalog unavailable'
    // Fail-soft: keep an empty-but-usable working set so the manager still renders
    // its "create the first metric" path against a live cube profile (never blank).
    set({ status: 'error', message, metrics: [], dimensions: [], dirty: false })
  }
}

/** Replace-by-id in a keyed list, preserving order (append when new). Pure. */
function upsertById<T extends { id: string }>(list: T[], next: T): T[] {
  const i = list.findIndex((x) => x.id === next.id)
  if (i === -1) return [...list, next]
  const copy = list.slice()
  copy[i] = next
  return copy
}

export const useSemanticCatalogStore = create<SemanticCatalogState>((set, get) => ({
  status:     'idle',
  metrics:    [],
  dimensions: [],
  dirty:      false,

  ensure: () => {
    const s = get()
    if (s.status === 'loading' || s.status === 'ready') return
    void hydrate(set)
  },

  reload: () => hydrate(set),

  upsertMetric: (metric) =>
    set((s) => ({ metrics: upsertById(s.metrics, metric), dirty: true })),

  removeMetric: (id) =>
    set((s) => ({ metrics: s.metrics.filter((m) => m.id !== id), dirty: true })),

  upsertDimension: (dimension) =>
    set((s) => ({ dimensions: upsertById(s.dimensions, dimension), dirty: true })),

  removeDimension: (id) =>
    set((s) => ({ dimensions: s.dimensions.filter((d) => d.id !== id), dirty: true })),

  markSaved: () => set({ dirty: false }),
}))

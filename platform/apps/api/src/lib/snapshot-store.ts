// ── PageDataSnapshot — boundary DTO (Anti-Corruption Layer) ───────────────────
// The authoritative rich PageDataSnapshot lives in the engine (@statdash/react/engine,
// produced by renderPageToJSON). The api stores it OPAQUELY and reads exactly one
// field — generatedAt. That boundary shape (timestamp + opaque blob) is now
// single-sourced in @statdash/contracts as `SnapshotEnvelope`, so the api no longer
// re-declares the type name (DRY/SSOT). The engine's rich type is structurally
// assignable to SnapshotEnvelope at the storage boundary; the api never compiles
// the engine's internal structure into this NodeNext service.
import type { SnapshotEnvelope } from '@statdash/contracts'

/** Boundary view of a page-data snapshot — see @statdash/contracts SnapshotEnvelope. */
export type PageDataSnapshot = SnapshotEnvelope

// ── Embed params (whitelist) ──────────────────────────────────────────────────
// What the snapshot's embed is permitted to do. Kept declarative (data, not
// logic) so a future Constructor can author it. `allowedDims` whitelists which
// dim values an embed may surface; `expiresAt` bounds the token's lifetime.
export interface EmbedParams {
  /** Which dim values are permitted to be shown by this embed. */
  allowedDims?: Record<string, unknown>
  /** Unix epoch ms after which the token is Gone (HTTP 410). */
  expiresAt?: number
}

/** One stored snapshot + the metadata the delivery boundary needs. */
export interface StoredSnapshot {
  snapshot: PageDataSnapshot
  createdAt: number
  params: EmbedParams
}

// ── SnapshotStore — port ──────────────────────────────────────────────────────
// In-memory for now (N38: no DB). Shaped as a port so swapping to Postgres later
// is one binding change at the route layer — the API-readiness law (src/data is
// pure, the store is a parameter). LRU bounds memory: oldest-touched entry is
// evicted past `max`, so a long-running process can't leak unbounded snapshots.
export interface SnapshotStore {
  set(token: string, value: StoredSnapshot): void
  get(token: string): StoredSnapshot | undefined
  readonly size: number
}

/**
 * LRU store backed by a Map. Map preserves insertion order, so the first key is
 * the least-recently-used; a `get` re-inserts to mark recency. Past `max`, the
 * oldest entry is evicted.
 */
export function createSnapshotStore(max = 100): SnapshotStore {
  const entries = new Map<string, StoredSnapshot>()

  return {
    set(token, value) {
      // Re-insert moves the key to the most-recent position.
      if (entries.has(token)) entries.delete(token)
      entries.set(token, value)
      // Evict the least-recently-used while over capacity.
      while (entries.size > max) {
        const oldest = entries.keys().next().value
        if (oldest === undefined) break
        entries.delete(oldest)
      }
    },

    get(token) {
      const value = entries.get(token)
      if (value === undefined) return undefined
      // Touch: bump to most-recent so an actively-read embed isn't evicted.
      entries.delete(token)
      entries.set(token, value)
      return value
    },

    get size() {
      return entries.size
    },
  }
}

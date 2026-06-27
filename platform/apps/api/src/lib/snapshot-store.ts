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

// ── SnapshotStore — port (API-09 durability) ──────────────────────────────────
// Shaped as a port so the adapter swaps with one binding change at the app layer
// (the API-readiness law: src/data is pure, the store is a parameter). The
// in-memory LRU is the test/offline default; createPgSnapshotStore is the durable
// production adapter — a minted embed URL must SURVIVE A RESTART (a public embed
// contract that breaks on every deploy is unshippable). Async because a DB-backed
// store cannot honour a sync signature (Liskov: both adapters satisfy one contract).
export interface SnapshotStore {
  set(token: string, value: StoredSnapshot): Promise<void>
  get(token: string): Promise<StoredSnapshot | undefined>
}

/** Minimal Postgres surface the pg adapter needs (Dependency Inversion). */
export interface SnapshotDb {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
}

/**
 * LRU store backed by a Map. Map preserves insertion order, so the first key is
 * the least-recently-used; a `get` re-inserts to mark recency. Past `max`, the
 * oldest entry is evicted. The test/offline default — NOT durable across restart.
 */
export function createSnapshotStore(max = 100): SnapshotStore {
  const entries = new Map<string, StoredSnapshot>()

  return {
    async set(token, value) {
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

    async get(token) {
      const value = entries.get(token)
      if (value === undefined) return undefined
      // Touch: bump to most-recent so an actively-read embed isn't evicted.
      entries.delete(token)
      entries.set(token, value)
      return value
    },
  }
}

interface SnapshotRow {
  snapshot: PageDataSnapshot
  created_at: Date | string
  params: EmbedParams | null
}

/**
 * Postgres-backed SnapshotStore over config.snapshot (V36). Durable across restart.
 * set() best-effort purges expired rows first (cheap housekeeping bounded by the
 * expires_at index) then UPSERTs the token. get() reads the row back; expiry is
 * NOT enforced here — the embed route owns the 410 lifecycle decision (separation
 * of storage from policy). Read/write errors PROPAGATE (fail-fast: a snapshot on
 * the request path must surface a fault, not silently miss).
 */
export function createPgSnapshotStore(db: SnapshotDb): SnapshotStore {
  return {
    async set(token, value) {
      // Opportunistic GC of dead tokens (write-path, bounded by the partial index).
      await db.query(`DELETE FROM config.snapshot WHERE expires_at IS NOT NULL AND expires_at < now()`)
      const expiresAt = value.params.expiresAt
      await db.query(
        `INSERT INTO config.snapshot (token, snapshot, created_at, expires_at, params)
         VALUES ($1, $2::jsonb, to_timestamp($3 / 1000.0), $4, $5::jsonb)
         ON CONFLICT (token) DO UPDATE
           SET snapshot = EXCLUDED.snapshot,
               created_at = EXCLUDED.created_at,
               expires_at = EXCLUDED.expires_at,
               params = EXCLUDED.params`,
        [
          token,
          JSON.stringify(value.snapshot),
          value.createdAt,
          expiresAt !== undefined ? new Date(expiresAt).toISOString() : null,
          JSON.stringify(value.params),
        ],
      )
    },

    async get(token) {
      const { rows } = await db.query<SnapshotRow>(
        `SELECT snapshot, created_at, params FROM config.snapshot WHERE token = $1`,
        [token],
      )
      const row = rows[0]
      if (!row) return undefined
      return {
        snapshot: row.snapshot,
        createdAt: row.created_at instanceof Date ? row.created_at.getTime() : new Date(row.created_at).getTime(),
        params: row.params ?? {},
      }
    },
  }
}

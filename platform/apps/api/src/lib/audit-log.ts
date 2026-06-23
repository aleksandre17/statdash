// ── AuditLogger — governance audit trail port [N41] ───────────────────────────
//
// Records who did what, when, against which resource. Append-only by contract:
// the only writes are log(); reads are recent(). Shaped as a PORT (same pattern
// as snapshot-store.ts) so the in-memory ring buffer here can be swapped for a
// Postgres-backed implementation with one binding change at the app layer — the
// API-readiness law. The route layer depends on the AuditLogger interface, never
// on this concrete buffer.
//
// In-memory ring buffer for now: no audit migration tooling is checked into this
// repo, so persistence beyond process lifetime is out of scope (consistent with
// snapshot-store's in-memory N38 stance). When the audit_log table lands, this is
// the DDL the Postgres adapter targets — same AuditLogger surface, no call-site
// change:
//
//   CREATE TABLE IF NOT EXISTS audit_log (
//     id         SERIAL PRIMARY KEY,
//     ts         TIMESTAMPTZ NOT NULL DEFAULT now(),
//     user_id    TEXT,
//     action     TEXT NOT NULL,
//     resource   TEXT,
//     payload    JSONB
//   );
//   CREATE INDEX IF NOT EXISTS audit_log_ts_idx ON audit_log (ts DESC);

/** One audit record. `ts` is stamped by the logger, never by the caller. */
export interface AuditEntry {
  /** ISO 8601 timestamp — assigned at log() time, the single source of truth for ordering. */
  ts:        string
  /** Subject id of the actor, when known (absent for anonymous/system actions). */
  userId?:   string
  /** What happened — e.g. 'config.save', 'embed.mint', 'snapshot.create'. */
  action:    string
  /** What it happened to — e.g. a pageId or token. */
  resource?: string
  /** Free-form structured detail; stored opaquely (JSONB in the DB adapter). */
  payload?:  unknown
}

// ── AuditLogger — port ──────────────────────────────────────────────────────
// Narrow by design (ISP): producers depend only on log(); the admin read route
// depends only on recent(). No update/delete — an audit trail is append-only.
export interface AuditLogger {
  /** Append an entry. `ts` is stamped here, so callers pass everything but ts. */
  log(entry: Omit<AuditEntry, 'ts'>): void
  /** Most-recent-first slice of the trail, bounded by `limit` (default: all held). */
  recent(limit?: number): AuditEntry[]
}

/**
 * In-memory ring buffer AuditLogger. Holds at most `max` entries; once full, each
 * new entry evicts the oldest (FIFO). Bounded memory: a long-running process can
 * never leak unbounded audit records. recent() returns newest-first — the order
 * an admin reads a trail in.
 */
export function createInMemoryAuditLogger(max = 1000): AuditLogger {
  // Guard against a degenerate capacity that would make the buffer useless.
  const capacity = Math.max(1, Math.floor(max))
  const buf: AuditEntry[] = []

  return {
    log(entry) {
      buf.push({ ...entry, ts: new Date().toISOString() })
      // Evict oldest while over capacity (handles capacity changes defensively).
      while (buf.length > capacity) buf.shift()
    },

    recent(limit) {
      // Newest-first view. A non-positive limit yields nothing; absent ⇒ all held.
      const newestFirst = buf.slice().reverse()
      if (limit === undefined) return newestFirst
      if (limit <= 0) return []
      return newestFirst.slice(0, limit)
    },
  }
}

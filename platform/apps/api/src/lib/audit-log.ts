// ── AuditLogger — governance audit trail port [N41] (API-03 durability) ───────
//
// Records who did what, when, against which resource. Append-only by contract:
// the only writes are log(); reads are recent(). Shaped as a PORT (same pattern
// as snapshot-store.ts) so the in-memory ring buffer can be swapped for a
// Postgres-backed implementation with one binding change at the app layer — the
// API-readiness law. The route layer depends on the AuditLogger interface, never
// on a concrete buffer.
//
// DURABILITY (API-03): the governance trail of a regulated stats agency must
// survive a restart. The pg-backed adapter (createPgAuditLogger) writes to
// config.audit_log (migration V15 — already applied), so the in-memory ring is
// now only the test/offline default. index.ts wires the pg adapter in production.
//
// ASYNC PORT: both methods return Promises so the in-memory and pg adapters are
// Liskov-substitutable behind ONE contract (a sync ring and an async DB cannot
// share a sync signature). log() is FIRE-AND-FORGET by design — a producer (a
// config save, a publish) must never block on, or be failed by, the audit write
// (the wrong coupling); the pg adapter therefore catches its own write error and
// logs it (surfaced, never swallowed) rather than rejecting into the caller. A
// caller that needs durability confirmation (a test, a shutdown flush) may await.

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
  log(entry: Omit<AuditEntry, 'ts'>): Promise<void>
  /** Most-recent-first slice of the trail, bounded by `limit` (default: all held). */
  recent(limit?: number): Promise<AuditEntry[]>
}

/** Minimal Postgres surface the pg adapter needs (Dependency Inversion). */
export interface AuditDb {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
}

/** Logger port for surfacing a failed (fire-and-forget) audit write. */
export interface AuditFailureLogger {
  error(obj: unknown, msg?: string): void
}

/**
 * In-memory ring buffer AuditLogger. Holds at most `max` entries; once full, each
 * new entry evicts the oldest (FIFO). Bounded memory: a long-running process can
 * never leak unbounded audit records. recent() returns newest-first — the order
 * an admin reads a trail in. The test/offline default (not durable across restart).
 */
export function createInMemoryAuditLogger(max = 1000): AuditLogger {
  // Guard against a degenerate capacity that would make the buffer useless.
  const capacity = Math.max(1, Math.floor(max))
  const buf: AuditEntry[] = []

  return {
    async log(entry) {
      buf.push({ ...entry, ts: new Date().toISOString() })
      // Evict oldest while over capacity (handles capacity changes defensively).
      while (buf.length > capacity) buf.shift()
    },

    async recent(limit) {
      // Newest-first view. A non-positive limit yields nothing; absent ⇒ all held.
      const newestFirst = buf.slice().reverse()
      if (limit === undefined) return newestFirst
      if (limit <= 0) return []
      return newestFirst.slice(0, limit)
    },
  }
}

/**
 * Postgres-backed AuditLogger over config.audit_log (V15). Durable across restart
 * — the launch-blocker the in-memory ring could not meet for a governance trail.
 * occurred_at is server-assigned (DEFAULT now()); the append-only trigger
 * (trg_audit_log_immutable) enforces the no-update/no-delete contract in the DB.
 *
 * log() never rejects: a write failure is logged via `onError` (surfaced) and the
 * promise resolves, so a fire-and-forget producer is never failed by the audit
 * side-channel. recent() DOES propagate read errors (the admin read must fail-fast
 * rather than silently show an empty trail).
 */
export function createPgAuditLogger(db: AuditDb, onError?: AuditFailureLogger): AuditLogger {
  return {
    async log(entry) {
      try {
        await db.query(
          `INSERT INTO config.audit_log (user_id, action, resource, payload)
           VALUES ($1, $2, $3, $4::jsonb)`,
          [
            entry.userId ?? null,
            entry.action,
            entry.resource ?? null,
            entry.payload === undefined ? null : JSON.stringify(entry.payload),
          ],
        )
      } catch (err) {
        onError?.error({ err, action: entry.action }, 'audit: failed to persist entry')
      }
    },

    async recent(limit) {
      if (limit !== undefined && limit <= 0) return []
      const { rows } = await db.query<{
        occurred_at: Date | string
        user_id: string | null
        action: string
        resource: string | null
        payload: unknown
      }>(
        `SELECT occurred_at, user_id, action, resource, payload
           FROM config.audit_log
          ORDER BY occurred_at DESC, id DESC
          ${limit !== undefined ? 'LIMIT $1' : ''}`,
        limit !== undefined ? [limit] : [],
      )
      return rows.map((r) => ({
        ts: r.occurred_at instanceof Date ? r.occurred_at.toISOString() : String(r.occurred_at),
        ...(r.user_id != null ? { userId: r.user_id } : {}),
        action: r.action,
        ...(r.resource != null ? { resource: r.resource } : {}),
        ...(r.payload != null ? { payload: r.payload } : {}),
      }))
    },
  }
}

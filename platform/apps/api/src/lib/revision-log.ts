// ── revision-log — the append + read seam for config.revision (ADR-052 §3) ─────
//
//  The ONE place that writes and reads `config.revision`, so the two routes
//  (data-specs, data-sources) cannot drift on the SQL. `appendRevision` runs INSIDE
//  the caller's transaction (the append + the current-row UPDATE MUST move together
//  — the `pages.ts` PUT invariant; a crash between them would drift current-state
//  from its log). The `revision_number` is trigger-assigned (V39
//  assign_revision_number), so there is no app-side max()+1 race.
//
//  The read mappers project the snake_case DB row onto the camelCase
//  `RevisionRecord` / `RevisionSummary` wire contract (`@statdash/contracts`) — the
//  panel reads ONE shape regardless of doc kind. `tenant_id` is a storage-side seam
//  column, deliberately NOT projected on the wire in single-tenant v1 (ADR-052 §3).
//
//  Depends only on a narrow query port (Dependency Inversion) — a pooled client, an
//  in-txn client, or a test fake all satisfy it.

import type {
  ConfigDocKind,
  RevisionRecord,
  RevisionSummary,
} from '@statdash/contracts'

/** Minimal query capability the log needs — satisfied by app.pg / an in-txn client / a fake. */
export interface RevisionStore {
  query<R extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: R[] }>
}

/**
 * The raw `config.revision` row shape (snake_case), as SELECTed. A `type` (not an
 * `interface`) so it satisfies the `R extends Record<string, unknown>` query-port
 * constraint (a type-literal carries the implicit index signature an interface lacks).
 */
type RevisionRow = {
  id:              string
  doc_kind:        string
  doc_id:          string
  revision_number: number
  body:            unknown
  actor:           string | null
  note:            string | null
  restored_from:   string | null
  created_at:      string | Date
}

/** Project a DB row → the full `RevisionRecord` wire shape (with body). */
function toRecord(r: RevisionRow): RevisionRecord {
  return {
    id:             r.id,
    docKind:        r.doc_kind as ConfigDocKind,
    docId:          r.doc_id,
    revisionNumber: r.revision_number,
    body:           r.body,
    actor:          r.actor,
    note:           r.note,
    restoredFrom:   r.restored_from,
    createdAt:      new Date(r.created_at).toISOString(),
  }
}

/** Project a DB row → a `RevisionSummary` (body OMITTED — the list-view weight rule). */
function toSummary(r: Omit<RevisionRow, 'body'>): RevisionSummary {
  return {
    id:             r.id,
    docKind:        r.doc_kind as ConfigDocKind,
    docId:          r.doc_id,
    revisionNumber: r.revision_number,
    actor:          r.actor,
    note:           r.note,
    restoredFrom:   r.restored_from,
    createdAt:      new Date(r.created_at).toISOString(),
  }
}

/** Fields a caller supplies to append one revision. */
export interface AppendRevisionInput {
  docKind:       ConfigDocKind
  docId:         string
  /** The FULL document snapshot (restore re-applies it verbatim). */
  body:          unknown
  /** JWT sub / 'system:provisioning' | 'system:adoption'; null tolerated. */
  actor:         string | null
  note?:         string | null
  /** Set only when this row is a restore — the source revision's UUID (lineage). */
  restoredFrom?: string | null
}

/**
 * Append one revision. MUST be called inside the caller's transaction (the same txn
 * as the current-row UPDATE). Returns the appended `RevisionRecord` (with the
 * trigger-assigned `revisionNumber`). Body is bound as JSON text; the JSONB column
 * coerces text→jsonb (no `::jsonb` cast needed in an INSERT VALUES position).
 */
export async function appendRevision(
  db:    RevisionStore,
  input: AppendRevisionInput,
): Promise<RevisionRecord> {
  const { rows } = await db.query<RevisionRow>(
    `INSERT INTO config.revision (doc_kind, doc_id, body, actor, note, restored_from)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, doc_kind, doc_id, revision_number, body, actor, note, restored_from, created_at`,
    [
      input.docKind,
      input.docId,
      JSON.stringify(input.body),
      input.actor,
      input.note ?? null,
      input.restoredFrom ?? null,
    ],
  )
  return toRecord(rows[0]!)
}

/**
 * List a document's revision history, newest first (body OMITTED — mirrors the pages
 * `GET /:id/versions` projection). Uses the (doc_kind, doc_id, revision_number DESC)
 * index.
 */
export async function listRevisions(
  db:      RevisionStore,
  docKind: ConfigDocKind,
  docId:   string,
): Promise<RevisionSummary[]> {
  const { rows } = await db.query<Omit<RevisionRow, 'body'>>(
    `SELECT id, doc_kind, doc_id, revision_number, actor, note, restored_from, created_at
       FROM config.revision
      WHERE doc_kind = $1 AND doc_id = $2
      ORDER BY revision_number DESC`,
    [docKind, docId],
  )
  return rows.map(toSummary)
}

/**
 * Read one full revision (with body) by its UUID, scoped to its document so a
 * cross-document id cannot be read through the wrong route. Returns undefined when
 * absent.
 */
export async function getRevision(
  db:      RevisionStore,
  docKind: ConfigDocKind,
  docId:   string,
  revId:   string,
): Promise<RevisionRecord | undefined> {
  const { rows } = await db.query<RevisionRow>(
    `SELECT id, doc_kind, doc_id, revision_number, body, actor, note, restored_from, created_at
       FROM config.revision
      WHERE doc_kind = $1 AND doc_id = $2 AND id = $3`,
    [docKind, docId, revId],
  )
  return rows[0] ? toRecord(rows[0]) : undefined
}

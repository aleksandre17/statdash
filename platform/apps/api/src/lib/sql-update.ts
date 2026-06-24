// ── buildSetClause — the parameterized partial-UPDATE SET builder (SSOT) ──────
//
//  A partial update writes ONLY the fields the client supplied (an absent field is
//  left untouched, not nulled). Every config CRUD route built this the same way:
//  walk the optional fields, push `col = $n` into a list with hand-rolled
//  placeholder arithmetic (`$${sets.length + 1}`), then join. That arithmetic was
//  copy-pasted into four routes (data-source, data-spec, nav, page identity) —
//  Shotgun Surgery + a fragile off-by-one surface in each copy.
//
//  This is the ONE definition of that mechanism (M-5 reusable capability / Protected
//  Variations): give it the column→value map (undefined = omit), get back a SET
//  fragment + its ordered bind values, with the placeholders numbered from a caller-
//  chosen offset so the route appends its own WHERE/RETURNING with correct indices.
//  The route still owns its full statement (the statement shapes legitimately differ
//  — RETURNING vs in-transaction); only the bug-prone placeholder math is shared.
//
//  SAFETY: column names come from the route's OWN literal map keys (never user
//  input), so they are safe to interpolate; values are ALWAYS bound parameters
//  ($n), never interpolated — the SQL stays fully parameterized.

/** The SET fragment (no leading `SET`) + its ordered bind values. */
export interface SetClause {
  /** e.g. `"name = $1, url = $2"` — empty string when no fields were provided. */
  readonly clause: string
  /** The bind values, in placeholder order. Empty when no fields were provided. */
  readonly values: unknown[]
  /** Count of fields included — `0` lets the caller short-circuit (nothing to update). */
  readonly count: number
}

/**
 * Build a parameterized `col = $n, …` SET fragment from a column→value map, skipping
 * any field whose value is `undefined` (the partial-update contract: omit, don't
 * null — pass an explicit `null` to set NULL). Placeholders start at `startIndex`
 * (default 1) so the caller can reserve earlier params or append a WHERE that
 * continues the numbering: `WHERE id = $${result.count + 1}` with `[...values, id]`.
 *
 * Insertion order of the map's keys is the placeholder order (stable per ES2015).
 */
export function buildSetClause(
  fields: Record<string, unknown>,
  startIndex = 1,
): SetClause {
  const cols: string[] = []
  const values: unknown[] = []
  for (const [col, value] of Object.entries(fields)) {
    if (value === undefined) continue
    values.push(value)
    cols.push(`${col} = $${startIndex + cols.length}`)
  }
  return { clause: cols.join(', '), values, count: cols.length }
}

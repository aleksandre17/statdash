// ── relationExists — the ONE rolling-migration precondition probe ─────────────
//
//  The platform's graceful-degradation mechanism for a rolling migration window:
//  an api build may run against a database that has NOT yet applied the migration
//  a feature depends on. Every such feature gates on "does this relation exist in
//  THIS database?" and degrades (404 the capability / available:false) instead of
//  500ing when it is absent.
//
//  to_regclass(name) returns NULL for an absent relation WITHOUT raising — a clean
//  precondition test that does not depend on catching a query error (fail-fast on a
//  missing CAPABILITY, not on a thrown exception we'd have to disambiguate from a
//  real fault).
//
//  WHY a shared helper (M-5 reusable capability / Protected Variations): the probe
//  was hand-rolled in five places (cube/actual-region viewExists, stats/lifecycle
//  datasetPublishedViewExists, stats/datasets referenceMetadataTableExists, catalog
//  categoryTablesExist, bootstrap loadCategories). Each re-derived the SAME SQL. The
//  named, feature-specific wrappers STAY (they carry the "which relation = which
//  migration" intent at the call site), but they now delegate to this one definition
//  of the mechanism — change the probe once, every feature follows (DRY, SSOT).
//
//  Depends only on the narrow query port (Dependency Inversion) — app.pg, a pooled
//  client, or a test fake all satisfy it; never on @fastify/postgres concretes.

/** Minimal query capability the probe needs — satisfied by app.pg / a PoolClient / a fake. */
export interface RelationProbe {
  query<R extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: R[] }>
}

/**
 * True iff EVERY given relation (`schema.table` / `schema.view`) exists in the
 * connected database. A single relation is the common case; the variadic form lets
 * a feature that spans several relations (e.g. the V29 category tables) probe them
 * in one round-trip, AND-ed in SQL. An empty list is vacuously true.
 *
 * The names are SERVER CONSTANTS passed by feature code (never user input), so
 * interpolating them into the to_regclass arguments has no injection surface; they
 * are bound as parameters regardless (defense in depth — to_regclass takes text).
 */
export async function relationExists(
  db: RelationProbe,
  ...relations: string[]
): Promise<boolean> {
  if (relations.length === 0) return true
  // One AND-ed predicate so N relations cost one round-trip. Each is a bound
  // parameter ($1..$n); to_regclass(text) returns NULL when the relation is absent.
  const predicate = relations
    .map((_, i) => `to_regclass($${i + 1}) IS NOT NULL`)
    .join(' AND ')
  const { rows } = await db.query<{ exists: boolean }>(
    `SELECT ${predicate} AS exists`,
    relations,
  )
  return rows[0]?.exists === true
}

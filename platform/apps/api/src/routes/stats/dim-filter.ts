// ── dim-filter — the canonical observation key-selection predicate (SDMX-aligned) ──
//
// SSOT for "scope observations to a dimension key". An SDMX data query key
// (SDMX REST · Eurostat · .Stat) selects a dimension to ONE OR MORE values:
// MULTIPLE values for one dimension are an OR *within* that dimension; ACROSS
// dimensions the selection is an AND. A cross-region panel that wants
// `geo ∈ {R2,R3}` is exactly the multi-value case the single-value `@>`
// containment could not express.
//
// THE CANONICAL FILTER SHAPE (the wire contract, end-to-end):
//   filter = JSON object, one entry per scoped dimension. Each value is EITHER
//     · a scalar  "GVA"        → AND containment   (back-compat, unchanged)
//     · an array  ["R2","R3"]  → OR within the dim (the multi-value form)
//   e.g. {"geo":["R2","R3"],"sector":"_T","measure":"GVA"}
//        = geo ∈ {R2,R3}  AND  sector = _T  AND  measure = GVA
//
// SQL STRATEGY (generic over dimension names — Law 1, no privileged dims):
//   · ALL scalar dims collapse into a SINGLE `dim_key @> $jsonb` containment
//     (one GIN-indexable predicate; for a scalar-only filter the emitted SQL +
//     params are BYTE-IDENTICAL to the prior `dim_key @> $::jsonb`).
//   · EACH multi-value dim emits one `dim_key->>'<dim>' = ANY($text[])` clause
//     (Postgres array membership; the dim name is bound as a jsonb path key, the
//     values as a text[] param — never string-interpolated, no SQL injection).
//   The clauses AND together. An empty array for a dim is `= ANY('{}')` ⇒ FALSE,
//   which is the correct "no value can match" — a deliberately empty selection.
//
// This is a pure function: (filter, startIndex) → { sql, params }. The caller
// owns parameter numbering (the observations route threads $1..$n across the
// dataset/range/limit binds), so this returns the predicate fragment and the
// ordered params to append. No DB handle, no Fastify — Dependency-free.

/** A single canonical filter value: a scalar dim selection or a multi-value OR-set. */
export type DimFilterValue = string | number | boolean | Array<string | number | boolean>

/** The canonical filter map: dimension code → scalar | array (the wire shape). */
export type DimFilter = Record<string, DimFilterValue>

export interface DimFilterPredicate {
  /** SQL boolean fragment, AND-combined, or `'TRUE'` when the filter is empty/absent. */
  readonly sql: string
  /** Positional params in the order their `$n` placeholders appear in `sql`. */
  readonly params: unknown[]
}

/**
 * Build the key-selection predicate for one observation filter map.
 *
 * @param filter      the canonical filter (scalar AND array values), or undefined.
 * @param nextIndex   the next free positional-parameter index ($n) the caller will bind.
 * @param column      the jsonb column holding the dimension key (default `dim_key`).
 *                    Threaded so the as-of read can target `live_obs.dim_key`.
 * @returns `{ sql, params }` — AND the `sql` into the WHERE clause and append
 *          `params` to the query's param array in order. `sql` is `'TRUE'`
 *          (a no-op) when there is nothing to scope, so the caller need not branch.
 */
export function buildDimFilter(
  filter: DimFilter | undefined,
  nextIndex: number,
  column = 'dim_key',
): DimFilterPredicate {
  if (!filter) return { sql: 'TRUE', params: [] }

  // Partition into scalar dims (one shared containment) and multi-value dims (one
  // = ANY each), in deterministic key order. Sorting makes the SQL/params insensitive
  // to how the JSON was authored — same selection ⇒ same predicate (stable for caching
  // + golden tests). Object key order is insertion order in JS; the sort pins it.
  const sortedKeys = Object.keys(filter).sort()
  const scalars: Record<string, string | number | boolean> = {}
  const multiKeys: string[] = []
  for (const dim of sortedKeys) {
    if (Array.isArray(filter[dim])) multiKeys.push(dim)
    else scalars[dim] = filter[dim] as string | number | boolean
  }

  // Assign parameter indices in CLAUSE ORDER so `$n` ascends left-to-right (readable
  // SQL, intuitive param array). The scalar containment leads (when present), then the
  // multi-value clauses in sorted-key order.
  const clauses: string[] = []
  const params: unknown[] = []
  let idx = nextIndex

  if (Object.keys(scalars).length > 0) {
    // All scalar dims → one containment. For a scalar-ONLY filter this is the SOLE
    // clause and is byte-identical to the legacy `dim_key @> $n::jsonb`.
    clauses.push(`${column} @> $${idx}::jsonb`)
    params.push(JSON.stringify(scalars))
    idx += 1
  }
  for (const dim of multiKeys) {
    // Multi-value: OR within the dim via array membership. The dim path key is a SQL
    // literal (->> needs a literal key) but comes from the parsed filter map's KEYS —
    // validated dimension codes, never raw user free-text; VALUES are bound params.
    clauses.push(`${column}->>'${sqlJsonKey(dim)}' = ANY($${idx}::text[])`)
    // Postgres text[] membership: stringify each leaf (dim_key values are text in jsonb).
    params.push((filter[dim] as Array<string | number | boolean>).map((v) => String(v)))
    idx += 1
  }

  if (clauses.length === 0) {
    // filter was `{}` — an explicit empty selection scopes nothing (matches the
    // prior behaviour where an empty object containment `@> '{}'` is always TRUE).
    return { sql: 'TRUE', params: [] }
  }
  return { sql: clauses.join(' AND '), params }
}

// A jsonb object key cannot contain a single quote in our dimension vocabulary
// (codes are [A-Za-z0-9_]). We still defensively reject a quote so a malformed
// dim name can never break out of the ->>'…' literal (fail-fast, defence in depth).
function sqlJsonKey(dim: string): string {
  if (dim.includes("'")) {
    throw new Error(`illegal dimension code in filter key: ${JSON.stringify(dim)}`)
  }
  return dim
}

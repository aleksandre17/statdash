---
name: observations-multivalue-filter
description: The observations route's filter param now supports SDMX multi-value key selection — a dim value may be a scalar (AND containment) OR a JSON array (OR-within-dim). The canonical wire shape + the shared buildDimFilter seam + where the scalar-only variant is required.
metadata:
  type: project
---

# Observations multi-value (OR-within-dim) key selection

The observations route (`apps/api/src/routes/stats/observations.ts`) and the vintage read
(`releases.ts` `GET /:id/observations`) accept an SDMX-aligned multi-value filter so a
cross-region panel can express `geo ∈ {R2,R3}` (was impossible — the old `dim_key @>` single
containment is ONE value per dim, AND across dims, so a multi-region request returned empty).

**The canonical wire contract (for the frontend):** `?filter=` is a URL-encoded JSON OBJECT,
one entry per scoped dimension, each value EITHER
- a scalar `"GVA"` → AND containment (back-compat, unchanged), OR
- a JSON array `["R2","R3"]` → OR within that dimension (the multi-value form).
Example: `filter={"geo":["R2","R3"],"sector":"_T","measure":"GVA"}`
= `geo ∈ {R2,R3} AND sector=_T AND measure=GVA`. Empty array = matches nothing (deliberate
empty selection). Generic over dim names (Law 1 — no privileged dims).

**The seam (SSOT, reuse it):** `apps/api/src/routes/stats/dim-filter.ts` `buildDimFilter(filter,
nextIndex, column?)` → `{ sql, params }`. Pure, DB-free. Scalar dims collapse into ONE
`<col> @> $n::jsonb`; each array dim emits `<col>->>'<dim>' = ANY($n::text[])`; clauses AND.
For a scalar-ONLY filter the emitted SQL+params are BYTE-IDENTICAL to the legacy single-jsonb
containment (no behaviour change for existing callers). Caller owns `$n` numbering; the as-of
read threads it across BOTH legs (live `o.dim_key`, preimg `live_obs.dim_key`). Dim KEYS are
interpolated as jsonb path literals (validated codes, single-quote rejected); VALUES are bound.

**Engine wire side:** `packages/core/src/data/store-api.ts` `toObsParams` now PRESERVES arrays
as arrays (was comma-joining `["R2","R3"]` → the unmatchable literal `"R2,R3"`). Empty arrays
are dropped.

**Schema split (do not collapse):** `filterSchema` (multi-value, exported from observations.ts)
is shared by observations + vintage. The revision-triangle (`releases.ts` `TriangleQuery`)
resolves exactly ONE series via `md5($filter::jsonb::text)` → it MUST use `scalarFilterSchema`
(also exported) — an array there would hash to a key matching no series. Both schemas are the
SSOT, imported (the prior copy-pasted filterSchema in releases.ts was removed).

Tests: `dim-filter.test.ts` (pure, the SQL/param shape) · `apiStore.async.test.ts` (array wire
encoding) · `observations-multivalue.fitness.test.ts` (DB-gated: real Postgres OR-union /
AND-of-ORs against a seeded geo×approach grid).

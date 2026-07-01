---
name: api-shared-seams
description: two shared apps/api lib seams to reuse (don't re-derive) — relationExists rolling-migration probe + buildSetClause partial-UPDATE builder; plus the alreadyPublished RFC-9457 factory
metadata:
  type: project
---

Three reusable seams in `apps/api/src/lib/` extracted from copy-paste during the
2026-06-24 quality sweep. REUSE these; do not re-derive the mechanism.

**`lib/relation-exists.ts` — `relationExists(db, ...names)`** (the rolling-migration
precondition probe, M-5). The platform's graceful-degradation mechanism: an api build
may run against a DB that hasn't applied a migration yet, so a feature gates on
"does this relation exist?" (`to_regclass(name) IS NOT NULL`) and degrades (404 the
capability / available:false) instead of 500ing. Was hand-rolled in 5 places; now ONE
definition. The feature-specific NAMED wrappers stay (they carry "which relation =
which migration" intent) and delegate: `cube/actual-region.ts viewExists` (V26),
`stats/lifecycle.ts datasetPublishedViewExists` (V28), `stats/datasets.ts
referenceMetadataTableExists` (V31), `catalog/index.ts categoryTablesExist` (V29,
variadic — 3 tables AND-ed in one round-trip), `bootstrap/index.ts loadCategories`
(V29). Depends only on the narrow query port. Any NEW rolling-migration feature:
add a named wrapper that calls `relationExists`, never a 6th raw to_regclass.

**`lib/sql-update.ts` — `buildSetClause(fields, startIndex?)`** (parameterized
partial-UPDATE SET builder, M-5). A partial update writes only supplied fields
(undefined = omit, explicit null = set NULL). The fragile placeholder arithmetic
(`$${sets.length+1}`) was copy-pasted into 4 config routes (data-sources, data-specs,
nav, pages identity). Now: pass a `{col: value|undefined}` map → get `{clause, values,
count}`; the route appends its own `WHERE id = $${count+1}` with `[...values, id]`.
The route still owns its FULL statement (RETURNING vs in-txn shapes differ
legitimately) — only the bug-prone math is shared. JSONB columns: pass
`JSON.stringify(v)` as the value (column type coerces text→jsonb; no `::jsonb` cast
needed in assignment context). Column names are literal map keys (never user input),
values always bound — fully parameterized.

**`lib/problem.ts` — `alreadyPublished(existingJobId)`** (RFC-9457 factory). The
Idempotent-Receiver 409. Was `throw new HttpError(409, JSON.stringify({code,
existingJobId}))` in BOTH `routes/ingest/index.ts` AND `routes/admin/displays.ts` —
a structured blob stuffed into `detail`. Now a `conflict` Problem carrying `code:
'ALREADY_PUBLISHED'` + `existingJobId` as RFC-9457 EXTENSION MEMBERS (top-level body
fields, read as `body.existingJobId`, not `JSON.parse(body.detail)`). No in-repo
client/test consumed the old stringified shape (verified by grep), so the conversion
was byte-safe on status (still 409) and a contract improvement. Sweep kept api green:
typecheck + build + lint(0) + suite 118 passed/44 skipped; platform-wide 1150 passed.

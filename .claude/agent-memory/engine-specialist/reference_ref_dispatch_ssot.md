---
name: ref-dispatch-ssot
description: resolveRef (core/src/ref/ref.ts) is the ONE dispatcher for every $-ref; scope taxonomy ctx/param/row/var/dim; $ctx collision fixed via v5 migrator
metadata:
  type: reference
---

`packages/core/src/ref/ref.ts` is the SSOT for `$`-ref resolution [ADR R4 / fault-line F-B].
ONE `resolveRef(ref, services)` dispatcher routes by scope. Closed taxonomy (`REF_SCOPES`):
- `ctx`  (`$ctx`)   → `services.dims` (SectionContext.dims) — ObsQuery filters
- `param`(`$param`) → `services.params` — DataLink filter-param (was the colliding `$ctx`)
- `row`  (`$row`)   → `services.row` — clicked datum (DataLink)
- `var`  (`$ref`)   → `services.vars` — FilterDerive if-else fallback
- `dim`  (`$cl`/`$d`)→ classifier/display view; delegates to `resolveDimRef` (codelist.ts, the dim-scope LEAF)

**Consumers route through resolveRef (no parallel evaluators):** links/resolver.ts, data/store-filter.ts,
registry/resolvers.ts (resolveFilterForReqs), config/filter-derive.ts, data/resolve.ts, data/transform/steps.ts.
Locked by `core/src/ref/ref.fitness.test.ts` (FF-ONE-RESOLUTION-PATH source-scan: consumers must import resolveRef;
only ref.ts/codelist.ts may CALL `resolveDimRef(`).

**The `$ctx` collision fix:** DataLink param token `$ctx`→`$param` (DataLinkParam in links/types.ts). `$ctx` now means
ctx.dims EVERYWHERE. Migrator v4→v5 (config/migration.ts `migrateDataLinkCtx`) rewrites `$ctx`→`$param` ONLY inside
`dataLinks[].params` values — leaves ObsQuery/vars `$ctx` untouched. CURRENT_SCHEMA_VERSION = 5.

**NOTE — expr package has its OWN ref resolution:** `@statdash/expr` (below core in the arrow) resolves ExprRef
`$ctx`/`$row`/`$derived`/`$literal` in its own `evalRef` (expr/src/eval.ts). That is a DELIBERATELY separate
lower-layer concern (expr cannot import core). R4's resolveRef unifies the CORE-tier ref families only; do NOT try to
route expr's ExprRef through core's resolveRef (arrow violation). The taxonomy's `var`=`$ref` is core's FilterDerive
if-else ref, NOT expr's ExprRef.

No live config (geostat sources, provisioning) uses a DataLink `$ctx` — migrator is a no-op there ⇒ byte-identical.

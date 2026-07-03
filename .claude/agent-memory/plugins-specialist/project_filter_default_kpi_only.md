---
name: filter-default-kpi-only
description: `default` on a $ctx query filter ref is KPI-path-only; type:"query" specs silently ignore it — use {$ne:_T,$ctx} instead
metadata:
  type: project
---

A `{$ctx:dim, default:X}` filter ref is honored ONLY by the KPI-family path
(`packages/core/src/data/kpi.ts` `resolveFilterVal` → `ref.default ?? ''`).

**On a `type:"query"` spec it is a SILENT no-op.** QueryResolver →
`storeObs` → store-filter.ts `resolveFilter` / `buildObsFilterParam` resolve
`$ctx` via `resolveRef(ref, {dims})` (`ref/ref.ts`) which returns
`dims[key]` with NO default fallback; an empty value → wildcard. `CtxRef` type
(`sdmx.ts`) is `{$ctx:string}` — carries no `default` field. Page vars/derives
land in `ctx.vars`, NOT `ctx.dims`, so a var-backed `{$ctx:_derived}` in a
query filter also can't resolve.

**Why it matters:** AR-38's owner-approved DESIGN §3.2 proposed adding
`default:"_T"` to 4 bare `{$ctx:sector}` query clauses to stop the sentinel
flip (`_T→""`) wildcard-double-counting the `_T` total against its leaves — but
that would have shipped the bug. The correct provisioning-only fix is the
geo-arm idiom `{$ne:"_T","$ctx":"sector"}` (store-agnostic: unselected→exclude
`_T` + wildcard leaves = the total; selected→that member). Safe when the node
aggregates the dim away; numerically = the old `_T` pin under `_T == Σleaves`.

**How to apply:** to make an unselected query filter fall back to the aggregate
`_T` row, DON'T reach for `default` (KPI-only) — use `{$ne:"_T","$ctx":dim}`.
Reserve `default:"_T"` for KPI-family specs (point/yoy/growth/ratio). See
[[project_store_decorator_install_point]] for the store-filter seam.

---
name: reference-no-privileged-literal-guard
description: FF-NO-PRIVILEGED-LITERAL — vitest scan of registry/** + check-laws.sh twin forbidding privileged-dim / tenant-field literals in resolvers
metadata:
  type: reference
---

FF-NO-PRIVILEGED-LITERAL locks the crown resolver layer (the surface second-tenant.fitness certifies) against two literal classes.

- **Vitest SSOT:** `packages/core/src/registry/no-privileged-literal.fitness.test.ts` — line scanner over `registry/**` (skips comments/tests/.d.ts).
- **Bash twin:** `ops/scripts/check-laws.sh` (added after the FF-NO-MODE-LITERAL block), scoped to `$ENGINE/src/registry`. Keep the two in sync.

Forbidden (non-comment lines):
1. Privileged DIM-NAME literal `time`/`geo`/`sector`/`region` — quoted (`'time'`) OR bare object key (`{ time: … }`). Use the TIME_DIM SSOT (core/context.ts).
2. Tenant-namespaced field `<x>Color`/`<x>Label` (camelCase compound, e.g. `accountColor`). Engine reads GENERIC `color`/`label` only.

**Deliberately exempt:** `{ measure: … }` — that is the ObsQuery field name (the query API's own key), NOT a privileged-dim literal; obs-ROW measure access has its own SSOT `MEASURE_DIM`. Do not add `measure` to the forbidden set.

**How to apply:** adding a resolver that reads an obs/meta field → use generic `color`/`label`; pinning time on an obs query → `filter: { [TIME_DIM]: … }` (not `atTime`, which only writes ctx.dims — `_observe` ignores that). Related: [[cluster2-law1-seams]].

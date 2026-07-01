---
name: api-typecheck-inflight
description: RESOLVED — the ADR-0027 cube-region symbols (loadAllowedRegion/firstRegionViolation) landed; apps/api typechecks fully green
metadata:
  type: project
---

HISTORICAL (resolved 2026-06-24). Earlier, `apps/api` typecheck showed errors in
`src/ingest/validate.ts` referencing undefined `loadAllowedRegion` /
`firstRegionViolation` — another agent's in-flight ADR-0027 (SDMX-P0-1)
ContentConstraint work.

**Current state:** that work LANDED. Both symbols now live in
`apps/api/src/ingest/region.ts` (`loadAllowedRegion` loads a dataset's role='allowed'
cube region into an in-memory predicate; `firstRegionViolation` is the batch-form
twin of the V26 `stats.dim_key_in_allowed_region` SSOT). validate.ts imports them and
emits `ILLEGAL_COMBINATION`. `pnpm --filter @statdash/api typecheck` is fully GREEN.

**How to apply:** this is no longer a DO-NOT-TOUCH zone. The ingest layer is complete
and clean (Law-1 generic, batch-loaded, fail-soft). If a future typecheck breaks,
it IS your edit — don't blame in-flight ADR-0027 work.

---
name: api-scripts-src-boundary
description: apps/api scripts/ and src/ are separate tsc compilation units — runtime src/ code must not import build-time scripts/ (seed-helpers); duplicate-but-aligned SQL instead
metadata:
  type: project
---

`apps/api/scripts/` and `apps/api/src/` are compiled by DIFFERENT tsconfigs: `tsconfig.json` (rootDir:"src", emits to dist) vs `tsconfig.scripts.json` (include:["scripts"], noEmit, runs under tsx with an ambient @geostat/engine shim).

**Why:** the ETL scripts (seed.ts/seed-helpers.ts) are build-time tools that import geostat bundle DATA via an ACL; they are deliberately NOT part of the API build. Importing a scripts/ file from src/ pulls a file outside rootDir into the src build (tsc rootDir violation) AND couples runtime to a build-time script (against the dependency arrow, Law 3).

**How to apply:** when runtime code needs logic that also lives in seed-helpers (e.g. the stats.* upsert SQL), do NOT import seed-helpers. Put the canonical SQL in a src/ module on the `Queryable` DI port (see `apps/api/src/ingest/upsert.ts` — it restates upsertClassifier/upsertDisplay/upsertObservation byte-identical to seed-helpers but on the port). The two copies are kept aligned because both write through the same V4/V8 gold triggers — a constraint change forces both to update. This is intentional duplication at a compilation boundary, not a DRY violation to "fix" by cross-importing.

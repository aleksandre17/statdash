---
name: seed-etl-decoupling
description: The api seed ETL imports geostat bundle data but must NOT couple to the engine type graph — use an ACL + ambient shim + cleared paths.
metadata:
  type: feedback
---

The seed script (`apps/api/scripts/seed.ts`) ingests the three static bundles from `apps/geostat/src/data/{gdp,accounts,regional}/raw.ts`. Those bundle files carry `import type { ... } from '@geostat/engine'`.

**Rule:** the seed imports the bundles' RUNTIME data only; it owns its own input contract (local interfaces = an Anti-Corruption Layer) and must not pull the engine's type graph into the API typecheck.

**Why:** (1) the dependency arrow (Law 3) — the API must not depend on the engine/frontend. (2) Mapping `@geostat/engine` to its source in a NodeNext tsconfig drags the whole engine tree in and explodes with TS2835 (engine source uses bundler-style extensionless imports incompatible with NodeNext).

**How to apply:** the working setup is —
- `apps/api/tsconfig.scripts.json` (separate from build; build includes "src" only). It sets `"paths": {}` to OVERRIDE the root tsconfig's `@geostat/engine`→source mapping (the root mapping otherwise wins over an ambient shim).
- `apps/api/scripts/types/geostat-engine.d.ts` — ambient `declare module '@geostat/engine'` with permissive types, so the bundles' type-only imports resolve to the shim, not the source.
- seed.ts re-types the imported data through local `*In` interfaces (the ACL).
- Runtime: `tsx scripts/seed.ts` — type-only imports erase, workspace resolution works.
- `pnpm --filter @geostat/api typecheck` runs both `tsc --noEmit` (src) and `tsc -p tsconfig.scripts.json` (scripts).

This pattern applies to any future ETL/script in apps/api that reads geostat/engine source files.

---
name: project-ci-db-gating
description: How the DB-gated suites un-skip and what each precondition needs (migrate vs seed vs self-provision) for CI/parity work
metadata:
  type: project
---

The DB-gated suites use `const suite = process.env.DATABASE_URL ? describe : describe.skip`
— a no-op locally, a real gate only when DATABASE_URL is set (CI). The two that gate today:
`apps/api/src/routes/bootstrap/bootstrap-parity.fitness.test.ts` and
`apps/api/src/ingest/upsert.scd2.test.ts`.

**Why (precondition map, non-obvious):**
- **bootstrap-parity**: needs migrations ONLY (no separate `seed`). It self-provisions by
  copying the committed `apps/api/provisioning/geostat.provisioning.json` into a temp dir and
  calling `runProvisioning`. V13 migration seeds `config.locale` (en + ka, ka is_default,
  is_active defaults true) which the i18n↔locale assertion relies on.
- **scd2**: migrations ONLY; runs in a rolled-back tx, upserts the `account` dimension itself.
- **verify-parity (P1-3, scripts/verify-parity.ts) — RETIRED as a lane** (see [[fresh-provision-canonical]]): the bundle `seed` + `verify-parity` stages were removed from validate-local (bundles are stale 3-dim; canonical ingest is the SSOT). `verify-parity.ts` survives only as the `ParityRow`/`diffParity` comparator lib. Historical order was: migrate → `pnpm --filter @statdash/api seed` → start API → verify-parity.

**Key orchestration distinction:** the API at boot (`src/index.ts`, on `app.ready()`) runs
`runProvisioning` from `./provisioning` — so starting the API auto-loads config.* — but it
does NOT seed the cube (stats.observation). The cube must be seeded separately before
verify-parity, or /api/stats/observations returns nothing and parity fails.

**How to apply:** When wiring any CI/parity step, set DATABASE_URL to un-skip; don't add a seed
step for bootstrap-parity/scd2 (waste); DO seed before verify-parity. Migrations require the
`timescale/timescaledb-ha:pg16` image (V4 hypertable + V13 ICU collations) — a plain postgres
image fails. See [[project-toolchain-facts]].

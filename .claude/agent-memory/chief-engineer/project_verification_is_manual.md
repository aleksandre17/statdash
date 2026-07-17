---
name: verification-is-manual
description: The platform has NO executing CI — every green/BUILT/VERIFIED is a manual local pnpm-test run; the one ci.yml is stale (dead package scope) and never-run. Verified 2026-07-15 coherence audit.
metadata:
  type: project
---

**The single largest coherence defect (2026-07-15 deep coherence audit).** Every "gate green (N/0 fail)", every registry `BUILT`/`VERIFIED` row, every "VERIFIED live :3013" verdict is a MANUAL `pnpm test` / one-time Playwright run by an agent on one workstation. There is no standing gate holding the line.

**Why:** the only workflow, `.github/workflows/ci.yml`, (a) declares itself *"⚠ NOT YET EXECUTED — never run in CI"* (header line 42–44), and (b) is STALE — its api steps filter `@geostat/api` (`ci.yml:158,250,268,289`: typecheck/seed/verify-parity/exec tsx) but the Phase-5 rename made every package `@statdash/*` (`apps/api/package.json:2`). Those filters now match nothing. So even if triggered it fails/no-ops at the api steps.

**Consequences (all load-bearing, verify before trusting a green):**
- The **18 DB-gated suites** (`describe.skip` unless `DATABASE_URL`) have NEVER executed — `DATABASE_URL` is set only in the never-run CI. bootstrap-parity, upsert.scd2, verify-parity are dark. A wire/DB→bootstrap projection change passes every *executed* gate silently.
- The **12 Playwright e2e specs** (`apps/panel/e2e/*.e2e.ts`) are not in any workflow — only `test:e2e` npm scripts. "VERIFIED live" = unreproducible one-time agent runs.
- M0/M1/M2 rows say "committed on `feat/ar49-…` (NOT pushed)". Branch never pushed → CI never even attempted.

**How to apply:** (1) Treat "BUILT/VERIFIED" as "ran once locally," not durable — re-run or re-read before building on it. (2) The #1 highest-leverage fix in the whole platform is Tier-0: fix ci.yml scope, push, make DB-gated + e2e suites run on push/PR. Until then, ~223 source fitness files are documentation, not an ecology (Ford/Parsons: continual evaluation is the defining property). (3) A never-run workflow referencing dead package names is FALSE-GREEN — worse than none (see [[kit-false-green-classes]], [[self-policing-mandate]]). Full audit: `docs/architecture/audit/DEEP-2026-07-15-coherence.md`.

**Related durable findings from the same audit:**
- **Corpus adoption = 0** for the metric-first stack: `metric-ref`/`"metric":` count in `apps/api/provisioning/geostat.provisioning.json` is 0, yet AR-40/49/50 are "BUILT/LIVE". AR-40 P0 made raw-code≡metric-id byte-identical, so the corpus still ships raw codes. `FF-DATA-BOUNDED` does NOT exist. The platform's dominant failure mode: ship mechanism, defer adoption into invisibility.
- **`no-capability-without-consumer` has a hole:** it guards only engine-tier families (DataSpec discriminants, scope-keys, MetricDefs) and part C *defers* config-reference adoption "one tier out" to a provisioning gate that does not assert corpus metric adoption. App-tier orphans invisible.
- **Self-sealing dead code:** `FilterBarControlsBridge` is exported + fitness-tested but never mounted (only `<FilterBarControlsBridge` usage is its own `filterControlDrill.fitness.test.tsx`). The FF keeps the orphan green. No reachability meta-gate exists.
- **Contract-type drift is LOW** (good): PageDataSnapshot dup resolved (`snapshot-store.ts:12` aliases contracts `SnapshotEnvelope`); Law 11 (Authoring Canon) genuinely added to CLAUDE.md.

---
id: "0077"
title: "STAGE-0 — CI resurrection: the executing gate (the floor under every wave)"
status: CONFIG-CORRECT (lead, 2026-07-15) · UNPROVEN — blocked on gh-auth OR a Docker runner (owner door)
class: M
priority: P0
owner: lead
implements: ROADMAP-zero-to-hero Stage-0 · GUARDRAILS keystone · CONCEPT-power-of-the-core G4
depends_on: []
links:
  - .github/workflows/ci.yml
  - docs/architecture/GUARDRAILS.md
---
**Done (lead, harness — no product code):** `ci.yml` corrected — the 4 dead `@geostat/api` package filters → `@statdash/api` (Phase-5 rename; CI could not even resolve the package); **added the green-gate holes** `pnpm lint` + `@statdash/panel` typecheck (panel was absent from CI entirely); refreshed stale `@geostat/engine`/V25 comments; header reframed honest ("CORRECT-BUT-UNPROVEN, not evidence"). YAML parses clean; unit coverage confirmed complete (root `vitest.config.ts` `test.projects` spans all packages + panel + api + geostat).

**⚠️ Load-bearing risk flagged, NOT blind-fixed — the FRESH-MIGRATE V33 HAZARD:** a pristine CI Postgres migrates V1→V39; a single uncapped `flyway migrate` was known to DIE at V33 (needs canonical data present — the migrate/ingest interleave, ADR-035; database-architect memory `project_fresh_from_zero_interleave`). The first real run will likely hit this. Fix = the ADR-035 interleave (migrate-to-cap → seed → migrate-rest), never a blind bypass. This is the true work of proving Stage-0 — a database-architect + senior-backend slice once a runner exists.

**⛔ OWNER DOOR (the blocker to "the gate RUNS green"):** `gh` is not authenticated on the dev box and the authoring env has no Docker — so CI cannot be pushed/watched OR run locally from here. To turn the key, ONE of: (a) `gh auth login` + push this branch and watch the Actions run (lead iterates on real failures — chiefly the V33 hazard), or (b) a Docker-capable runner to exercise the Flyway+PG path locally. **Lead recommendation: (a)** — cheapest, and the whole point is a gate that runs in the real place (GitHub), not a local imitation.

**Deferred (honest, staged — NOT authored blind):** the 12 Playwright e2e + the J1–J6 journey walks are NOT yet in a workflow (they need a running panel+api; authoring never-run YAML for them would repeat the disease). They land as a second CI job AFTER the base pipeline proves green — incremental, each leg proven.

**Ride-along (folded into W1 closure, not a separate spawn):** the one stale RED on HEAD — `apps/panel/src/command/insertByteIdentity.fitness.test.ts` expects section-wrap that ADR-042 D3 de-privileged.

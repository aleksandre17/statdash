# Opus Brief — durable resume state

## Current State

**Two workstreams this session (2026-07-01→02):**

### A. `.claude` SSOT reorg — DONE, MERGED TO `main` (7 commits)
- One canonical `.claude` at repo root; `platform/.claude` deleted; ADRs → `docs/architecture/decisions/`; auto-load 5.98KB; naming canon; rotation; drift-guard.
- **Memory-home is now SELF-HEALING:** native tool writes `<cwd>/.claude/agent-memory` (cwd-relative — found the real divergence root cause). `.claude/kit/hooks/memory-home-guard.py` (SessionStart/SubagentStop/Stop) relocates any stray to root; doctor "single memory home" is the backstop. `pre-reorg-snapshot` tag exists.

### B. Render-pipeline PARITY build — IN PROGRESS on branch `feat/render-pipeline-parity` (NOT merged, NOT deployed)
Goal: every chart/table/KPI renders "data as it was" (correct pre-regression values) via clean architecture (no hardcode). Plan = `work/board/render-pipeline.md` items 0009–0055; specs in `platform/work/SPEC-render-pipeline-target*.md`; diagnoses in `platform/work/{render-drift,effect-variable,static-era}*.md`.

**COMMITTED + green (branch, full suite 2216 tests 0-fail):**
- C1 formatting SSOT (compact locale-aware; killed `/1000+'000'` axis hack) · BI-B3 signed formatter (chart==table) · BI-B1 localize-at-boundary (`[object Object]` fixed, DeriveContext.locale) · BI-B2 ranking `by:['geo']` (dup region labels) · C2 warm-contract · **ApiStore superset point-read** (live timeseries/growth no cold-crash — store-filter.ts SSOT) · C4 one choropleth engine (retired panels/map; geograph sole) · C5 mean KPI + cagr-zero-baseline guard · C6 component rollup via declarative `contribution_role` + per-capita 483→**4829.9** + expenditure bridge (C+I+X−M=GDP) · C7 dual-view (scoped I-6) + map toggle→view.role · C3 **effects recovery** (perspective onEnter/onExit param mutation; mode-switch clears stale params — the owner's core concern) · fixed stale perspective test 11→10.

**DATA-PARITY LOCK — DONE, GREEN, COMMITTED.** `platform/apps/geostat/src/data/{parity-harness.tsx, golden-canonical-alias.ts, data-parity/chart-eq-table/chart-presence.fitness.test.tsx}`. 3 gates, 26 tests, 0 fail: FF-DATA-PARITY 13/13 anchors == golden with **Δ0.000 through the real pipeline** (GDP 2024=93022.3, per-capita 2014=4829.9, all 6 KPIs), FF-CHART-EQ-TABLE (dual-view scoped), FF-CHART-PRESENCE. golden-canonical-alias = static→canonical code ACL (values preserved) + explicit `_T` totals. ⇒ "data as it was" DETERMINISTICALLY PROVEN. **The render-parity build is functionally COMPLETE on the branch.**

## STATUS — render-parity epic DONE + LIVE (2026-07-02)
- `feat/render-pipeline-parity` MERGED to `main` (FF 491eab1→2cdf190), pushed; full suite 2250 tests 0-fail.
- **DEPLOYED to prod** (SSH `geostat-deploy` 192.168.1.199, `docker-compose.prod.yml`, project `statdash-prod`): flyway V38 ok, ingest converged, containers healthy, smoke 200.
- **LIVE render-verify (Playwright vs :3002) ALL ✓:** GDP 2024=93022.275, per-capita 2014=4829.877, growth 2020=−6.291 (sign), choropleth 16 fills, 0 `[object Object]`, 11 distinct regions, component charts populated, axis==table, no kpi/dynamics crash, mode-toggle clears stale params. ⇒ "data as it was" is LIVE.
- Rollback armed: tags `pre-parity-deploy`=b5bf242 + `pre-parity-origin-main`=57a34e5, DB backup `/tmp/statdash-prod-backup-20260702-094036.dump`, `:rollback` images.
- Deploy note: live stack builds from `ops/compose/docker-compose.prod.yml` (NOT the kit); the kit `gen_server_compose.py` seam was already correct (line 56 is a comment; `BUILD_LAYOUTS` emits `context:"./context"`). Regression-B (observations filter) was never broken (renderer sends one `filter=<JSON>` param).

## NEXT (resume here)
The render-parity epic is COMPLETE + LIVE. Next = the parked **innovation initiatives** ([[proactive-innovation-mandate]]): (1) Grammar of Interaction / cross-filter, (2) formal semantic/metrics layer (Cube/Malloy/LookML class), (3) data lineage/provenance surface — register in `platform/work/ARCHITECTURE-REGISTRY.md`, architect-design the owner's pick, sign-off, build.

## STANDING rules (this session, binding)
- **green-gate: PARSE THE LOG (`Tests N failed`), NOT exit code** — `pnpm test` returns 0 even when vitest fails.
- "data as it was" = the CORRECT golden/source values, NOT the buggy current screenshots (e.g. per-capita 2014 = 4829.9, screen showed 483).
- chart==table asserted ONLY for same-section dual-view; different panels may have different data pipes.
- **Proactive-innovation mandate** ([[proactive-innovation-mandate]]): parked future initiatives (owner said finish parity FIRST) — (1) Grammar of Interaction / cross-filter, (2) formal semantic/metrics layer (Cube/Malloy/LookML class), (3) data lineage/provenance surface. Register in `platform/work/ARCHITECTURE-REGISTRY.md`; design via architect + owner sign-off after parity.
- Owner granted autonomy for en-route improvements (within DoD, no degradation).

## Last Session
Ran the `.claude` SSOT reorg (merged to main) + drove the render-pipeline parity build on branch `feat/render-pipeline-parity`: all capabilities C1–C7 + bug fixes + ApiStore live-fix + effects recovery committed & green (2216 tests); parity-lock harness built (gdp/KPI parity pending golden code-reconciliation, in flight). Memory-home divergence permanently fixed (self-heal hook). Next: finish golden reconcile → commit parity → deploy-verify (owner OK) → merge to main.

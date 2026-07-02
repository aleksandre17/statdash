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

## NEXT STEPS (resume here)
1. (optional) run full suite from `platform/` (`pnpm test`, parse LOG) to confirm the whole branch green with parity added.
2. **deploy-verify (ONLY on owner OK — real-server side-effect):** via `ops/` + `kits/geostat-kit` (real Docker build + headless-browser render vs golden + `scriness/` screenshots — the LIVE "as it was" proof, since parity is deterministic/jsdom). FIRST fix the kit blocker: `kits/geostat-kit` `gen_server_compose.py:56` hardcodes `build.context:"."` → must be `"./context"` (else `geostat api deploy` fails).
3. After deploy-verified → **merge `feat/render-pipeline-parity` → `main`** (owner authorizes merge; server tracks main → push triggers rebuild). This is when the fixes go LIVE (until then the site shows old `main` build — expected).
4. THEN the parked innovation initiatives (interaction-grammar / semantic-layer / lineage) — register + architect-design + owner sign-off.

## STANDING rules (this session, binding)
- **green-gate: PARSE THE LOG (`Tests N failed`), NOT exit code** — `pnpm test` returns 0 even when vitest fails.
- "data as it was" = the CORRECT golden/source values, NOT the buggy current screenshots (e.g. per-capita 2014 = 4829.9, screen showed 483).
- chart==table asserted ONLY for same-section dual-view; different panels may have different data pipes.
- **Proactive-innovation mandate** ([[proactive-innovation-mandate]]): parked future initiatives (owner said finish parity FIRST) — (1) Grammar of Interaction / cross-filter, (2) formal semantic/metrics layer (Cube/Malloy/LookML class), (3) data lineage/provenance surface. Register in `platform/work/ARCHITECTURE-REGISTRY.md`; design via architect + owner sign-off after parity.
- Owner granted autonomy for en-route improvements (within DoD, no degradation).

## Last Session
Ran the `.claude` SSOT reorg (merged to main) + drove the render-pipeline parity build on branch `feat/render-pipeline-parity`: all capabilities C1–C7 + bug fixes + ApiStore live-fix + effects recovery committed & green (2216 tests); parity-lock harness built (gdp/KPI parity pending golden code-reconciliation, in flight). Memory-home divergence permanently fixed (self-heal hook). Next: finish golden reconcile → commit parity → deploy-verify (owner OK) → merge to main.

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

**IN FLIGHT (agent running at checkpoint):** `database-architect` (id `ae8b3e6f6fae8a490`) reconciling golden fixtures static→canonical codes + `_T` totals so the DATA-PARITY gate can verify gdp panels + 6 KPIs (they render empty/0 ONLY because golden uses pre-rename codes; pipeline PROVEN faithful — accounts P1/P2/B1G + regional GVA total match golden to 0.03; presence + dual-view ALL pass).
**UNCOMMITTED on disk (parity harness — commit on resume):** `platform/apps/geostat/src/data/parity-harness.tsx` + `data-parity.fitness.test.tsx` + `chart-eq-table.fitness.test.tsx` + `chart-presence.fitness.test.tsx`.

## NEXT STEPS (resume here)
1. Check `database-architect` output (task `ae8b3e6f6fae8a490`); if golden reconciled, re-run the 3 parity fitness tests → expect gdp anchors (GDP 2024=93022.3, per-capita) + 6 KPIs PASS.
2. Commit the parity-lock (harness + reconciled golden + 3 gates). Register as CI gates (0030).
3. **deploy-verify (ONLY on owner OK):** via `ops/` + `kits/geostat-kit` (real Docker build + headless-browser render vs golden + `scriness/` screenshots). FIRST fix the kit blocker: `kits/geostat-kit` `gen_server_compose.py:56` hardcodes `build.context:"."` → must be `"./context"` (else `geostat api deploy` fails).
4. After parity green + deploy-verified → merge `feat/render-pipeline-parity` → `main` (owner authorizes merge; server tracks main → push triggers rebuild).

## STANDING rules (this session, binding)
- **green-gate: PARSE THE LOG (`Tests N failed`), NOT exit code** — `pnpm test` returns 0 even when vitest fails.
- "data as it was" = the CORRECT golden/source values, NOT the buggy current screenshots (e.g. per-capita 2014 = 4829.9, screen showed 483).
- chart==table asserted ONLY for same-section dual-view; different panels may have different data pipes.
- **Proactive-innovation mandate** ([[proactive-innovation-mandate]]): parked future initiatives (owner said finish parity FIRST) — (1) Grammar of Interaction / cross-filter, (2) formal semantic/metrics layer (Cube/Malloy/LookML class), (3) data lineage/provenance surface. Register in `platform/work/ARCHITECTURE-REGISTRY.md`; design via architect + owner sign-off after parity.
- Owner granted autonomy for en-route improvements (within DoD, no degradation).

## Last Session
Ran the `.claude` SSOT reorg (merged to main) + drove the render-pipeline parity build on branch `feat/render-pipeline-parity`: all capabilities C1–C7 + bug fixes + ApiStore live-fix + effects recovery committed & green (2216 tests); parity-lock harness built (gdp/KPI parity pending golden code-reconciliation, in flight). Memory-home divergence permanently fixed (self-heal hook). Next: finish golden reconcile → commit parity → deploy-verify (owner OK) → merge to main.

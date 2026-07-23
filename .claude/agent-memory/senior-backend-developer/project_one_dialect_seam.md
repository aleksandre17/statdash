---
name: one-dialect-seam
description: W0 (0ffc46b0) SHIPPED — config.data_spec normalize-on-write (POST/PUT/restore lower sugar via desugarToPipeline); allowlist ratio-list/row-list/growth(multi)/metric; FF-ONE-DIALECT-AT-REST; lane flip scope = isWorkbenchShaped (DU4-safe); pages PUT still un-normalized
metadata:
  type: project
---

**W0 ONE-DIALECT hygiene SHIPPED 2026-07-23 (commit 0ffc46b0, live on dev :3011).** The rest grammar for `config.data_spec` is machine-enforced:

- **THE seam:** `apps/api/src/lib/normalize-data-spec.ts` → `normalizeSpecForRest` (engine `desugarToPipeline`, api legally imports `@statdash/engine` — it's a runtime dep, apps are eslint-outermost). Wired into ALL three write doors in `routes/config/data-specs.ts`: POST create, validated PUT (lowers the MERGED snapshot → an empty `PUT {}` converges a legacy sugar row), revision restore. Lower FIRST, then `validateConfigDoc` (validate-what-you-store).
- **Allowlist (frozen in FF-ONE-DIALECT-AT-REST, must empty at U2):** `ratio-list`, `row-list`, `growth` (multi-code only), **`metric`** — metric was NOT in the design brief but `desugarToPipeline` returns it identity ("already a source(metrics) head by construction"); allowlisted + SURFACED rather than silently stored/rejected. Its fold is unresolved D1-tail work.
- **FF-ONE-DIALECT-AT-REST** = `apps/api/src/provisioning/one-dialect-at-rest.fitness.test.ts` (provisioning scan + seam units + frozen allowlist) + a write-path describe in `config-revision.fitness.test.ts` (fake-pg harness; note: fake revision rows need real ISO `created_at` or `toISOString()` throws).
- **Lane flip (panel):** `lowerLaneEmission` in `workbenchModel.ts`, scope DERIVED = `isWorkbenchShaped` (today query/pipeline). DO NOT widen to all foldables — per-keystroke lowering of timeseries/growth/pivot re-creates the Step A regression the DU4 trust-recovery correction reverted (documented on `toWorkbenchModel`). Widen only as kinds become pane-admissible (W1 simple views).

**Why:** ONE-PIPE §4·D1/D6 + three-zooms §Z8 — Postel: sugar accepted at the boundary forever, only spine at rest.

**How to apply / residual holes:**
- **Pages PUT is NOT normalized** — a sugar DataSpec written into a page node (`config.page_version`) still re-enters storage as sugar; the panel lane flip only covers pane-shaped kinds. Named W0 residual; close it when the pages route gains a spec-walk (or when the fallback-lane kinds fold).
- POST `/config/data-specs` still has NO referential gate (`validateConfigDoc`) — only the dialect seam. Pre-existing E0 gap, unchanged.
- Provisioning re-emission recipe: `platform/e2e/probes/rewrite-provisioning-w0.mjs` (U3 rails: backup → extractRequirements parity both ctx modes → desugar idempotence → APPLY=1); then `UPDATE_BASELINE=1 vitest run .../pipeline-equiv...` and check the baseline diff is discriminant-only. Fitness walkers that read `data.query.filter` must read the source HEAD (`data.pipe[0].query`) — pattern now in accountsFilter/crossFilterLinkage/config-no-rollup tests.
- Dev worktree deploy gotcha: `/tmp/statdash-dev-line` carried STALE tar-synced working-tree state (index pinned at an old sha) → checkout aborts. Fix: `git stash push -u -m ...` (recoverable) then `checkout --detach <sha>`. See [[full-dev-line]].

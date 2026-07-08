---
name: project-benchmark-corpus
description: The benchmark corpus (statdash vs reference-platform class) — platform-architect owns it; consulted at every Leader's Scan
metadata:
  type: project
---

`platform/work/BENCHMARK-REFERENCE-PLATFORMS.md` is the capability-comparison SSOT (statdash vs Form.io/Builder.io/Grafana/Superset·Metabase/Retool·Appsmith). I (platform-architect) OWN it.

**Why:** owner mandated the lead operate as a principal innovator — continuously benchmarking against the reference class, spotting functional LAGs, completing half-formed concepts. That needs a maintained corpus; I created it 2026-07-08 (first Leader's Scan).

**How to apply:** at every Leader's Scan — (1) re-ground each "We-today" cell against the cited file (code is authoritative, not the matrix); (2) re-rank Lag/Missing rows by (Constructor leverage × distance); (3) new Missing row or a leader shipping a new model = refresh trigger → add row + propose initiative into `ARCHITECTURE-REGISTRY.md` (never into the benchmark file — it stays one-body). Keep the "None" rows visible (versioning/expr/validation/tokens/i18n/a11y are genuinely reference-grade — honest calibration).

**Grounded standing (first scan):** reference-grade = schema versioning/migration (`CURRENT_SCHEMA_VERSION=5` chain + per-node version+migrate + forward-compat guard), node registry+palette (`NodeSliceMeta`+`describeApp()`), expr sandbox, two-tier validation, DTCG tokens, i18n LocaleString, WCAG AA. Lag/Missing = interaction WRITE adapter (AR-36/42 registered), plugin SDK (internal-only), authoring governance (version rows only), export/embed (stub), RBAC (missing).

**First scan's 3 NEW registered initiatives:** AR-46 (Extension/Plugin SDK), AR-47 (config authoring governance draft→review→publish + audit + diff/rollback), AR-48 (headless export/embed/snapshot port). Do NOT re-propose the already-registered visions: cross-filter/interaction (AR-36/38/42), semantic layer (AR-40), data lineage (AR-43), multi-tenancy (AR-30, owner-DEFERRED). See [[maximal-orthogonality]] for the defer-until-real-consumer discipline.

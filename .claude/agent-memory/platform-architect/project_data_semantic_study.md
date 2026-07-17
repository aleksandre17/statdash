---
name: data-semantic-study-ar-study
description: AR-50 semantic-layer elevation — reconciled to ONE canonical ADR-034 + ONE canonical SPEC (fable); M3/M5b/M2/M-SQ BUILT, M4-kernel + M5-lifecycle pending; hierarchies = the AR-40↔AR-42 bridge primitive (deferral to re-challenge)
metadata:
  type: project
---

AR-50 = the semantic-layer elevation. Two independent 2026-07-11 studies (Fable-5 + Opus) benchmarked the data-object + JSON-transform + semantic axis vs LookML/Cube/MetricFlow/Malloy/Vega-Lite/Tableau. Both converged: data-manipulation + reactive-graph (ADR-024) at/above class; the gap is semantic DEPTH. Reconciled 2026-07-11 into ONE canonical record.

**Canonical artifacts (read ONLY these):**
- ADR: `docs/architecture/decisions/ADR-034-semantic-query-plane-and-measure-algebra.md` (ACCEPTED, folds both studies). `ADR-025-…` is Superseded→034 (kept for history).
- SPEC: `docs/architecture/proposals/SPEC-data-semantic-worldclass-fable.md`. `SPEC-data-semantic-worldclass.md` (Opus) is Superseded→it.

**FIXED decisions (do NOT re-litigate — MASTER-PLAN → AR-50 DECISIONS):**
- D-AR50-1 relationships = REIFY the SDMX DSD (`ManifestDataflow`→`sliceableBy`), NOT a `RelationshipDef` noun (Fable over Opus).
- D-AR50-2 semantic query = a `metric` DataSpec DISCRIMINANT (registered resolver → `resolveMeasureRef`), NOT a separate `SemanticQuery` plane (Fable M1 over Opus M4).
- D-AR50-3 sequence: M5 → M5b → M2 → M-SQ → M4/kernel → M5/lifecycle.

**Build state (verified 2026-07-12):** M3 one-dialect+one-agg (`parseFormula`, `AGG_OPS`) BUILT `53bb83f` · M5b discoverable modeler + role-is-lens Data Dictionary + `FF-DATA-REACHABLE` BUILT `bb7a74c` · M2 measure-algebra-at-grain (`core/data/metric-grain.ts`, `evalCalcAtGrain`, additivity, `FF-NO-SUM-OF-RATIO`) BUILT `87aea32` · **M-SQ (`metric` discriminant) NOW BUILT/LANDED** — `MetricSpec` in `config/data-spec.ts:242`, `MetricResolver` wired in `registry/resolvers.ts`, in `DATASPEC_DISCRIMINANTS` + root CLAUDE.md DataSpec list (verify `FF-METRIC-QUERY-EQUIV` green on stored corpus before the ⛔ demotion contract) · M4/kernel (transform kernel + `impute`-with-SDMX-flags/broadcast/unfold/bin/timeUnit) + M5/lifecycle (DSD-reify `sliceableBy` + status/certified + catalogVersion) PENDING.

**2026-07-12 deepening audit (Opus, re-commissioned by lead as "SPEC-semantic-layer-deepening" — REFUSED as duplicate; returned as verdict).** The frontier is ALREADY designed (ADR-034 ACCEPTED) + 4/6 built; a new whole-layer SPEC = a 3rd semantic SSOT (after superseded Opus + canonical fable) — declined per FF-CATALOG-ONE-SSOT spirit. The ONE genuinely-open reference-grade gap the accepted design DEFERS: **dimension hierarchies / drill paths** (S4) — and, secondarily, a **multi-hop entity/join graph** beyond DSD-reified shared-key align-join (the MetricFlow entities primitive; likely YAGNI for national accounts). KEY SEQUENCING INSIGHT: hierarchies are NOT YAGNI — they are the **bridge primitive between AR-40/50 (semantics) and AR-42 (drill-down interaction)**: you cannot declare "select→drill" without a governed parent/child dim relation. `DimensionDef` (`data/dimension.ts`) is thin curation with NO hierarchy (conceptRole is an open advisory hint only). Right-next-epic verdict: the semantic keystone is ~2/3 delivered as a substrate; highest remaining leverage = **M5-lifecycle/certification** (provenance AR-43 + published-page governance rest on it) + **promote S4 hierarchies out of deferral as the AR-42 bridge**. AR-42 should co-sequence with the hierarchy primitive, not precede it.

**The only ⛔ one-way door:** the M-SQ contract phase — demote `ratio-list`/`growth` spec discriminants to sugar + flip the Constructor default emission — gate-fired when `FF-METRIC-QUERY-EQUIV`/`FF-GROWTH-KIND-EQUIV` are green on every stored config. Everything else is expand-contract, git-revert-able.

**ADR numbering standard (fixes E7):** `ADR-NNN` three-digit zero-padded; the four grandfathered four-digit records (0023/0025/0026/0033) not renumbered; treat their numeric value as taken. Recorded in ADR-034 §0 + `ARCHITECTURE-REGISTRY.md` footer.

**How to apply:** consult ADR-034 + the canonical SPEC before any AR-50 slice; get the erosion id / invariant / target shape there. Held line: no Cube/dbt/JSONata runtime (Law 5 + FF-AUTHOR-NO-QUERY + extractDeps totality); the reactive-graph surpass is preserved (M2/M-SQ feed it).

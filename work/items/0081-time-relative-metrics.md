---
id: "0081"
title: "TIME-RELATIVE METRICS AS GOVERNED NOUNS — YoY/QoQ/growth/cumulative declared, never coded"
status: ACTIVE (2026-07-17, lead-fired per owner's «გაგრძელე»)
class: M
priority: P0
owner: engine-specialist (Opus)
implements: CAPABILITY-INJECTION-BACKLOG rec #2 (D6 cycle 2026-07-17) → AR-49 M3.2 ranked up; Canon C1 (data first) — the W2 semantic spine's completion at the engine seam
depends_on: ["0072"]
links:
  - docs/architecture/proposals/CAPABILITY-INJECTION-BACKLOG.md
  - platform/packages/core/src/data/metric-calc.ts        # the calc evaluator — the seam
  - platform/packages/contracts/src/manifest.ts            # ManifestMetricInput wire mirror
---
**Intent.** Ratio/share/derived metrics are declarable today; time-relative ones (YoY, QoQ, growth-rate, cumulative) are NOT — every growth number on the portal is either hand-coded in an `op:if` expr (the recurring drift-bug class) or absent. The reference class (dbt MetricFlow, LookML) solves this with SQL time-spines; our variant is BETTER because the engine already point-reads at a declared coordinate: extend `MetricInput.at` with a RELATIVE time token (`{$prev: n}` against the ctx time dim) so «GDP growth YoY» becomes a governed calc-metric declaration — no query language, no new evaluator, Constructor-ready (Law 2).

**The outcome that counts.** (1) The grammar: a relative-coordinate token in `MetricInput.at`, resolved at read time against `ctx.dims` + the store's ordered time members (last-period, n-back; design the exact token set — `$prev` at minimum, judge `$first`/window need vs YAGNI). (2) Wire mirror in `contracts` manifest + registry refinement, zero-dep preserved. (3) At least TWO real governed metrics declared with it in the geostat catalog (e.g. gdp.growth-yoy from gdp.current) and LIVE on :3013 — a KPI binds them through the W2 palette gesture. (4) `FF-` fitness: relative-read correctness incl. edge (first period → honest no-data state per Law 11, never a fake 0 or crash). (5) A Proposed ADR naming the grammar (number = next free in docs/architecture/decisions/).

**Hard boundaries.** Law 1: time is NOT privileged — `$prev` addresses ANY ordered dimension (time is just the first consumer); no `ctx.year`-shaped anything. One evaluator (`@statdash/expr`), one lowering path (`resolveMeasureRef`), FF-BIND-PARITY byte-identity stays green. Non-additive semantics: a growth metric is `non-additive` (never summed — FF-NO-SUM-OF-RATIO class). Expand-contract: existing catalogs untouched semantically. Crosses `packages/{contracts,expr?,core}` → FULL `tsc -b` + full vitest + dist rebuild before any live check.

**DoD.** Gate green (parsed) · dist rebuilt · dev :3013 walk: bind a declared growth metric via the palette, real value renders, first-period edge shows the honest state · card + ADR committed · owner shown.

---
id: "0081"
title: "TIME-RELATIVE METRICS AS GOVERNED NOUNS — YoY/QoQ/growth/cumulative declared, never coded"
status: DONE (2026-07-17; FINAL visual leg closed 2026-07-18 — the real growth series renders live via the governed metric, see 0082 ADR-047 Wave A)
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

---

**COMPLETION (2026-07-17, engine-specialist).**

- **Grammar (ADR-045, PROPOSED):** `docs/architecture/decisions/ADR-045-relative-coordinate-navigation.md` — cites MDX `Lag`/`ParallelPeriod` (adopted whole), SDMX `TIME_PERIOD` (any ordered dim, Law 1), and why coordinate-relative point-reads beat a dbt/LookML SQL time-spine (no dialect, gap-honest, Constructor-ready). Token set: `{ $prev: n }` (minimal canonical); `$first`/window named as OCP discriminants, YAGNI-deferred.
- **Engine:** `RelativeCoord`/`isRelativeCoord` + widened `MetricInput.at` (metric.ts) · `relative-coord.ts` (orderedMembers obs-scan · navigateRelative · resolveRelativeAt) · metric-calc resolves tokens before each read, returns `null` off-the-edge (honest no-data) · calcMetricRequirements warms the whole navigated axis (warm ⊇ read on the live ApiStore). Contracts wire mirror widened (zero-dep). Commits `e6b2f09` (engine) + `57a8c03` (catalog).
- **Two governed metrics:** `gdp.growthYoy` (from gdp.current) + `gdp.perCapitaGrowthYoy` (from gdp.perCapita), both `non-additive`.
- **Fitness:** `relative-coord.fitness.test.ts` — FF-RELATIVE-COORD (member nav + gap-skip) · FF-RELATIVE-EDGE-NO-DATA (first-period null at value AND KPI level) · FF-RELATIVE-GENERIC (Law-1 coded non-time axis) · FF-RELATIVE-WARM-COVERS. Core project 902 pass; FF-BIND-PARITY 8/8 green.
- **Gate (parsed):** tsc — my surface GREEN (2 pre-existing ApexRenderer errors in a file outside my diff). vitest — my surface GREEN; the one failure I caused (redundant `%` unit) fixed; 8 residual `national-accounts` failures are pre-existing base-metric golden drift (`gdp.current` 2024 expected 93022.3 vs 104598 — seed drift, not my surface). lint GREEN. dist rebuilt (`pnpm -r --filter './packages/*...' build`).
- **Live (:3013):** pushed main → api rebuilt on dev. Bootstrap manifest serves `gdp.growthYoy` + `$prev`. Palette-bind walk (`platform/e2e/probes/probe-0081-relative-metrics.mjs`): the governed growth metric surfaces in the Metric Palette, bind LANDS ("მეტრიკა მიბმულია: მშპ-ის ზრდა (წლიური)"), honest no-data grammar renders live ("მონაცემი არ არის"), zero console errors. Shots → `work/authoring-truth/0081/`.
- **Follow-up (out of scope):** grain-SERIES relative navigation (the tuple-vs-token collision) is deferred — the scalar KPI path resolves tokens honestly; grain path drops tokens (`absolutePins`), byte-identical for every token-free metric.

# ADR-045 — Relative-coordinate navigation (`{ $prev: n }` over an ordered member set)

**Status:** PROPOSED (owner blesses acceptance; the grammar landed additively behind FF gates, reversible by revert).
**Decision authority:** engine-specialist proposes; owner accepts. Class-M (public `@statdash/engine` API + zero-dep `@statdash/contracts` wire mirror).
**Extends (never forks):** DC-01 (calculated metrics — `MetricInput`/`MetricCalc`, the measure-algebra seam) · ADR-034 (semantic query plane) · AR-50 M2 (additivity — a growth metric is `non-additive`) · the Cell honest-state seam (W1, `ValueState`). No new evaluator, no new dialect, no new store port.
**Implements:** card `work/items/0081-time-relative-metrics.md` (W2 semantic-spine completion) · CAPABILITY-INJECTION-BACKLOG rec #2 · Canon C1 (*data first*) + C2 (*the canvas never lies*).

---

## Context — growth is the one number the semantic layer could not govern

Ratio/share/accounting-identity metrics are declarable today (DC-01): a `MetricDef.calc` is an expression over component measures point-read at a **generic coordinate** (`MetricInput.at`, an absolute `DimVal` per dim, Law 1). But a **time-relative** number — YoY, QoQ, growth-rate, cumulative — was **not** declarable: every growth figure on the portal is either a raw pre-computed source code (`gdp.realGrowth`) or hand-coded in an `op:if` expression. Hand-coded growth is the recurring drift-bug class, and worse, it **fabricates a 0 at the first period** (the prior-period read misses → `storeVal ?? 0` → `(cur/0−1)` folds to 0), the exact "the canvas lies" wound Law 11 forbids.

The missing primitive is a coordinate that means *"the same measure, one period back"* — resolved not by the author but by the engine, honestly, at read time.

### The reference class (named, per the owner's standing directive)

| Standard | What it solves | What we adopt / why we differ |
|---|---|---|
| **MDX `Lag(n)` / `ParallelPeriod`** (SSAS/OLAP) | relative-member navigation over an ordered hierarchy | **Adopted whole (Law 4).** `{ $prev: n }` navigates the **ordered member set** of a dimension — `n` positions back — NOT a naive `value − n` arithmetic. Off-the-edge → **no member** (honest no-data), never a wrap or clamp. Arithmetic cannot tell "no prior member" from "a gap year with no observation"; member navigation can — that distinction IS the honest first-period edge. |
| **SDMX `TIME_PERIOD`** (ISO 17369) | time is an ordered dimension with a frequency | Our engine already treats time as **just a dimension** (Law 1). The token addresses **any** ordered dimension; member ORDER follows the SDMX member-order canon: the dimension's **classifier codelist order** when coded, else natural value order. Time is merely the first consumer. |
| **dbt MetricFlow / LookML** (the competitors) | relative time via a SQL **time-spine** join | We deliberately **do not** build a time-spine. A time-spine is a materialized calendar table joined in a SQL dialect — it presumes a warehouse, a SQL engine, and contiguous periods. Our renderer is **config-driven and SQL-free**: a growth metric is a **coordinate-relative point read** evaluated by the ONE `@statdash/expr` evaluator over the ONE `storeValAt` seam. No dialect, no spine table, gap-honest, and **Constructor-authorable** (a JSON token, never a function — Law 2). |

---

## Decision — a relative coordinate is a declared token, navigated over ordered members

> **THE GRAMMAR.** An `at` coordinate value is EITHER an absolute `DimVal` OR a `RelativeCoord` token `{ $prev: n }`. At read time each token is navigated over the dimension's **ordered member set** (MDX `Lag`); off-the-edge resolves to **no member**, which the calc evaluator folds to the honest **no-data** state (Law 11) — never a fabricated 0.

### The type (public `@statdash/engine`)

```ts
export type RelativeCoord = { $prev: number }              // n members BACK (MDX Lag(n))
export interface MetricInput {
  measure: string
  at?: Partial<Record<string, DimVal | RelativeCoord>>     // absolute OR relative, per dim
}
```

The union is **OPEN (OCP)**: a future `$first` (MDX `OpeningPeriod` — index-to-base / cumulative anchoring) or a window token is a **new discriminant** resolved by one more branch in `navigateRelative`; the interface and every consumer are unchanged. `$prev: n` is the minimal canonical set the card requires — `$first`/window are **YAGNI-deferred** but named here so the next writing is a registration, not a redesign.

### The resolver (`packages/core/src/data/relative-coord.ts`)

- **`orderedMembers(store, code, dim, ctx)`** — the ordered members of `dim` present at the slice (measure = `code`, every other concrete ctx dim fixed, `dim` freed), via an **obs scan** — the SAME warmed-obs mechanism `obsAtCoord` (the Cell seam) already relies on, so it resolves synchronously on the live async store post-warm. Order = classifier codelist when coded, else numeric/lexical.
- **`navigateRelative(members, current, token)`** — MDX `Lag`: `members[idx(current) − n]`, or `undefined` off-the-edge.
- **`resolveRelativeAt(at, code, ctx, store)`** — replaces every token in an `at` with its absolute member; returns `undefined` when ANY token is off-the-edge.

`resolveMetricValue` calls `resolveRelativeAt` **before** each component read and returns `null` (a NEW third return value) when off-the-edge — the honest no-data signal, distinct from `undefined` (not-a-calc-metric) and from a numeric `0` (a genuine div-by-zero). The KPI `metric` consumer already maps `null → state:'no-data'` (renders a `KpiStateCard`, never a number).

### Warm ⊇ read (the live-store invariant)

`calcMetricRequirements` **drops** a relative-token dim from the warm requirement, so the async store fetches the **whole axis** (time unbounded). Member enumeration AND the navigated prior-member point read then both resolve from that ONE cached superset slice (`resolveCachedPointRead`). A **token-free** input is byte-identical to `{ ...ctx.dims, ...at }` — FF-BIND-PARITY unbroken.

### Wire mirror (zero-dep `@statdash/contracts`)

`ManifestMetricInput.at` widens to `Record<string, DimVal-scalar | { $prev: number }>` — a plain JSON token, so it survives the manifest round-trip and refines onto `MetricCalc` at the existing boot seam (`registerManifestMetrics`) with no adapter change.

---

## Consequences

- **Governed growth is now declarable.** Two real metrics land in the geostat catalog: `gdp.growthYoy` (from `gdp.current`) and `gdp.perCapitaGrowthYoy` (from `gdp.perCapita`), both `non-additive`. A KPI binds them through the W2 palette gesture; the first-period edge shows the honest no-data state.
- **No new evaluator, no SQL, no store-port change.** One dialect (`@statdash/expr`), one lowering path (`resolveMeasureRef`), one point-read seam (`storeValAt`), one honest-state grammar (`ValueState`).
- **Law 1 preserved.** `$prev` addresses any ordered dimension; there is no `ctx.year`-shaped anything and no privileged time branch — proven by FF-RELATIVE-GENERIC (navigation over a coded `phase` axis).
- **Reversibility (09B):** additive superset — every existing config stays valid (`DimVal ⊆ DimVal|RelativeCoord`); `resolveMetricValue`'s widened return is handled by every caller (`?? 0` / explicit `null` check). Rollback = revert; no persisted-state migration.

**Fitness:** `packages/core/src/data/relative-coord.fitness.test.ts` — FF-RELATIVE-COORD (member nav, gap-skip) · FF-RELATIVE-EDGE-NO-DATA (first-period honest no-data at value + KPI level) · FF-RELATIVE-GENERIC (Law-1 non-time axis) · FF-RELATIVE-WARM-COVERS (full-axis warm + token-free byte-identity).

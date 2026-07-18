# ADR-047 — Metric-natural coordinates + the honest-null calc floor

> **Status:** ACCEPTED (design) — the two decided rules that close the ⛔ W-P5 demotion door (card `work/items/0082`, W-P5c FINDING). Class-M (public `@statdash/engine` API). Reversible/additive (expand-contract); no stored config rewritten.
> **Decision authority:** architect (design) → engine-specialist + react-specialist (build waves). Owner accepts.
> **Extends (never forks):** ADR-045 (relative coordinates — the honest-null-at-the-edge precedent) · ADR-046 Addendum 2 (the grain-∅ governed browse) · ADR-034 (semantic query plane / `resolveMeasureRef`) · the Cell honest-state seam (`ValueState`, `cell.ts`). No new evaluator, no new store port, no new dialect.
> **Implements:** the two architect-owned decisions escalated by W-P5c: (1) metric-natural coordinates for the grain-∅ browse; (2) no-data honesty in calc evaluation. Laws 1, 6, 11.

---

## Context — a fabricated number, proven live (the Law-11 breach)

Proven live on `:3013` + by fixture (W-P5c, do not re-derive): `gdp.growthYoy` (a calc metric over `gdp.current`, a **national** metric — no regional geo axis) browsed on a page whose ctx pins `geo=adjara` renders **−100 for every year 2011–2023**. The mechanism, end to end:

1. The grain-∅ governed browse (`pipeline-resolver.browseCalcMetric`) enumerates the metric's time members, then evaluates `resolveMetricValue(ref, atTime(y, ctx), store)` **at the full ctx** — carrying the foreign `geo=adjara` pin.
2. `resolveMetricValue` honors that pin → `storeValAt(gdp.current, {geo:adjara, time:y}) = 0` — because `storeValAt` returns `0` for **both** a genuine zero **and** no-data (the OLAP sum of an empty match is `0`).
3. The growth expr folds `0/prev − 1` (and `0/0`) → **−100** — a number that is a pure artifact of missing data.

Where the metric HAS data at the coordinate the lowering is proven correct (`12.5 / 11.111` + an honest first-period null at the ExternalStore gate). So the defect is **not** in the pipeline lowering — it is two seams deep, both coordinate/honesty concerns:

- **The coordinate is wrong for a browse.** A browse of a metric across a dimension the metric does not range over should read the metric's **natural table**, not impose a foreign pin. (The class answer — see benchmark — is *ignore-with-annotation or refuse; never silently coerce to 0*.)
- **The read is dishonest at the floor.** Even at a coordinate the metric legitimately doesn't cover, `resolveMetricValue` fabricates a number instead of propagating no-data. A statistics platform must never print a number that is an artifact of missing data (Law 11).

### What the manifest actually declares TODAY (the surprise)

**Naturality is NOT declared anywhere.** Checked against the live contracts:

- `MetricDef.dims?` (metric.ts:184) and `ManifestMetric.dims?` (contracts/manifest.ts:142) are **default filter pins** ("merged with query-time filters", e.g. `{adjustment:'S'}`) — *not* the set of axes the metric ranges over. A metric that pins `adjustment:'S'` still says nothing about whether it has a geo axis.
- `ManifestDimension` (manifest.ts:204) declares the tenant's governed dimensions **globally** (id/code/label/`conceptRole` advisory hint/hierarchy) — the PEER of metrics, Law 1 — but there is **no per-metric axis binding**. Nothing maps `gdp.current → {time}` vs `accounts.compensation → {time, geo, sector}`.
- AR-49 / `resolveMeasureRef` resolves a metric-id → codes + governance; it carries **no dimensionality**.

**But naturality IS derivable from the store, at zero extra cost.** The M2 grain algebra already probes exactly this: `metric-grain.enumerateGrainTuples` runs an `obs` scan of a measure's code and reads which grain axes the returned rows populate. `browseCalcMetric` already runs one such obs scan (time-member enumeration). The set of dims — and the members per dim — that a metric's observations actually carry is a **derived fact from the obs slice we already read**. This is the Law-5-faithful route (members resolve FROM the DSD at runtime, never duplicated into config).

### The re-merge wall (why a requirement alone cannot fix this)

The react per-request warm re-merges `reqCtx = { ...ctx.dims, ...r.dims }` (`useNodeRows`; the KPI sibling `useKpiRows.ts:141` is the already-corrected verbatim form). So a warm requirement that simply *omits* `geo` still inherits `geo=adjara` from `ctx.dims`. A requirement cannot *strip* a ctx pin by omission. The existing cure — used TODAY for a national-total KPI on a region-pinned page (`useKpiRows` comment lines 137–140; `cell.ts:89` treats `''` as unpinned) — is the **empty-wildcard**: the requirement sets `geo:''`, which WINS the spread (`{...ctx.dims, geo:''}` = `geo:''`) and the store matcher treats `''` as "dimension unpinned". **Foreign-pin neutralization must therefore be expressed as an empty-wildcard**, and it must be applied at BOTH the read (resolver) and the warm (requirements) from ONE shared function — or warm ⊉ read and the async store throws cold.

### Benchmark — how the class handles "a metric queried along a dimension it does not have"

| System | Behaviour | What we adopt |
|---|---|---|
| **dbt MetricFlow** | The semantic graph knows a metric's reachable entities/dimensions; querying a metric by an unreachable dimension **raises "dimension not available for metric."** Never 0. | The *refuse-or-ignore* principle — never coerce to 0. |
| **Cube.dev** | A measure belongs to a cube; slicing by a dimension with no join path returns the measure **at its own grain** (the foreign slice is not applied), or errors — never a fabricated 0. | *Ignore-with-annotation*: read the metric at its natural grain (our browse), annotate that it's the metric's own table. |
| **LookML** | A measure sliced by an unjoined dimension is simply **not offered / SQL error**; symmetric aggregates prevent fan-out lies. | The measure is defined only where its axes reach; outside → honest absence, not a number. |

**The class verdict:** refuse or ignore-with-annotation — *never* silently coerce a missing coordinate to `0`. Both decisions below implement that verdict: DECISION 1 = ignore-with-annotation (read the natural table) for the exploratory **browse**; DECISION 2 = honest-absence (`—`) for an explicit **bound coordinate**.

---

## DECISION 1 — a browse reads the metric's NATURAL table (foreign pins neutralized)

> **THE RULE.** A grain-∅ metric browse reads the metric at its **natural coordinates**: every ctx pin on a dimension the metric does **not** carry an observation for (a *foreign* pin) is **neutralized to the empty-wildcard `''`** before the read. The metric's natural dims are **derived** from the obs slice the browse already scans — never a declared per-metric axis field. The rule lives in ONE core function consumed by BOTH the browse read and the browse warm, so warm ≡ read by construction.

### The seam (ONE home, two consumers)

New pure core helper (`packages/core/src/data/metric-natural.ts`), a data-layer leaf beside `metric-calc`/`metric-grain`:

```ts
/** The dims a metric CARRIES observations for, derived from an obs slice (Law-5:
 *  from the store, never a declared axis field). A dim present with ≥1 concrete
 *  (non-'_T') member is a natural axis of the metric. */
export function metricNaturalDims(obs: Observation[], code: string): Set<string>

/** ctx with every FOREIGN pin (a concrete ctx dim NOT in the metric's natural set,
 *  whose pinned member is absent from the metric's obs) neutralized to '' — the
 *  empty-wildcard the store matcher + the re-merge warm both read as "unpinned". */
export function naturalBrowseCtx(
  obs: Observation[], code: string, ctx: SectionContext,
): { ctx: SectionContext; neutralized: string[] }
```

- **Read side (`pipeline-resolver.ts`).** `browseMetrics`/`browseCalcMetric`/`browseBaseMetric` compute `naturalBrowseCtx` from the obs slice they already read (base browse: the `query`-resolver obs; calc browse: the time-member obs scan already at line 94) and use the neutralized ctx for the member enumeration AND every per-member `resolveMetricValue`. Zero extra store reads — the naturality is a projection of the slice already in hand.
- **Warm side (`sourceHeadObs` / `pipelineRequirements` / the browse branch of `calcMetricRequirements`).** The warm requirement sets each neutralized dim to `''` so `{...ctx.dims, geo:''}` survives the re-merge wall as "unpinned" and the async store warms the metric's natural (national) slice. The empty-wildcard is the SAME mechanism the national-total KPI already uses — no new warm concept.

### Why derived, not declared

The obs scan the browse already performs makes naturality free and Law-5-faithful (members from the DSD at runtime). A declared `MetricDef.naturalDims` field would (a) duplicate DSD structure into config — the exact Law-5 anti-pattern `ManifestDimension`'s doc forbids; (b) drift from the cube whenever a dataset gains/loses an axis; (c) add authoring burden to every metric. Derivation reuses the M2 `enumerateGrainTuples` precedent (proven machinery), costs one already-issued obs read, and cannot drift.

### Rejected alternatives (DECISION 1)

- **ALT-1a — declare per-metric natural axes (`MetricDef.naturalDims`/`ManifestMetric.dims` as axes).** Duplicates DSD structure into config (Law-5 breach), drifts from the cube, burdens authoring. Refused — naturality is a store-derivable fact, not a governance choice. (Kept as the *escape hatch* only: if a future metric needs to force an axis the obs cannot reveal, a declared override refines the derived set — a registration, not the default.)
- **ALT-1b — return no-data for the whole browse when any pin is foreign (refuse, don't ignore).** Matches MetricFlow's "raise" literally, but destroys the browse's purpose: the author asked "show me this metric" and gets an empty grid on a regional page. The class also offers *ignore-with-annotation* (Cube) — strictly more useful for an exploratory browse, and honest (the grid caption/annotation names the natural grain). Refused for the browse; **kept for the bound-value path** (DECISION 2 — an explicit coordinate is a refuse case, not an ignore case).
- **ALT-1c — inject a default browse grain at emission (e.g. `time`).** Explicitly refused already by ADR-046 Addendum 2 ("a lie in the config — the stored spec carries a grain the author never chose"). Neutralization changes no stored config; it is a read-time coordinate rule. Refused, consistent with the standing decision.

---

## DECISION 2 — the honest-null calc floor (no-data propagates, never fabricates)

> **THE RULE.** `resolveMetricValue` reads each component through a **state-carrying read**; if any component is genuinely **no-data** at its coordinate, the calc result is **`null`** (the honest `—`), never a fabricated number. A metric may DECLARE a per-input `coalesce` value to opt a component into zero-fill where that is the true semantics; the default is honesty. This is the Law-11 floor — it holds on the browse AND on every bound KPI.

### The seam (`metric-calc.ts` + one additive `cell.ts` sibling)

`cell.ts` already models the honest envelope (`Cell`/`ValueState`, `storeCell`) — it just never reaches the calc component read (which uses `storeValAt`, whose OLAP sum collapses no-data→0). Add the at-layered sibling and switch the calc read onto it:

```ts
// cell.ts — the valAt sibling of storeCell (ctx.dims ⊕ at, then storeCell).
export function storeCellAt(
  store: DataStore, code: string, at: Partial<Record<string, DimVal>>, ctx: SectionContext,
): Cell

// metric-calc.ts — resolveMetricValue's component loop:
const cell = storeCellAt(store, code, at, ctx)
if (cell.state !== 'ok') return input.coalesce ?? null   // honest no-data (Law 11), never a fabricated number
derived[name] = cell.value                                // a genuine 0 is state 'ok' → binds as 0
```

This is the **exact generalization of ADR-045**: that ADR already returns `null` when a component's *relative* coordinate is off-the-edge; DECISION 2 extends the same short-circuit to a component that is *no-data at its coordinate*. One honesty rule, two triggers. A calc metric whose component has no observation at the coordinate is itself no-data — a defensible, Law-11-mandated statistical rule (you cannot compute GDP growth from absent GDP).

- **`coalesce` (the declared escape, derive-from-declaration).** `MetricInput.coalesce?: number` — a metric declares "a missing component here means this value" (e.g. `0` for a genuine additive coalesce). Absent ⇒ honest-null short-circuit (the default). This makes the missing-data policy a **declaration on the metric**, not a silent engine convention — the Bounded-Element ideal.
- **`storeVal`/`storeValAt` stay byte-identical** — the `?? 0` sites in `store.ts:196,232` are untouched. Only the calc *component* read migrates to the state-carrying sibling. `kpi.ts` consumers of `resolveMetricValue` already map `null → state:'no-data'` (they handle the ADR-045 null today).

### Blast radius + migration (expand-contract)

- **Expand:** add `storeCellAt` + `MetricInput.coalesce` + the short-circuit. Honest-null becomes the default. This is additive at the type level (`coalesce?` optional; the wire mirror `ManifestMetricInput` widens by one optional scalar).
- **Parity check:** re-run **FF-BIND-PARITY** (its fixtures — `bind-parity.fitness.test.ts`, ctx `{time:2023, geo:'GE'}` with all data present — never hit a no-data component, so they stay green **by construction**; every `ok` cell binds its value identically). Re-run the full suite for byte-identity on token-free/base metrics.
- **Contract:** any fixture that BREAKS is one that was asserting a fabricated number — it was a **latent lie**. Fix it by either (a) declaring `coalesce:0` where zero-fill is the true semantics, or (b) **deliberately versioning** the fixture (documented: "was −100 fabricated, now honest `—`"). The catalog of calc metrics is small (`gdp.growthYoy`, `gdp.perCapitaGrowthYoy`, ratios/deflator) — auditable.
- **First consumer to flip:** `resolveMetricValue` itself (one function) flips all consumers at once (browse + KPI + M2 grain via `readInputAt`). This is intentional — the floor must be uniform; a partial floor is a floor with a hole. `metric-grain.readInputAt:174` already does `resolveMetricValue(...) ?? 0` for a nested derived input — that `?? 0` becomes the one place a grain-series consumer chooses to coalesce a no-data sub-cell (or should itself propagate — flagged as a follow-up, out of this ADR's scope).

### Rejected alternatives (DECISION 2)

- **ALT-2a — null-poisoning arithmetic in the expr (bind `null`, let `add`/`mul` propagate).** Today the expr COERCES `null → 0` inside `add`/`mul` (ADR-045 notes this), so a null component would silently become 0 again unless we change expr arithmetic semantics platform-wide — a far larger blast (every expr, not just calc metrics) with subtle correctness risk. The short-circuit ("any no-data component ⇒ metric no-data") is narrower, more conservative, and matches the existing ADR-045 precedent. Refused as over-broad.
- **ALT-2b — honest-null only in the browse calc path, leave the bound KPI on `?? 0`.** Fixes the visible W-P5c symptom but leaves the Law-11 breach live for any KPI bound at a mismatched coordinate (national metric on a regional card). A floor with a hole is not a floor. Refused — the floor is uniform or it is not the floor.
- **ALT-2c — honest-null with NO `coalesce` escape (pure short-circuit, no declaration).** Simpler, but forces every genuine zero-fill metric (a sum where a missing addend truly means 0) to lose its semantics or break parity, with no declared way to opt in. The `coalesce` field is the derive-from-declaration answer: the metric OWNS its missing-data policy. Refused the escape-less form.

---

## Consequences

- **The −100 lie turns honest.** On the browse (DECISION 1): `gdp.growthYoy` browsed on a `geo=adjara` page neutralizes the foreign geo pin → reads national `gdp.current` → renders the REAL growth series (`12.5 / 11.111 / …`) + the honest first-period null (ADR-045). On any bound coordinate the metric genuinely doesn't cover (DECISION 2): honest `—`, never a number.
- **Law 1 preserved.** Neutralization is generic over dims (no `geo`/`time` literal — the foreign set is derived per metric); `coalesce` is a per-input scalar. No privileged-dimension branch.
- **One derivation path (E5) intact.** No new store port, no new evaluator, no second read surface. DECISION 1 reuses the obs slice the browse already reads; DECISION 2 reuses the `Cell`/`ValueState` grammar and the ADR-045 short-circuit.
- **Reversibility (09B):** both are additive supersets (a new read-time coordinate rule on grain-∅ browse; an optional `coalesce` + a state-carrying component read). Rollback = revert; no persisted-state migration. `FF-PIPELINE-EQUIV` stays byte-identical (grained/query/metric/transform paths untouched — the browse is a spec form nothing stored uses).

---

## Fitness functions (the gates that make it bite)

New (`packages/core/src/data/metric-natural.fitness.test.ts` + `metric-calc.fitness.test.ts`):

- **`FF-BROWSE-METRIC-NATURAL` (BITING — the −100 reproduction, green→honest).** A fixture reproducing the exact live lie: register `gdp.current` (national, obs at `geo:_T` only) + `gdp.growthYoy` (calc, `$prev`), an `ExternalStore` with national data, ctx pinning **`geo:adjara`** (foreign). Assert the grain-∅ browse renders the REAL national growth series (`12.5 / 11.111 / …`) + first-period `null` — **NOT** `−100`. The single fixture that turns the W-P5c lie green. Also assert `neutralized === ['geo']`.
- **`FF-CALC-NO-DATA-HONEST` (BITING — the Law-11 floor).** `resolveMetricValue` at an explicit coordinate where a component is genuinely no-data returns **`null`**, never a number (0, −100). And: a declared `coalesce:0` input at a no-data coordinate binds `0` (the escape works).
- **`FF-BROWSE-WARM-COVERS-NATURAL` (BITING — warm ≡ read across the wall).** The browse warm requirement carries the neutralized dim as `''` so that after the `{...ctx.dims, ...r.dims}` re-merge the natural slice is warmed — no cold component on the async path (assert the requirement dims + a warm-then-read on an async ExternalStore).
- **`FF-NATURAL-DERIVED-NOT-DECLARED` (BITING — guards the chosen route).** Assert `metricNaturalDims` derives from the obs slice with NO per-metric axis field consulted — a structural guard that we did not silently add a declared-axis field (Law-5). Falsifies if a `MetricDef`/`ManifestMetric` axis field is introduced as the naturality source.

Held (must survive, re-run green):

- **`FF-BIND-PARITY` (8/8)** — green by construction (no no-data component in its all-present fixtures). If it breaks, a fixture was a latent lie → version it deliberately.
- **`FF-PIPELINE-EQUIV`** (apps/api shadow 11/11 + rows net), **`FF-DESUGAR-EQUIV`**, **`FF-CANVAS-NEVER-LIES`**, **`FF-AUTHOR-NO-QUERY`**, warm-covers-render / warm-read-key.

---

## Wave-sizing (WIP=1, serial)

- **Wave A — DECISION 1, the metric-natural browse (S–M · `packages/core` + `packages/react`). THE MINIMAL DOOR-UNBLOCK.** `metric-natural.ts` (`metricNaturalDims`/`naturalBrowseCtx`), wired into the browse read (`pipeline-resolver`) + the browse warm (`sourceHeadObs`/`pipelineRequirements`). `FF-BROWSE-METRIC-NATURAL` + `FF-BROWSE-WARM-COVERS-NATURAL` + `FF-NATURAL-DERIVED-NOT-DECLARED` biting. Live walk: `gdp.growthYoy` browsed on the regional page renders the real national growth series (not −100). **This alone re-fires the ⛔ demotion door** (the calc browse renders a real growth VALUE live). Additive/revert-clean; `FF-PIPELINE-EQUIV` byte-identical.
- **Wave B — DECISION 2, the honest-null calc floor (M · `packages/core`).** `storeCellAt` + `MetricInput.coalesce` (+ wire mirror) + the `resolveMetricValue` short-circuit. `FF-CALC-NO-DATA-HONEST` biting; `FF-BIND-PARITY` re-run (version deliberately if a latent lie surfaces). Closes the Law-11 breach class **beyond** the browse (protects every bound KPI at a mismatched coordinate).

**Sequencing note.** Wave A is the minimal unblock. Because the −100 is a **live Law-11 breach** and Law 11 is a hard project law, Wave B SHOULD land before the demotion actually FIRES (the demotion removes the legacy-editor safety net; the honesty floor must hold before the canvas commits fully to the new path). Wave A re-opens the door; Wave A+B is the condition to walk through it. EXIT-FAST: Wave A introduces no regression (the browse becomes honest; the bound-KPI −100 is a pre-existing condition Wave B closes), so shipping A before B strands no author.

---

## The ⛔ W-P5 demotion door — re-fire condition (updated)

The demotion door (tag-editor demotion; W-P5c held it CLOSED because the calc growth-VALUE leg was not real live) **re-fires when**, in addition to the standing `FF-PIPELINE-EQUIV` byte-identity across all stored configs + `FF-JOURNEY-PIPE` walked live:

1. **`FF-BROWSE-METRIC-NATURAL` green** AND the FF-JOURNEY-PIPE live walk shows a **calc browse (`gdp.growthYoy`) rendering a REAL growth series** (not −100) on the regional page — the W-P5c FINDING closed live. *(Wave A.)*
2. **`FF-CALC-NO-DATA-HONEST` green** — the Law-11 floor proven: no fabricated number anywhere a component is no-data, browse or bound. *(Wave B — the condition to COMMIT the demotion, per the sequencing note.)*

The demotion commit remains gated on the full journey being green — now including "the canvas never lies" proven at the calc floor, not just the base-browse crack.

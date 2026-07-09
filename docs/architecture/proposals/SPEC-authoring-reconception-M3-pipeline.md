# SPEC — Authoring Reconception M3: The Non-Programmer Data Pipeline (Metric Recipes + the calc editor)

> **Status:** DESIGNED (bold proposal — owner sign-off pending) · **Author:** platform-architect (Opus) · **Date:** 2026-07-09
> **Milestone of:** AR-49 (`SPEC-authoring-reconception-vision.md`, owner-APPROVED). This is the **detailed design for M3 only** — the frontier the owner named: *"will a non-programmer master the panel AND the data pipeline?"* M0 (Metric Palette), M1 (Studio shell), M2 (Model mode + Steward lens + in-tool base-metric authoring) are **BUILT and LIVE**.
> **Registry:** AR-49 card (`ARCHITECTURE-REGISTRY.md` §B) — row-update appended.
> **Consumes / completes:** the vision's *calc/measure-algebra editor* (deferred at M2 §4.4 as "M2.5/M3" — this is it), the AR-49 "close the data cliff for a non-programmer" thesis, AR-40 (`MetricCalc` runtime — DONE + LIVE), M2 (Steward lens, `MetricCatalogManager`, `saveSemanticCatalog`, governance FFs), AR-47 (authoring governance — the discipline M3 seeds), Law 4 (Grammar of Graphics / measure-algebra whole), Law 8 (M-5 capability catalog).
> **Grounded against (read, in code):** `packages/core/src/data/metric.ts` (`MetricDef.calc` / `MetricCalc` / `MetricInput{measure, at?}`) · `packages/core/src/data/metric-calc.ts` (`resolveMetricValue` / `calcMetricRequirements` — the LIVE runtime, evaluated through `@statdash/expr`) · `packages/contracts/src/manifest.ts` (`ManifestMetricCalc{inputs, expr:JsonValue}` — the wire shape, already complete, refined to `Expr` at the boot seam) · `packages/core/src/data/transform/types.ts` (the `TransformStep` union + `DeriveExpr` — the expert row-set pipeline) · `packages/core/src/data/transform/op-schemas.ts` (each op carries its PropSchema for the generic Inspector) · `apps/panel/src/studio/model/{MetricEditor,MetricCatalogManager,metricDraft,metricValidation,metricImpact,saveSemanticCatalog,semanticCatalog.store}.tsx?` (the M2.2 "define" surface + the DEFERRED calc placeholder Alert in `MetricEditor.tsx`) · `apps/panel/src/studio/surfaces/ModelSurface.tsx` (Region 1 = metric catalog, Region 3 = relocated raw modeler) · `apps/panel/src/features/data-layer/{DataModelingPanel,DataSpecEditor}.tsx` + `editors/*` (the expert query/pivot/growth/transform suite).
>
> **Scope discipline:** M3.0 + M3.1 (the calc editor + the Recipe library) are **apps/panel-only, additive, reversible — the dependency arrow does not move, `packages/` is untouched, no contracts change, no api change.** They ride the *already-live* `MetricCalc` runtime + the *already-live* `ManifestMetricCalc` wire + the *already-live* `saveSemanticCatalog → PUT /api/config/site → GET /api/bootstrap → registerManifestMetrics` delivery — a derived metric is delivered byte-identically to the base metric M2.2 already ships. **The single seam that touches `packages/` is M3.2's relative-time coordinate** (to make *growth* a governed noun rather than a per-block spec) — it is **isolated into its own gated sub-milestone and flagged as a one-way-ish engine decision (§10).** Everything else is the M0/M1/M2 story again: the engine never notices.

---

## 0. What M3 is, in one paragraph

M2 made a **non-programmer** able to *define a base metric* — pick a dataset, pick a real SDMX measure, govern it. But the owner's frontier is harder: can a non-programmer do the **data pipeline** — the transforms (growth %, per-capita, share-of-total, rebase) that today live in the expert `DataModelingPanel` (query/pivot/growth/transform, cube/pivot jargon) and in the **deferred** calc editor (runtime live, no UI)? M3's load-bearing realisation, from the grounding: **almost every analytical transform a statistics steward needs is not a row-shaping operation — it is *measure-algebra*, and we already run measure-algebra as a governed noun.** `MetricDef.calc` (a declarative `@statdash/expr` tree over named component measures, each point-read at a coordinate `⊕ input.at`) is **live in code** and delivers through the identical M2 pipeline. Per-capita = `GDP ÷ population`; share-of-total = `X ÷ X-at-total-member`; rebase = `X ÷ X-at-base-year` — all express as calc metrics on the *existing* runtime, no new engine. So M3 does two additive things on top: (1) **the calc / measure-algebra editor** (M2's deferred piece) — a visual builder where a steward composes a derived metric from other governed nouns, emitting a pure `ManifestMetricCalc`; and (2) **Metric Recipes** — a governed library of *parameterised* derivations ("X per capita", "X as share of total", "X rebased to year Y") that lower to a calc metric with **one or two governed picks and zero formula typing** — the "Show Me" of data prep. The non-programmer never opens the transform pipeline, never writes a query, never types a formula: they **pick a recipe and fill a blank, and the result is a first-class governed metric** — with unit, format, provenance, and bilingual label — that flows through the *one* `resolveMeasureRef` seam like any other. **The honest boundary (§4), stated once:** *deriving new meaning from governed data (algebra) becomes non-programmer-friendly; defining what the raw data IS (SDMX/DSD ingestion, cube-profile definition, row-shaping) stays expert.* That line is not a compromise — it is the calc-layer-vs-transform-pipeline split we already have in the architecture, named.

---

## 1. Competitor deep-study — approachable data prep / modeling, specifically

M0 studied the *semantic model*, M1 the *shell*, M2 the *define-vs-curate role*. M3's question is the sharpest: **what single mechanism makes data preparation approachable to someone who cannot write SQL/DAX/M/a formula — and where do we go beyond it for a statistics-grade, SDMX-native, non-programmer product?** For each: the one idea, why it works, then the opinion.

| Platform | The ONE idea that makes data prep approachable | Why it works |
|---|---|---|
| **Tableau Prep** | **A visual flow of transform nodes with a live data preview at every step** — you *see* the rows change as you add clean/pivot/aggregate. | Immediate feedback collapses the "what will this do?" gap; the preview is the teacher. |
| **Power BI / Power Query** | **The "Applied Steps" list** — every no-code ribbon click (filter, group-by, add-column) appends a **named, reorderable, removable step**; the M formula is generated *behind* the click. | Transforms become an editable *history of named actions*, not code — undoable, inspectable, forgiving. |
| **Sigma** | **Spreadsheet-familiar formulas over a modeled warehouse** — a computed column is `[GDP] / [Population]` in a cell, on governed data. | Meets the spreadsheet-literate where they are; the modeled layer keeps it governed under the familiar surface. |
| **Rill** | **Metrics-first: define a measure/dimension view (BI-as-code) and get exploration for free** — the metric is the unit of work, the dashboard is downstream. | Puts the *metric*, not the query, at the centre — exactly the AR-49 axis. |
| **Metabase (no-code questions / models)** | **The notebook: join / filter / summarize / custom-column as guided dropdowns**, and **"models" that promote a saved question into a reusable governed entity**. | "Summarize by" and "custom column" are pick-lists, not code; a model turns a one-off into a reusable noun. |
| **Observable / Framework** | **Reactive dataflow — every cell recomputes its dirty dependents automatically.** | The author states *relationships*, not an execution order; the runtime handles propagation. |
| **dbt Semantic Layer / MetricFlow · Malloy** | **Measure-algebra: metrics compose from other metrics** (`revenue_per_user = revenue / users`), defined once, consumed everywhere. | The derivation is a *first-class, named, reusable* definition — not a per-chart calculation. This is literally our `MetricDef.calc`. |
| **Airtable** | **Computed fields as a configurable "field type"** — a rollup is *pick a linked table + pick an aggregation*; a formula field is opt-in. | Derivation is a **guided form**, not a language; the common case (rollup/lookup) needs zero formula. |
| **Retool** | **A low-code transformer box beside a mostly-visual binding** — bind UI to data, drop to a small JS transform when needed. | The escape hatch is always *right there* — but small, adjacent, optional. |

### The opinion — where we go BEYOND (statistics-grade + SDMX-native + non-programmer)

Two families in the field, and **both leave a cliff**:

- **The step-flow family** (Tableau Prep, Power Query) teaches an **imperative pipeline** — you still must understand pivot, join, group-by, cardinality. It is *visual* but not *conceptually* approachable; a non-programmer stalls at "which join?".
- **The formula family** (Sigma, Metabase custom-column, Airtable formula field, dbt/Malloy, Retool) exposes a **formula/code escape hatch** — a smaller cliff, but still a cliff, and (Retool especially) an *ungoverned* one (arbitrary JS = Law 2 violation for us).

**Nobody ships the combination we can:** a **governed recipe library whose output is a first-class, provenance-carrying, reusable *metric noun*, where the formula is only ever an optional whitelisted escape hatch.** We steal:

- from **Power Query** — *named, editable steps* (but our "step" is a governed derivation, and its history is the metric's definition, not a throwaway flow);
- from **Airtable** — *derivation-as-a-configured-field-type* (our recipe is a metric factory: pick nouns, fill a blank);
- from **dbt/Malloy** — *measure-algebra as a first-class reusable definition* (we already have it live; we add the *visual, non-programmer* authoring dbt/Malloy refuse to);
- from **Tableau Prep** — *live preview* (but on the actual governed canvas, not a throwaway grid);
- from **Metabase** — *models: promote a derivation to a governed entity* (ours is statistics-grade — unit/methodology/provenance are fields of the definition, Law 9);
- and we **refuse Retool's arbitrary-JS transformer** — the escape hatch is a whitelisted `@statdash/expr` tree, never `eval`.

**The beyond, stated plainly:** *data prep becomes "pick governed nouns and fill blanks → get another governed noun."* The semantic layer eats data prep. A non-programmer never learns pivot/join/group-by because the derivations they actually need (ratio, per-capita, share, rebase, accounting identities) are **scalar measure-algebra**, and measure-algebra is a governed metric — authored once, resolved everywhere through `resolveMeasureRef`, carrying provenance no BI tool attaches by default.

---

## 2. The non-programmer model layer — the mental model + surfaces

### 2.1 The one mental model: *a metric is a noun; a derived metric is a noun made from nouns*

The whole non-programmer story rests on refusing to introduce a second mental model. The author already learned (M0/M2): **data is a palette of governed nouns you pick**. M3's rule: **you make new nouns the same way you pick them — by combining the ones you have.** There is no "pipeline", no "query", no "transform" in the non-programmer's vocabulary. There is only:

> **"I want *GDP per person*." → pick the recipe *"per capita"* → pick *GDP* → done. A new noun *GDP per capita* appears in the palette, byte-identical to one a data engineer would hand-author.**

This is the Airtable/dbt fusion: derivation-as-a-configured-field (Airtable) producing a first-class reusable metric (dbt) — but non-programmer and provenance-native.

### 2.2 Three tiers of "define beyond pick-measure" (progressive disclosure, one surface)

The M2 `MetricCatalogManager`'s "New metric" affordance grows from one on-ramp (base metric) to a **tiered "how do you want to define it?"** chooser — all on the *same* Model-mode surface, no new tool (§5):

| Tier | Who | Surface | Emits | Formula? |
|---|---|---|---|---|
| **T0 — Base metric** (M2.2, LIVE) | non-programmer | pick dataset → measure → govern | `ManifestMetric{code}` | never |
| **T1 — Recipe** ★ M3.1 | **non-programmer** | pick a recipe → fill 1–2 governed blanks | `ManifestMetric{calc}` | **never** (recipe supplies the algebra) |
| **T2 — Measure-algebra builder** ★ M3.0 | near-non-programmer power-steward | pick inputs (governed metrics) + coordinate pins → compose a *visual expression tree* | `ManifestMetric{calc}` | **visual tree, whitelisted** (never free text / JS) |
| **T3 — Raw transform pipeline** (M2-relocated, expert) | expert / data engineer | `DataModelingPanel` (query/pivot/growth/transform) | `DataSpec` | structural row-shaping |

T0/T1 are the non-programmer floor; T2 is the "one step up" for a power-steward; **T3 stays expert and stays exactly where M2 put it** (the escape hatch, below the metric region in Model mode). The tiers are a single progressive-disclosure ladder on one surface — the author climbs only as far as they need, and **most never leave T1.**

### 2.3 (a) Define governed metrics beyond simple pick-measure — the calc editor (T2)

Covered in full in §3. It is the atom: a visual builder that composes a `MetricCalc{inputs, expr}` from governed metric picks + coordinate pins + a small algebra vocabulary. Everything in T1 is a *pre-filled T2*.

### 2.4 (b) Common transforms via a plain-language builder — Metric Recipes (T1)

The load-bearing non-programmer surface. A **Recipe** is a governed, parameterised **calc-metric factory**: a small piece of *registry* code (Law 8 capability, not config) that takes 1–2 governed picks and returns a pure `ManifestMetricCalc`. The steward sees only plain language and pickers; the algebra is the recipe's job.

The four the brief names, grounded against the LIVE runtime (`MetricInput.at` is an absolute coordinate merged over `ctx.dims`; `@statdash/expr` supplies `div/mul/sub/add`):

| Recipe (plain language) | Steward picks | Lowers to (`MetricCalc`) | Works on LIVE runtime? |
|---|---|---|---|
| **"X per capita"** | X (a metric); *population* defaulted, changeable | `inputs:{num:{measure:X}, denom:{measure:pop}}`, `expr: div($num,$denom)` | ✅ **today** |
| **"X as share of total"** | X; the *total member* of the share dimension (e.g. `geo:_T`) | `inputs:{part:{measure:X}, whole:{measure:X, at:{geo:'_T'}}}`, `expr: mul(div($part,$whole),100)` | ✅ **today** (`at` pins the total member) |
| **"X rebased to year Y (=100)"** | X; base year Y | `inputs:{cur:{measure:X}, base:{measure:X, at:{time:Y}}}`, `expr: mul(div($cur,$base),100)` | ✅ **today** (`at` pins the base year) |
| **"Growth of X (% vs previous period)"** | X | needs value at *t* and *t−1* — a **relative-time** read, not an absolute pin | ⚠️ **§4.3 / M3.2** — needs a relative-coordinate seam OR lowers to the existing `growth` DataSpec |

**Three of the four named transforms are pure scalar measure-algebra and run on the runtime that is already live** — M3.1 is genuinely an apps-only authoring surface over a working engine. Growth is the honest exception (§4.3): time-difference is a *row-set/series* operation, not a point read, so it is either (a) lowered to the existing `growth` DataSpec (keeping it a per-block spec, not a governed noun — a T1 recipe that produces a *spec* fragment, not a metric), or (b) enabled as a governed noun via a small relative-time coordinate extension to `MetricInput.at` (§10 decision #1). **Recommendation: (b)** — keep *growth* a governed noun consistent with the whole thesis — but as the isolated, gated M3.2, so M3.0/M3.1 ship arrow-untouched first.

**The plain-language builder hides pivot/cube/query jargon by construction:** the steward never sees `aggregate`/`rollup`/`derive`/`melt`. A recipe internally *may* pin a coordinate (the "total member", the "base year"), but that is surfaced as a **governed dimension+member pick** — the exact `DefaultDimPins` control M2.2's `MetricEditor` already ships — never as a pivot spec. Recipes that genuinely need row-shaping (a hierarchy total that is not a codelist member; a cross-store blend) are **not offered as recipes** — they are honestly the expert T3 (§4).

### 2.5 (c) Governed templates + "Show Me"-style automation — the Recipe Gallery

So a non-programmer *rarely starts from zero*:

- **Recipe Gallery** — the "New metric" flow opens on a **gallery of recipe cards** (grouped: *Ratios & shares · Rebasing & indices · Growth & change · Accounting identities*), each with a plain-language title, a one-line "what it does", and a live example ("GDP → GDP per capita"). This is Power BI's "Show Me" for *metrics* — the automation that means the blank page is a menu.
- **Suggested recipes ("Show Me" contextual)** — given the metric a steward is looking at, the gallery *surfaces* the recipes that fit its unit/dimensions (e.g. a monetary total offers "per capita", "share of total", "growth"; an index offers "rebase"). Sourced from the recipe's declared *applicability predicate* (part of its Law-8 descriptor), reusing the M0 `ShowMe` pattern that already suggests encodings on bind — now suggesting *derivations* on a metric.
- **Recipe = Metabase's "model" done statistics-grade:** the output is not a saved query, it is a governed metric with provenance carried from its inputs (§3.4).

---

## 3. The calc / measure-algebra editor (M3.0 — the first concrete piece)

This is M2's explicitly deferred piece (M2 §4.4: *"the RUNTIME is live, only its authoring UI waits — M2.5"*). The `MetricEditor.tsx` even ships a disabled placeholder Alert marking the seam. M3.0 fills it.

### 3.1 What it is

A **visual measure-algebra builder** — a new define-tier in the `MetricCatalogManager` "New metric" flow — where a steward composes a **derived metric** from other governed metrics. It emits a pure `ManifestMetricCalc{inputs, expr}` (Law 2 — a JSON `@statdash/expr` tree, never a function), saved and delivered through the **unchanged** M2 pipeline. The *engine* (`resolveMetricValue`, `calcMetricRequirements`, `resolveMeasureRef` calc-expansion) is **live and untouched**; M3.0 is authoring + a save, exactly like M2.2 was for base metrics.

### 3.2 The flow (all pick / compose, never type a formula)

1. **Name & govern** — reuse the M2.2 governance form verbatim: immutable `id`, bilingual `label`, `unit`, `format`, `methodology`, `description`. (A derived metric carries `calc` *instead of* `code` — `MetricDef`/`ManifestMetric` already enforce "exactly one of `code`/`calc`".)
2. **Pick inputs** — add named component measures via the **governed metric picker** (the M0 `enum-ref source:'metrics'` control — pick a noun, never type a code). Each input gets a short name (`num`, `denom`, `pop`, …) auto-suggested from its label. Optionally pin a **coordinate** on an input via the **`DefaultDimPins` control M2.2 already ships** (dimension + member from the live cube profile) — this is the "total member" / "base year" mechanism, surfaced as governed picks.
3. **Compose the algebra** — two modes, progressive:
   - **Template mode (default, non-programmer):** pick from a small vocabulary of *shapes* — **Ratio** (A÷B), **Percentage** (A÷B×100), **Difference** (A−B), **Sum** (A+B), **Weighted** (A×k). Two inputs, one shape → the `expr` is generated. This is the whole T1 recipe internals, exposed.
   - **Advanced mode (escape hatch, power-steward):** a **visual expression-tree builder** — nodes are `+ − × ÷`, `abs/neg`, a literal, or an input reference; the tree renders as a bracketed formula preview (`(GDP ÷ population)`). The tree is the `@statdash/expr` shape 1:1. **Never a text box** — the author assembles operators and operands from menus (Scratch/Blockly-shaped, but tiny — 4 operators + inputs + literals cover the statistics-grade need). This is the one place a Blockly-class control is warranted; §8 evaluates the lib call.
4. **Live preview** — the calc evaluates against the active canvas coordinate (the runtime is live) and shows the resulting value inline (Tableau-Prep's "see it change", on the real canvas). A `div`-by-zero folds to 0 exactly as the runtime already guarantees.
5. **Validate & save** — §3.3; then the exact M2 `saveSemanticCatalog()` → live re-register → the derived metric appears in the palette without a reload.

### 3.3 Declarative + governed + safe by construction

- **Pure data (Law 2):** the output is a `ManifestMetricCalc` — `inputs` (a `Record` of `{measure, at?}` coordinates) + `expr` (a JSON `@statdash/expr` tree). No function, no `fetch`, no free-text formula ever enters config. `FF-CALC-AUTHORING-SERIALIZABLE` (§7).
- **Sandboxed algebra:** the builder emits **only** `@statdash/expr` whitelisted ops — the *same one evaluator* the runtime already uses (`metric-calc.ts` → `evalExpr`), never a second dialect, never `eval`. `FF-CALC-EXPR-SANDBOXED` (§7). This is the vision's *safe expression evaluation* canon, made an authoring surface.
- **Governed inputs (contract-first):** every input `measure` is picked from the registered metric catalog (or a real SDMX code via the base picker) — validated against the live catalog/cube profile before save (extends M2's `FF-CATALOG-EDIT-SAFE`): an input that references a non-existent metric, or an `at` coordinate that is not a real dimension member, **cannot be saved.**
- **A derived metric is a first-class noun (no second path):** it registers via `registerManifestMetrics`, resolves through the *one* `resolveMeasureRef` seam (which already expands a calc metric to its component codes for warm/store-routing — `metric.ts` L232), appears in the palette, and binds to any block exactly like a base metric. `FF-DERIVED-IS-GOVERNED` (§7). This is why "chart ≡ KPI" holds for derived metrics too — structurally, there is no alternate resolution path.
- **Provenance composes:** a calc metric carries no own `code` (no direct provenance — `metric.ts` L296) — its provenance is its **components'**, unioned, plus its own `methodology`. The steward's derived metric inherits source→vintage→revision from its inputs (Law 9), and a "derived from GDP + Population" lineage is structurally available (feeds AR-43). `FF-DERIVED-PROVENANCE-COMPOSES` (§7).

### 3.4 Accessibility (WCAG 2.1 AA, Law 9)

Inherits the M2.2 `MetricEditor` a11y discipline (every control labelled; validation in a labelled list wired via `aria-describedby`; the immutable-id explains itself). New for the algebra builder: the **visual expression tree is keyboard-navigable** (each node focusable, operators/operands chosen from labelled menus, not drag-only), and the **formula preview is a text alternative** (`aria-live`) so a screen-reader steward hears "GDP divided by population" as they build. Template mode is fully form-based (no tree) — the *default* non-programmer path is the most accessible one.

---

## 4. The honesty boundary — what CAN vs what MUST stay expert

The design's credibility is this line. The owner values the truth over a pitch, so it is stated as sharply as the architecture allows — and it is **not a compromise, it is the calc-layer-vs-transform-pipeline split we already have in code, named.**

### 4.1 The line, in one sentence

> **Deriving new *meaning* from governed data (measure-algebra: ratio, per-capita, share, rebase, difference, accounting identities) becomes non-programmer-friendly. Defining what the raw data *is* (SDMX/DSD ingestion, cube-profile definition, structural row-shaping, novel source onboarding) stays expert.**

The first is *scalar algebra over already-modeled nouns* → the `MetricCalc` layer → **approachable**. The second is *shaping unmodeled bytes into tidy, governed structure* → the `TransformStep` pipeline + the `fromSDMX` boundary (Law 5) → **expert**. The architecture already draws this line; M3 just refuses to pretend it isn't there.

### 4.2 CAN become non-programmer-friendly (M3 delivers)

- **Derive metrics from governed metrics:** ratio, per-capita, share-of-total, rebase-to-base-period, sum/difference, accounting identities (`GVA + taxes − subsidies = GDP`). → **Recipes (T1), fill a blank.** ✅ (3 of 4 named transforms on the live runtime *today*.)
- **Compose a custom algebra** the recipes don't cover → **the visual expression builder (T2)**, whitelisted. ⚠️ *Approachable but a genuine step up* — composing an expression, even visually, is real cognitive load. Honest label: this is the near-non-programmer power-steward's tier, not the floor. Most stewards live in T1.
- **Growth / index / moving-average over time** → a recipe, either lowering to the existing `growth`/`window` engine or (M3.2) to a governed noun. ✅ *with the §4.3 caveat.*

### 4.3 The honest nuance — growth is a *series* operation, not a point

`MetricInput.at` is an **absolute** coordinate merged over `ctx.dims` (`metric-calc.ts` — a point-read addresses a single cell; it is explicitly *not* a `$ctx`/relative predicate). Per-capita/share/rebase need only absolute pins (the population, the `_T` member, the base year) — so they are pure calc metrics today. **Growth needs the value at *t* and at *t−1* relative to whatever period the block is showing** — a relative offset the point-read `at` cannot express. This is not a UI gap; it is a real category boundary: growth-over-time is a *windowed series* transform (the existing `growth`/`window` DataSpec), not scalar point-algebra. M3 is honest about it (§10 decision #1): either accept growth as a *spec-producing* recipe (a T1 that outputs a `growth` DataSpec fragment, not a governed metric — pragmatic, arrow-untouched, but growth is then not a reusable noun), or add a small **relative-time coordinate** to `MetricInput.at` (e.g. `{ $prev: 'time' }`) so growth becomes a governed metric like the rest — a clean, small engine extension that *strengthens the whole calc layer* but touches `packages/core` + `@statdash/expr` + the `ManifestMetricInput` wire. **Recommended: the extension, gated as M3.2**, because a national-statistics product's most-requested derivation (growth) deserving to be a governed, provenance-carrying noun is worth one small, well-isolated engine seam — but not on the M3.0/M3.1 critical path.

### 4.4 MUST stay expert (M3 does NOT overpromise)

- **Raw SDMX / DSD ingestion + cube-profile definition** — deciding what a dataset's *measures and dimensions ARE*, mapping an SDMX/Excel source into the cube profile, DSD/codelist versioning. This is `fromSDMX`-boundary work (Law 5); it requires a model of the DSD, concept roles, codelists. **A non-programmer cannot and should not author this.** It is the input the whole governed layer stands on.
- **Structural row-shaping** — `melt` (wide→long), `lookup`/`join` (codelist enrichment), `group` (hierarchy materialisation), `blend` (cross-store) — the `TransformStep` pipeline. These require a tidy-data model + knowledge of the data's structure. They stay in the M2-relocated `DataModelingPanel` (T3), behind the Steward lens, exactly where they are.
- **Novel data-source onboarding** — connecting/authoring a new source, Excel schema mapping. Expert.

### 4.5 We can make expert *kinder*, without pretending it is non-programmer (M3.4, droppable)

The honest move for T3: **improve the expert surface's approachability without claiming it becomes non-programmer.** Plain-language field labels over cube jargon, a "what is this step?" info-affordance per transform op (the op already carries a PropSchema; add a `describe`), and a **template-source starting point** (clone a governed example source rather than a blank). Explicitly labelled in-product as *"Advanced — data modeling (expert)"*. This raises the floor of the expert tier without moving the honesty boundary — a genuine improvement, honestly scoped, and droppable if timeboxed.

---

## 5. Progressive disclosure / one canvas — how M3 layers on Model mode

M3 adds **no new tool and no new surface** — it deepens the `MetricCatalogManager` region that M2 already put in Model mode (`ModelSurface.tsx` Region 1). The whole ladder lives on one surface over the one always-mounted canvas:

```
Model mode (Steward lens, M2) — over the SAME live canvas
├─ Region 1: Metric catalog + editor  ← M3 deepens THIS
│    "New metric" ▸ choose how to define:
│      ┌ T0  From a dataset measure        (M2.2, LIVE)      → base metric
│      ├ T1  From a recipe  ★M3.1          [Recipe Gallery]  → derived metric (fill a blank)
│      └ T2  Custom algebra ★M3.0          [expr builder]    → derived metric (compose)
├─ Region 2: (dimension curation — M2.4/M3.3, thin)
└─ Region 3: Advanced — data modeling (expert)  ← T3, M2-relocated, UNCHANGED
     the DataModelingPanel (query/pivot/growth/transform)   → DataSpec
```

- **The author lens never sees any of this** — the Metric Palette (Data surface) shows derived metrics as ordinary nouns to *bind*; `FF-AUTHOR-NO-QUERY` (M2) still bites and extends to *no calc-editor / no pipeline reachable from the author lens* (`FF-PIPELINE-STAYS-STEWARD`, §7).
- **The steward climbs only as far as needed** — T1 for the common case, T2 for a custom algebra, T3 only for structural shaping. Each tier is a disclosure, not a gate (the M1 no-waterfall contract holds).
- **Everything reacts on the same canvas** — a derived metric previews live (§3.2); the steward sees the dashboard react as they define, exactly the Power-BI-Model-lens-but-better property M2 established.

---

## 6. Target architecture + Strangler path (arrow unchanged for M3.0/M3.1)

```
contracts ← expr ← core ← charts ← react ← plugins ← apps/panel
   │          │      │                          │        │
 (Manifest   (@statdash/expr:  (MetricCalc runtime:      │  NEW (apps/panel + plugins only):
  MetricCalc   the ONE           resolveMetricValue ·     │   • Calc editor (T2): visual expr-tree over @statdash/expr
  already      evaluator the     calcMetricRequirements · │   • Recipe library (T1): governed calc-metric FACTORIES
  carries      builder emits)    resolveMeasureRef calc-  │       (per-capita/share/rebase) + Recipe Gallery + Show-Me
  inputs+expr) — UNCHANGED        expansion) — ALL LIVE,  │   • MetricCatalogManager "New metric" ▸ T0/T1/T2 chooser
                                  UNCHANGED                │   • reuse M2: governance form · DefaultDimPins · saveSemanticCatalog
                                                          │
apps/api (REUSED, no change): PUT /api/config/site {metrics} · GET /api/bootstrap · registerManifestMetrics
```

- **M3.0 (calc editor) + M3.1 (recipes): apps-only.** A derived metric is a `ManifestMetric{calc}` — the wire shape (`ManifestMetricCalc`) already exists, the runtime already evaluates it, the delivery pipeline already registers it. Authoring one is the *same* additive move M2.2 made for `{code}`. **No contracts change, no core change, no api change, arrow untouched — the engine never notices**, the fourth time this vision has held that line.
- **The Recipe library placement (Law 8 / arrow):** a recipe is a *factory* that produces declarative config from picks — it is **renderer/registry code, not config** (Law 2 respected: the *output* is data; the *factory* is code, like `ShowMe` or `NodeSliceMeta.defaults`). It lives in `apps/panel` (or `packages/plugins` if we want it Constructor-discoverable via `describeApp()` — recommended, §8). Recipe *descriptors* (id, title, applicability predicate, blank-schema) are a **capability catalog** (Law 8 M-5): a new recipe = a new registered descriptor + factory, the editor unchanged (OCP). `FF-RECIPE-IS-CAPABILITY` (§7).
- **M3.2 (growth relative-coordinate) is the ONLY seam that moves `packages/`** — a small additive field on `MetricInput.at` + its `@statdash/expr` resolution + the `ManifestMetricInput` wire mirror. Isolated, gated, owner-decided (§10). Reversible (additive union member; absent ⇒ today's behavior).
- **Strangler (Law 7):** every M3 move is *additive over live seams* or a *relocation-kindness* (§4.5) — never a rewrite. T3 (the expert pipeline) is untouched and stays online throughout; the calc editor replaces a disabled placeholder Alert; recipes are additive factories. Each sub-milestone is independently reversible: calc editor unshipped → base-metric-only (M2.2 behavior); recipes unshipped → calc editor only; growth-extension reverted → growth via DataSpec. **No page of authoring capability is ever offline.**

---

## 7. Fitness functions (invariants → executable, not prose)

Extends the M2 discipline; the load-bearing ones are the *derive-side* siblings of M0's `FF-BIND-PARITY` and M2's `FF-METRIC-AUTHORING-SERIALIZABLE`.

- **FF-CALC-AUTHORING-SERIALIZABLE** — an authored derived metric is pure JSON (`ManifestMetricCalc` — `inputs` + an `@statdash/expr` tree; no function/`fetch`/free-text-formula, Law 2); a saved catalog round-trips `site_config → /api/bootstrap → registerManifestMetrics` **byte-identically**, and the registered calc metric evaluates identically to a hand-authored one (the derive-side of M2's byte-identity).
- **FF-CALC-EXPR-SANDBOXED** — the calc editor emits **only** `@statdash/expr` whitelisted ops, evaluated through the *one* `evalExpr` the runtime uses; no second dialect, no `eval`, no arbitrary code. (The vision's safe-expression canon, enforced at the authoring boundary.)
- **FF-DERIVED-IS-GOVERNED** — a derived metric registers via `registerManifestMetrics` and resolves through the *one* `resolveMeasureRef` seam; it appears in the palette and binds like a base metric — there is no second resolution path (chart ≡ KPI holds for derived metrics).
- **FF-RECIPE-LOWERS-TO-CALC** — every recipe factory's output is a valid `ManifestMetricCalc` that passes `FF-CALC-AUTHORING-SERIALIZABLE`; a recipe is *only* a pre-filled calc metric (no privileged recipe-runtime — recipes have zero runtime footprint, they lower entirely to the calc layer).
- **FF-RECIPE-IS-CAPABILITY** — recipes are registered descriptors (Law 8); a new recipe = a new registered descriptor + factory with **zero** editor/Inspector change (OCP). The gallery/Show-Me source their list from the registry, never a hardcoded array.
- **FF-DERIVED-PROVENANCE-COMPOSES** — a derived metric's provenance is the union of its components' provenance ⊕ its own `methodology`; no rendered derived number is un-provenanced (Law 9).
- **FF-PIPELINE-STAYS-STEWARD** (extends M2's `FF-AUTHOR-NO-QUERY`) — neither the calc editor, the recipe gallery, nor the transform pipeline is reachable from any **author-lens** surface; all three live behind the Steward lens in Model mode.
- **FF-CALC-EDIT-SAFE** (extends M2's `FF-CATALOG-EDIT-SAFE`) — a derived metric validates before save: every input `measure` resolves to a registered metric/real code; every `at` coordinate is a real dimension member; the `expr` type-checks against `@statdash/expr`; a cyclic calc (a metric depending on itself) is rejected.

---

## 8. Package / library evaluation for M3

Selection principle unchanged (adopt only if it strengthens AND simplifies AND honors the arrow + Config = SSOT). **M3's honest call: at most one small, carefully-scoped visual-tree control — and only if our own composition of existing controls proves insufficient.**

| Candidate | Verdict | Why |
|---|---|---|
| **Blockly / Scratch-blocks** (visual expression tree) | **DEFER / REJECT for the default** — evaluate only for T2 advanced mode | Heavy, opinionated, its own serialization model (a Config = SSOT risk — its block XML/JSON is *not* our `@statdash/expr`), a large dependency for a **4-operator** need. Template mode (T1 + the default T2 shapes) needs **no tree at all** — it is form-based. If a genuine free-form tree is needed, build a **tiny in-house tree control** (nodes = `+−×÷`/abs/neg/literal/input-ref) that emits `@statdash/expr` 1:1 — ~a few hundred LOC, token-themeable, a11y-controllable, no schema fork. **Recommendation: in-house tiny tree**; Blockly is a cannon for a nail and forks our expression SSOT. |
| **A formula parser** (math.js / expr-eval) for a text-formula escape hatch | **REJECT** | A text formula is the cliff we refuse (Retool's sin) and a second dialect competing with `@statdash/expr` (Law 2 / DRY). The visual tree + template shapes cover the need; the sandbox stays one evaluator. |
| **A form lib** (react-hook-form / Formik) for the recipe forms | **REJECT** (held from M2 §8) | The recipe blank-forms are small; the M2.2 governance form + `DefaultDimPins` + M0 `enum-ref` metric picker already exist and are reused. A form lib = a second field model vs PropSchema (Config = SSOT risk). |
| **Zod** for calc/recipe validation | **REUSE existing** | The api already validates shape at the boundary; the panel validates semantically against the catalog + `@statdash/expr` type-check — pure functions, no new dep. |
| A recipe *registry* mechanism | **BUILD (ours), place in plugins** | A recipe is a Law-8 capability. Register it like `NodeSliceMeta` — a descriptor (id/title/i18n/applicability/blank-schema) + a factory. Placing it in `packages/plugins` makes it `describeApp()`-discoverable (Constructor-ready); placing it in `apps/panel` is fine if we keep it panel-local for now. **Recommend plugins** for M-5 platform-leverage, but panel-local is an acceptable YAGNI start. |

**M3 adds only our own code** (calc editor, recipe library, gallery) plus, at most, a tiny in-house expression-tree control. The value is *capability* (in-tool derivation + recipes) riding a live runtime — the same subtraction-and-reuse discipline as M0/M1/M2, not accretion.

---

## 9. Phasing within M3 — sequenced, each reversible & independently valuable

| Sub-M | Delivers | Reversible? | FFs that lock the seam | Depends on |
|---|---|---|---|---|
| **M3.0 — calc / measure-algebra editor** ⭐ (recommended first) | The T2 visual builder: governance form (reuse M2.2) + governed metric-input picks (M0 `enum-ref`) + `DefaultDimPins` coordinate pins + template shapes (ratio/pct/diff/sum) + the tiny visual expr-tree (advanced) + live preview → emits `ManifestMetric{calc}` → `saveSemanticCatalog` → live re-register. Replaces the M2.2 deferred placeholder. | Yes (unship → base-metric-only, M2.2 behavior) | `FF-CALC-AUTHORING-SERIALIZABLE`, `FF-CALC-EXPR-SANDBOXED`, `FF-DERIVED-IS-GOVERNED`, `FF-DERIVED-PROVENANCE-COMPOSES`, `FF-CALC-EDIT-SAFE` | M2.2 (`MetricCatalogManager`, `saveSemanticCatalog`) — LIVE |
| **M3.1 — Metric Recipes + Gallery** ★ headline (non-programmer floor) | The recipe registry (per-capita / share-of-total / rebase as calc factories) + the Recipe Gallery ("Show Me for metrics") + contextual suggestion; each recipe = pick + fill-a-blank → a pre-filled calc metric (lowers entirely to M3.0's path). | Yes (unship → calc editor only) | `FF-RECIPE-LOWERS-TO-CALC`, `FF-RECIPE-IS-CAPABILITY`, `FF-PIPELINE-STAYS-STEWARD` | M3.0 |
| **M3.2 — Growth as a governed noun** (the ONE engine seam) | Relative-time coordinate on `MetricInput.at` (e.g. `{ $prev: 'time' }`) + `@statdash/expr` resolution + `ManifestMetricInput` wire mirror; a "Growth of X" recipe becomes a governed calc metric. **Isolated, gated on owner decision #1.** | Yes (additive union member; absent ⇒ today) | (folds into `FF-CALC-EXPR-SANDBOXED` + `FF-CALC-EDIT-SAFE`) | M3.1 + owner call |
| **M3.3 — Dimension curation editor** (thin, droppable) | The M2.4 dimension editor (label · conceptRole · defaultMember · whitelist over a cube dim) if not already shipped — rounds out "define governed nouns beyond pick-measure" on the dimension side. Same `saveSemanticCatalog`. | Yes | (rides M2's `FF-CATALOG-ONE-SSOT`) | M2.2 |
| **M3.4 — Kinder-expert (T3) polish** (droppable, honesty-preserving) | Plain-language labels + per-op "what is this?" `describe` + a template-source starting point over the *existing* `DataModelingPanel`; labelled "Advanced (expert)". Raises the expert floor without moving the honesty boundary. | Yes | — | M2.1 (relocated modeler) |

### First sub-milestone recommendation: **M3.0 — the calc editor. Calc-editor-first is right.**

**Rationale:** (1) it is the **deferred M2.5 piece with the runtime ALREADY LIVE** — the M0 pattern (ride a spine that exists in code) → lowest risk, fastest to first honest value ("GDP per capita, authored in-tool"); (2) it is the **atom every recipe is built from** — a recipe is a pre-filled calc metric, so M3.1 becomes a thin parameterisation once M3.0 exists; building recipes first would build the gallery before the thing it fills; (3) it is **fully additive and reversible** (replaces a disabled placeholder; unship → M2.2 behavior) and **arrow-untouched** (apps-only over the live `MetricCalc` runtime + `ManifestMetricCalc` wire + M2 delivery); (4) it delivers an immediate, demonstrable non-programmer win — the exact frontier the owner named — before any engine seam (M3.2) is opened. Sequencing recipes or the growth-extension first would either build on an unbuilt atom or open the one engine decision prematurely.

---

## 10. Build decomposition (ordered; owner tier; deps; parallelism)

| # | Work item | Owner tier | Depends on | Parallel? |
|---|---|---|---|---|
| **1** | `MetricCatalogManager` "New metric" ▸ **T0/T1/T2 define-mode chooser** (replaces the single base-metric entry; T0 = existing `MetricEditor`) | react-specialist | — (M2.2 live) | ∥ start |
| **2** | **Calc governance form** — reuse `MetricEditor`'s governance section for a `calc` metric (`calc` XOR `code`; hide dataset/measure pickers, show inputs instead) | plugins-specialist / react-specialist | 1 | after 1 |
| **3** | **Input picker** — add N named inputs via the M0 `enum-ref source:'metrics'` governed picker; auto-name from label; reuse `DefaultDimPins` for per-input `at` coordinate | plugins-specialist | 2 | after 2 |
| **4** | **Template-shape composer** (ratio/pct/diff/sum/weighted) → generate the `@statdash/expr` tree from 2 inputs + a shape | plugins-specialist / senior-frontend | 3 | after 3 |
| **5** | **Tiny visual expr-tree control** (advanced mode) — nodes `+−×÷`/abs/neg/literal/input-ref → emits `@statdash/expr` 1:1; keyboard-navigable; `aria-live` formula preview | senior-frontend | 3 | ∥ with 4 |
| **6** | **Live preview** — evaluate the draft calc at the active canvas coordinate via the live `resolveMetricValue`; inline value | react-specialist | 4,5 | after 4,5 |
| **7** | **Calc validation** (`FF-CALC-EDIT-SAFE`): inputs resolve · `at` members real · `expr` type-checks · no cycle → gate Save | plugins-specialist | 3,4,5 | after 3 |
| **8** | **Save** — emit `ManifestMetric{calc}` through the existing `saveSemanticCatalog()` + live re-register (no new persistence) | react-specialist | 2,7 | after 7 |
| **9** | FFs: `FF-CALC-AUTHORING-SERIALIZABLE` · `FF-CALC-EXPR-SANDBOXED` · `FF-DERIVED-IS-GOVERNED` · `FF-DERIVED-PROVENANCE-COMPOSES` · `FF-CALC-EDIT-SAFE` | plugins/react/engine-specialist | alongside 2–8 | ∥ per item |
| — | **— M3.0 complete (calc editor). M3.1 forks below —** | | | |
| **10** | **Recipe registry** — descriptor (id/i18n/applicability/blank-schema) + factory; per-capita / share-of-total / rebase factories → `ManifestMetricCalc` | plugins-specialist | 4 (expr-gen) | after 4 |
| **11** | **Recipe Gallery** — grouped cards + plain-language + example; "New metric" ▸ T1 opens here | senior-frontend / react-specialist | 10 | after 10 |
| **12** | **Contextual "Show Me" suggestion** — surface applicable recipes for a selected metric (reuse M0 ShowMe pattern) | react-specialist | 10,11 | after 11 |
| **13** | FFs: `FF-RECIPE-LOWERS-TO-CALC` · `FF-RECIPE-IS-CAPABILITY` · `FF-PIPELINE-STAYS-STEWARD` | plugins/react-specialist | 10–12 | ∥ |
| **14** | *(M3.2, gated)* Relative-time coordinate on `MetricInput.at` (`{ $prev: 'time' }`) + `@statdash/expr` resolution + `ManifestMetricInput` wire; "Growth of X" recipe | engine-specialist (+ contracts) | 10 + owner call #1 | after owner decision |
| **15** | *(M3.3, droppable)* Dimension curation editor (label/conceptRole/defaultMember/whitelist) → `saveSemanticCatalog` | plugins-specialist / react-specialist | M2.2 | ∥ (independent) |
| **16** | *(M3.4, droppable)* Kinder-expert: per-op `describe` + plain labels + template-source over the existing `DataModelingPanel` | react-specialist | M2.1 | ∥ (independent) |

**Critical path:** 1→2→3→4→7→8 (calc editor + save) → 10→11 (recipes + gallery). **Parallel lanes:** 5 (expr-tree) ∥ 4 (templates); 9 (calc FFs) ∥ each; 15/16 fork independently off M2 and are droppable; **14 (M3.2) is gated and off the critical path** — it does not block M3.0/M3.1. M3.0 (1–9) is a self-contained mergeable unit; M3.1 (10–13) forks after the expr-generator (4); M3.2 (14) waits on the owner's engine-seam call.

---

## 11. Rejected alternatives (ADR discipline — ≥2)

- **(a) Build a full visual transform-pipeline builder for non-programmers** (drag melt/join/aggregate/pivot nodes, Tableau-Prep-style, for the author). **Rejected.** It teaches the *imperative row-shaping* cliff the whole AR-49 vision refuses — which join? which grain? — and it is the wrong *category*: the derivations a statistics steward actually needs are scalar measure-algebra (governed nouns), not row-shaping. Row-shaping is genuinely expert (§4.4) and stays in the M2-relocated `DataModelingPanel`. Offering a "friendlier pipeline" would be a symptom-patch (Law 6) — a prettier cliff.
- **(b) A text-formula box** (Sigma/Metabase custom-column/Retool style: type `[GDP] / [Population]`). **Rejected.** A free-text formula is a second expression dialect competing with `@statdash/expr` (Law 2 / DRY), and — for a national-statistics artifact — an ungoverned, un-typo-checked authoring path. The visual tree + template shapes cover the need with a *governed, sandboxed* surface; the escape hatch stays the one whitelisted evaluator.
- **(c) Adopt Blockly for the expression builder.** **Rejected as the default** (§8). Heavy, its own serialization model forks our `@statdash/expr` SSOT (Config = SSOT risk), and it is a cannon for a 4-operator need. A tiny in-house tree emitting `@statdash/expr` 1:1 is smaller, token-themeable, a11y-controllable, and forks nothing.
- **(d) Recipes as saved *DataSpec* fragments (per-block), not governed metrics.** **Rejected** (except pragmatically for growth pending M3.2). A per-block spec is not reusable, not a governed noun, not provenance-composing, and re-grows the "chart ≠ table" bug-class the semantic layer exists to kill. Recipes must lower to *metrics* so the derivation is authored once and resolved everywhere through the one seam. (Growth-as-a-spec is the honest interim only until decision #1.)
- **(e) Ship the growth relative-coordinate engine extension inside M3.0.** **Rejected as scope/sequencing.** It is the *only* seam that moves `packages/` and touches `@statdash/expr` + the wire — it deserves its own gated sub-milestone and an owner call, not a rider on the apps-only calc editor. M3.0/M3.1 must ship arrow-untouched first (the vision's repeated discipline).
- **(f) Promise a non-programmer can onboard a novel SDMX source.** **Rejected — refused as dishonest.** DSD/cube-profile definition is `fromSDMX`-boundary expert work (§4.4). Overpromising here would cost the design its credibility; M3.4 makes the expert surface *kinder*, never *non-programmer*.

---

## 12. Definition of done (M3)

A Steward, in Model mode over the same live canvas, opens **"New metric"** and chooses **"From a recipe"** → picks **"per capita"** → picks **GDP** → and a governed metric **"GDP per capita"** appears in the Author's Metric Palette without a reload, byte-identical to a hand-authored calc metric, carrying GDP's + Population's composed provenance and its own bilingual label/unit — **with no query, no pivot, no formula typed.** For a derivation no recipe covers, the Steward opens **"Custom algebra"**, picks input metrics as governed nouns, pins any coordinate via the same dimension+member picker M2.2 ships, composes a **ratio/percentage/difference** (or, in advanced mode, a small **visual expression tree** that emits only whitelisted `@statdash/expr`), sees the value **preview live on the canvas**, and saves — the result registering through the *unchanged* `resolveMeasureRef` seam like any metric. **The author lens never sees the calc editor, the recipe gallery, or the transform pipeline** (`FF-PIPELINE-STAYS-STEWARD`); **the raw modeler stays exactly where M2 put it** (T3, expert, online). The **honesty boundary is explicit in the product** — recipes/calc are "define new metrics"; the pipeline is labelled "Advanced — data modeling (expert)". For M3.0 + M3.1 the **dependency arrow is unchanged**, `packages/` is untouched, no contracts/api change was needed; **only M3.2 (growth-as-a-governed-noun) touches the engine**, and it is isolated, gated, and reversible. Every fitness function in §7 is green.

---

## 13. One-way-door decisions needing the owner's explicit call

1. **Growth as a governed noun — the `MetricInput.at` relative-time extension (the one engine seam).** *Recommendation: DO it, as the isolated gated M3.2* — a national-statistics product's most-requested derivation deserves to be a governed, provenance-carrying noun, and the extension (`{ $prev: 'time' }` on `at` + `@statdash/expr` resolution + the wire mirror) *strengthens the whole calc layer*, small and additive (absent ⇒ today's behavior). **Owner call because it is the only M3 change below `apps` — it touches `packages/core` + `@statdash/expr` + `ManifestMetricInput`.** The alternative (growth as a per-block `growth` DataSpec recipe) keeps the arrow untouched but leaves growth a non-reusable spec, not a noun — inconsistent with the thesis. If the owner declines the extension, growth ships as the honest DataSpec interim.
2. **Recipe library placement — `apps/panel` vs `packages/plugins`.** *Recommendation: `packages/plugins`* so recipes are a `describeApp()`-discoverable capability catalog (Law 8 M-5, Constructor-ready). Panel-local is an acceptable YAGNI start. **Owner-aware, not blocking** — a platform-leverage call, reversible either direction.
3. **The honesty boundary itself — confirm the line.** *Recommendation: adopt §4's line as product doctrine* — "derive meaning = approachable; define what data IS = expert." **Owner should bless it explicitly**, because it sets what we *do not* promise (novel-source onboarding stays expert). The design's credibility depends on this being a stated, shared boundary, not a silent limitation.
4. **Expr-tree control — in-house tiny tree vs a library (Blockly).** *Recommendation: in-house tiny tree* (emits `@statdash/expr` 1:1, no schema fork). **Owner-aware** — a small build-vs-buy the design already resolves (§8), flagged for visibility.

---

## Appendix — relationship to registered architectures

- **Completes (vision scope):** the **calc / measure-algebra editor** deferred at M2 §4.4 (M2.5/M3) — now M3.0; the AR-49 "close the data cliff for a non-programmer" thesis, on the *pipeline/steward* side (M0–M2 closed the *author/compose* side).
- **Consumes / rides (all already in code):** AR-40 (`MetricDef.calc` / `MetricCalc` / `metric-calc.ts` runtime — LIVE, evaluated via `@statdash/expr`), the `ManifestMetricCalc` wire (complete), M2 (`MetricCatalogManager`, `MetricEditor` governance form, `DefaultDimPins`, `saveSemanticCatalog`, governance FFs, the Steward lens, the relocated `DataModelingPanel`), M0 (`enum-ref source:'metrics'` governed picker, `ShowMe`), the existing `PUT /api/config/site` + `GET /api/bootstrap` + `registerManifestMetrics` delivery, `@statdash/expr` (the safe-expression sandbox).
- **Seeds / sets up:** AR-43 (data lineage — a derived metric's "derived from X + Y" is structurally available from `calc.inputs`); AR-47 (authoring governance — a derived metric is a versioned catalog entry like a base metric); AR-41 (reactive core — live calc preview is the reactive-dataflow direction); the far-horizon conversational authoring (vision §3.4 — a governed derivation vocabulary an LLM can emit safely).
- **Refuses to disturb:** the dependency arrow (M3.0/M3.1 are apps-only; M3.2 is the one isolated, gated engine seam), Config = SSOT (a derived metric is pure `ManifestMetricCalc` JSON), Law 2 (the algebra is an `@statdash/expr` tree, never a function/free-text/JS), Law 5 (`fromSDMX`-only — recipes derive over governed metrics, never a new adapter; DSD ingestion stays the expert boundary), Law 8 (recipes are an OCP capability catalog), AR-30 (MT still deferred), the M2 catalog-is-one-`site_config`-SSOT decision.

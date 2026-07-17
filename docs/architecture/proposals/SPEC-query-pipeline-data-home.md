# SPEC — Query as a Visible Pipeline + the Raw-Data Home

> **Status:** DESIGN — decided recommendation (platform-architect, 2026-07-17). Card `work/items/0082-query-pipeline-data-home.md`. Owner sees the concept BEFORE build waves fire.
> **Class:** M · **Priority:** P0 · **Implements:** owner directive 2026-07-17 (Canon C1 continuation) · CAPABILITY-INJECTION-BACKLOG rec #1 (DQ-on-ingest, folded).
> **Bounds honored:** Laws 1–3, 10–11 verbatim · ONE evaluator (`@statdash/expr`) · ONE lowering path (`interpretSpec`→`desugar`→registry→`resolveMeasureRef`) · ObsQuery stays the only wire query · author plane speaks governed nouns (FF-AUTHOR-NO-QUERY holds) · NO object-model change (ADR-041/042 verbatim) · NO metric-grammar change (ADR-034/045 verbatim) · additive / Strangler.
> **Companion canon:** ADR-034 (semantic query plane) · ADR-045 (relative coordinates) · ADR-041/042 (object model) · SPEC-rendering-architecture.md (the reactive graph this rides) · BLUEPRINT-panel-canonical-relay.md (the DATA-rail IA this lands in) · CAPABILITY-INJECTION-BACKLOG.md rec #1.

---

## Executive summary (read this first — plain language)

Today, building a query means facing a wall of choices at once — a type menu with eight options, chips and tags, step cards, and a box of raw text, all on the screen together. Even you find it confusing. This plan replaces that with ONE simple idea the industry has already proven (Power Query, Grafana): **a query is a PIPELINE — a short stack of plain steps, read top to bottom.**

You start by picking **what** you want (a metric, in plain names — never raw codes). Then you add steps: keep only these rows, group them, add a calculation, sort. **Three panes, always visible:** the steps on the left, the **actual data flowing through the step you're looking at** in the middle, and the **finished query written out** on the right. You SEE the raw numbers change as you build, and you SEE what query you are making — exactly your two asks.

Raw data gets **one permanent home**: a clear ladder — Raw sources → the governed model → queries → the elements on your page. Raw files never mix with the rest again, and we check their quality the moment they arrive.

Nothing breaks. The old editors keep working while we build; they retire only once the new way is proven by walking a real journey. Full power stays reachable; the simple path is the default.

---

## 0. The decided architecture, named

**"The pipeline is the spine."** ONE canonical manipulation grammar — an ordered `TransformStep[]` whose HEAD is a governed-noun `source` read and whose tail is the existing pure transform verbs — authored through a **three-pane Power-Query-class surface** (step rail · live per-step grid · generated-query pane), lowered through the ONE evaluator, with raw data given ONE canonical floor in the studio IA.

This is not a new engine. The ground truth is that **we already own the pipeline grammar and its lowering** — an ~18-op runtime registry (`listTransformOps()`), each op carrying its own runtime handler AND authoring `PropSchema` (OCP), resolved through `interpretSpec → desugar → registry`. What we lack is (a) **one spine** instead of a pipe bolted onto three discriminants, (b) **a live per-step grid** (the Power-Query surpass), and (c) **the tag-zoo retired** into a graspable verb grammar. This SPEC decides all three and gives raw data its home.

### The confusion, diagnosed (ground truth)

`DataSpecEditor.tsx` presents, **all at once**: a top-level `Select` over **8 discriminants** (`query`/`row-list`/`timeseries`/`growth`/`ratio-list`/`pivot`/`transform`/`metric`) → routes to 8 bespoke editors → inside `query` you get `FieldWells` (chips dragged into 5 wells) **plus** `PipelineBuilder` (sortable step cards) **plus** a raw-JSON accordion. That literal simultaneity — a type picker + chips + tags + step cards + JSON — **is** the owner's "so many tags, so many things shown together." The pipeline (`PipelineBuilder.tsx`) is already good; it is drowned by everything shown beside it and split across `query.pipe` / `transform.steps` / `ratio-list.pipe` (three homes for one concept).

---

## 1. The pipeline grammar

### 1.1 One spine, one head verb

A pipeline is `pipe: TransformStep[]`. The **head** is a new `source` step; every tail step is a pure transform over rows (Power Query's exact model: Source first, pure steps after). The store-awareness is isolated to the head (mirrors how `PointSeriesSpec` is the store-aware primitive under `timeseries`/`growth`, and `joinByField` is the resolved-rows underside of `blend`).

```
pipe = [ source, filter?, aggregate?, derive?, reshape?, combine?, sort?, … ]   // ordered, top→bottom
         └─ store-aware head        └────────── pure over rows (Vega-Lite transform) ──────────┘
```

**New discriminant (additive, `registerSpec` — the OCP extension path, interpreter unchanged):**

```ts
| { type: 'pipeline'
    pipe:     TransformStep[]   // head = { op:'source', … }; tail = pure verbs
    encoding: EncodingSpec }
```

**New head op (`registerTransformStep('source', …, sourceSchema)`):** its payload is a **governed read** — a `MetricRef[]` + generic grain (`by` / `time` / `where`, Law-1 generic, identical to `MetricSpec`) for the author plane, OR a raw `ObsQuery` for the steward plane. The `source` handler is the store-aware head that lowers onto the existing `store.observe` / `resolveMeasureRef` path — **no new store port, no new evaluator**. Absent an inline `source` (the pure `transform` case) it accepts inline `rows` (subsumes `transform.source`).

### 1.2 The minimal canonical verb set (simple perception) vs the full op registry (full power)

The ~18 concrete ops are **full power** and stay the SSOT. The author never faces 18 tags. Each op **declares ONE `category`** at registration (an additive field on the step-registry entry — declaration→projection, the Bounded-Element ideal); the palette, the "+add step" menu, and the rail are all **projections** of that field. The author sees **seven intent-verbs**:

| Verb (author sees) | Intent | Concrete ops projected into it (registry SSOT) |
|---|---|---|
| **Get** (Source) | what data | `source` (governed metric+grain / ObsQuery / inline) |
| **Filter** | keep rows | `filter` |
| **Aggregate** | group & summarize | `aggregate` · `reduce` · `rollup` · `group` |
| **Derive** | add a calculated field | `derive` · `addField` · `template` · `concat` · `cast` · `window` (running / relative — ADR-045) |
| **Reshape** | wide↔long, pick columns | `melt` · `pivot`(unfold) · `select` · `rename` |
| **Combine** | bring in another source | `lookup` · `join` · `blend` |
| **Sort** | order rows | `sort` |

Seven verbs, graspable; the concrete op is a **progressive-disclosure detail** inside the chosen verb (often inferrable — "Aggregate" defaults to `aggregate`; "sum along a dimension" reveals `rollup`). This is the Arquero/dplyr conceptual vocabulary made a UI grammar without inventing a single new engine verb. **YAGNI discipline:** we add NO new ops for this SPEC — the canonical set is a *projection* of what exists, never a new grammar (per [[maximal-orthogonality]] — orthogonal axes authored once, not axis-count).

### 1.3 Lowering (ONE path, unchanged)

`interpretSpec(spec) → desugar(spec) → registry.spec(type).resolve(...)`. The `pipeline` resolver runs `applyPipeline`: the `source` head reads the store (via `resolveMeasureRef` for governed refs — ADR-034 seam untouched), each tail step runs `applyStep` (unchanged). **Every existing discriminant becomes SUGAR** that `desugar()` lowers into `pipeline`:

- `query` → `{pipeline, pipe:[source(obsQuery), …query.pipe], encoding}`
- `transform` → `{pipeline, pipe:[source(inline rows), …steps], encoding}`
- `metric` → `{pipeline, pipe:[source(metrics+grain)], encoding:default}`
- `timeseries` / `growth` / `ratio-list` / `pivot` → already desugar to primitives; re-target their desugar to `pipeline`.

**Serialization (expand-contract, never a silent break):** `pipeline` is added additively; the 7 legacy discriminants keep round-tripping byte-identically (they desugar at read time, they are NOT rewritten in stored config). The Constructor's **default emission flips to `pipeline` only after `FF-PIPELINE-EQUIV` is green on every stored config** — the single ⛔ one-way door, exactly mirroring the M-SQ demotion pattern (ADR-034). Everything before that flip is git-revert-able.

### 1.4 Law-1 (dimension genericity)

The `source` grain (`by` / `time.dim` / `where`) are **generic dim keys** (already true in `MetricSpec`; `time` is the first-class time affordance, not a privileged dim — grain = `by ⊕ time.dim`). Every transform op operates on generic field names. No hardcoded dimension anywhere in the grammar.

---

## 2. The raw-data home IA

### 2.1 The visible floor plan — "separated once and for all"

Four floors, ONE visible vertical spine in the DATA rail (the front-door mode #1 from BLUEPRINT-panel-canonical-relay):

```
┌─ Floor 1 · RAW SOURCES ───────── workbooks / DSDs / staged cubes (physical, ungoverned)
│                                   DQ expectations declare HERE (rec #1)         [apps/api + packages/contracts]
├─ Floor 2 · GOVERNED MODEL ─────── metrics · dimensions · codelists (the vocabulary)   [packages/core registry]
│                                   the ONLY thing the author plane speaks
├─ Floor 3 · SPECS / PIPELINES ──── the `pipeline` DataSpec bound to an element  [config; authored in §3]
└─ Floor 4 · ELEMENTS / PAGES ───── the node tree (ADR-041), rendered            [render(config)]
```

**"Separated once and for all" in module terms is already the dependency arrow** (`contracts ← expr ← core ← charts ← react ← plugins ← apps/*`, executable via `eslint no-restricted-imports`): raw ingest lives in `apps/api` + `packages/contracts` (`CanonicalDsd`), the governed model in `packages/core`, specs in config, elements downstream. Raw files **cannot** reach the author plane by construction — the arrow forbids it. This SPEC makes that arrow **VISIBLE** as an IA law: the DATA rail presents the four floors as one explicit ladder, each floor inspectable, raw never mixed with governed.

### 2.2 What moves where (Strangler)

Today `CanonicalUpload` is one box buried inside `DataModelBody` (front door, but co-mingled with the model surface). The move: **promote Floor 1 (Raw sources) to a first-class, always-visible DATA-rail section** above the governed model — the front door is front, not behind a lens (the AR-52 W2 fix already begun in `DataModelBody.tsx`; this completes it into the four-floor ladder). The author lens sees Floors 2–4 (governed nouns, specs, elements); the **steward lens** additionally owns Floor 1 (onboard raw, declare DQ, publish).

### 2.3 DQ expectations (rec #1, folded at Floor 1)

Declared, versioned expectation-sets (not-null · in-range · value-in-codelist · uniqueness · referential · freshness) declare **on the `CanonicalDsd`** at Floor 1, lowered through the **existing two-tier validation floor** (no second engine — Law 2/4). They are **SDMX-grade** (rules speak dimensions/codelists/OBS_STATUS, not raw columns) and their failures ride the **Cell honest-state grammar** (Law 11): a cell failing an expectation is a *declared* state — never a fake 0 or silent blank. The steward sees a validation report at the front door; the reader sees an honest cell. **This is the one place we exceed Great Expectations:** they validate columns; we validate a *governed statistical fact with provenance*, projected honestly. ADR owed for the expectation-declaration contract (≥2 alts: VTL-embedded vs our-own predicate DSL over `@statdash/expr` — the latter recommended, arrow-clean, one evaluator).

---

## 3. The authoring surface — three panes

The surface replaces the tag-zoo. It lands in the DATA rail (Floor 3), reached when an element needs binding.

```
┌──────────────┬───────────────────────────────────┬──────────────────────┐
│  STEP RAIL   │        LIVE DATA GRID              │  GENERATED QUERY     │
│ (left)       │        (center)                   │  (right)             │
│              │                                   │                      │
│ ▸ Get: GDP   │   rows AS THEY FLOW THROUGH the    │  pipeline:           │
│ ▸ Filter …   │   SELECTED step (Power Query)      │   - source: GDP …    │
│ ▸ Aggregate… │   governed column headers          │   - filter: …        │
│ ▸ Derive …   │   honest states (no fake 0)        │   - aggregate: …     │
│ [+ add step] │   [step N output]                 │  (read-only default) │
└──────────────┴───────────────────────────────────┴──────────────────────┘
```

### 3.1 Step rail (left) — Power Query's applied-steps

Reuse `PipelineBuilder.tsx` (already a dnd-kit sortable, keyboard-reorderable step list). Head card = **Get** (governed-noun source read). "+add step" opens the **7-verb palette** (§1.2); each step authored through the **ONE generic Inspector** via the op's `PropSchema` (`TransformStepEditor.tsx`, unchanged — no second form engine). Selecting a card sets the grid's "as-of step".

### 3.2 Live data grid (center) — the "raw data visible" want

The rows **at the output of the selected step** — Power Query's per-step preview, which nothing in our class currently gives us. **It is a projection of the reactive graph** (SPEC-rendering-architecture): each pipeline step is a derived graph node; the grid reads node N. **Never a hand-tuned preview cache** (refuse module-level row caches — FF-ONE-DERIVATION-PATH). It renders the **Cell honest-state grammar** (`ok`/`no-data`/`unbound`/`loading`/`masked`/`error`) — a no-data cell shows honest "—", never a fabricated 0 (Law 11 / FF-CANVAS-NEVER-LIES). Headers are **governed labels** (metric/dim names) in the author plane. This is the perception-through-seeing the owner asked for.

### 3.3 Generated-query pane (right) — the "resulting query visible" want

The live-updating serialized pipeline (Grafana's builder↔code duality). **Read-only by default** in the author plane (a friendly declarative rendering of the steps); the raw DataSpec JSON and the **lowered ObsQuery (the wire truth)** appear behind the steward lens. Editable code is a steward-only advanced door (progressive disclosure) — the builder is always primary.

### 3.4 Perception rules (the plane law, ADR-041 §PLANE)

| | Author plane | Steward plane (adds) |
|---|---|---|
| Sees | governed metrics/dims, 7 verbs, the live grid (governed headers), the declarative query | + raw SDMX codes, lowered ObsQuery, concrete op names, provenance, DQ expectations |
| Never sees | raw codes · ObsQuery internals · `vars`/plumbing · the 8-discriminant zoo · JSON | — |

**Progressive disclosure:** simple default = pick a governed metric + grain (one Get step) → a result appears. Full power = add Filter/Aggregate/Derive/Reshape/Combine steps; concrete ops one level deeper. The 8-type `Select` is **retired from the author plane** — the author starts from a metric and adds steps, never from "choose a spec type."

### 3.5 Accessibility (Law 9)

Live grid = a proper WCAG data table (headers, scope, caption = current step). Step rail keyboard-reorderable (dnd-kit keyboard sensor already wired). Generated-query pane = a labeled region; honest-state cells carry text + `aria` state (not color-only). Bilingual (ka/en) throughout, matching the existing editors.

---

## 4. Strangler route (reversible increments)

The grammar and lowering exist; the surface and the unification are the work. Old surfaces demote **only when journey-proven AND parity-green** — never before.

1. **Three-pane over today's `query.pipe`** — build the surface (rail = reuse PipelineBuilder; grid = reactive-graph projection; generated-query pane) over the EXISTING `query`+`pipe` model, no new discriminant yet. Proves the UX. Fully reversible (additive UI).
2. **`source` step + `pipeline` discriminant** — add both additively (`registerTransformStep` / `registerSpec`); `desugar` lowers `query`/`transform` → `pipeline`; `FF-PIPELINE-EQUIV` in shadow mode.
3. **Desugar the convenience specs** (`timeseries`/`growth`/`ratio-list`/`pivot`) → `pipeline`; project `category` onto the op registry → the 7-verb palette goes live.
4. **Flip the Constructor default emission to `pipeline`** — the ⛔ one-way door, gated on `FF-PIPELINE-EQUIV` green over the whole stored corpus. Demote the tag-based `DataSpecEditor` + `FieldWells` to the **steward "advanced" lens**.
5. **Raw-data-home + DQ** — promote Floor 1 to a first-class DATA-rail section (the four-floor ladder); DQ expectations declare at Floor 1, failures ride Cell states.

**Demotion criteria (old tag editors):** demote to steward-advanced **iff** the three-pane path is journey-proven (`FF-JOURNEY-PIPE` green — a real J-walk) **and** `FF-PIPELINE-EQUIV` is green on every stored config. Until both, the old editors stay the default (no user stranded).

### Journeys that prove it
- **J-PIPE (new):** author picks a governed metric → sees the raw grid → adds Filter + Aggregate + Derive → sees each step's grid change → sees the generated query → binds to an element → the published page shows the honest result. `FF-JOURNEY-PIPE`.
- **J1 (existing):** upload → staged cube → **DQ report** → published cube. Extended at Floor 1 (rec #1). `FF-JOURNEY-*`.

---

## 5. Wave decomposition (WIP=1)

| Wave | Scope | Effort | DoD / protecting gate |
|---|---|---|---|
| **W-P0** | ADR (pipeline-as-spine · `source` head · verb-category projection · DQ-expectation contract; ≥2 rejected alts each) + FF gates registered + baseline capture | S | ADR accepted by owner; `FF-PIPELINE-EQUIV`/`FF-JOURNEY-PIPE`/`FF-DQ-DECLARED` defined |
| **W-P1** | **Live per-step grid** — reactive-graph projection, Cell honest-state rendering, governed headers; over today's `query.pipe` | M | `FF-CANVAS-NEVER-LIES` green; grid = graph node (no new cache — `FF-ONE-DERIVATION-PATH`) |
| **W-P2** | **Three-pane shell** — rail (reuse PipelineBuilder) + grid + generated-query pane, wired, in the DATA-rail IA | M | `FF-AUTHOR-NO-QUERY` holds (no raw codes/ObsQuery in author plane); WCAG grid + keyboard rail |
| **W-P3** | **7-verb palette** — `category` projected on the op registry; verb→op progressive disclosure | S–M | Coverage fitness: every `listTransformOps()` op categorized (no orphan); no bespoke per-op UI |
| **W-P4** | **`source` step + `pipeline` discriminant** — additive; desugar `query`/`transform`→pipeline; `FF-PIPELINE-EQUIV` shadow | L (engine seam: core+contracts) | Parity shadow green on corpus; discriminant in `DATASPEC_DISCRIMINANTS` + exhaustiveness assert |
| **W-P5** | **Flip default emission → `pipeline`** (⛔ one-way door) + desugar convenience specs; demote tag editors to steward-advanced | M | `FF-PIPELINE-EQUIV` + `FF-JOURNEY-PIPE` green on ALL stored config before flip |
| **W-P6** | **Raw-data-home IA** — Floor-1 first-class section (four-floor ladder) + **DQ-on-ingest** (rec #1) declared at Floor 1, failures ride Cell states | L (crosses apps/api + contracts + core validation) | `FF-DQ-DECLARED` green; J1 extended (upload→DQ report→publish) |

Sequence is strict WIP=1. W-P1→P3 are apps-only (reversible UI); W-P4→P6 cross package seams — never concurrent, each after the prior lands.

---

## 6. Refusals (what the reference class does that we deliberately do NOT)

1. **No in-config query language / M-code / SQL / DAX text as the author's primary.** Power Query exposes M; Grafana exposes raw query text. We refuse text as the *primary* author surface — the generated-query pane is **read-only by default** (Grafana duality, but the builder leads). *Why:* Law 2 (config is data, not a language) + non-programmer authorable (FF-AUTHOR-NO-QUERY).
2. **No free-form custom-function step / drop-to-code escape hatch.** Power Query lets you write arbitrary M; Retool lets you write JS transforms. The **op registry (`registerTransformStep`) is the ONLY extension path** (OCP). *Why:* Law 2 + a single extension mechanism (the `custom`/`fn` escape hatch was already removed, ENG-16).
3. **No raw column/code names in the author plane.** Power Query's steps operate on raw column headers. We speak **governed nouns** end-to-end (this is our structural surpass — the governed × simple × no-query quadrant no single leader holds). *Why:* Law 4 governed spine (W2) + the plane law (ADR-041).
4. **No second form engine / bespoke per-op form.** Every step authored through the ONE generic Inspector via the op's `PropSchema`. *Why:* the Bounded-Element declaration→projection ideal (a per-op form is the special-case anti-pattern) — even when a hand-form would ship faster.
5. **No per-discriminant `pipe?` proliferation.** We refuse adding `pipe?` to each spec type (today it is on `query`/`transform`/`ratio-list` — three homes). ONE `pipeline` spine; the rest desugar. *Why:* one concept, one home (SRP + the SSOT law).
6. **No materialized / imperative preview cache for the live grid.** The per-step grid is a **projection of the reactive graph**, never a hand-tuned string-keyed cache. *Why:* the rendering-architecture canon (the shadow-graph-as-cache-keys bug class the reactive graph exists to kill).
7. **No new pipeline verbs invented for this SPEC.** The 7-verb author grammar is a *projection* of the existing ~18 ops, not a new grammar. New capability = a new registered op (OCP), never a new author-facing verb category bolted on ad hoc. *Why:* YAGNI + orthogonality ([[maximal-orthogonality]]).

---

## 7. ADR skeleton (owed — the lead assigns the number)

**Decision:** the pipeline is the spine — a `pipeline` DataSpec discriminant with a `source` head op, authored through the three-pane surface, the convenience specs desugared into it, DQ expectations declared at the raw floor.

**Rejected alternatives (≥2):**
- **ALT-A · Per-discriminant pipe everywhere.** Add `pipe?` to all 8 discriminants and keep the type picker. *Rejected:* entrenches the tag-zoo, three-plus homes for one concept, no single spine, the confusion persists. (Refusal #5.)
- **ALT-B · A real query language in config (M-code / SQL-lite / JSONata runtime).** *Rejected:* breaks Law 2 (config becomes a language), breaks FF-AUTHOR-NO-QUERY, needs a foreign runtime (Law 5), not non-programmer authorable, not dep-extractable for the reactive graph. (Refusals #1/#2.)
- **ALT-C · Adopt Vega-Lite / Power Query as the runtime wholesale.** *Rejected:* dual state stores vs our URL-param SSOT (Law 9), raw-column vocabulary vs governed nouns, scope mismatch — the same grounds ADR-024 rejected VL-as-runtime. We adopt the *grammar and the surface*, not the runtime. (Refusal #3.)

**Trade-off named (ISO 25010):** we buy **usability** (learnability — 7 verbs + live grid vs 8-tag simultaneity) and **maintainability** (one spine, OCP) at a one-time **compatibility** cost (the expand-contract migration of stored configs, fully guarded by `FF-PIPELINE-EQUIV` — no silent break).

---

## 8. Fitness functions (each invariant, executable)

- `FF-PIPELINE-EQUIV` — every stored config resolves byte-identically through the legacy discriminant and through its `pipeline` desugaring. **Gates the ⛔ default-emission flip.**
- `FF-JOURNEY-PIPE` — J-PIPE walked live (metric → raw grid → steps → generated query → bound element → honest published result).
- `FF-AUTHOR-NO-QUERY` (existing, held) — no raw codes / ObsQuery / query text in the author plane.
- `FF-CANVAS-NEVER-LIES` (existing, held) — the live grid renders Cell honest states, never a fake 0.
- `FF-ONE-DERIVATION-PATH` (existing, held) — the grid reads a reactive-graph node, no bespoke preview cache.
- `FF-VERB-COVERAGE` (new) — every `listTransformOps()` op declares a `category`; the 7-verb palette is a total projection (no orphan op, no author-facing verb without a backing op).
- `FF-DQ-DECLARED` (new) — DQ expectations are declarations on the `CanonicalDsd`, lowered through the existing validation floor; failures produce Cell states, never a swallowed error.

---

## 9. The lead's elevation pass (Fable, 2026-07-17) — five amendments, binding on the waves

The draft above is sound; these amendments close the gaps a second, stronger read found. They are part of the decided SPEC.

**E1 · Browse-FIRST, build second (sharpens want #4).** The grid must appear BEFORE any pipeline exists: the **Get step's metric picker itself shows a live preview grid** of the candidate metric's observations as the author browses (Excel/Power BI perception law — you start from looking at a table, never from an empty pipeline). "Pick a metric → data is already on screen → now shape it." The empty-pipeline state is therefore never an empty pane: it is the browse grid with a hint. (Folds into W-P1/W-P2 DoD: the picker preview is the same graph-node projection, capped per E3.)

**E2 · The promotion rule — local Derive vs governed noun (closes a semantic-bypass hole the draft left open).** With ADR-045 there are now TWO ways to express e.g. growth: a governed calc-metric (`$prev`) or a pipeline `Derive/window` step. Without a named boundary the old hand-built-growth drift-class re-enters through the pipeline door. The rule: **reusable-across-pages ⇒ a governed metric (Floor 2); element-local shaping ⇒ a pipeline step (Floor 3).** The surface enforces the ecology: a Derive step gains a **"promote to governed metric"** affordance (author proposes → steward blesses → the step is replaced by a governed ref) — the Looker/dbt promotion path, closing the Floor 3→2 loop so local calculations feed the semantic layer instead of silently competing with it. (New small FF: `FF-PROMOTE-ROUNDTRIP` — a promoted step's governed replacement resolves byte-identically.)

**E3 · The grid is a CAPPED, HONEST preview.** Per-step preview reads the first N rows (N≈200, Power Query's exact discipline) with an honest count note — *"showing 200 of 4,812 rows"* — never a silent truncation (Law 9 honesty is for the author too) and never an uncapped store read per keystroke (debounced, capped, cancelled-on-supersede). Full data flows only at render. (W-P1 DoD.)

**E4 · The generated-query pane IS the EXPLAIN seam.** The right pane is not only Grafana duality — it is the natural home of the per-element **lineage/EXPLAIN** differentiator (H3, D6 scan: source→pixel provenance, half-built): the pipe read top-to-bottom *is* the lineage. The pane therefore renders, per step, which governed nouns and (steward plane) which raw codes/ObsQuery it lowers to — one surface, two canonical duties. No separate lineage viewer is ever built for elements. (Shapes W-P2; no extra wave.)

**E5 · Ground-truth correction on W-P1's dependency (built ≠ designed).** The graph SUBSTRATE exists in code (`packages/core/src/graph/` — `compilePage`, `extractDeps`, `shadow`, fitness-tested) but SPEC-rendering-architecture is PROPOSED and **per-step intermediate outputs are NOT graph nodes today** — W-P1's real work is the step-node projection built on the EXISTING graph engine. W-P1 must neither assume the full proposed rendering architecture nor hand-roll a preview cache (refusal #6 stands); if the step-node projection proves to need the fuller graph, W-P1 STOPS and reports — it does not build a shadow substitute.

*End SPEC. Registry rows (AR-*) + ADR number are the lead's to assign; this document proposes and decides the architecture.*

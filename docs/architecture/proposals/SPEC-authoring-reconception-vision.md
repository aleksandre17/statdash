# SPEC — Authoring Reconception: Vision & Conceptual Foundation

> **Status:** VISION (owner sign-off pending) · **Author:** platform-architect (Opus) · **Date:** 2026-07-09
> **Scope:** the concept and conceptual architecture for a bold reconception of the authoring platform. **Not** detailed API design — that is the phase after owner sign-off (Law 7: architecture leads, code follows).
> **Registry card:** AR-49 (`ARCHITECTURE-REGISTRY.md` §B).
> **Grounded against:** `BENCHMARK-REFERENCE-PLATFORMS.md`, `ARCHITECTURE-REGISTRY.md` (AR-1…AR-48), `packages/core/src/config/*` (PropSchema/DataSpec/perspective), `apps/panel/src/**` (working visual builder), the binding laws in root `CLAUDE.md`.

---

## 0. Executive thesis (read this first)

We already own, in code, most of what the market's config-driven leaders ship: schema versioning, a node registry + palette, a safe expression sandbox, two-tier validation, DTCG tokens, `LocaleString` i18n, WCAG AA, a working drag-drop visual builder, and the *spine* of a semantic layer (AR-40). The benchmark confirms this — six of fifteen capability rows are already **at or above** the reference standard.

So the reconception is **not** "catch up." It is: **name and complete the one idea none of the leaders combine** —

> **A metric-first authoring canvas: LookML/Malloy semantic-layer power, Builder.io/Notion composition simplicity, ONS/Eurostat statistical integrity — where a non-programmer builds a statistics-grade dashboard by composing governed *nouns* (metrics × dimensions × perspectives), and never sees a query, a pivot, or a cube.**

The disliked 3-step wizard (Data → Site → Pages) is an **artifact-ordered waterfall**: it forces *every* author to walk through data modeling before they can place a single block. That is the wrong axis. The reconception inverts it to **content-first, bind-progressively**, and relocates modeling from *a step everyone walks* to *a mode a steward occasionally enters* — the "define-vs-curate" split that Looker, Cube, and Malloy all embody, but which none of them expose to a **non-programmer** and none of them wrap in **statistical provenance**.

**The semantic layer is the simplicity engine.** Binding data is a cliff today because binding exposes `ObsQuery`/pivot/transform/cube-profile. A governed metric layer turns "GDP · real growth · by region" into three picked nouns; the renderer resolves the query. Power and simplicity stop being a trade-off because the *complexity moves to a different role*, authored once.

---

## 1. Market / concept study — the one load-bearing idea from each

Synthesized, not enumerated. For each: the single concept worth stealing, and why it matters *for us*.

### Data / semantic / spec platforms

| Platform | The one load-bearing idea | Why it matters here |
|---|---|---|
| **Vega-Lite** | **Grammar of graphics as a JSON algebra** — `mark × encoding × transform`; data is never pre-shaped, the *encoding* says how to map fields to channels. | This is *exactly* our `encoding.ts` golden rule ("data never pivoted; encoding says HOW", AR-36). Law 4 says adopt it whole. Our `ChartDef` should converge onto a Vega-Lite-shaped grammar so charts become spec-portable and pivot/re-encode is free. |
| **Looker / LookML** | **Define-once, curate-many** — a data steward models measures/dimensions in LookML *once*; analysts *curate* dashboards from those governed entities. The two audiences are split. | The keystone of the whole reconception. Modeling is a **role**, not a wizard step. Authors curate; stewards model. |
| **Malloy** | **Measure algebra** — metrics compose from other metrics (calculated measures), declaratively, without SQL soup. | Our `MetricDef` (AR-40) should support calc-metrics (a measure defined over measures) — the "GDP per capita = GDP ÷ population" case, authored once, never re-derived. |
| **Cube.dev** | **Headless semantic layer + `dataSource`-on-measure** — the metric declares where it comes from; the API is the product, not the UI. | We already route `ManifestMetric.dataSource` (benchmark row 6). Cube validates the *shape* of AR-40. But — see §5 — we **steal the concept, refuse the runtime** (Cube assumes SQL; we are SDMX/OLAP-native, Law 5). |
| **Superset / Metabase** | **Progressive query authoring** — a visual query builder that degrades to raw SQL as an escape hatch. | Confirms the escape-hatch pattern: keep our `PipelineBuilder`/`QuerySpecEditor`, but demote them from the author's *default* path to the steward's *advanced* path. |
| **Power BI / Tableau** | **Field wells + "Show Me"** — drag a field into a shelf; the tool suggests the chart. | We already have `fieldwells/` + `ShowMe.tsx`. The reconception makes the *metric palette* (governed) the source of those fields, not raw cube dimensions — safer and simpler. |
| **Sigma / Rill** | **Live, spreadsheet-familiar exploration on a modeled layer.** | Familiarity as an on-ramp; but the modeled layer underneath is what keeps it governed. Reinforces semantic-layer-first. |
| **Grafana** | **Everything is a registered, versioned plugin (`plugin.json`) + JSON dashboards + snapshot/embed.** | Validates AR-46 (plugin SDK) and AR-48 (export/embed). The registry *is* the palette. |
| **Observable Framework / Plot** | **Reactive dataflow + explorable documents** — cells recompute only their dirty dependents; the document *is* the app. | Validates AR-41 (reactive core) and AR-44 (explorable dissemination). The "document" mental model is the right canvas metaphor. |
| **Evidence.dev** | **Markdown + SQL → a data document.** Prose and data interleave. | The *narrative* dimension — a statistics release is a document, not a control panel. Feeds the canvas metaphor and AR-44. |

### Visual-builder / spec-UI engines

| Platform | The one load-bearing idea | Why it matters here |
|---|---|---|
| **Builder.io** | **Content-first visual editing on a headless content model; bind data *after* you place the block.** | The paradigm inversion. You don't configure data first — you compose, then bind. Directly refutes the 3-step wizard. |
| **Plasmic** | **Design-tool-grade canvas over a component registry; code components register their props.** | Our `NodeSliceMeta` + `PropSchema` = the same registration idea. We are already Plasmic-class here — validates "keep our registry." |
| **Puck** | **The editor's data model IS a typed JSON tree of components with a `fields` schema — render(config) purity.** | Puck is the closest external match to *our own* model. This is the "keep what we have, steal the ergonomics" call (§5) — adopting Puck would mean bending our schema to theirs, breaking Config = SSOT. |
| **Craft.js / GrapesJS** | **Freeform drag-drop primitives.** | Lower-level than we need; we have a governed block registry, not freeform HTML. Instructive as a *counter-example*: freeform = ungoverned = not statistics-grade. |
| **JSON Forms / RJSF** | **Render UI from JSON Schema; validate at the boundary with Ajv.** | Our generic Inspector + generated `page-config.schema.json` already do this. Keep our richer `PropSchema`; keep emitting JSON Schema as the external contract. |
| **Adaptive Cards** | **A portable declarative UI payload rendered by many host renderers.** | The portability north-star: one config, many render targets (web / print / embed / export) — our `ViewSnapshot` + `render(config)` purity already point here. |

**Synthesis — the three ideas the whole field agrees on, that we must hold:** (1) *the config tree is the single source of truth, the renderer is pure* — we have this; (2) *define-vs-curate: modeling is a governed layer separate from composition* — we have the spine (AR-40), not the split; (3) *content-first, bind-progressively* — we have the opposite (wizard-first), and this is what we reconceive.

---

## 2. Differentiation thesis — the gap we can own

Plot the field on two axes: **data-grade** (does it understand metrics, dimensions, OLAP, provenance?) and **non-programmer-authorable** (can a domain expert with no code/SQL/DSL build the whole thing?).

```
              non-programmer authorable
                        ▲
        Builder.io      │      ┌───────────────┐
        Plasmic  ●      │      │   THE GAP     │
        Notion          │      │  (we own it)  │
        Form.io  ●      │      └───────────────┘
        ────────────────┼────────────────────────►  data-grade / statistics-grade
                        │      ● Metabase
        Craft.js ●      │   ● Superset  ● Sigma
                        │      ● Looker ● Cube ● Malloy
                        │      ● Tableau ● Power BI ● Grafana
```

- **Top-left (web builders):** non-programmer-friendly, but data-blind. No metrics, no OLAP, no provenance. A Builder.io page cannot express "GDP real growth by region, preliminary-flagged, SDMX-sourced."
- **Bottom-right (BI / semantic tools):** deeply data-grade, but every one of them assumes an **analyst or developer** — SQL, LookML, a Malloy grammar, a query builder. None targets a domain expert who cannot write a query.
- **The empty top-right quadrant** — *statistics-grade AND non-programmer-authorable* — **is unclaimed.** That is the "something that doesn't exist yet."

**Our concrete, opinionated claim to it:**

> **The Governed Canvas** — the first authoring platform where a non-programmer composes a **statistics-grade** dashboard end-to-end by picking governed *nouns* from a semantic layer, with **provenance, methodology, accessibility, and bilingual content as native properties of every number** — not features to remember to add.

Three moats, each already partly built, none held by any single competitor together:

1. **The semantic layer hides the cliff** (AR-40) — no author writes a query.
2. **Integrity is intrinsic, not bolted on** (Law 9, AR-26/37/39/43) — every rendered number carries source → vintage → revision → methodology; preliminary/last-updated badges are structural. No BI tool ships this as a *default property of a metric*.
3. **One config → every surface** — locale × theme × perspective × render-target, losslessly (`ViewSnapshot`, `render(config)` purity, AR-28/31/48). Vega has the grammar; Grafana has embed; nobody has all of it wrapped for a non-programmer with provenance.

---

## 3. The reconceived authoring paradigm — "the Governed Canvas"

### 3.1 The mental model

**One canvas. Three lenses. Two roles.** Replace the artifact-ordered wizard (Data → Site → Pages) with a **single document-canvas** where the three old "steps" become **ambient contexts**, not sequential gates:

| Old wizard step (retired) | Becomes… |
|---|---|
| **Data** (query/pivot/cube exposed to everyone) | The **semantic layer** — a governed metric/dimension catalog, browsable as a *palette*, authored by a **steward** in **Model** mode. Not a step; a mode a different role enters occasionally. |
| **Site** (theme/chrome as a stage) | **Edit-in-place** — theme, chrome, tokens edited directly on the canvas via `StyleField` (AR-11), previewed live. Not a step; a property panel. |
| **Pages** (the actual composition) | **The canvas itself** — the default surface. This is where authoring *starts*, not ends. |

### 3.2 The paradigm inversion: content-first, bind-progressively

Today: *model data → then compose*. Reconceived (Builder.io / Notion model): **compose → then bind, progressively.**

An author's flow becomes:

1. **Drop** a block from the palette onto the canvas (chart / KPI / table / text / map — all already registered).
2. **Bind** it to a **metric** by picking from the metric palette — "GDP", "real growth rate", "population" — governed nouns, not a query. Show Me suggests the encoding.
3. **Slice** by picking dimensions/perspectives — "by region", "annual", "current prices" — again from governed pickers (`enum-ref source:'cube.dimensions'` already exists, but now backed by the *semantic layer*, not raw cube members).
4. **Refine** (optional, progressive disclosure) — styling, parts, responsive breakpoints, visibility rules, cross-filter — in the Inspector, which is already PropSchema-driven and generic.

The author **never** opens `PipelineBuilder`, `PivotEditor`, or `QuerySpecEditor`. Those tools are not deleted — they move to **Model** mode (§3.3).

### 3.3 The load-bearing move: define-vs-curate as a *role*, not a *step*

This is the single most important architectural decision in the reconception, and the reason the 3-step wizard failed.

- **Steward / Model mode** (rare, governed): defines the semantic layer — metrics, dimensions, calc-metrics, DSD bindings, provenance. This is where the existing query/pivot/transform machinery lives. Done once per dataset, not per dashboard. This is LookML's `.model` file, Cube's schema, Malloy's source.
- **Author / Compose mode** (frequent, safe): curates dashboards from governed nouns. Cannot write a query; cannot break a number; cannot produce a mixed-locale or un-provenanced artifact — the layer *makes it structurally impossible*.

The 3-step wizard forced *every author through the steward's job first*. The Governed Canvas separates the audiences. This directly resolves the owner's dislike ("doesn't fit") — the split never fit because it was a **role boundary masquerading as a linear step**.

### 3.4 The far horizon: conversational authoring, grounded

Because the semantic layer gives us a *governed vocabulary* and `describeApp()` gives us machine-readable introspection of every capability, natural-language authoring becomes **safe and possible**: "Add GDP by region as a line chart, last 10 years, preliminary flagged." An LLM maps that to **governed metrics + registered nodes**, never to SQL or arbitrary code (Law 2 preserved — the LLM emits *config*, which is validated at the boundary like any other config). No BI tool can do this safely today because their NL layer must generate SQL against an ungoverned schema. **A governed statistical semantic layer is the thing that makes trustworthy conversational authoring possible.** This is genuinely novel — and it is an *emergent property* of the architecture, not a bolted-on feature. Phased late (M5), but the seams (MetricDef registry, `describeApp()`) are laid now.

### 3.5 Rejected authoring paradigms (ADR discipline)

- **(a) Keep the 3-step wizard, just prettier.** Rejected: it encodes the wrong axis (artifact-order over role-separation). Polishing a waterfall leaves the data-binding cliff intact for every author.
- **(b) Template-first (author only picks a finished template, fills blanks).** Rejected as the *primary* model: it caps ceiling (no true composition), fails the owner's "powerful" requirement, and doesn't scale to Geostat's breadth. **Kept as an on-ramp** (templates gallery already exists) — a starting point on the canvas, not a cage.
- **(c) Spreadsheet-first (Sigma/Rill model).** Rejected as primary: familiar but exposes rows/columns/formulas — a different cliff, and weaker for a *published-document* dissemination product than a document-canvas. The semantic layer subsumes its one real advantage (governed exploration).
- **(d) Pure conversational / prompt-only.** Rejected as primary: non-deterministic, non-auditable authoring of a national-statistics artifact is unacceptable (provenance/governance). **Kept as an accelerant on top of the canvas** (§3.4), where every generated config is still validated, diffable, and reviewable.

---

## 4. The simplicity engine — powerful AND simple, simultaneously

The owner's central tension. Resolved by **five mechanisms**, layered so that power is *available* but never *in the way*:

1. **The semantic layer hides the query (the big one).** Complexity is not removed — it is *relocated and authored once* by a steward. The author sees nouns; the renderer resolves the query through the existing `DataStore` + `fromSDMX`. This is why power and simplicity stop trading off: they live in *different roles*. (AR-40 grows into this.)

2. **Progressive disclosure.** The canvas shows the minimum (drop + bind). The Inspector reveals styling/responsive/visibility/cross-filter only when asked. `PropSchema` already supports `showWhen`/grouping — the Inspector *already* renders each block's schema generically; we tier the fields by frequency, not add machinery.

3. **Smart defaults + "Show Me."** Every registered node ships `defaults` (already in `NodeSliceMeta`); binding a metric to a chart auto-picks a sane encoding (`ShowMe.tsx` already exists). The author starts from *correct*, not from *blank*.

4. **Governed pickers over free-text everywhere.** `enum-ref` sources (`cube.measures`, `dataSpecs`, `tokens`, `pages`, `perspectives`, `filterParams`) already forbid typing raw identifiers (Law 2). Extend this discipline: metrics, dimensions, and members are *picked from the semantic layer*, never typed. Governance = simplicity — you cannot pick a wrong noun.

5. **Sane templates + one-config-many-views.** The templates gallery is the on-ramp; the perspective/theme/locale axes (AR-31, tokens, `LocaleString`) mean the author builds *one* thing and gets many views for free — less to author, more delivered.

**The rule that makes this coherent:** *complexity is a property of a role, not of a task.* Simplicity for the author is bought by concentrating power in the steward's semantic layer and the platform's smart defaults. That is the architectural answer to "powerful yet simple."

---

## 5. Library / package evaluation — strengthen AND simplify (with honest "keep" calls)

Selection principle: adopt a library only if it strengthens *and* simplifies *and* honors the arrow + Config = SSOT. Where our own thing is already at standard, **keep it and say so** — resisting rip-and-replace is itself a senior call.

### Retire

- **`react-admin` — RETIRE.** The CRUD `<Resource>` screens are a **dead fork** (unwired), and "provider only" pulls an entire data-provider paradigm we don't use. **Replaces:** nothing (Zustand + our own boot already carry the load). **Win:** removes a dormant fork that tempts drift (first-tenant-erosion risk), shrinks the panel's dependency surface. **Cost/risk:** low — it is already dead. This is the clean first cut of the Strangler.

### Adopt the *idea*, refuse the *runtime*

- **Semantic layer — GROW AR-40; do NOT adopt Cube.dev or Malloy as a runtime.** **Replaces:** the query/pivot editors *in the author's path* (relocated, not deleted). **Win:** the simplicity engine. **Cost/risk of adopting the runtime instead:** Cube and Malloy assume a **SQL warehouse**; adopting either would (a) violate Law 5 (`fromSDMX` is the *only* adapter boundary), (b) reintroduce a query language into config (Law 2), and (c) fork the OLAP model we already have (perspective axes, `cube-profile`). **Verdict:** steal the *concept* (governed measures/dimensions, define-vs-curate, calc-metrics) and grow our own thin declarative `MetricDef` layer, resolved through `DataStore`. We already refused sql/joins on `MetricDef` in AR-40 — hold that line.

- **Charting grammar — converge `ChartDef` onto a Vega-Lite-shaped algebra; keep ApexCharts as ONE renderer strategy.** **Replaces:** nothing yet — ApexCharts stays the default renderer. **Win:** Law 4 (adopt Grammar of Graphics whole), spec-portability, free pivot/re-encode (AR-36), and an *optional* Vega/Observable-Plot renderer strategy for the long tail. **Cost/risk:** high if rushed — imperative interaction and theme-reactivity differ (AR-14 already shows the ApexCharts theme-baking pain). **Verdict:** **north-star, not milestone-1.** Formalize the grammar; migrate renderers behind a strategy interface later. `encoding.ts` is already the kernel.

### Keep what we have (and steal ergonomics)

- **Visual editor — KEEP our canvas/registry; borrow Puck's drop-zone & field-resolution ergonomics.** Our palette + live-preview canvas + generic Inspector + outline + `NodeSliceMeta`/`PropSchema` is **already Puck/Plasmic-class** and, crucially, honors our arrow and Config = SSOT. **Adopting Puck would mean bending our schema to Puck's `fields` model — a Config = SSOT violation and a Law-7 inversion (architecture would follow a library).** **Verdict:** keep the engine; study Puck's drop-zone UX and nested-field resolution as *pattern* input only.
- **Form/schema rendering — KEEP `PropSchema` + the generic Inspector; keep emitting JSON Schema at the boundary.** Our descriptor is *richer* than JSON Forms (it carries `DataSpec`, `ChartDef`, `enum-ref` sources). JSON Forms/RJSF would be a downgrade. Keep the standards *bridge* (`describeApp()` → `page-config.schema.json`) for external validation/tooling.
- **Layout — KEEP the JSON grammar of layout (AR-5).** No CSS-in-JS library beats a config-is-data CSS-Grid grammar for our constraint. Above standard.
- **State — KEEP Zustand.** Right-sized. The real state evolution is AR-41 (reactive dataflow core), an *architecture* move, not a library swap.
- **Design tokens — KEEP the DTCG token SSOT + `TOKENS_CATALOG`.** Above standard (benchmark row 8). This is the rebrand seam (§9).
- **cmdk / @dnd-kit / d3-geo — KEEP.** Fit-for-purpose, no simpler equivalent.

### Watch (defer, but flag)

- **MUI + Emotion (panel only).** The runner (`geostat`) is correctly MUI-free and token-driven. The panel's MUI is heavy and its theme *competes* with our token layer. **Not milestone-1**, but the north-star is to converge the authoring UI onto our own token layer + a **headless primitive lib (Radix / Ark UI)** so the tool and the product speak one design language. Flag; don't act yet (YAGNI).

**Top 3 (for the owner):** (1) **Retire react-admin** (clean, low-risk first Strangler cut). (2) **Semantic layer: grow AR-40, refuse Cube/Malloy-the-runtime** (the simplicity engine; SDMX-native call). (3) **Keep our canvas, borrow Puck's ergonomics** (resist the rip-and-replace; protect Config = SSOT).

---

## 6. High-level target architecture (concept-level, no API design)

### 6.1 Mapping onto the package graph (arrow preserved)

```
contracts ← expr ← core ← charts ← react ← plugins ← apps
   │          │      │       │        │        │        │
   │          │      │       │        │        │        └─ apps/panel  = Governed Canvas (Compose/Refine/Model lenses)
   │          │      │       │        │        │           apps/geostat = runner (unchanged; boots from SiteManifest)
   │          │      │       │        │        └─ plugins  = block registry (palette SSOT) + metric/dimension slices
   │          │      │       │        └─ react   = generic Inspector, canvas engine, ViewSnapshot host (app-agnostic)
   │          │      │       └─ charts = ChartDef grammar (→ Vega-Lite-shaped, ApexCharts as a strategy)
   │          │      └─ core = SEMANTIC LAYER lives here: MetricDef registry, resolveMeasureRef, DataStore port, perspective axes
   │          └─ expr = safe expression sandbox (calc-metrics reuse this; no new eval)
   └─ contracts = wire/boundary types: SiteManifest, ViewSnapshot, MetricDef wire, SnapshotEnvelope
```

Everything the reconception needs already sits on the correct side of the arrow. **No arrow change is required** — the vision rides existing seams. That is the strongest evidence it is the right architecture (Law 7: the code already leans this way).

### 6.2 The formal semantic / metrics layer (Cube/Malloy/LookML-class, our form)

Lives in `packages/core` (pure, above `expr`, resolved through `DataStore`). Concept-level shape (not API):

- **`MetricDef`** (exists, AR-40) — a governed measure: id, unit, format, provenance/methodology, `dataSource` routing. **Grow:** calc-metrics (measure-over-measures, resolved via the `expr` sandbox — no new eval), so "GDP per capita" is defined once.
- **`DimensionDef` + members** — governed dimensions and their members, backed by the cube-profile that `enum-ref source:'cube.*'` already reads. **Grow:** make the semantic layer, not raw cube introspection, the source the pickers bind to (governed > raw).
- **`resolveMeasureRef`** (exists) — the single resolution seam every surface (KPI/chart/table/featured-slider) already routes through. **Hold:** this is *the* invariant that makes "chart ≠ table" structurally impossible (the bug-class AR-40/AR-41 target).
- **Refusals held:** no SQL, no joins, no `fetch`, no functions on `MetricDef` (Law 2 / Law 5). The layer is *declarative data + governed references*, resolved by the renderer.

The author's metric palette = a browsable view of this registry (define-vs-curate). The Constructor's metric-picker (AR-10) = the same registry introspected.

### 6.3 How the block registry / PropSchema / ViewSnapshot evolve

- **Block registry (`NodeSliceMeta`)** — evolves *by population, not by mechanism*. New capability = new registered slice (OCP; benchmark row 2 = at standard). The palette taxonomy surfaces `caps`/`category` (AR-10). Externalization = AR-46 (plugin SDK) when a third-party/Constructor author is real.
- **`PropSchema`** — add a `'metric-ref'` / `'dimension-ref'` field type (a governed `enum-ref` variant sourced from the semantic layer). This is the *only* new vocabulary the reconception strictly needs, and it is additive (OCP — new `PropFieldType` token, no Inspector interface change). It is the field that lets the generic Inspector render "bind to metric" with zero per-type form.
- **`ViewSnapshot`** (AR-48) — becomes the portability SSOT that unifies permalink-state + rendered-data + provenance across render targets (web/print/embed/export). The Adaptive-Cards "one payload, many hosts" north-star, already spined.

### 6.4 Fitness functions the vision must hold (invariants → executable, not prose)

Consistent with the project's fitness-function discipline (every invariant is a test):

- **FF-METRIC-SINGLE-RESOLUTION** — no surface computes a measure except through `resolveMeasureRef` (kills "chart ≠ table").
- **FF-AUTHOR-NO-QUERY** — Compose-mode surfaces bind only `metric-ref`/`dimension-ref`; no raw `ObsQuery`/pipeline field is reachable from the author's default path (query editors are Model-mode-only).
- **FF-CONFIG-IS-DATA** — no function/`fetch`/`if` in any config or `MetricDef` (existing Law-2 gate, extended to the semantic layer).
- **FF-RENDER-DETERMINISTIC / -ISOMORPHIC** — `render(config)` pure (exists, AR-28) — the precondition for every render target.
- **FF-PROVENANCE-ON-EVERY-NUMBER** — every rendered measure carries source→vintage→revision→methodology (AR-43 direction).

---

## 7. Strangler-Fig migration path (no big-bang)

The existing ~19k-LOC panel is an *asset*, not a liability — most of it is kept and *reframed*, not rewritten.

| Component | Disposition | Rationale |
|---|---|---|
| Engine (`packages/*`), palette, live-preview canvas, generic Inspector, outline, command palette, templates gallery, Show Me, field wells | **KEEP** | Already Governed-Canvas-shaped; the reconception is a *reframing* of the entry model, not the engine. |
| `PropSchema`, `DataSpec`, `NodeSliceMeta`, `ViewSnapshot`, tokens, `page-workflow` UI | **KEEP** | On the correct side of the arrow; at/above standard. |
| **3-step wizard** (`features/wizard/*`: `ConstructorWizard`, `WizardStepper`, `DataStep`, `SiteStep`, `PageStep`) | **RESHAPE → dissolve** | DataStep → Model mode; SiteStep → edit-in-place theme/chrome; PageStep → the canvas (default). The steps become contexts. |
| Data-layer query editors (`PipelineBuilder`, `QuerySpecEditor`, `EncodingEditor`, `PivotEditor`, `TransformEditor`) | **RESHAPE → relocate** | Demoted from the author's default path to **Model** mode (steward) + advanced escape hatch. Not deleted — governed. |
| Metric palette + `metric-ref` binding | **NEW (additive)** | The author's primary data affordance; grows on AR-40's spine. |
| **react-admin CRUD `<Resource>` screens** (`PageList/SectionList/DatasourceList` + Edit/Create), `react-admin` dep | **RETIRE** | Dead fork; the clean first Strangler cut. |

**Migration principle:** each cut is *reversible* and *independently valuable*. The wizard is dissolved lens-by-lens, not deleted in one commit. The query editors keep working throughout — they just change *who* sees them and *when*. No page of authoring capability is ever offline.

---

## 8. Phasing — sequenced, each milestone independently valuable & reversible

| M | Milestone | Delivers | Reversible? | Depends on |
|---|---|---|---|---|
| **M0** ⭐ | **Semantic layer + Metric Palette** | Complete AR-40 into a browsable governed metric/dimension catalog; add `metric-ref`/`dimension-ref` PropSchema types + a "bind to metric" affordance on the canvas. Authors stop writing queries. | Yes (additive on `DataStore`) | AR-40 spine (in code) |
| **M1** | **Dissolve the wizard → unified canvas** | Compose lens becomes the default entry; retire the react-admin CRUD fork. | Yes (wizard can be re-enabled) | M0 |
| **M2** | **Model mode (steward)** | Relocate query/pivot/cube editors behind the steward role; formalize define-vs-curate + the authoring-role half of RBAC (benchmark row 10). | Yes | M1 |
| **M3** | **Refine lens** | Surface `StyleField`/parts/responsive/visibility authoring (AR-4/AR-11) via progressive disclosure. | Yes | M1 |
| **M4** | **Governance + dissemination** | Authoring workflow draft→review→publish + audit + diff/rollback (AR-47); wire export/embed (AR-48). Multi-author safety + citation-grade delivery. | Yes | M1 |
| **M5** | **North-star** | Conversational authoring (§3.4), Vega-Lite grammar convergence, perspective lattice (AR-31), reactive dataflow core (AR-41). | Yes (each gated) | M0–M4 |

### First-milestone recommendation: **M0 — Semantic layer + Metric Palette.**

**Rationale:** (1) It attacks the **hardest usability gap the brief names** — the data-binding cliff — head-on and first. (2) It is the **simplicity engine**; every later milestone (unified canvas, Model mode, conversational authoring, Constructor palette) *depends* on it. (3) It is **already started** (AR-40 spine in code, `resolveMeasureRef` live), so it is low-risk and fast to first value. (4) It is **additive and reversible** — it rides the existing `DataStore`/`fromSDMX` boundary, breaks nothing, and delivers immediate author value (pick a metric instead of building a query) *before* any wizard is touched. Sequencing modeling-first would repeat the wizard's mistake; sequencing *the layer that removes modeling from the author* first is the correct inversion.

---

## 9. Brand / visual identity direction (high-level, for owner approval)

The theme editor (today a read-only stub, `SiteDef.themeOverrides` + `SiteDef.chrome` data model exists) is the **concrete rebrand seam** — and the architecture makes rebrand a *data* operation, not a code change. That is itself a proof point of the platform.

- **Product name direction (primary): "Strata."** Statistics + layered composition (data / metric / view strata) + institutional gravitas. Reads credible to an NSO audience and modern to a builder audience. **Alternates:** *Facet* (OLAP facets / perspective axes — playful, precise), *Prism* (one source refracted into many views — literally the perspective lattice AR-31; caution: near "Prisma"). **Recommendation:** Strata primary.
- **Visual tone:** *institutional trust × modern clarity* — the credibility of Eurostat/ONS/IMF dissemination meets the polish of Stripe/Linear. Restrained, data-forward, high-contrast (a11y-native), typography-led. The chart *is* the hero; chrome recedes.
- **Token / theme strategy:** the DTCG token SSOT (`packages/styles`) is already the single lever. Brand = a **token preset**, authored via `StyleField` (AR-11) once the theme editor is made writable. Ship a default **"Strata" theme** as the reference token set; the current dark/light switcher (AR-13) already proves multi-theme. **Per-tenant/agency theme = the multi-tenant seam** (AR-30) — preserved, not built (single-tenant-first confirmed). Rebranding for a second agency later = authoring a token preset, zero engine code. That is the architecture keeping its promise.

---

## 10. Working-assumption verdicts (confirm/challenge, per brief)

- **Single-tenant-first (Geostat), MT seam preserved not built** — **CONFIRMED.** Aligns with AR-30 (owner-deferred) and the per-tenant-theme-as-token-preset call (§9). The reconception adds no MT dependency.
- **Brand is ours to propose** — **EXERCISED** (§9): "Strata."
- **One additional challenge (Observation Duty):** the brief frames this as replacing the *3-step wizard*. The deeper finding is that the wizard is a *symptom*; the root is **role-conflation** (author forced to do the steward's modeling). The reconception must fix the *root* (define-vs-curate split), or a new authoring surface will re-grow the same cliff. The vision above targets the root.

---

## Appendix — relationship to registered architectures (nothing re-litigated)

This vision is the **umbrella** the following registered cards serve; it does not supersede them, it sequences them:

- **Consumes / completes:** AR-40 (semantic layer — the M0 keystone), AR-10/AR-11 (authoring ← schema SSOT, StyleField), AR-4 (style system), AR-46 (plugin SDK), AR-47 (authoring governance), AR-48 (export/embed).
- **Enabled later by:** AR-31 (perspective lattice), AR-36/38/42 (grammar of interaction), AR-41 (reactive core), AR-43 (lineage), AR-44 (explorable dissemination), AR-28 (rendering north-star).
- **Refuses to disturb:** AR-30 (MT deferred), Law 5 (`fromSDMX` sole boundary — the reason we refuse Cube/Malloy runtimes).

**Next action on sign-off:** promote M0 (semantic layer + Metric Palette) to a detailed design (`SPEC-*`), with API design, PropSchema `metric-ref` type, and the metric-palette authoring surface — the phase Law 7 defers until the concept is owner-approved.

# MASTER PLAN — Canonical Rearchitecture (AR-49 → the object-model + rendering + shell unification)

> **Author:** orchestrator (lead), synthesizing two independent Fable-5 studies + the layout arc + deep-authorability. **Date:** 2026-07-10 (overnight autonomous run, owner-authorized). **Status:** roadmap → executing.
> **The vision (owner):** the best-in-class Constructor nobody else has — everything canonical, unified, agnostic, dynamic; every anti-pattern/degradation killed; the best concepts/patterns/architectures from the leading platforms, unified. This doc is the single scheme; the full designs live in the linked SPECs.

## The three unified backbones (one coherent model)
1. **WHAT renders — object model** (`SPEC-rendering-core-object-model.md`, Fable study 1): **"One Type System, One Tree, Two Residences."** Collapse 3 registries + 2 composition mechanisms + the unregistered item tier into ONE type system; "kind" (node/panel/page/chrome/control) = a facet, not a mechanism. A **Promotion Law** (≥2 node-facets {id, visibility, style, own DataSpec, RBAC, reorder} → a type; below → a value) decides residence: kpi-card + hero-card **promote** to types; table-columns / chart-encodings / filter-controls correctly **stay values** (Grafana/Vega canon). D7/itemSchema = the value band's **canonical** editor (reframed, kept).
2. **HOW data flows + updates — rendering architecture** (`SPEC-rendering-architecture.md`, Fable study 2): **Grammar → config-compiled Reactive Query Graph → pluggable realizers.** The grammar (GoG/DataSpec) + the render pipeline are reference-grade (kept). The debt is the data/reactivity plane — coarse re-render patched by fragile string cache-keys (2 are patches over shipped bugs). Fix: **compile the whole dashboard's dependency graph from the declarative config** (`extractDeps` is total because Law 2) → surgical, exact invalidation; subsumes the cache/warm/poll patches + the bug class. "Nobody compiles a dashboard-scale dataflow graph from config — we can." + a static `ChartEmitter` (ChartOutput→SVG) closes the server-side/export hole.
3. **WHERE it's edited — shell/placement** (`SPEC-studio-shell-layout.md`): the Placement Law (`place(scope,weight)→container`) — unaffected + strengthened; its scope-axis maps 1:1 onto residence; focus-view = a **separate Studio route** (owner clarification). SL-0/0b/1 built; SL-2..5 remain.

The three cohere: kpi-card promotion (backbone 1) ⇄ per-card graph node (backbone 2) ⇄ selectable object in the shell (backbone 3). One declarative config; one type system; one reactive graph; one placement law.

## Sequenced roadmap — reversible first, one-way-doors LAST (held for owner)
**Legend:** ✅ done · 🔁 reversible (autonomous) · ⛔ one-way-door (STOP — owner sign-off with green evidence).

### Object model
- ✅ D7.0–D7.3 (itemSchema value-band editor — reframed as canonical, kept)
- 🔁 **R0** — ADR-023 + the 6 fitness scaffolds (ONE-TYPE-SYSTEM, KIND-IS-FACET, TWO-RESIDENCES-ONLY, NO-FACET-REINVENTION, PROMOTION-LOSSLESS, ONE-COMPOSITION-GRAMMAR)
- 🔁 **R1** — type-system unification (3 registries → 1 `ObjectMeta` with kind-facets; engine-internal, config byte-identical, alias-reversible)
- 🔁 **R2-expand** — kpi-card as a promoted leaf-data-panel type ALONGSIDE the itemSchema (behind a flag; `interpretKpi` → renderNode pipeline; FF-PROMOTION-LOSSLESS in shadow)
- ⛔ **R2-contract** — remove the old kpi item path (the one-way door; only after FF-PROMOTION-LOSSLESS green on ALL stored configs)
- 🔁 **R3-expand** — hero-card promotion (expand) · ⛔ R3-contract
- ⏸ R4 chrome residence (defer, after SL) · ⏸ R5 control split (defer, YAGNI)

### Rendering
- 🔁 **V0** — ADR-024 + FFs + **baseline measurements** (the honesty gate)
- 🔁 **V1** — `extractDeps` SSOT (standalone value; the config→dependency static analyzer)
- 🔁 **V2** — reactive graph engine in **shadow mode** (FF-GRAPH-PARITY diff vs current)
- ⛔ **V3** — render-path switch (the one-way door; golden-DOM + latency-gated, soak window)
- 🔁 **V4** — subsume warm/stream/poll (after V3) · 🔁 **V5** — `ChartEmitter` (ChartOutput→SVG, independent — build now) · ⏸ V6 extra strategies (defer)

### Shell / layout
- ✅ SL-0/SL-0b (Placement Law primitive) · ✅ SL-1 (dock 3-zone)
- 🔁 **SL-2** — Focus-View = a **separate Studio route** (owner clarification) + re-home Model mode · 🔁 **SL-3** popover · 🔁 **SL-4** overflow escalation · 🔁 **SL-5** relocate audit

## Overnight execution order (autonomous, each DoD-gated + committed, STOP before ⛔)
R0 → R1 → V0 → V1 → V2(shadow) → SL-2 → SL-3 → SL-4 → SL-5 → V5(ChartEmitter) → R2-expand → **R2-contract** → R3-expand → **R3-contract** → V3-switch → V4 → end.
Each step: principled agent (mission-command brief, model per decision-density) → DoD gate (functional + live/parity-verified + canon-checked + full converged gate incl. independent root `tsc -b` for packages work) → commit (no push) → next. Anti-pattern hunt + the self-policing gate rollout run alongside. Nothing degrading laundered into a brief; laws + arrow held throughout.

**⛔ contracts/switch — OWNER-AUTHORIZED to run overnight (2026-07-10, conscious risk-acceptance, on record).** The owner overruled the lead's soak-first counsel: execute the full plan, replace old-with-new, do not wait. The contracts are NOT held for the owner. Instead each ⛔ **fires the moment its correctness gate is GREEN** — this is engineering proof, not a wait: **R2-contract** fires only when `FF-PROMOTION-LOSSLESS` is green on EVERY stored config; **V3-switch** fires only when `FF-GRAPH-PARITY` (golden-DOM identity) + the latency gate are green. The gate proves new==old BEFORE the old is removed; a contract whose gate cannot go green is a STOP + report (a real blocker), never a forced removal. Reversible in practice via `git revert` of the contract commit.

## Standards-gap ledger — continuous benchmarking (proactive innovation; the lead scans + closes, not one-off)
> Purposeful innovation only — each gap is measured against the leading reference systems/standards and closed with the best-known (or a more-refined/hybrid) solution. Serves system improvement / functional growth / scientific-grade concepts, never novelty.

| # | Gap (where we fall short) | Reference standard / systems | Best solution (adopt/hybrid) | Serves | Disposition |
|---|---|---|---|---|---|
| G1 | ~180 fitness gates, no PROOF they bite (vacuous-gate incidents seen) | **Stryker / mutation testing** (intl. std for test-suite efficacy) | Stryker on the fitness suite + FF-GATE-BITES meta-gate — machine proves every gate catches a planted mutant | "no false-green / no slips" | **fold into quality track (near-term)** |
| G2 | No "why is this number what it is" lineage surface | ONS/Eurostat/IMF (methodology+provenance) · Collibra/dbt-docs (lineage graph) | Read the V1/V2 reactive graph + semantic layer + SDMX provenance → a lineage readout (graph makes it mechanically free) | statistics-grade trust; functional expansion | register (post-V-track) |
| G3 | Thin production observability on the public site | OpenTelemetry · Core-Web-Vitals RUM · error tracking (Sentry-class) | OTel traces + web-vitals RUM + error tracking | production-readiness | register |
| G4 | Authoring-chrome hardcoded English ("+ Add item", "No items yet") | full i18n / ICU MessageFormat, zero hardcoded UI strings | i18n catalog for editor chrome | bilingual mandate (Wave 5) | fold into Wave 5 |
| G5 | Semantic-layer completeness vs the leaders | LookML · Cube · Malloy · dbt Semantic Layer | metric versioning · access grants · typed query API · caching — grown on OUR SDMX-native layer (Law 5: refuse Cube-as-runtime) | governed-noun depth | **DESIGNED → AR-50** (two independent studies: opus `SPEC-data-semantic-worldclass.md`+`ADR-025`, Fable-5 `SPEC-data-semantic-worldclass-fable.md`+`ADR-034`). **APPROVED (2026-07-11, owner delegated the call under the "always the stronger/more-agnostic/higher-standard" principle).** See AR-50 decision block below. |

## AR-50 — semantic-layer elevation: DECISIONS (2026-07-11, lead-decided under owner's standing principle)
> Two independent studies (opus + Fable-5) converged on the diagnosis: data-object + JSON-transform + reactive-graph = at/above class; the whole gap is **semantic depth**. Both found the same live defect — *"GDP per capita over time" cannot be a governed metric today* (re-derived per chart), and a non-additive ratio is silently summed. The lead synthesized; decisions below are recorded, not pending.

- **D-AR50-1 — relationships = REIFY the SDMX DSD, NOT a new `RelationshipDef` noun.** The DSD already encodes the structural contract (sliceableBy per metric); adding a parallel noun = a second source of truth. More agnostic + SDMX-native (Law 5) + faithful to how LookML/Cube keep joins off the measure. (Chose Fable over opus.)
- **D-AR50-2 — semantic query = a `metric` DataSpec DISCRIMINANT** (Fable M1), compiled by a registered resolver → ObsQuery. OCP-consistent with our union + the coverage build-gate; NOT a separate parallel plane (opus M4). Metric-first (AR-49) becomes *structure*, not just UI.
- **D-AR50-3 — synthesized build sequence (all reversible except the one noted ⛔ contract):**
  1. **M5 — one expression dialect + one aggregation vocabulary** (converge `DeriveExpr` → `@statdash/expr`; `parseFormula` compiles the string surface to the canonical `Expr` AST; `avg`≡`mean` via one `AGG_OPS` SSOT). Confirmed live erosion (E1/E2). Reversible. **✅ BUILT (`53bb83f`).**
  2. **M5b — G6 discoverability + `FF-DATA-REACHABLE`** (built-≠-buried as a fitness function; role-is-lens on content — author=Data Dictionary, steward=modeler; navigation never flips the lens). Reversible (rail entry). **✅ BUILT (`bb7a74c`).**
  3. **M2 — grain/measure algebra + `FF-NO-SUM-OF-RATIO`** (scalar→any-grain via `evalCalcAtGrain`; additivity model additive/semi/non-additive; the science). Reversible expansion (scalar = grain-∅ byte-identical, `FF-CALC-GRAIN-SCALAR-IDENTICAL`). **✅ BUILT (`87aea32`, `packages/core/src/data/metric-grain.ts`).**
  4. **M-SQ — the `metric` DataSpec discriminant** (Fable M1; registered resolver → M2 grain evaluator + `resolveMeasureRef`; `growth`/`cumulative` as metric kinds). Reversible (unregister resolver; flag off). ⛔ **the ONLY one-way door is its CONTRACT phase** — demoting the `ratio-list`/`growth` spec discriminants to sugar + flipping the Constructor default emission — gate-fired only when `FF-METRIC-QUERY-EQUIV`/`FF-GROWTH-KIND-EQUIV` are green on EVERY stored config. **IN PROGRESS (another agent — do not edit core).**
  5. **M4/kernel — transform kernel + statistics verbs** (Fable: `impute` with SDMX status-flag propagation = Law-9 surpass; `broadcast`/`unfold`/`bin`/`timeUnit`; duplicate verbs → registered sugar with row-identical lowerings). Reversible (additive). PENDING.
  6. **M5/lifecycle — DSD-reified structural contract + versioning/certification** (**the D-AR50-1 landing**: reify the SDMX DSD as `ManifestDataflow` → `MetricDef.sliceableBy`, powering authoring-time validation + palette projection; + `status` draft→certified→deprecated + catalog `catalogVersion` migrations). Reversible (additive contract fields). PENDING.
- **Housekeeping — DONE (2026-07-11):** the two studies are reconciled into ONE canonical record. **Canonical ADR = `ADR-034-semantic-query-plane-and-measure-algebra.md`** (`ADR-025` marked Superseded→034, kept for history — its `RelationshipDef`/`SemanticQuery`-plane are the rejected alts under D-AR50-1/2). **Canonical SPEC = `SPEC-data-semantic-worldclass-fable.md`** (`SPEC-data-semantic-worldclass.md` marked Superseded→it). **ADR numbering standard (fixes E7): `ADR-NNN`, three-digit zero-padded, unpadded beyond three** (the dominant ADR-001…024 series); the four grandfathered four-digit records (`ADR-0023/0025/0026/0033`) are NOT renumbered; `034` (not the lower `025`) is canonical because number 25 is already occupied by `ADR-0025-vintage-release` — recorded in ADR-034 §0 + `ARCHITECTURE-REGISTRY.md`.
- **Held line:** the config-compiled reactive-graph SURPASS is preserved — M1/M2 feed it; the `metric:` catalog edges make lineage (G2) a read. No Cube/dbt/JSONata runtime (Law 5 + FF-AUTHOR-NO-QUERY + extractDeps totality).
| **G6** | **Built-but-buried: the whole query-builder + data-pipe (`DataModelingPanel`/`PipelineBuilder`/`TransformEditor`/`FieldWells`/`ShowMe`/Excel-ingest) is unreachable from a default (`author`) session — hidden behind the default-off localStorage `steward` role; owner cannot find/use it, reads as "unused"** | Tableau/PowerBI (Data pane always present) · Looker (discoverable Develop mode) · Retool/Metabase (visible data/resources) | Make "Data model" workspace a **first-class DISCOVERABLE destination** (rail entry visible, subtly steward-marked) — keep author's default Data surface = governed Metric Palette (metric-first vision intact, FF-AUTHOR-NO-QUERY preserved); reconsider self-toggled-localStorage as the gate | capability actually lives in the tool; "nothing un-buildable" | **✅ CLOSED — BUILT as AR-50 M5b (`bb7a74c`): Data model is a first-class always-visible rail destination, role-is-lens on CONTENT (author=read-only Data Dictionary, steward=modeler), navigation never flips the lens; `FF-DATA-REACHABLE` bites. Canonical design in `SPEC-data-semantic-worldclass-fable.md` (§4.5) + `ADR-034`.** |

> **Meta (2026-07-11):** G6 surfaced because the OWNER observed it, not the lead — a repeat of the react-not-observe failure. Standing correction: run a REACHABILITY audit (built ≠ surfaced ≠ discoverable ≠ used), not just works-live. See `.claude/agent-memory/orchestrator/feedback_built_but_buried_audit.md`.

## Owner one-way-doors (on return, with green evidence)
D-ROM-1 adopt object model (proceeding on the reversible R0–R2-expand) · **D-ROM-2 kpi-card contract** · D-ROM-3 hero-card contract · D-RRA-1 adopt rendering (proceeding on reversible V0–V2) · **D-RRA-2 V3 render-switch** · D-RRA-3 ChartEmitter (proceeding — cheap high-value).

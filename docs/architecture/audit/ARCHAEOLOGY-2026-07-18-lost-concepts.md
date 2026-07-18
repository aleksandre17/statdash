# ARCHAEOLOGY — 2026-07-18 — "Maybe we lost some good architecture in the archives?"

> READ-ONLY dig of `docs/archive/` (all) + `docs/architecture/examples/` (esp. `multi-store-platform.md`),
> cross-referenced against live canon (CLAUDE.md laws · ARCHITECTURE-REGISTRY · ADR-001/010/034/040/041 ·
> SPEC-query-pipeline-data-home · CAPABILITY-INJECTION-BACKLOG · `packages/core/src/data/` + `packages/plugins/datasources/`).
> Author: architect. Verdicts are evidence-cited; nothing here modifies the registry or backlog — revival rows are PROPOSALS for the lead.

---

## Executive summary (read this first)

Good news: **almost nothing good was lost.** Both shapes you remember are alive.
Your **href/HttpDataStore** idea shipped — better than the original: it is now the `href`
store kind (`packages/plugins/datasources/href-registrations.ts`), with format parsers,
auth, and a security allowlist, behind the same one DataStore port as `static` and `stats`.
Your **tree-field** derive op survives **verbatim** in the engine (`core/core/types.ts`,
`evalNodeDerive.ts`), and the hierarchy idea behind it grew into the governed
dimension-hierarchy drill (ADR-034 S4, `drill.ts`, FF-HIERARCHY-DRILL).
What was deliberately dropped (per-node `href`, theme.shells, the effects subsystem,
hierarchy-as-a-dataset) was dropped for reasons written in ADRs — do not re-buy those.
**Three fragments genuinely worth reviving:** (1) remote **self-describing structure**
for external SDMX sources (the Tier-2/3 envelope's good half → fold into AR-51);
(2) **one hierarchy grammar** — point tree-field lookups at the governed codelist;
(3) the **extract/freeze** door → fold into the already-built-but-unwired AR-48 delivery port.

---

## 1. The owner's two quoted shapes — first-class verdicts

### Shape 1 — DataSpec carrying its own source (`href` + `transform:'fromSDMX'`)

Origin: `docs/archive/architecture-superseded/10-agreements.md` §C-3/C-4 ("Phase 2 Data Path — `type:'url'` replaces named stores"; `HttpDataStore`, `TRANSFORM_MAP`), elaborated in `docs/architecture/examples/multi-store-platform.md` + `subsystems/25-datasource-system.md`.

**Verdict: the CAPABILITY is ABSORBED; the FORM was RIGHTLY DISCARDED; one sub-concept remains deferred/lost (see revival #1).**

| Aspect of the remembered shape | Verdict | Evidence |
|---|---|---|
| Remote-URL data source, no provisioning step | **ABSORBED** — `kind:'href'` store: fetch → format-parse → `ExternalStore` through the ONE DataStore port | `packages/plugins/datasources/href-registrations.ts` (D-HREF door opened); `static-registrations.ts`; ADR-001 §4 "three kinds behind one port" |
| `transform:'fromSDMX'` as a declared string (JSON-safe, resolved at runtime) | **ABSORBED, renamed** — the format-parser registry (`registerHrefFormatParser`, ships `json`/`csv`; an SDMX format = one registration). `fromSDMX` stays core's single adapter boundary (Law 5) | `href-registrations.ts` header §registries |
| `href` ON the DataSpec (per-node/per-spec source) | **RIGHTLY DISCARDED** — a second "which data" mechanism beside `storeKey` = fragmentation. Source-mode is a property of the *named store* (manifest tier), never the node. Grafana/Retool/Superset all agree | ADR-001 rejected-alt 2; ADR-010 rejected-alt 1; `resolveStore` CSS-cascade is mode-blind |
| Auth per source | **ABSORBED (minimal)** — auth-strategy registry (`none`/`bearer`/`header`), pure-data descriptor, deliberately not a framework | `href-registrations.ts` (Law 2 note) |
| `ApiResponse` Tier-2/3 envelope + `structureUrl` (source self-describes its classifiers) | **PARTIALLY ABSORBED** — the *concept* (a source self-describes its structure) lives as AR-51's self-describing `CanonicalDsd` at Floor 1; the *render-time* delivery (structureUrl fetch / structure-in-response) is unbuilt behind the named D1 door. **This is the one genuinely valuable un-shipped fragment** → Revival #1 | ADR-010 §1 pillar 4 ("the genuinely clever part") + D1; SPEC-query-pipeline-data-home §2 (four floors); STUDY-authoring-canon (AR-51 parked, re-opens after W5) |

Bottom line: you did not lose href — the archive's three parallel data paths were **unified into one port with N kinds**, which the archived `RESEARCH-data-binding-architecture.md` itself verifies as shipped ("nothing was lost; the binding model was unified and extended"). Beyond the original vision, two things the old system never had now exist: **metric names its store** (`MetricDef.dataSource`, Cube pattern) and a **declarative cross-store `blend` step** (`core/data/transform/types.ts:299-323`).

### Shape 2 — `tree-field` hierarchical derive (`storeId:'accounts'`, `indicator:'ACCOUNT_TREE'`)

Origin: `docs/archive/SKELETON.md:115` and `architecture-superseded/04-render-pipeline.md:331` (DataLookupOp).

**Verdict: the OP is ABSORBED VERBATIM; the hierarchy CANON was upgraded past it; the "hierarchy-as-a-queried-dataset" half was RIGHTLY DISCARDED; a convergence remnant is open (Revival #2).**

| Aspect | Verdict | Evidence |
|---|---|---|
| `{op:'tree-field', data:DataSpec, ref, field, fallback}` derive op | **ABSORBED verbatim** — the exact type lives in `packages/core/src/core/types.ts:12`, evaluated by `evalNodeDerive.ts` (data-lookup via `interpretSpec`); plus a filter-side `tree-field` in `config/filter-derive.ts:60`. Alive and used (geostat: 3 `vars`, 7 `derive` — per `docs/audit/effect-variable-architecture-drift.md`) | code cited |
| Hierarchical dimensions as a first-class statistical capability | **ABSORBED — upgraded**: governed `DimensionHierarchy` + grain-aware, additivity-respecting drill (`core/data/drill.ts`, `evalMetricDrill`, `FF-HIERARCHY-DRILL`, ADR-034 S4); hierarchy REIFIED from codelist `parent` edges (`codelist.ts` — `childrenOf`/`membersAtDepth`); SDMX HierarchicalCodelist is the SSOT (Law 5, whole standard) | `drill.fitness.test.ts` (5 invariant groups incl. Law-1 second-dim-pair proof) |
| Hierarchy shipped AS a fact dataset (`indicator:'ACCOUNT_TREE'` queried from a store) | **RIGHTLY DISCARDED** — hierarchy belongs to the *structure* (codelist), not to a *fact query*. The SDMX canon and every reference platform (LookML `drill_fields`, Power BI hierarchies, Cube hierarchies) put the tree in the model, and today's codelist-edge SSOT does exactly that | `codelist.ts:93-151`; ADR-034 |
| The remnant that did NOT survive cleanly | **Three hierarchy-lookup surfaces coexist**: (a) codelist parent-edge reification (governed), (b) `evalNodeDerive` tree-field over a DataSpec (its own data), (c) `filter-derive` tree-field over an inline `CascadeNode[]` tree. (b)+(c) carry hierarchies OUTSIDE the governed codelist — a one-grammar (Law-10-spirit) convergence candidate, already half-named by `subsystems/22-derive-effects.md` ("map/tree replace DataLookupOp") | → Revival #2 |

---

## 2. Full inventory — every archive concept, classified

Verdicts: **A** = ABSORBED · **PA** = PARTIALLY ABSORBED · **LR** = LOST & WORTH REVIVING · **RD** = RIGHTLY DISCARDED.

| # | Concept / idea | Origin doc | Verdict | Evidence — where it lives / why it died | Where it folds |
|---|---|---|---|---|---|
| 1 | href/HttpDataStore per-spec remote source (Shape 1) | `10-agreements.md` C-3/C-4 | **A** (capability) / **RD** (per-node form) | §1 above | done (D-HREF opened) |
| 2 | `transform:'fromSDMX'` declared-string transform | `10-agreements.md` C-3 | **A** | format-parser registry; `fromSDMX` stays the adapter boundary | done |
| 3 | Tier-1/2/3 `ApiResponse` structure envelope (`structureUrl`, structure-in-response) | `examples/multi-store-platform.md`; `25-datasource-system.md` | **PA → LR** | Tier-1 equivalent live (build-time per-dim fetch; `params.classifiers`); Tier-2/3 remote self-description unbuilt (D1 door). Concept survives as AR-51 CanonicalDsd | **Revival #1** — AR-51 + W-P6 Floor 1 |
| 4 | `getMetadata` / `testConnection` Constructor authoring hooks | `multi-store-platform.md` | **A** | `registerStoreCapabilities` — built for `static` + `href` (M2 tests in `static-registrations.test.ts:130-142`) | done (ADR-010 M2) |
| 5 | Multi-store routing: `ctx.stores`, `storeId` cascade (C-2) | `10-agreements.md` C-2 | **A** | `buildStoreManifest` + `resolveStore` CSS-cascade + node `storeKey`; 3 seeded cubes | done (ADR-010, FF-MULTISTORE-ROUTES) |
| 6 | Data blending / cross-store node (`CrossStoreRenderer`) | `multi-store-platform.md` | **A** | declarative `blend` transform step, resolved in the ADAPTER layer, core stays single-store (`transform/types.ts:299-323`) — the Tableau/Grafana-Mixed steal landed in the right (model) tier | done (D3 opened correctly) |
| 7 | `tree-field`/`map-field` DataLookupOp (Shape 2) | `SKELETON.md:115`; `04-render-pipeline.md` | **A** (op) / **PA** (grammar unity) | §1 above | **Revival #2** |
| 8 | DataBundle triplet — facts / id-keyed classifiers / display overlay (D-1) | `10-agreements.md` D-1 | **A** | `codelist.ts` (Kimball surrogate ids + parent edges + display join); `ExternalStore` | done |
| 9 | `$cl` (structural) vs `$d` (display) dim refs (D-2) | `10-agreements.md` D-2 | **A** | `core/src/ref/ref.ts` + `ref.fitness.test.ts`; `resolveClassifierRef` consumer-facing only (engine reads classifier only) | done |
| 10 | `pipe` transform pipeline op surface — melt·aggregate·rollup·lookup·join… (D-3) | `10-agreements.md` D-3 | **A** | `core/data/transform/` (steps + op-schemas); being promoted further into the 7-verb pipeline spine | SPEC-query-pipeline W-P0–P6 |
| 11 | Mode-as-perspective-axis (the whole VISION v3 corpus) | `VISION-mode-as-perspective-axis.v3*.md` (5 docs) + `VISION-mode-as-view-axis.md` | **A** | Built: `perspectiveState: Record<param,id>`, `perspective-is/in/not` ops, 11 perspective fitness files, in-canvas switch (BE-3 verified), AR-22 BUILT. Even the synthesis's D-GUARD door is built (`perspective-available.fitness.test.ts`) | doors live in registry: AR-31 (lattice, needs vintage consumer), AR-32 (`_geoMode`) |
| 12 | D-FACET — axis `render:'switch'\|'facet'` (perspective small-multiples/trellis) | `VISION…v3-SYNTHESIS.md` §3.2 | **PA** | Door shaped (correctly located on the AXIS per Grammar of Graphics), not built; `repeat` node covers data-driven repetition only | **Revival #3** — with AR-31 |
| 13 | Effects subsystem (reactive filter mutation `{when,set}`) | archive-era engine (documented in `effect-variable-architecture-drift.md`) | **RD** | Retired `4ccd042` — zero consumers after P6; retirement-locked in `check-laws.sh`; rendering concern already migrated to `visibleWhen`/`perspective-is` | — |
| 14 | Three-data-paths research (LOCAL/HREF/STOREID) | `archive/RESEARCH-data-binding-architecture.md` | **A** | The doc's own verdict: promotion to "three KINDS behind ONE port" is *shipped in code*; archived as completed | done |
| 15 | ThemeConfig `theme.shells` dispatch (#4/#8/#9/#11/#14) | `10-agreements.md`; `03-theme-system.md`; `examples-deprecated/*` | **RD** | Superseded by `nodeRegistry`/`chromeRegistry` (archive README says so explicitly; deprecation banners in-doc) | — |
| 16 | SlotRegistry / SlotWrapper / `renderSlots()` / `buildNav()` derived nav | `10-agreements.md` #18, I-1 | **RD** | Removed for `renderNode` + declared nav — the declarative-over-derived call, validated by Grafana/Retool consensus | — |
| 17 | Layout-is-a-node + array-only children (#13/#16) | `10-agreements.md` | **A — superseded upward** | `nodes/layout/` slices; then ADR-041 Part grammar made containment ONE declared grammar (Law 10) | done |
| 18 | Shell-props ISP + engine-resolves-view + generic role toggle (S-1/S-2/S-3) | `10-agreements.md` | **A** | plugins slice anatomy; chart↔table as two `view.role` views of ONE section data (`plugins/CLAUDE.md`) | done |
| 19 | DeriveMap as ordered array (I-5) | `10-agreements.md` I-5 | **A** | `NodeDeriveMap` `Array<{key,expr}>`, earlier keys visible via `{$derived}` (`evalNodeDerive.ts`) | done |
| 20 | Next-priorities queue (error/empty states · skeletons · metadata badges · a11y) | `architecture-superseded/14-next-priorities.md` | **A** | Grown into LAW: honest-state Cell grammar (Law 11, FF-CANVAS-NEVER-LIES), Law 9 badges/WCAG | done |
| 21 | Track-A/B monorepo split, gen-1/gen-2 migration specs, refactor-plane docs | `01-monorepo-overview.md`; `migration-*/`; `SKELETON.md`; `overview.md`; `react.md` | **RD** (executed/superseded) | Archive README table: superseded by `docs/plan/` + `subsystems/` + as-built migration skill; the migrations RAN | — |
| 22 | kit-reorg (audit/target-design/merge-log) | `archive/kit-reorg/` | **A** (executed) | The `.claude` kit reorg happened; ops history, not product architecture | — |
| 23 | `*_CATALOGUE` static exports; `FilterBarSpec[]` in config | `10-agreements.md` D-1, C-5 | **RD** | Forbidden then, still forbidden — SSOT via `codesOf()`; config carries `Record<string,BarDef>` only | — |

---

## 3. Ranked revival list (backlog CANDIDATES — the lead registers, this doc proposes)

### R1 — Remote self-describing structure for external SDMX sources (the Tier-2/3 envelope's good half)
- **What:** when an `href`/external source is added, its classifiers/display/DSD are fetched FROM the source (SDMX `datastructure` endpoint / structure-in-response), not hand-declared — the `structureUrl` + Tier-2/3 idea from `multi-store-platform.md`, ADR-010's "genuinely clever part."
- **Anchor:** SDMX Registry structure endpoints (the standard exists precisely for this) · Grafana datasource `getMetadata` · Power BI composite models (external source self-describes schema on connect).
- **Fold-point:** **AR-51** (self-declaring `CanonicalDsd` adapter registry — parked, re-opens after W5) + **W-P6** Floor-1 raw-data home: an external SDMX endpoint becomes one more Floor-1 raw source whose DSD arrives via the adapter registry; the `href` builder's `getMetadata` capability is the seam already in place. This unifies the D1/D-HREF door with AR-51 instead of building a second envelope.
- **What it gives the owner:** onboard Eurostat/UNSD/another office's SDMX endpoint with **zero hand-declared structure** — the original multi-tenant vision of `25-datasource-system.md`, now landing at the governed Floor 1 instead of the render path.
- **Effort:** M–L (crosses `apps/api` + `contracts` + `plugins/datasources`). **Trigger discipline:** first real external source (D1's named trigger) — with AR-51 re-opening after W5, propose them as ONE work item.

### R2 — One hierarchy grammar: tree-field reifies from the governed codelist
- **What:** converge the three hierarchy-lookup surfaces (§1 Shape 2): the `tree-field`/`map-field` derive ops (and filter-derive's inline `tree`) take their tree from the **governed codelist parent edges** (`childrenOf`/`membersAtDepth`) instead of a self-carried DataSpec/inline tree. Keep the op's authoring shape (key/ref/field/fallback — it is good sugar); rebase its data source.
- **Anchor:** SDMX HierarchicalCodelist (hierarchy is structure, not facts) · LookML `drill_fields` · Power BI & Cube hierarchies (model-owned, first-class).
- **Fold-point:** ADR-034 S4 seam (`core/data/drill.ts` + `codelist.ts` reification) + the `22-derive-effects.md` map/tree cleanup already in canon docs. Fitness: a derive hierarchy lookup and the drill enumerate the SAME tree (one SSOT).
- **What it gives the owner:** parent/breadcrumb/sector labels that are governed, i18n-correct, and never drift from the drill; kills the need for ACCOUNT_TREE-style hierarchy datasets forever.
- **Effort:** S–M (core + a small filter-derive migration; Strangler — old form desugars).

### R3 — Perspective facet (D-FACET): render an axis as small multiples
- **What:** `PerspectiveAxis` gains `render:'switch'|'facet'` — a faceted axis renders ALL perspectives simultaneously (trellis), per the v3-SYNTHESIS's Grammar-of-Graphics relocation (facet is an AXIS operator, not a scope key).
- **Anchor:** Vega-Lite `facet` / Wilkinson GoG · Power BI small multiples · Tableau trellis. Statistics-native: annual-vs-quarterly side-by-side, region small-multiples in publications.
- **Fold-point:** AR-31 Perspective Lattice (VISION row) — facet is the lattice's cheapest first payoff; the seam location is already decided in the synthesis, so the build is additive on `page.perspectives`.
- **What it gives the owner:** publication-grade comparison views (the ONS/Eurostat bulletin idiom) from a one-flag config change.
- **Effort:** M. **Gate:** keep the synthesis's own YAGNI rule — build with the first real trellis ask (or with AR-31's vintage consumer), not before.

### R4 — Extract/freeze (D-EXTRACT): snapshot a live query into a static source
- **What:** freeze a `stats` query's rows into a `static`-kind source (ADR-001's D-EXTRACT door) — a portable, offline, embeddable dashboard artifact.
- **Anchor:** Tableau Extract · Power BI Import mode · Superset CSV-upload→dataset (static promoted to named).
- **Fold-point:** **AR-48 delivery port** — the export/embed/snapshot backend is BUILT but UNWIRED (`plugins/CLAUDE.md`); an extract is exactly the data half of a snapshot. One door, two archive threads close together.
- **What it gives the owner:** shareable/embedded pages that render with zero backend; demo and archival ("as published") artifacts — which also serves Law 9's permalink/integrity story.
- **Effort:** S–M once AR-48 wiring happens; propose as an AR-48 sub-item, not a new surface.

---

## 4. Rightly discarded — do NOT re-buy (the protection list)

1. **Per-node `href`/`data:{values|url|name}` union** — rejected twice with reasons (ADR-001 alt-2, ADR-010 alt-1): a second "which data" mechanism fragments against `storeKey`; source-mode belongs at the manifest/store tier.
2. **`theme.shells` / ThemeConfig dispatch, SlotRegistry/SlotWrapper, derived `buildNav()`** — superseded by registries + declared nav; the archive README marks the whole family non-authoritative.
3. **The effects subsystem** (`{when,set}` filter mutation) — retired with a lock (`check-laws.sh` grep guards); its rendering concern lives better in `visibleWhen`/`perspective-is`. Re-introducing it would resurrect the silent no-op footgun.
4. **Hierarchy as a queried fact dataset** (`ACCOUNT_TREE`) — hierarchy is structure (codelist), not data; the drill canon (ADR-034 S4) is strictly superior.
5. **The full `ApiResponse` envelope rebuilt at render time** — R1 above revives only its *concept* (self-description) at Floor 1/AR-51; rebuilding the render-time envelope for the internal backend remains speculative generality (ADR-010 D1 reasoning stands).
6. **XState actors / imperative orchestration for perspectives** — explicitly refused in the v3-SYNTHESIS (§3.3); would break `view=f(state)` purity (FF-PERSPECTIVE-IS-PURE-FUNCTION).

---

## 5. Method note

Dig sites read: `docs/archive/` (README index, `10-agreements.md` full, SKELETON/04-render-pipeline via targeted grep, VISION-v3-SYNTHESIS full, RESEARCH-data-binding full, 14-next-priorities) · `docs/architecture/examples/multi-store-platform.md` full. Absorption judged against: ADR-001 §1–8, ADR-010 full, ADR-034 S4 artifacts (`drill.ts`/`codelist.ts` + fitness), `plugins/datasources/{static,href,stats}-registrations`, `core/core/{types,evalNodeDerive}`, `core/config/filter-derive`, `core/data/transform/types` (blend), `ref/ref.ts`, ARCHITECTURE-REGISTRY (AR-22/31/32/48/51, BE-3), SPEC-query-pipeline-data-home (four floors, W-P6), CAPABILITY-INJECTION-BACKLOG, `effect-variable-architecture-drift.md`. Product code untouched; registry/backlog untouched.

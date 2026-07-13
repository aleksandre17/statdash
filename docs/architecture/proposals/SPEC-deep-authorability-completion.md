# SPEC — Deep Authorability, COMPLETION (reform 0066 P3: universal contract editing)

> **Status:** decision-grade study (READ-ONLY; no code). Author: platform-architect, 2026-07-13.
> **Extends (never forks):** ADR-038 (Bounded Element Law) · ADR-041 (Part Grammar + Part Port, Ph.1–6 landed) · ADR-039 (Bounded-Element Selection) · SPEC-studio-ia-canonical (S1–S6 dock) · SPEC-worldclass-authoring-ui (dock section registry, Summary Corollary) · SPEC-deep-authorability (the CONSTITUENT-axis half) · DESIGN-framework-grade-style-system (the style-facet design) · SPEC-authoring-reconception-M3-pipeline (the DataSpec editors).
> **Governing laws:** CLAUDE.md Law 1 (no privileged types), Law 2 (declarative, no per-type special-case), Law 8 (OCP — new capability = new declaration).

---

## 0. TL;DR — the one finding that reframes all four gaps

**Every element carries TWO orthogonal declared-contract surfaces, and the platform generically projects only ONE of them.**

1. **The CONSTITUENT axis** — *"what PARTS does this element contain?"* Declared as `PartField`s (`slot`/`value`/`sourced`), enumerated through the ONE Part port (`enumerateParts`/`writePart`), projected into the dock by `element.schema` (whole node ∪ band item). **This axis is COMPLETE** — ADR-041 Phases 1–6 landed; wrapper/leaf is a derived predicate; chrome, filters, kpi items all fall out as three residence adapters of one mechanism. This is the axis the prior `SPEC-deep-authorability.md` (D7/itemSchema) targeted.

2. **The FACET axis** — *"what universal CAPABILITIES does this element expose — its STYLE, its DATA pipeline, its EVENTS/interactions, its layout/visibility?"* These are declared today as **TypeScript STRUCTURE on the runtime config type** (`NodeBase.view.styles: NodeStyles`, `NodeBase.data: DataSpec`, `NodeBase.on: NodeEventHandler[]`, `NodeBase.transforms/vars/dataLinks`, `ChromeSlotConfig.variant/region/order`) — **but NOT as a projectable AUTHORING contract.** The generic dock has a declaration to recurse over for per-type props (`meta.schema` → PropFields → `FieldControlRegistry`) but **NO declaration to recurse over for the universal facets.** So the facets fall out of the inspector: they are either hand-wired one-offs (`element.data` = metric-bind only; `element.visibility`) or entirely absent (style, events, data-pipeline, chrome variant).

**All four felt gaps are ONE root cause:** the generic-projection ideology (ADR-038) was applied to the constituent axis and never to the facet axis. **The completion = give the facet axis the same treatment the part axis got:** declare each universal facet ONCE as an authorable contract, project it generically as a dock section via the EXISTING `dockSectionRegistry` mechanism — no per-type special-case, mechanism unchanged per new facet (OCP). This is ADR-041's unbuilt sibling: **ROOT-4 (Facet) elevated from a render-side opt-in to a projectable authoring contract.**

The homoiconic ideal (one declaration → every surface) is only half-built. It is complete when **Parts ⊥ Facets** are both generic, both declared, both projected.

---

## 1. Current-state diagnosis — the four gaps, each classified

Classification legend: **[MISSING CONTRACT]** = no declared authoring contract to project · **[BURIED SURFACE]** = an editor exists but is unreachable/role-gated · **[NON-GENERIC]** = projected by a per-type hand-wire, not a declaration.

### 1.1 Gap 1 — Chrome authoring not clean/canonical/visible — **[MISSING CONTRACT] + [structural-facet gap]**

Post-S6, chrome IS canonically a `sourced` part of the synthetic `site-frame` element (`SITE_FRAME_META.band = { source:'site-chrome' }`), enumerated by the `chromeParts` adapter, selectable on canvas, projected through the SAME band-item path as a filter control (`useCanvasController.selectedBand` → `element.schema`). **The part MECHANISM is correct and canonical.** The gap is the CONTRACT it projects:

- `chromeParts.enumerateParts` sets `contract = chromeRegistry.getMeta(slot, key).schema` and `subject = chrome[slot]?.config ?? {}` (`apps/panel/src/canvas/bandSource.ts:204–231`). It projects **only the per-region `config` params.** Writes go through `updateChromeConfig(slot, field, value)` into `config` only.
- **`variant` is READ to resolve the schema (`key = chrome[slot]?.variant ?? 'default'`) but is NOT authorable** — you cannot switch a chrome region's variant from the panel. Likewise `region` and `order` (the `ChromeSlotConfig` structural facets) are unreachable. These are the chrome analogue of `NodeBase.view.styles`/`on` — structural facets outside the projected `schema`.
- **The site-frame element has NO whole-element inspector.** `owner.selectable = false` for the site-frame; the item "Back" button DESELECTS (`useCanvasController.ts:105–107`, `builtins.tsx:105–107`). So the chrome COMPOSITION — *which* regions are active, add/remove a region, per-region variant/placement — has no authoring home. `enumerateParts` walks `chromeRegistry.list()` (every registered schema-bearing slot), not the authored set, so absence/presence is never authored either.

**Root:** the part mechanism is canonical, but (a) chrome's structural facets (variant/region/order) are not declared as a projectable contract, and (b) the owning `site-frame` element has no facet-inspector for its own composition. Same root as Gaps 2/4 — a structural facet that lives on the config type but not in a declared authoring contract.

### 1.2 Gap 2 — self-declaring elements lack FULL functionality-management — **[MISSING CONTRACT], the umbrella gap**

The element-context dock projects exactly three sections (`inspector/sections/builtins.tsx`): `element.schema` (the `meta.schema` PropSchema + band items), `element.data` (metric-bind ONLY, §1.3), `element.visibility` (`view.visibleWhen`). But `NodeBase` (`packages/react/src/engine/types/node.ts:86–128`) declares, on EVERY node, a rich universal facet set the dock never touches:

| Facet on the config type | Declared at | Projected in dock? |
|---|---|---|
| `view.styles: NodeStyles` | `node.ts:53` | ❌ (Gap 4) |
| `data: DataSpec` | `node.ts:90` | ⚠️ metric-bind only (Gap 3) |
| `on: NodeEventHandler[]` | `node.ts:127` | ❌ (no events section) |
| `transforms / fieldConfig / vars / dataLinks` | `node.ts:114–121` | ❌ |
| `view.visibleWhen` | `node.ts:42` | ✅ (`element.visibility`) |
| `variants` | `node.ts:102` | ✅ (folded into schema via `variantPropSchema`) |
| `visibleToRoles` | `node.ts:111` | ❌ |

The facets that ARE reachable (`visibleWhen`, `variants`) got there by a **hand-wired section** or by being **folded into the PropSchema**. There is no declared FACET contract that says "this element exposes a Style facet / an Events facet / a Data-pipeline facet" the way `meta.schema` says "this element exposes these props." So the generic dock — which faithfully projects everything it has a declaration for — has nothing to render for the rest.

**Root:** the element's second contract surface (universal facets) is TypeScript structure, not a projectable declaration. This is the parent gap; Gaps 1/3/4 are its instances.

### 1.3 Gap 3 — data pipeline per element WITHOUT a metric — **[BURIED SURFACE] + [NON-GENERIC]**

- `element.data` offers ONLY the governed `MetricPalette` bind, gated by `selectedBindable = isMetricBindable(schema)` (`builtins.tsx:135–156`, `useCanvasController.ts:85`). Bind-by-noun for metric-declaring elements — nothing else.
- The full pipeline editors **exist and are first-class**: `DataSpecEditor` → `QuerySpecEditor` → `PipelineBuilder` (`apps/panel/src/features/data-layer/`), `CalcBuilder`/`MetricEditor` (`apps/panel/src/studio/model/`). But they are mounted ONLY in `DataModelingPanel` — **Model mode, the Steward "define" workspace behind the role lens** (`DataModelingPanel.tsx:30–36`; `FF-AUTHOR-NO-QUERY` deliberately keeps the author's Data surface metric-only).
- `DataSpec` is NOT registered in `FieldControlRegistry` — it resolves to `summarizeDataSpec` (a SummaryCard **glance**, not an editor; `summarize.ts:154`, `FieldControlRegistry.ts:133–135`). So even where a node declares `data: DataSpec`, the dock shows a read-only card.

**Root:** the editor is buried (role-gated to Steward) AND not projected as a generic Data-pipeline facet on any DataSpec-declaring element. The owner wants ANY data-bound element (not just a metric) to get its pipeline authored in place. **Note the policy seam:** the FF-AUTHOR-NO-QUERY honesty boundary (author binds governed metrics; steward defines raw queries) is a *deliberate* governance decision — the fix must project the pipeline as a facet WITHOUT silently dissolving that boundary (see §4, one-way flag).

### 1.4 Gap 4 — per-element STYLE authoring is missing — **[MISSING CONTRACT], genuinely unbuilt**

- The render side is READY: `view.styles: NodeStyles` on the config (`node.ts:53`), `resolveStyle`/`applyNodeStyles` cascade + `@layer` tokens + `[data-tenant]` rebind (`packages/styles`). A style authored as data renders correctly today.
- But there is **no declared style CONTRACT** to project: `styleKeys` (`HEADER.logo`, `SECTION.body`) are a PRIVATE BEM SSOT, not a public authorable `parts` manifest. There is **no `StyleField` control** (grep: zero hits in `apps/panel`). There is **no `element.style` dock section**. `NodeStyles` is authorable today only as a raw-JSON blob — i.e. not at all, under FF-NO-RAW-JSON-DEFAULT.

**Root:** the contract is unbuilt on BOTH ends — no declared style contract to project, no projection to render it. This is the cleanest, most-visible gap and the natural first slice (§5). The design already exists: `DESIGN-framework-grade-style-system.md` (token-constrained + part-aware `NodeStyles`, `StyleField` = property-groups × breakpoint-tabs × token-pickers, driven by the already-declared-but-unconsumed `enum-ref source:'tokens'`).

---

## 2. The canonical model — the Facet-authoring axis

### 2.1 The principle (ADR-038 applied to the facet axis)

> An element's contextual inspector = the union of GENERIC PROJECTIONS over BOTH its declared contract surfaces: **(A) its per-type PropSchema** (constituent props + parts) **and (B) the universal FACETS it opts into** (STYLE · DATA · EVENTS · VISIBILITY · CHROME-composition). No facet is hand-wired per type; each is one declaration, projected by one mechanism.

The inspector for any selection is:

```
inspect(selection) = renderSchemaSection(selection)                    // A — EXISTS (element.schema)
                   ⊕ ⋃ { project(facet) | facet ∈ facetRegistry,       // B — the completion
                          facet.appliesWhen(selection) }
```

### 2.2 The seam — extend `dockSectionRegistry`, add a `FacetDescriptor` declaration

The mechanism already exists: `dockSectionRegistry` (`inspector/sections/dockSection.ts`) — sections are declared data (`{ id, appliesTo, render, order }`), RightDock projects generically, "a new section = one `register()` call; RightDock never changes (OCP)." **Today the facet sections (`element.data`, `element.visibility`) are hand-authored `DockSection`s.** Canonicalize them as projections of a declared facet:

```ts
// packages/react/src/engine — a DECLARED, authorable universal facet (ROOT-4 elevated)
interface FacetDescriptor {
  id:          string                              // 'style' | 'data' | 'events' | 'visibility' | 'chrome'
  appliesWhen: (meta: ObjectMeta) => boolean       // opt-in predicate over the DECLARATION (no type read)
  contract:    (meta: ObjectMeta) => FacetContract // the authorable shape to project (schema | control ref)
  readPath:    string                              // where the facet lives on the config ('view.styles','data','on')
  // write is residence-routed like the Part port: node-props | filter-schema | site-chrome
}
```

- `appliesWhen` reads only the DECLARATION (a cap or a declared field), never a concrete type — Law 1 / `FF-NO-EXTERNAL-SPECIAL-CASE`. E.g. `data` facet applies iff `meta` declares a `DataSpec` field or `caps:['data']`; `events` iff `caps:['filterable']` or a data node; `style` iff style-capable (see §2.4); `chrome` iff `isSiteFrame(meta)`.
- The dock derives one section per applicable facet: `registerBuiltinDockSections` iterates `facetRegistry.list()` and registers a `DockSection` whose `render` projects `facet.contract` through the appropriate control — instead of hand-writing `element.data`/`element.visibility`. **`element.data`/`element.visibility` become facet projections; nothing about RightDock changes.**
- Writes route exactly like the Part port's residence-tagged mutations (`useCanvasController.patchItemProp` already does `node-props | filter-schema | site-chrome`). The facet write path reuses that spine.

**Thin-base discipline (feedback: strict-SOLID-per-element).** The facet CONTRACT lives ONCE in the `facetRegistry` (platform-level, declared once). An element does NOT carry each facet's authoring form on its schema — it merely declares an **opt-in signal** (a `cap` token, or the presence of a declared field). No shared base bloat; no per-element facet form. This is the maximal-orthogonality law: facets are independent axes authored once, opted into by declaration.

### 2.3 The canonical inspector — the six sections, all projections

| Section | Facet contract source | Control | Status |
|---|---|---|---|
| **Content / params** | `meta.schema` (PropSchema) + parts (band items) | `Inspector` + `FieldControlRegistry` | ✅ EXISTS (`element.schema`) |
| **STYLE** | `view.styles: NodeStyles` + declared `parts` manifest + `TOKENS_CATALOG` | **`StyleField`** (new PropFieldType `'style'`) | ❌ build (Gap 4) |
| **DATA (pipe/calc, metric-optional)** | `data: DataSpec` (declared field) | project existing `DataSpecEditor`/`QuerySpecEditor`/`CalcBuilder` | ⚠️ ungate + project (Gap 3) |
| **EVENTS / interactions** | `on: NodeEventHandler[]` + declared trigger vocabulary | **`EventsField`** (new; over the `NodeAction` union) | ❌ build (Gap 2) |
| **VISIBILITY** | `view.visibleWhen` (+ `visibleToRoles`) | `VisibilitySection` | ✅ EXISTS (+ add roles) |
| **CHROME composition** (site-frame only) | `SITE_FRAME_META.band` + `ChromeSlotConfig` variant/region/order | site-frame whole-element inspector | ❌ build (Gap 1) |

### 2.4 What needs a DECLARED contract ADDED vs just WIRED

- **STYLE — add the declared contract.** Promote `styleKeys` (private BEM) to a PUBLIC `parts` manifest in `meta` (`DESIGN-framework-grade-style-system` S2), emit `data-part`, resolve `view.parts.<p>: NodeStyles`. The style-opt-in signal = "declares a `parts` manifest OR is a leaf renderable" (default: all renderable elements are style-capable at the root part). MVP (S0/S1 of that design) needs only whole-element `view.styles` — no `parts` yet. Also **activate the already-declared-but-unconsumed `enum-ref source:'tokens'`** (`prop-schema.ts:66`) against `TOKENS_CATALOG`.
- **EVENTS — surface an existing declared contract.** `on: NodeEventHandler[]` and the `NodeAction` discriminated union (`filter`/`highlight`/`drill`, `node-events.ts`) ALREADY exist and are Constructor-ready (JSON, no functions). What is missing is (a) the **element declaring which TRIGGERS it supports** (a data node supports `row:click`/`selection:change`; a chart supports `interval:brush`) — add a `triggers?: NodeEventTrigger[]` facet declaration, or derive from `caps`; and (b) the **`EventsField` control** projecting the union. No new runtime — the `useNodeInteractions` interpreter already reads `on[]`.
- **DATA — wire + ungate (no new contract).** The DataSpec contract and its editors exist. Register a `DataSpec` control in `FieldControlRegistry` (or a `data` facet section) that mounts `QuerySpecEditor`/`CalcBuilder` for any DataSpec-declaring element. Ungate the AUTHORING reach from the Steward role — but preserve the honesty boundary as a **lens**, not a wall (§4 flag).
- **CHROME — add the structural-facet contract + a site-frame inspector.** Extend `chromeParts.contract` to include `variant`/`region`/`order` (as declared facet fields alongside the config schema), and give the `site-frame` a whole-element inspector (its `band` of regions = its composition, add/remove/enable). This is the chrome instance of the general facet fix.

---

## 3. Ideology verdict — does the generic-projection ideology hold?

**YES — the ideology is correct and canonical, but it was applied to only ONE of an element's two contract axes. The completion is to apply it to the second.**

- ADR-038 says: every authoring surface is a generic projection of the element's declaration; never special-case a concrete type. **This is right and stays.**
- ADR-041 realized it for the CONSTITUENT axis (Parts). Fully landed, fully generic — chrome/filters/kpi items are three residence adapters of one port. **The proof it works is that S6 chrome fell out with zero engine change.**
- The FACET axis is ADR-041's unbuilt sibling. Today the facets live as TypeScript structure on the config type — a declaration the RENDERER reads but the AUTHORING surface cannot project, because there is no facet-authoring contract and no facet-projection mechanism. **That is the exact shape of the pre-ADR-041 constituent axis** (containment was real at runtime but smeared across signals the authoring surface couldn't recurse over).

**The improvement that takes it to its best form:** name the two axes explicitly and make BOTH generic and declared:

> **Two orthogonal projection axes.** `inspect(element) = projectParts(element) ⊕ projectFacets(element)`. Parts answer *"what does it CONTAIN"* (Part port, ADR-041 — done). Facets answer *"what CAPABILITIES does it expose"* (Facet registry — this SPEC). Both project from a declaration; neither special-cases a type. A new element costs zero authoring code on either axis; a new FACET costs one declaration, the dock unchanged (OCP). A new element's full authorability — content, style, data, interactions, chrome — FALLS OUT, which is the homoiconic ideal ADR-038 promised.

This does NOT contradict the "thin base + per-element schema" law: the facet CONTRACT is declared once at the platform (not on each element), and an element opts in by a cap/field — the facet axis is a shared, orthogonal capability spine, not per-element bloat.

**One honest caveat the ideology must respect (not a rejection — a refinement):** a generic projection is only as good as the facet's declared contract. `DataSpec` and `NodeStyles` are RICH structured values; their facet controls (`QuerySpecEditor`, `StyleField`) are non-trivial editors, not auto-generated from a flat PropSchema. That is fine and canonical — the `FieldControlRegistry` is explicitly the seam for registering a rich control per type (Strategy pattern). The genericity is in the DISPATCH (one mechanism resolves which control), not in pretending a pipeline builder writes itself. This is exactly how Builder.io/Plasmic (custom input components), Grafana (`fieldConfig` editors), and Framer (property controls) do it.

**Benchmark confirmation (the reference class does exactly this).** Webflow: select any element → one contextual right inspector with tabbed facets (Style panel · Settings · Interactions). Framer: property controls + Style + Variants per component. Builder.io/Plasmic: Inputs + Style + Data-binding tabs. Figma: contextual properties + styles. **Every reference platform's "select any element → author its ENTIRE contract" is a fixed set of facet PROJECTIONS (style/settings/data/interactions), each opted into by the element's declaration — not a per-type inspector.** Our facet registry is the canonical form of that, with the added moat that our facets are declared data (Constructor-serializable), not code.

---

## 4. One-way doors & owner decisions

None are hard one-way doors; all slices are additive/reversible. Flags:

- **D-DA1 — the DATA honesty boundary (Gap 3).** Projecting the pipeline on any data-bound element crosses `FF-AUTHOR-NO-QUERY` (author binds governed metrics; steward defines raw queries). **Recommendation:** keep the boundary as a **LENS, not a wall** — the author authors a per-element `transform`/derive pipeline over an ALREADY-GOVERNED source (the existing `transforms[]`/`vars` facet, which is author-safe), while raw-SOURCE definition (a new external query/upload) stays Steward-gated. This gives "data pipeline per element without a metric" (transform/derive/filter on any bound element) WITHOUT dissolving the governance that keeps published numbers trustworthy (Law 9 data-integrity). Owner picks: (a) full ungate, (b) lens [rec], (c) status quo.
- **D-ST1 — token constraint enforcement.** `StyleField` pickers offer token-constrained values (bounded scale + `[13px]` escape). Enforce as a WARN fitness (`FF-TOKEN-CONSTRAINED`), not a hard block, in the first slice. Rec: warn.
- **D-CH1 — site-frame whole-element inspector.** Give the synthetic site-frame a selectable whole-element surface (its chrome composition) vs. keep it part-only. Rec: yes — it is the element's own facet home; without it chrome composition is unauthorable.
- **D-EV1 — events trigger declaration.** Declare supported triggers per element (`triggers?: NodeEventTrigger[]`) vs. derive from `caps`. Rec: derive from `caps` first (zero new field), add explicit `triggers` only when a real element needs a non-derivable set (YAGNI).

---

## 5. Gradual execution plan (Strangler-Fig, felt-impact first)

Each slice ships independently, is fitness-gated, and reversible. The FIRST slice establishes the facet-section pattern; each subsequent facet is "one declaration, mechanism unchanged" — the OCP proof.

### Slice 1 (RECOMMENDED FIRST) — per-element **StyleField** (Gap 4) + the facet-section seam

**Why first:** genuinely unbuilt (biggest FELT gap), visible on EVERY element, no policy/role entanglement (unlike Data), design already converged (`DESIGN-framework-grade-style-system` S0/S1). It doubles as the seam that Data/Events reuse.

- Introduce the `FacetDescriptor` + derive dock sections from a `facetRegistry` (the mechanism), with STYLE as the first declared facet. Refactor `element.visibility`/`element.data` to be facet projections (no behaviour change — Strangler expand).
- Build `StyleField` (new `PropFieldType 'style'` → register in `FieldControlRegistry`): property-groups × responsive-breakpoint-tabs × token-pickers, driven by activating `enum-ref source:'tokens'` against `TOKENS_CATALOG`. MVP = whole-element `view.styles` on section/panel/chart (no `parts` yet — no empty cathedral).
- Serialized form stays `var(--*)` (zero migration); round-trip via `cssVar → token key` reverse-lookup.
- **Fitness:** `FF-NO-RAW-CLASS-IN-CONFIG`, `FF-STYLE-ROUNDTRIP`, `FF-TOKEN-CONSTRAINED` (warn), `FF-FACET-SECTION-IS-PROJECTION` (dock facet sections derive from `facetRegistry`, name no concrete type).
- Apps-only + additive `PropFieldType`. Reversible.

### Slice 2 — the **DATA** facet: project the pipeline on any bound element (Gap 3)

- Register a `data` facet: `appliesWhen` = declares a `DataSpec` field / `caps:['data']`. Its section mounts the EXISTING `DataSpecEditor`/`QuerySpecEditor` (transform/derive) — the author-safe `transforms[]`/`vars` pipeline over a governed source — with the metric-bind palette retained as the bind entry (unify presentation).
- Per D-DA1: raw-source definition stays Steward-gated (the lens). Add a lineage summary card at point-of-use (`SPEC-worldclass-authoring-ui` Data-Flow Spine).
- **Fitness:** `FF-DATA-FACET-ON-DECLARER` (every DataSpec-declaring element gets the Data section), `FF-GOVERNANCE-LENS-PRESERVED` (raw-source define stays role-gated).
- Owner gate D-DA1 first.

### Slice 3 — the **EVENTS** facet (Gap 2 completion)

- Register an `events` facet: `appliesWhen` = `caps:['filterable']` or data node. Build `EventsField` projecting the `NodeEventHandler[]` / `NodeAction` union (`filter`/`highlight`/`drill`) — trigger picker × action editor, all over the EXISTING declared grammar (no runtime change; `useNodeInteractions` already interprets `on[]`).
- Derive supported triggers from `caps` (D-EV1 rec).
- **Fitness:** `FF-EVENTS-FACET-DECLARED` (events authored through the declared `NodeAction` union, no free-form), `FF-ACTION-UNION-OCP` (already exists — a new action arm is a declaration).

### Slice 4 — **CHROME** completion (Gap 1)

- Extend `chromeParts.contract` to project `variant`/`region`/`order` structural facets alongside the config schema (chrome's facet axis).
- Give the `site-frame` a whole-element inspector: its `band` of regions = its composition (enable/add/remove/reorder regions), authored through `updateChromeConfig` + the site SSOT.
- **Fitness:** `FF-CHROME-FULL-CONTRACT` (a chrome region projects variant+region+order+config, not config-only), `FF-SITE-FRAME-INSPECTABLE`.

### Slice 5 — canonicalization sweep + the completion gate

- Harden: all facet sections derive from `facetRegistry` (no residual hand-wire); `visibleToRoles` folded in as a facet.
- **The 100%-facet-authorable gate:** `FF-EVERY-DECLARED-FACET-PROJECTED` — for every element, each universal facet it declares (`view.styles`, `data`, `on`, `transforms`, `visibleWhen`, chrome structural) resolves to a facet section, never to a raw-JSON default and never to nothing. This is the facet-axis peer of the constituent-axis completeness gate.

---

## 6. Reconciliation & invariants honored

- **ADR-038 / Law 1 / Law 2:** every facet section reads a declaration + names no concrete type (`FF-NO-EXTERNAL-SPECIAL-CASE` stays `[]`). Facets are DATA (NodeStyles object, NodeAction union, DataSpec) — never code/functions/classes in config.
- **ADR-041 / S1–S6:** the Part port and `element.schema` band-item projection are UNTOUCHED. Facets are the orthogonal axis; the chrome fix (Slice 4) extends the existing `chromeParts` adapter's contract, not a new grammar.
- **SPEC-worldclass-authoring-ui:** the `dockSectionRegistry` + Summary Corollary are the mechanism this rides; facet sections join it. The Stage contract (Chart Studio) is where a rich facet (DATA) escalates when it outweighs the dock — Slice 2 reuses it.
- **Thin base (feedback):** facet contracts declared once at platform level; elements opt in by cap/field — no shared-base bloat, no per-element facet form.
- **Maximal orthogonality (feedback):** facets are independent axes authored once; a facet is added only when a real element declares it (YAGNI — `parts` manifest, explicit `triggers` deferred to first real consumer).

---

## 7. The four diagnoses (one line each) + verdict + first slice

1. **Chrome (Gap 1):** part MECHANISM canonical (S6), but the projected contract is config-only — variant/region/order structural facets + the site-frame's own composition are unauthorable (**missing structural-facet contract + no site-frame inspector**).
2. **Full functionality (Gap 2):** the dock projects only `meta.schema`; the universal facets on `NodeBase` (styles/data/on/transforms/roles) are TypeScript structure with **no projectable authoring contract** — the umbrella gap.
3. **Data-pipeline without a metric (Gap 3):** editors exist but are **role-buried** (Steward/Model, FF-AUTHOR-NO-QUERY) and **not projected** as a generic Data facet; author gets metric-bind only.
4. **Per-element style (Gap 4):** **genuinely unbuilt on both ends** — render cascade ready, but no declared style contract (styleKeys private) and no `StyleField`/`element.style` projection.

**Canonical inspector model:** `inspect(element) = projectParts (ADR-041, done) ⊕ projectFacets (this SPEC)` — six generic projections (content · STYLE · DATA · EVENTS · VISIBILITY · CHROME), each a declared facet opted into by a cap/field, projected by the existing `dockSectionRegistry`, no per-type special-case.

**Ideology verdict:** the generic-projection ideology HOLDS and is canonical — it was simply applied to only the constituent axis. The completion elevates ROOT-4 (Facet) from a render-side opt-in to a projectable authoring contract, making Parts ⊥ Facets both generic and declared. This is the homoiconic ideal completed.

**Recommended first slice:** **per-element StyleField (Slice 1)** — highest felt-impact, most visible, no policy entanglement, design converged, and it lays the facet-section seam every later facet reuses.

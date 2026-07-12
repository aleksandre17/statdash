# SPEC — Object-Model Foundation Diagnosis: the Root Concepts (the "Fable" study)

> **Status:** DIAGNOSIS + PROPOSAL (read-only study; no code in this commission) · **Author:** platform-architect (first-principles study, 2026-07-12) · **Card:** `work/items/0067-fable-root-concept-study.md`
> **Commission (owner, verbatim intent):** *"We're going in circles; lay down the ROOT concepts on which the core logic + full canonical structure assembles. Tell me: too much architecture or too little? Are we cutting too much, or too little?"* — plus the placed-nowhere intuition: a **wrapper-vs-single-element** split he keeps landing on.
> **Relations:** extends ADR-038 (Bounded Element Law — unchanged, this settles its missing root) · ADR-039/BE-4 (kept; becomes the first adapter of the root) · `SPEC-rendering-core-object-model.md` (extended: "Two Residences" → "One Part Grammar, N declared residences") · `SPEC-worldclass-authoring-ui.md` (unchanged; its projections consume the root).

---

## 0. The verdict in one paragraph

**We are BOTH — under-built at the root and over-built one level above it, and the two are causally linked.** Exactly ONE root concept is missing: the platform has never settled, as a first-class primitive, the relation *"this element HAS CONSTITUENT PARTS."* Because that root was never laid down, containment grew **four parallel grammars** (tree slots · props value-bands · sourced bands · chrome regions), **three selection species** (node-id · item-path · chrome slot/key), **two anchor mechanisms**, and **two competing theories of what a KPI card is** — both currently in the tree at once. Every BE-x was a bridge from one grammar to the authoring machinery; each bridge was locally lawful (generic, declared, fitness-gated) and globally a symptom. The cut is real but surgical: kind-as-mechanism and the duplicate card answer go; the declaration layer (ObjectMeta, schema, slots, caps, variants) is canonical and **stays**. The addition is exactly one primitive. Net concept count goes DOWN.

---

## 1. Concept map — ground truth (what actually exists, what each really is, where they fight)

Verified against code on `feat/ar49-m0-metric-first-authoring` (every claim cited). Two languages currently coexist:

### 1a. The DECLARATION language (`packages/react/src/engine` + `packages/plugins`)

| # | Concept | What it REALLY is | Problem it solves | Canonical counterpart | Overlap / fight |
|---|---|---|---|---|---|
| 1 | **`ObjectMeta`** (`slice-meta.ts:210`) | THE one declared contract: identity + schema + slots + caps + variants + band + facets | Bounded-Element declaration (ADR-038) | Builder registered component · Puck config · Gutenberg block type | None — this is the sound trunk. **KEEP** |
| 2 | **`sliceType`** (`'node'\|'page'\|'panel'\|'chrome'\|'control'`) | A 5-way KIND discriminant on the META union | Routes registration to behaviour stores; palette semantics | Figma: kinds are trait-mixins, not a union; Builder/Puck: no kind at all | **FIGHTS the contract** (see §2): `panel` pins `canHaveChildren:false` while kpi-strip *contains* cards. Page/chrome/control identities are real; **panel-vs-node is accidental** |
| 3 | **slice** | The plugin module unit (`META + Shell + Skeleton + validate + migrate`) | Packaging + registration granularity | Grafana panel plugin · Gutenberg block | Benign packaging term, but "slice/sliceType" leaks into vocabulary as if it were a model concept |
| 4 | **`type` / `variant`** | Universal identity, normalized at ingestion (`objectRegistry.normalizeObjectIdentity`) | One discovery spine | Builder component name · block name | None. KEEP |
| 5 | **`SliceCategory`** | Palette grouping (`'page'\|'data'\|'layout'\|'content'\|'filter'`) | Palette taxonomy | Builder/Plasmic `section` grouping | Mildly overlaps caps (`'data'` category vs `data` cap vs `panel` kind = three encodings of "renders data") |
| 6 | **`caps` / `NodeCap`** | Declared capability tokens (facet band) | Capability discovery, cross-kind queries | Gutenberg `supports` · ECS components · Figma mixins | KEEP — canonical facet mechanism |
| 7 | **`SlotDef` / `slots`** (`slice-meta.ts:120`) | Tree-children contract: `{field, accepts, multi, min/max}` — children are **node instances** | Composite tree + drop validation (BE-5 `FF-COMPOSITE-INTEGRITY`) | Puck `slot` field · Builder blocks input · Gutenberg InnerBlocks `allowedBlocks` | **Containment grammar #1.** Note: it already carries `field: string` — it is *half* a PropField and was never unified with the field grammar |
| 8 | **`PropSchema` / `PropField`** | The prop contract (typed authoring vocabulary, core-owned) | Inspector/validation/JSON-Schema projection | Builder `inputs` · Plasmic props meta · RJSF schema | KEEP — the trunk |
| 9 | **`itemSchema` (+`itemLabel`, `itemGroups`)** on a `PropField` | Per-item contract of a **value band** (array of typed values on props) | Deep authorability of nested items (D7/ADR-022) | Builder `list`+`subFields` · Sanity `of:[{type}]` | **Containment grammar #2.** Same relation as #7 ("has parts"), different mechanism, address, and validation path |
| 10 | **`BandDescriptor` / `META.band`** (`slice-meta.ts:183`) | Node-level pointer naming a registered BandSource ("my items live elsewhere") | Filter-bar items resident in page SSOT (BE-4) | Grafana: variables ≠ widgets (the residence insight is right) | **Containment grammar #3.** Mis-seamed: residence is declared **on the NODE**, but Puck's law — which ADR-023 itself cites — says residence is a property of the **composition SITE (the field)**. One node with two bands of different residences is unrepresentable |
| 11 | **`VariantSchema` / `VariantDef`** | Declared visual variants → `data-*` attrs, folded into schema as `variants.*` fields | Style variants w/o shell code | Leaders: just an enum prop | Sound; already collapses into the field grammar via `nodeSchemaWithVariants` — proof folding works |
| 12 | **chrome facet** (`slot`/`key`/`defaultRegion`/`defaultOrder`) + `ChromeEntry`/`ChromeSlotConfig` | App-shell composition: positional (region+order) resolution, manifest/page override chain | Site chrome variants | Webflow/Builder: header/footer are ordinary elements; Grafana chrome is not authorable | **Containment grammar #4** (positional, not slot-based). ROM R4 already plans folding it into slots — correctly deferred |
| 13 | **control facet** (`controlType`/`dimension`) + `ParamDef` + `getParamSchema` | Filter controls as page-owned params; per-type contract via the param-schema registry | Params ≠ canvas widgets (Grafana canon — CORRECT) | Grafana template variables | The **discriminated-contract** resolution (`getParamSchema(type)`) duplicates the role `itemSchema` plays for homogeneous bands — two "resolve the item's contract" paths |
| 14 | **registries** | `objectRegistry` (discovery, ONE) + behaviour stores (`nodeRegistry`, `chromeRegistry`, `filterControlRegistry`, `skeletonRegistry`) | Discovery vs behaviour split (ISP) | Fine — R1 built the one discovery spine | The behaviour stores are honest; the hand-curated `authoring-metas.ts` roster is a small parallel truth (roster vs registry) |
| 15 | **Promotion Law + `promotionMode.ts` + `kpi-card` shadow slice** | "≥2 node facets ⇒ must be a node"; flag-gated shadow residence per promoted type | Facet reinvention (ROM F2: `KpiSpec.when/color/id` re-implement node facets) | Gutenberg list-item promotion precedent | **FIGHTS #16 below — the smoking gun.** See §2/§4 |

### 1b. The AUTHORING language (`apps/panel/src`)

| # | Concept | What it REALLY is | Duplicates / fights |
|---|---|---|---|
| 16 | **band** (`BandItemRef`, `bandFieldsOf`, `bandItemsOf`) | BE-1: enumerate selectable value-band items from the declaration | The authoring-side NAME for containment grammar #2. Generic and lawful — but a *bridge*, per-grammar |
| 17 | **`BandSource` port + adapters + `BandMutation`** (`canvas/bandSource.ts`) | BE-4: Strategy port "enumerate my items / write one subfield," residence-tagged writes | **This is ~70% of the missing root, built one layer too high** (app-level, value-bands only, tree children and chrome outside it) |
| 18 | **`BandItemBoundary` / `AuthoringAnchorContext`** (`react/engine/bandAnchor.tsx`) | The ONE render anchor for band items (`display:contents`, inert off-canvas) | Correct (Builder `<Blocks>` / Craft `<Element>` contract) — but a **second** anchor mechanism beside the canvas node-anchor middleware (`data-node-id`): same technique, two implementations |
| 19 | **selection triple** (`selectedNodeId` · `selectedItemPath` · `chromeSel` — `useCanvasController.ts:32-34`) | THREE address species for "the selected element" | Three, because there are three containment grammars in reach. The Composite address `(node, item-path)` was the right idea, stopped halfway |
| 20 | **`SchemaSource`** (node / chrome / fixed / filterParam) | DIP port "where does this element's contract come from" | Correct pattern — but it exists *because* contracts resolve differently per grammar; under one root it collapses to one resolution |
| 21 | **`boundary`, `itemSchema`, `band`, `itemObject`…** as UI vocabulary | The panel's working language | The lead's hypothesis confirmed: an authoring language PARALLEL to the declaration language. Leaders have **one** language (§3) |

### 1c. The seams, named honestly

1. **Four containment grammars for ONE relation.** `slots` (nodes) · `array+itemSchema` (values) · `band.source` (projected) · chrome regions (positional). Each has its own enumeration, address grammar, write path, validation, and anchor. This is THE root defect.
2. **Kind fights contract.** `panel ⇒ canHaveChildren:false` (pinned literal) while `kpi-strip` — a panel — visually and semantically contains cards; `filter-bar` — category `'layout'` — is a tree-leaf whose constituents live on the page. The kind says one thing, the contract another.
3. **Two live answers to "what is a KPI card."** ADR-023 R2 says *promote it to a node* — `kpi-card` slice + `kpiSpecToCardNode` + `promotionMode` are in-tree, flag-dark. ADR-038/039 BE-1 says *it's a band item, select it generically* — live, e2e-verified. Both mechanisms exist simultaneously for the same element. This is the circle made visible.
4. **Residence declared at the wrong site.** `META.band` is node-level; the canon (Puck, cited by our own ROM spec) puts residence on the field.
5. **Two anchor mechanisms, two contract-resolution paths, a hand roster beside the registry** — small parallel truths, each a consequence of #1.

---

## 2. Wrapper-vs-leaf: the owner's intuition, resolved

**The distinction is ESSENTIAL. Its current placement is ACCIDENTAL. That mismatch is exactly why he cannot place it.**

- **Essential:** every canonical platform distinguishes elements that contain from elements that don't — it is the Composite pattern itself (Builder `canHaveChildren`, Puck slot fields, Gutenberg InnerBlocks, Figma `ChildrenMixin`). The owner's instinct is the field's instinct.
- **Accidental placement:** in our model, "does this element contain things, and how?" is answered by **five scattered signals** — `sliceType` (panel vs node), `canHaveChildren`, `slots`, `array+itemSchema` fields, `META.band`. They can and do disagree:
  - `kpi-strip`: kind says LEAF (`PanelSliceMeta`, pinned `canHaveChildren:false`); contract says WRAPPER (`items` band of cards). The owner looks at a strip of cards, sees a wrapper, and the architecture tells him "leaf panel." His intuition is not confused — the model is.
  - `filter-bar`: tree-leaf, category `'layout'`, no slots — yet it visibly wraps controls, which actually reside in `page.meta.filterSchema`. Wrapper by sight, leaf by tree, projector by truth.
  - `section`: wrapper by every signal — the only case where the signals agree, which is why sections never hurt.
- **The canonical resolution** (Figma `ChildrenMixin`, Builder `canHaveChildren`-derived, Puck "does the config declare a slot field?"): *wrapper-ness is a DERIVED PREDICATE of the contract, never a stored kind.* **Wrapper ⇔ the contract declares ≥1 constituent-bearing field. Single element ⇔ it declares none.** One question, one place to look. The moment this predicate is derived from ONE grammar (§5 ROOT-2), the owner's split becomes placeable — and `kpi-strip` is honestly a wrapper whose parts are value-resident, `filter-bar` a wrapper whose parts are page-resident, `chart` a true single element.

The deeper reading of his intuition: he senses that *containment* is the platform's primary structural relation, and that the architecture treats it as four secondary details. He is right.

---

## 3. Canonical benchmark — how the field models THE ONE THING

"A unit in an authorable tree that declares its contract." Concept counts for {node · contract · children · variants · authoring-projection}:

| Platform | Node | Contract | Children | Variants | Authoring projection | Root-concept count |
|---|---|---|---|---|---|---|
| **Builder.io** | ONE uniform `BuilderElement` (JSON) | registered component + typed `inputs` | a **blocks input** / `canHaveChildren`; `list`+`subFields` for values | an enum input | editor generated from `inputs` | **3** (element · component+inputs · tree) |
| **Puck** | component instance in one data tree | `config.components[x].fields` | **`slot` IS a field type** (`type:'slot'` vs `type:'array'`) — the crispest formulation in the field | a field | panel generated from `fields` | **2–3** (component · field; root) |
| **Plasmic** | element in one tree | code-component registration, props meta | a **prop of type `'slot'`** | a prop | studio from props meta | **3** |
| **Craft.js** | ONE uniform `Node` | component + `craft` config (rules, related UI) | `<Element canvas>` regions — one render-contract | props | toolbar from `related` | **3** |
| **Framer** | canvas node (all share transforms) | property controls (`ControlType`) | a **property control** (children/ComponentInstance) | enum control | panel from controls | **2–3** |
| **Webflow** | DOM-like element | element settings + style classes | DOM containment — ONE grammar | classes/combos | settings per element | **3** |
| **Gutenberg** | block, blocks all the way down | block type: `attributes` + `supports` | **`InnerBlocks` + `allowedBlocks`** — one mechanism; list items were *promoted into it* | an attribute | inspector from attributes | **3** |
| **JSON-Forms / RJSF** | — (the schema IS the tree) | JSON Schema (+uiSchema) | **recursion**: arrays/objects recurse through the SAME generator at every depth | — | THE projection, total | **2** |
| **Grafana** | panel (flat dashboard — no nesting) | options builder + `fieldConfig` | n/a (layout owns placement); variables = separate param model | — | options UI from builder | **3–4** |
| **Vega-Lite** | unit spec | mark+encoding grammar | explicit **composition operators** (layer/facet/concat/repeat); encodings stay values | — | n/a (headless) | **3** |
| **Backstage** | catalog entity / template | `kind`+`spec`; parameters = JSON Schema | relations, not containment | — | scaffolder form from schema | **3** |

**What the field converged on — the minimal canonical foundation (three roots + projections):**

1. **ONE uniform node** in one tree (homoiconic: the document is data in one shape).
2. **ONE registered type contract** (fields/inputs/attributes/controls) — the single declaration everything derives from.
3. **Children as PART OF THE CONTRACT** — a field/input/InnerBlocks/slot-prop. **No leader has a second containment grammar**, and none has a separate authoring taxonomy: *the authoring language IS the declaration language.* Where a "value band" exists (Builder `subFields`, Sanity objects, Grafana fieldConfig), it is the SAME field grammar recursing — not a parallel mechanism.

Variants are never a root concept (an enum field). Authoring surfaces are never concepts (projections of #2). Selection is one address over #1. That is the whole canon: **≈3 concepts.** Our declaration trunk matches it; our containment layer has 4 grammars where the canon has 1 — and our authoring layer had to mirror each.

---

## 4. Diagnosis — the verdict

**MIS-FACTORED, with one missing root primitive.** To the owner's binary: **too little at the root, and — as a direct consequence — too much one level above it.** The embryo is not over-designed in its trunk (ObjectMeta, schema, caps, variants, one discovery registry — all canonical, all load-bearing, all match the leaders 1:1). The excess is concentrated precisely where the missing root forced compensations:

**The ONE thing we keep not doing:** we never declared, in the object model itself, the relation *"element HAS PARTS"* as a single grammar with a single enumeration, address, write, and anchor. The renderer never needed it explicitly (each shell renders its own items — containment stays implicit in render code), so it was never forced into the model. But the **authoring** surface needs it explicitly for every gesture — selection, overlay, inspector, drop-validation, lineage. So each time the owner pointed at a thing that "isn't an object" (KPI card → BE-1; filter control → BE-4; section child → BE-5), we generically bridged *that grammar* to the authoring machinery. Each bridge was locally excellent — declared, projected, fitness-gated, no per-type branch. And each was still a bridge, because the question "what are this element's parts?" has no single answer in the model. **The circle is the model asking us the same question once per grammar, forever** — table columns, chart encodings, repeat instances, hero cards, chrome items are all still queued to re-ask it.

**The smoking gun — two theories of the KPI card, both in-tree:** ADR-023 (render language) diagnosed facet reinvention and prescribed *promotion to a node* — `kpi-card` slice, `kpiSpecToCardNode`, `promotionMode`, `FF-PROMOTION-LOSSLESS`: built, flag-dark. ADR-038/039 (authoring language) prescribed *generic band selection* — built, live, e2e-verified. Both mechanisms currently answer the same owner question. Neither ADR retired the other. Two parallel taxonomies over one idea — the lead's hypothesis is **confirmed**, with one refinement: it is not merely that the render and authoring languages differ; it is that **containment was never one concept in either**, so both languages fragmented around it, and then fragmented against each other.

**What is honestly OVER-built (accidental — cut):** kind-as-mechanism (`panel` vs `node` sliceType distinction, and the pinned `canHaveChildren` where it contradicts the contract) · the node-level `META.band` seam (right idea, wrong site) · the duplicate card answer (one of the two must retire, §5) · the second anchor implementation · the roster-beside-registry.
**What is honestly UNDER-built (the missing primitive — add):** the one Part grammar + its one engine-level port (§5 ROOT-2/3). `BandSource` (BE-4) is ~70% of it — built one layer too high (app-only) and one scope too narrow (value bands only).
**What is neither (keep, untouched):** ObjectMeta · PropSchema/itemSchema · caps · variants · objectRegistry + behaviour stores · renderNode's 12-step · the two-residence insight itself (the value band is canon — Builder/Sanity/Grafana; node-maximalism stays rejected).

---

## 5. The root concepts — the proposal (the foundation everything assembles on)

Four roots. Three already exist (one fully, two in fragments); one is new. Everything else in the platform is a **projection** of these four.

### ROOT-1 — **Element** *(exists — keep verbatim)*
A registered `(type, variant)` identity with ONE declared contract (`ObjectMeta`) in ONE discovery registry. Built (ADR-023 R1). Unchanged.

### ROOT-2 — **The Part grammar** *(exists in four fragments — unify)*
**An element's contract declares its PARTS as fields.** A constituent-bearing field ("part field") states, per field: *what the parts are* (per-part contract), *what it accepts*, and **where the parts reside** — the residence is a property of the FIELD (Puck's law), never of the node:

| Residence (closed set, extensible) | Parts are… | Today's fragment |
|---|---|---|
| `slot` | node instances of registered types (accepts-gated) | `SlotDef` (already carries `field:`) |
| `value` | typed values on `node.props` (per-part contract = `itemSchema`, homogeneous or discriminated) | `array + itemSchema` |
| `sourced` | projections of an external SSOT (per-part contract resolved by the adapter — e.g. `getParamSchema`) | `META.band` + `BandSource` |

One grammar, N residences. `SlotDef`, `itemSchema`-bands and `BandDescriptor` become three surface forms of ONE `PartField` concept (types can remain as today's names — the alias/re-export discipline R1 already proved). **Wrapper/leaf becomes derived:** wrapper ⇔ ≥1 part field; `canHaveChildren`/panel-leafness become derived predicates (compile-time pins may remain as refinements, but no mechanism reads the KIND to answer a containment question). ROM's "Two Residences" is hereby extended, not contradicted: *One Type System · One Tree · One Part Grammar (N declared residences)* — BE-4 had de-facto already added the third residence; the model catches up with its own reality.

### ROOT-3 — **The Part port** *(the missing primitive — add)*
ONE engine-level interface every authoring/validation/lineage mechanism recurses over — the generalization of BE-4's `BandSource` from "value bands, app-level" to "ALL parts, engine-level":

```
enumerateParts(element, ctx) → [{ address, contract, subject, residence }]
writePart(element, address, patch, ctx) → residence-tagged mutation   (BandMutation, kept)
```

- **One address grammar:** `(nodeId, partPath?)` — today's Composite address (ADR-039) completed: tree child ⇒ the child's own nodeId reached THROUGH the part enumeration; value/sourced part ⇒ path. The selection triple (`selectedNodeId`/`selectedItemPath`/`chromeSel`) collapses to one selection type.
- **One anchor:** `BandItemBoundary` and the node-anchor middleware merge into one part-anchor contract (same `display:contents` technique, one implementation).
- **Adapters, not bridges:** `slotParts` (walks `children` by the declared slot) · `valueParts` (= BE-1 `bandItemsOf`) · sourced adapters (= BE-4 `filterSchemaBandSource`, staying app-level where they touch app SSOTs — the PORT is engine, adapters live with their residence). Chrome joins later as a sourced/slot adapter of a `site-frame` element — ROM R4 unchanged, still deferred.
- **BE-1/BE-4/BE-5 fall out as ONE mechanism:** KPI card = `valueParts` of kpi-strip's `items` part-field; filter control = `sourcedParts` of filter-bar's declared page-filters field; section children = `slotParts` gated by `accepts` (FF-COMPOSITE-INTEGRITY becomes the port's validation projection). **No per-kind bridge remains, and — the actual test — the NEXT kinds (hero cards, table columns, repeat instances, chrome items) are declarations only.**

### ROOT-4 — **Facet** *(exists — keep; one reframe)*
Capabilities and kind refinements as declared opt-ins (`caps`, `rootOnly`, variants, chrome/control identity). One reframe with teeth: **the Promotion Law becomes a RENDER-side law only.** Authoring reach is residence-independent under ROOT-3 (any part is selectable/authorable wherever it lives), so promotion is *never again* justified by authorability — only by render-pipeline facets (own DataSpec routing, per-part RBAC, error boundary, visibility evaluated by renderNode instead of a private seam like `kpiVisible`). This resolves the two-theories fight in §4: BE-1 stays as THE authoring answer; the `kpi-card` shadow promotion is re-judged purely on render grounds (owner decision D-F2 below).

### Keep / Cut / Add — the explicit ledger

| KEEP (canonical, untouched) | CUT (accidental) | ADD (the root) |
|---|---|---|
| ObjectMeta · objectRegistry + behaviour stores · PropSchema/itemSchema · caps · variants · renderNode pipeline · value-band residence itself · BandMutation write discipline · `BandItemBoundary` technique · ADR-038/039 as law + design | `panel`-vs-`node` kind as a *mechanism* (derive leaf/wrapper from the contract) · node-level `META.band` (residence moves to the field) · ONE of the two KPI-card answers (D-F2) · the second anchor implementation · authoring-metas hand roster (derive from registry) · the parallel authoring vocabulary (band/boundary/itemSchema-drill become the Part port's ONE vocabulary) | **ROOT-2** unified PartField grammar (aliases keep import sites byte-identical) · **ROOT-3** engine Part port + three adapters · fitness: **FF-ONE-PART-GRAMMAR** (all constituent enumeration flows through the port — no parallel discovery), **FF-RESIDENCE-AT-FIELD** (residence declared on the field, never the node), **FF-DERIVED-CONTAINMENT** (no kind/flag may contradict the declared part fields) |

Config migration: **zero** — stored config already carries the uniform `type`-discriminated tree (ROM F3); this is engine-internal re-seaming, Strangler-Fig, alias-reversible until the last contract step.

---

## 6. The decision (owner picks the direction — near-one-way-door)

**OPTION A — Settle the root (RECOMMENDED).** Adopt ROOT-1..4; unify the four containment grammars into the Part grammar + port; derive wrapper/leaf; reframe Promotion as render-only; retire the losing KPI-card mechanism.
*Gains:* the circle ends structurally — every future "X isn't an object" is a declaration, not a bridge; the owner's wrapper/leaf intuition gets ONE home; concept count drops (~9 containment-adjacent moving parts → ~4); both SPECs and both ADRs are extended, not forked.
*Costs:* a deliberate one-time engine re-seam (medium; R1-style, alias-reversible, zero config migration); BE-4's held code reshapes into the first sourced adapter (its design survives verbatim — ADR-039's Delta already IS the port's spec, one layer down).
*Risk:* lowest long-term; the only one-way step is the final de-aliasing contract, gated like R2.

**OPTION B — Node-maximalism** (everything a tree node; promote all bands). *Gains:* one mechanism trivially. *Costs:* counter-canon (Builder/Sanity/Grafana/Vega all keep a value band); grammar noise (12 columns = 12 nodes); filter items CANNOT be nodes without forking the page SSOT (ADR-039 rejected-alt 1); config migration everywhere. **Rejected twice already (ROM ALT-A); still wrong.**

**OPTION C — Status quo, keep bridging.** BandSource already generalizes value bands; accept slots/chrome as separate species and keep the kpi-card double answer dark. *Gains:* zero cost now. *Costs:* the two languages persist; every next kind re-asks the question; the two card theories stay unresolved in-tree; the owner's intuition stays homeless. This is the circle, chosen deliberately.

**Owner gates under Option A:**
- **D-F1** — adopt ROOT-1..4 as the foundation (the direction call; rec: **yes**).
- **D-F2** — the KPI card: keep BE-1 band selection as THE answer and **retire the shadow promotion machinery** (rec), OR keep promotion flag-dark strictly for render facets (`kpiVisible` seam retirement) — never for authoring. Either way, ONE answer remains.
- **D-F3** — sequencing: port-first (engine ROOT-3, then re-home BE-4's held code as its first sourced adapter) vs land BE-4 as-is then port. Rec: **port-first** — BE-4 is held uncommitted for exactly this reason; landing it one layer down costs less than migrating it later.

---

## 7. Closing verdict (2–3 sentences, as commissioned)

**We are under-built at the root and over-built above it: ONE primitive was never laid — "an element's parts" as a single declared grammar with a single port — and its absence forced four containment grammars, three selection species, and two competing theories of the KPI card, which is the circle itself.** The wrapper-vs-single-element split the owner keeps landing on is essential and canonical — but it must be a *derived predicate of the contract* (declares parts / doesn't), not a stored kind; today it is smeared across five disagreeing signals, which is why he cannot place it. **Recommendation: Option A — keep the declaration trunk verbatim, cut kind-as-mechanism and the duplicate card answer, add the Part grammar + Part port; after that, BE-1/BE-4/BE-5 are three adapters of one mechanism and every future element is a declaration, not a bridge.**

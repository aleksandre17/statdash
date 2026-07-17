# DEEP EXPEDITION — the SYSTEM-ARCHITECTURE lens

**Question:** Is this platform ONE BODY at framework grade — and what is the INVISIBLE structural truth nobody has named yet?
**Author:** architect (system-architecture study, 1 of 5). Read-only; every claim code-cited to the live tree at `platform/packages/*` + `apps/*`.
**Peer:** the lead's `STUDY-authoring-canon-circle-break.md` is the PRODUCT lens (canvas honesty, inspector IA, journey-DoD). This study deliberately does **not** re-report its six findings — it goes one abstraction level beneath them, to the declaration algebras, artifact identity, the registry substrate, and meta-circularity.
**Method:** first-principles read of the type contracts that DEFINE each declaration algebra (`prop-schema.ts`, `partPort.ts`, `facet.ts`, `slice-meta.ts`, `contracts/*.ts`), a registry census, and a dogfooding probe of `apps/panel/src/studio`.

---

## 1. VERDICT — one body, one abstraction level short of its own ideal

**Yes — it is one body at framework grade at the SUBSTRATE level, and genuinely reference-class there.** The evidence is not aspirational:

- **One type system, one tree, one containment grammar.** `ObjectMeta` is the single declare-once contract (`slice-meta.ts:1`); the five META names are pinned facets of it, not five mechanisms (ADR-023). Containment is ONE `PartField` grammar with residence-on-the-field (`partPort.ts:53`), the four historical grammars unified, wrapper/leaf a *derived* predicate (`isWrapper`, ADR-041 Delta 3 landed). This is further than Builder.io (`subFields`), Sanity (`of:[]`), Grafana (`fieldConfig`) take it — they keep the value band but never unified slots+bands+sourced+chrome under one address grammar. **We did.**
- **The dependency arrow holds in letter AND is executable** (`eslint no-restricted-imports`, Law 3). `contracts` is genuinely zero-dep; `packages/react` is genuinely label-agnostic — the built-in facets carry their localized labels in `apps/panel/builtinFacets.ts`, not in `react/facet.ts` (verified: `facet.ts` imports only types, registers an empty registry the app populates). The engine/adapter boundary is real.
- **The semantic spine is governed and SDMX-native** (`ManifestMetric`/`ManifestDimension`, `contracts/manifest.ts`) — grain-additivity classified structurally (`additivity`, line 134), dimensions as first-class peers of metrics (Law 1), members reified from the DSD never copied into config (Law 5). This is Looker-grade governance without LookML — the governed×simple×no-query quadrant the benchmark names as nearly empty in the market.

**But it is UNDER-factored at the META level and slightly OVER-built at the vision level** — and the two are causally linked, the exact shape ADR-041 diagnosed one layer down ("under-built at the root, over-built one level above, causally linked"). The same disease has simply moved UP a level: the root object-model is now settled, so the un-factored seam is no longer *containment* — it is **the projection meta-model** (§2, Invisible 1+6), **artifact identity** (§2, Invisible 4), and **the registry substrate** (§2, Invisible 3). The over-build is the portfolio (the lead's F6 — 12 open strata) plus a growing rich-field-type union (§2, Invisible 2).

**Net:** one coherent body whose SUBSTRATE is at or above the reference class, sitting one unifying abstraction short of its OWN stated ideal (the homoiconic "one declaration, everything derived"). It has climbed 90% of its own ladder and the last rung — *naming what a projection IS* — is invisible precisely because every individual projection is already done correctly.

---

## 2. THE INVISIBLE — seven findings nobody has named

### Invisible 1 · Parts and Facets are TWO projection engines that are secretly ONE — and `inspect = projectParts ⊕ projectFacets` is a hand-wired binary fold, not a generic one

`facet.ts` calls the Facet axis the "orthogonal sibling" of the Part port. Read the two shapes together and the sibling relation is deeper than sibling — they are two instances of one un-named abstraction:

- `FacetDescriptor` = `{ id, appliesWhen(meta)→bool, contract(meta)→PropSchema, readPath, label, order }` (`facet.ts:47`).
- The Part port = `{ residence, enumerateParts(el,field)→EnumeratedPart[], writePart, placePart }`, and each `EnumeratedPart` carries its OWN `contract: PropSchema` (`partPort.ts:114`).

Both ultimately **emit `PropSchema` and both render through the one generic `Inspector` + `FieldControlRegistry`.** The Inspector composes them as a fixed binary `projectParts(sel) ⊕ projectFacets(sel)` (ADR-042 D1). The `⊕` is a hardcoded two-term union. A THIRD inspectable axis — provenance-as-inspectable (AR-43), relationships, lineage — would be a **third hand-written term in that fold**, not a registered projector. The homoiconic ideal is one rung higher than the platform stands: there is no declared concept `Projection = (appliesWhen, project: decl → PropSchema | Parts, order)` over which `inspect(el) = fold(projectors.applicable(el))` is ONE generic reduction. FacetDescriptor is 95% that concept already; the Part port is the same concept expressed as a bespoke port instead of a projector. **Why it matters:** this is the single largest remaining unification, and it is invisible *because both halves are individually canonical*. Naming it turns "add an inspectable dimension" from an engine edit into a registration.

### Invisible 2 · `PropFieldType` is quietly forking into two kinds — primitive VALUES and capability-SURFACE embeds — and the second kind is a closed union with a per-capability special case

`PropFieldType` (`prop-schema.ts:24`) mixes two ontologically different things in one union:
- **Primitive value kinds:** `string | number | boolean | color | icon | enum-ref | LocaleString`.
- **Whole-capability surface embeds:** `style | data-pipeline | events | visibility` — each is "an element's entire STYLE / DATA / EVENTS / VISIBILITY capability projected as a single field," dispatched to a rich control (StyleField, DataFacetField, EventsField, VisibilityField).

The second group is exactly the Facet set (`view.styles`, `data`, `on`, `view.visibleWhen`) re-appearing as *field types*. So a facet is expressible two ways — as a `FacetDescriptor` (dock section) AND as a `PropFieldType` embed (a field). That is a genuine fork: **the same capability has two declaration homes.** And the embed group is a CLOSED union living in `core`, so a 5th rich capability (say a governed `relationship` picker, or a `provenance` embed) costs a `core` union edit + a hand-registered control — the precise "new capability = edit the type" anti-pattern the Bounded-Element law exists to forbid, surviving in miniature at the field-type layer. **Why it matters:** it is small today (4 embeds) and will grow with every rich authoring surface; left unnamed it becomes the field-level version of the four-grammars circle. The clean form: rich embeds are `FacetProjection` fields resolved through the FieldControlRegistry by a *registered* descriptor, not a core enum arm.

### Invisible 3 · The platform is a compiler with ~20 symbol tables and no symbol-table abstraction — `describeApp()` is the unbuilt reflective spine

A census of `packages/*/src` returns ~20 distinct registration seams: `objectRegistry`, `NodeRegistry`, `registerSpec`, `registerExprOp`, `registerMetric(s)`, `registerDimension(s)`, `registerMigration`, `registerTransformStep`, `facetRegistry`, `FieldControlRegistry`, `filterControlRegistry`, `ChartRendererRegistry`, `skeletonRegistry`, `chromeRegistry`, `visibility-schema-registry`, `rowspec-schema-registry`, `param-schema-registry`, `presentationRegistry`, `perspectiveRegistry`, plus the app-side `focusViewRegistry`, `dockSectionRegistry`, and the enum-ref `source` resolvers. There IS a `makeRegistry` factory — so the WRITE side is not duplicated code. But there is **no unified READ model**: each registry is projected independently, and no single surface can answer "enumerate every capability this platform can author." `describeApp()` (cited across the schema-SSOT epic) is the *beginning* of that reflective surface — it projects some registries into a manifest for the Constructor — but it is partial and hand-composed. **Why it matters:** two of the platform's own north-stars depend on this seam existing: AR-46 (external Plugin SDK — "the Constructor's palette IS the registry") and the meta-circular goal (a Constructor that can author every capability). A compiler that cannot reflect on its own symbol tables cannot host a plugin ecosystem. The unification is a READ-model over the existing write-seams, not a rewrite — cheap relative to its leverage.

### Invisible 4 · "A published thing" is modelled FIVE ways with NO shared identity/version/lineage spine — the single biggest missing unification on the axis that IS the product (provenance)

Five independent models of a publishable artifact, each defensible in isolation as an Anti-Corruption-Layer boundary, none sharing an identity:

| Model | Home | Version notion | Consumer |
|---|---|---|---|
| `SiteConfigResponse` (open blob) | `contracts/site.ts` | none | authoring panel |
| `SiteManifestContract` | `contracts/manifest.ts:235` | own `schemaVersion?` | delivery runner |
| `ViewSnapshot` | `contracts/view-snapshot.ts:76` | own `configRef.schemaVersion?` | citation/embed |
| `SnapshotEnvelope` / `PageDataSnapshot` | `contracts/snapshot.ts` | none (opaque) | persistence |
| `page_version` | DB (Flyway) | the FSM version rows | publish workflow |

`schemaVersion` is re-declared in three of them; the publish FSM lives only in the DB row and never reaches `ViewSnapshot` or `SiteManifest`; lineage/provenance is a fourth scattering (`reference-metadata.ts`, `ViewSnapshotProvenance`, `agency_scheme`). **There is no `Artifact` / `Publishable` concept carrying `{ identity, version, lineage, provenance, publishState }` across the boundaries.** For a generic dashboard tool this is fine. For a **national statistics platform where provenance IS the credibility of the product** (Law 9, the whole AR-43/47/48 cluster), the absence of a unified identity spine is the deepest structural gap on the axis that most differentiates us. AR-43 (data lineage), AR-47 (config governance FSM), AR-48 (delivery port `ViewSnapshot`) are **three separate registered initiatives that would collapse into ONE coherent axis** if a shared Artifact identity existed — today they will be built as three, each re-deriving version/identity. That triple-build IS the over-build, hiding as three "different" concerns that are one concern seen from three consumers.

### Invisible 5 · The Studio is not dogfooded — the authoring surfaces are hand-coded React; only the CANVAS renders through the node system

The platform's thesis is "everything is a declaration projected generically." Probe of `apps/panel/src/studio`: `StudioShell`, `ActivityRail`, `RightDock`, `StudioTopBar`, `surfaces/`, `FocusView` are all hand-coded React. Only `CanvasView` (and, transitively, the Inspector's facet/schema projection) runs through the node/renderer system — and it renders the *content being authored*, not the Studio chrome itself. **The tool that authors declarations is not itself a declaration.** This is not automatically wrong — a compiler need not be written in its own language, and full Studio-as-config would be a YAGNI over-reach that slows authoring iteration. But two facts make it a *named* finding rather than an accepted boundary: (a) the Inspector/dock is ALREADY a projection of `facetRegistry` + schema — the platform is partway self-hosting and doesn't say where the line is; (b) `focusViewRegistry` exists — the surfaces are already registry-adjacent. **Why it matters:** the correct cut is a decision, not an accident. Fully project the inspector/dock/empty-states/affordances from registries (nearly true; W3 finishes it); explicitly FENCE the shell (rail/top-bar/routing) as hand-coded platform code. Naming the fence stops the drift in both directions (accidental hand-wiring in the dock; speculative self-hosting of the shell).

### Invisible 6 · The "Triprojection over ONE Part model" (ADR-042) and the "Facet axis" are two different unification stories that don't compose — INSPECT already reaches outside the Part port

ADR-042 D1 states authoring = SELECT ⊥ INSPECT ⊥ MANIPULATE over the ONE Part model. But INSPECT is defined (D4, `facet.ts`) as `projectParts ⊕ projectFacets` — so INSPECT is a projection over **two** models (parts + facets), while SELECT and MANIPULATE are projections over **one** (the Part port's `enumerateParts` / `placePart`). The Triprojection is therefore not quite "three projections of one model" — it is "three projections, one of which secretly spans two models." This is the same gap as Invisible 1 seen from the ADR side: the honest unification is not "Triprojection over the Part model" but **"N projectors over the ONE declaration,"** where SELECT, INSPECT-parts, INSPECT-facets, MANIPULATE, VALIDATE, RENDER, LINEAGE are peer projectors. ADR-041's port and ADR-042's Triprojection and the Facet registry are three *partial* statements of that one law. **Why it matters:** the platform has written the unifying law three times without noticing it is the same law — which is exactly why the "we started many architectures and they didn't come out" feeling (owner #5) persists at the ARCHITECTURE level even though each ADR is individually sound. The concept keeps forking one level above wherever it was just unified.

### Invisible 7 · The `sourced` residence is the load-bearing generalization and it is one grandfathered exception away from proving the whole model — but the model has no self-similar RECURSION guarantee

`FF-RESIDENCE-AT-FIELD` sits at BASELINE 1 (ADR-041 Delta 3): the `BandDescriptor` node-level residence is the one grandfathered exception, deferred out of the one-way containment step. That is correct one-way-door hygiene. The deeper invisible point: the Part model proves composition to ONE level (an element declares parts), but it has no declared guarantee of **self-similar recursion** — a `slot` part is a node that itself declares parts, but a `value` part (a KPI item) or a `sourced` part (a filter control) is a *leaf of the composition tree by construction* (its contract is an `itemSchema` of primitive fields, not a re-entrant declaration). The market's reuse spine (Figma components/instances, Webflow symbols, Builder.io — benchmark N1/N2) requires a part that is itself a full declaration with per-instance overrides — i.e. **the Composite must be able to nest a governed reusable unit, not just typed values.** The model can *represent* this (a `slot` part accepting a `symbol` node type) but the declaration algebra does not yet make "a reusable governed sub-instance" first-class. **Why it matters:** N1 (symbols) + N2 (governed repeat over a dimension) are flagged as the biggest capability jump for statistics pages (regional profiles that build themselves), and they land cleanly ONLY if the reusable unit is a declaration — otherwise they become a fourth residence or a bridge, re-opening the circle. This is the next place the circle would regenerate if PM1 is skipped.

---

## 3. THE MAXIMAL TARGET CONCEPT (benchmarked, named)

**The Declaration and its Projectors** — a homoiconic core in which every element AND every capability is exactly ONE declaration, and every derived surface is a registered PROJECTOR folded generically:

```
Declaration  = the single ObjectMeta/PartField/capability record (one home, no fork)
Projector    = { appliesWhen(decl) → bool, project(decl, subject) → View, order }
              where View ∈ { PropSchema fragment | Parts | Anchors | Placement plan
                             | Validation | Rendered node | Lineage edge | Catalog entry | Doc }

everySurface(decl) = fold(projectorRegistry.applicable(decl))
```

Under this concept the current bespoke machinery becomes projector *instances*: SELECT = the parts-enumeration projector; INSPECT = the union of the parts-projector and every facet-projector (no special `⊕`); MANIPULATE = the placement projector; RENDER, VALIDATE, LINEAGE, PALETTE-CATALOG, and (the meta-circular win) the Constructor's own capability catalog are all projectors over the same declaration. The Inspector, palette, canvas overlay, validator, and exporter each become `fold(applicable projectors)` — one reduction, no hand-wired term per axis.

**Reference class this meets or surpasses:**
- **Vega-Lite** — one JSON spec, many compilers (renderer, schema, docs). We are that, but *governed* and *authorable in place*.
- **Lisp/homoiconicity** — one representation, every surface derived. Our stated ideal (ADR-038 preamble) verbatim.
- **Roslyn / Language-Server Protocol** — one AST, N features (hover, rename, diagnostics) as registered providers over it. Our projectors ARE LSP providers over a declaration AST.
- **Sanity `defineType`** — schema as the single source that generates the Studio. We surpass it with a *statistical* type system and completeness gating.
- **Salesforce Metadata API** — every artifact reflectable through one describe surface. Our `describeApp()` is that seam, unbuilt to completion.

The platform is already 90% here. The maximal concept is not a new architecture — it is **naming the law the platform has already written three times (ADR-041 port, ADR-042 Triprojection, the Facet registry) as ONE law**, and closing the three gaps that keep it forking (Invisible 1, 4, 6).

---

## 4. POWER MOVES — ranked by leverage, honest about cost

> **Ordering discipline (binding on this recommendation):** none of these opens before the lead's W1–W5 product waves reach journey-DoD. Opening a meta-model refactor now would BE the circle the lead's study warns against (a 13th open stratum). These are the NORTH-STAR structural moves the waves earn the right to make — each carries an explicit gate.

### PM1 · Name the Projector meta-model; refactor Part port + Facet registry + INSPECT's `⊕` into one `fold(projectors)` — *(highest conceptual leverage)*
Unify Invisible 1 + 6: declare `Projector = (appliesWhen, project, order)`; re-express `FacetDescriptor` as a projector (it nearly is); re-express the parts-enumeration and placement as projectors; make `inspect/select/manipulate = fold(projectorRegistry.applicable(decl))`. A new inspectable/derivable axis becomes a registration.
**Cost:** an engine re-seam, Strangler-Fig, alias-reversible until a final de-alias (the ADR-041 pattern exactly). Medium risk; the fitness suite (`FF-AUTHORING-TRIPROJECTION`, `FF-DISPATCH-NOT-BRANCH`) already guards the invariant it would generalize.
**One-way-ness:** none until a final de-alias step (gate it like ADR-041 Phase 6).
**YAGNI check — honest:** justified ONLY if a 3rd inspect/derive axis is real. Provenance-in-inspector (AR-43), symbols/relationships (N1/N7), and the plugin-SDK reflection (AR-46) are three real consumers → it clears YAGNI, but not urgently. **Gate: after W5; trigger = the first of AR-43-inspector / N1-symbols / AR-46 becoming a build slot.** Until then it is an ADR, not a build.

### PM2 · Unify Artifact identity — one `Publishable` spine (id + version + lineage + provenance + publishState) collapsing the five models' version/identity notions — *(highest data-integrity leverage; the product's core axis)*
Design ONE identity/version/lineage concept that `SiteManifest`, `ViewSnapshot`, `page_version`, and the snapshot envelope all *carry* (not re-derive). Collapses AR-43 + AR-47 + AR-48 from three independent builds into one coherent axis with three facets. This is the provenance spine a national statistics office is judged on.
**Cost:** touches `contracts` + `apps/api` + the DB version schema. The DB `page_version` → unified-version migration is the real work.
**One-way-ness:** the DB version-schema change is expand/contract (reversible with discipline); the contract additions are additive.
**YAGNI check:** the three consumer initiatives are ALL already registered and owner-relevant — this is anti-YAGNI-debt (building them separately is the waste). **Gate: DESIGN now as an ADR (it should exist before W5's publish loop hardens); BUILD gated on W5 (J6 publish journey).** Recommend the ADR be written in parallel with W-planning so W5 lands on the unified spine, not a fourth version notion.

### PM3 · Elevate `describeApp()` into THE reflective capability manifest — one READ-model over the ~20 write-seams — *(highest Constructor/ecosystem leverage, lowest structural risk)*
Consolidate the registries' READ side behind one `describe()` that enumerates every authorable capability (nodes, specs, facets, metrics, dimensions, transforms, controls) as a uniform catalog. Write-seams stay in their layers (arrow unchanged); only the reflective read unifies. This is the seam AR-46 (Plugin SDK) needs and the meta-circular Constructor requires.
**Cost:** additive read-model; mostly `packages/react` + `apps/panel`. Low risk — no behaviour change, a new projection.
**One-way-ness:** none (additive).
**YAGNI check:** clears — the Constructor palette + AR-46 are real. **Gate: fold incrementally into the W2/W3 waves where the Constructor already reads the registries; it is a natural consolidation of work those waves do anyway, not a separate stratum.**

### PM4 · Resolve the `PropFieldType` fork — rich capability-embeds become registered FacetProjection fields, not core-union arms — *(cleanup leverage; prevents the next mini-circle)*
Retire `style | data-pipeline | events | visibility` as closed `core` union arms; a rich field is a `facet-field` resolved through `FieldControlRegistry` by a *registered* descriptor. A 5th rich capability becomes a registration, not a `core` edit.
**Cost:** small, contained; the FieldControlRegistry dispatch already exists.
**One-way-ness:** none (the union arms can alias through).
**YAGNI check:** do NOT do preemptively. **Gate: trigger = the 5th rich field-type is proposed (relationship/provenance/symbol picker).** Until then the 4 arms are acceptable; naming the fork now prevents it being solved wrong at #5.

### PM5 · Fence the meta-circular boundary — project inspector/dock/empty-states/affordances from registries; declare the shell hand-coded — *(low-medium leverage; a doctrine, not a build)*
Adopt as doctrine: everything that authors a *declaration's contract* (inspector, dock, empty-states, affordances, palette) is a registry projection; the Studio *shell* (rail, top-bar, routing, layout) is hand-coded platform code and stays so. W3 already finishes the dock projection; this move is mostly the FENCE + a fitness function (`FF-INSPECTOR-IS-PROJECTION` extended to empty-states/affordances) that stops accidental hand-wiring.
**Cost:** minimal (a doctrine + one fitness extension).
**One-way-ness:** none.
**YAGNI check:** clears — it PREVENTS both the drift toward hand-wiring and the over-reach toward Studio-as-config. **Gate: adopt now as a one-line doctrine; the fitness function rides W3.**

---

## 5. WHAT TO EXPLICITLY NOT DO

1. **Do NOT open PM1 (the Projector meta-model) now.** It is the north-star, and building it before W1–W5 land would be the exact 13th-umbrella pathology the lead's F6 names — a new architecture that "doesn't come out." The substrate is sound; the debt is product journeys, not another engine reform. Earn PM1 with shipped journeys.
2. **Do NOT collapse Parts and Facets by node-maximalism** (promote value/sourced parts to nodes so one mechanism covers all). Rejected THREE times (ROM, ADR-023, ADR-041/042) and still wrong — 12 table columns become 12 outline nodes, filter/chrome items fork their SSOTs. Uniformity of *mechanism* (the projector) must NOT be bought with uniformity of *residence*. PM1 unifies the mechanism WITHOUT touching residence — that distinction is the whole point.
3. **Do NOT chase full Studio-as-config meta-circularity.** Projecting the shell (rail/top-bar/routing) from config is an over-build that trades authoring-iteration speed for a purity that no reference tool (Figma, Webflow, Builder.io) actually pays for. PM5 fences it deliberately.
4. **Do NOT add a fifth artifact model, or build AR-43/47/48 as three independent version/identity notions.** Any new "published thing" folds into PM2's `Publishable` spine. Building the three separately is the over-build masquerading as three concerns.
5. **Do NOT unify the registries by bending the arrow.** Each write-seam stays in its layer (Law 3). Only the READ-model (PM3) unifies. A single mega-registry in `core` would pull app concerns downward and break the boundary that is currently one of the platform's strongest assets.
6. **Do NOT solve the `PropFieldType` fork (PM4) preemptively.** Four embed arms are tolerable; refactoring at n=4 is churn. Name it now, fix it at the 5th.

---

## Appendix — the single greatest asset and the single unnamed liability (a reference-class core team's read)

**Greatest structural asset:** the ONE containment grammar with residence-on-the-field + an executable dependency arrow. This is genuinely ahead of the visual-builder reference class — Builder.io/Grafana/Sanity each keep the value band but none unified slots+bands+sourced+chrome under one address grammar with a derived wrapper/leaf predicate AND machine-enforced layering. It is the platform's Vega-Lite-grade move.

**Greatest unnamed liability:** the platform has written its unifying law three times (ADR-041 Part port, ADR-042 Triprojection, the Facet registry) without recognizing it as ONE law — so the concept keeps forking one level ABOVE wherever it was just unified (Invisible 1, 6), and the same "we keep starting architectures" feeling regenerates at the meta level even though each artifact is sound. The cure is not a fourth architecture — it is *naming the law once* (PM1) and refusing to state it a fourth time. Paired with the artifact-identity scattering (PM2), these are the two unifications that would let the body finish climbing its own ladder.

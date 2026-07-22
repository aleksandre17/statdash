# DESIGN-0104 — Elevation to the Reference Class: the One Data Workspace, Finished

- **Status:** ACCEPTED (owner, 2026-07-22 — all four §7 decisions blessed: «თუ ეს შენი საუკეთესო ვერსიაა, მაშინ კი. ვიმედოვნებ, რომ საუკეთესო ui სტანდარტები, უძლიერესი და ლოგიკური ფუნქციები, მარტივი და powerful იქნება, ისეთი როგორც კონკურენციაში შევა, ჩვენს ცნობილ პლატფორმებთან» — the competitive bar is part of the acceptance)
- **Date:** 2026-07-22 · **Author:** platform-architect (apex pass, card 0104 Phase 3)
- **Card:** `work/items/0104-data-workspace-unification-and-capability-restoration.md`
- **Stands on (settled, not re-litigated):** ADR-041/042 (object model) · ADR-046 + Add.4/5 (pipeline spine, value-cell/cells heads) · ADR-050 (spine) · ADR-051 (One Data Workspace, DU1–DU3 shipped) · `DESIGN-data-workspace-canonical-redistribution.md` (5 owner verdicts, waves DW-C→DU6→DW-A/B/D) · TanStack-Table-only adoption verdict · Laws 2/10/11 · P-OFFER · one-model-two-zooms.
- **Owner mandate (verbatim intent):** strengthen, improve, and raise product + architecture + concepts to the international level; the ONE pipeline must do EVERYTHING the arsenal can AND stay authorable by a non-programmer — simple AND powerful, power never cut for simplicity.

---

## 0. Thesis

The 0104 regression incident was not an execution accident — it was the **symptom of a missing declaration**. The platform has a *kind-level* authoring contract (`SPEC_CATALOG`: schema-or-editor per DataSpec kind, `packages/core/src/spec-catalog.ts`) but **no step-level authoring contract and no declared capability set** — so "can the workbench author this kind?" was answered by a hand-edited gate (`isWorkbenchShaped`, `workbenchModel.ts:35`), and hand-edited gates lie silently. Every elevation in this design is one move applied four ways: **push the declaration down to the granularity where the decision is made, then derive the decision.** Steps declare their authoring surface (→ the three-pane becomes universal without a single per-kind branch); kinds declare their required capabilities and editors declare what they provide (→ admissibility is *computed*, and the regression class becomes unrepresentable); config documents get a declared lifecycle (→ the authoring-hold dies); rendered cells get a declared provenance projection (→ "explain this number"). The five QC findings all fall out as consequences, not patches — four of five are literally "an undeclared thing was projected raw."

---

## 1. The target picture

### 1.1 Information architecture (the workspace at rest)

One rail door: **Data** (`/studio/data`, ADR-051 DU1 — keep). Inside, the four-floor ladder (SPEC-query-pipeline-data-home) remains the vertical spine, with DU6/DW-A re-laying the floors:

```
DATA workspace
├─ Floor 1  Sources        raw cubes · DSD/classifiers (DW-C scent chips) · DQ badges · ingest health
├─ Floor 2  Model          governed metrics = ONE MetricCatalogView (DW-A) · flow strip (DU6) · dictionary
├─ Floor 3  Specs          named DataSpecs → THE Workbench (this design's subject)
└─ (Floor 4 Elements       lives on the canvas — the DATA facet is its door back down)
```

Two zooms, unchanged (one-model-two-zooms): the element's **DATA facet** = summary + core-ops band (DW-B) + one door; the **Workbench** = THE editor. Nothing else edits a spec — held by `FF-ONE-SPEC-EDITOR`, now made *honest* by the Capability Matrix (§2·C2) instead of by an allow-list.

### 1.2 The Workbench (universal three-pane)

```
┌ header: name · shape chip · lifecycle chip (Draft n changes ▸ Publish)  [C3] ┐
├───────────────┬──────────────────────────────┬──────────────────────────────┤
│ STEP LANE     │ LIVE GRID                    │ RESULT / QUERY PANE          │
│ 0 Get ▸ head  │ per-selected-step preview,   │ generated query (builder↔code│
│ 1 Filter …    │ Cell honest-states, governed │ duality, read-only default;  │
│ 2 Derive …    │ headers, TanStack Table      │ steward: lowered ObsQuery)   │
│ + step (7-verb│                              │ + writable raw JSON (steward)│
│   palette)    │                              │                              │
└───────────────┴──────────────────────────────┴──────────────────────────────┘
```

What changes vs. today: **every step card — the head included — resolves a rich editor by declaration** (§2·C1), with full parity to the dedicated editors it replaces. The lane is the *only* authoring geometry; kinds differ only in which head variant occupies step 0 and which tail the desugar emits:

| head variant (SourceStep) | step-0 card face | rich editor content (parity source) |
|---|---|---|
| `metrics` (governed) | metric chips | MetricPalette pick/remove · per-metric coords |
| `query` (ObsQuery) | measure + dims summary | MeasureSelector · FieldWells · FilterBuilder (from QuerySpecEditor Advanced) |
| value-cell `over` (Add.4) | code @ coords | measure-code **offer** field (C4) · years · coords · at/grain/rollup (from Timeseries/GrowthEditor) |
| `cells` (Add.5) | n explicit rows | row grid editor: code/denom/label/color/negate/isTotal (from RowListEditor) |

Tail steps already have this property: every transform op carries a `PropSchema` rendered by the one generic `TransformStepEditor`, grouped by the 7-verb `category` projection (`step-registry.ts:21`). The design finishes the symmetry: **heads get what tails already have.**

### 1.3 Authoring flow per kind (before the DU5 door)

- **Open a stored `pipeline`/`query`** — three-pane, as today.
- **Open a stored sugar kind (timeseries/growth/pivot/transform/…)** — the lane shows its desugared steps as a *reversible view* (Step-A semantics, unchanged); every step is now **editable at full parity** because its head/step editor carries the dedicated editor's fields. First write converts the instance to `pipeline` (convert-on-first-edit — the decided, disclosed, per-instance soft door). The dedicated editor for that kind retires **only when the Matrix proves the workbench a superset** (§2·C2) — the Strangler seam, per kind, machine-gated. Until then the kind stays on the fallback lane exactly as the restoration left it. **No kind is ever re-admitted by hand again** — admission is derived.
- **Create new** — the Shape Gallery (§2·C7): "start from…" cards projected from `SPEC_CATALOG` (`make()` seeds + label + description + example), *including `pipeline`* (closes QC-4). Picking a shape seeds the lane; the author lands in step 0 with the offer-driven head editor open.
- **Convert** — the shape chip in the header opens the same gallery as a converter. To-pipeline is always offered (desugar, lossless by construction). From-pipeline-to-sugar is offered only where a shape-recognizer trivially matches (deferred — YAGNI; the asymmetry QC-4 names is the *picker omission*, which the projection removes).

### 1.4 Simple forward, full power one click behind

One surface, two planes — never two editors (the archipelago must not be reborn as a "basic/advanced mode"):

- **Author plane (default):** step lane in governed nouns (7 verbs, metric labels, dimension labels — `FF-AUTHOR-NO-QUERY`), live grid, offer-driven fields (never a typed identifier — C4), lifecycle chip, honest states. Nothing here shows an identifier, a type signature, or wire syntax.
- **One click behind (progressive disclosure, same surface):** per-step "advanced" disclosure inside the step editor (rollup/clamp/grain, encoding details); the result pane's code face (builder↔code duality).
- **Steward lens (role, not mode):** lowered ObsQuery, raw codes beside labels, writable raw JSON, DQ detail, `plane:'system'` fields. The lens *adds*; it never relocates.

### 1.5 Visual language direction (reference-class, token-driven)

The bar: Airtable/Linear surface discipline + Power Query lane rhythm, Georgian-first typography. Binding rules for the build (senior-frontend executes; this is direction, not pixel spec):

1. **Every color/space/type value is a token** from `packages/styles` `@layer` — zero raw hex in workspace or charts. The Apex chart theme becomes a *derived projection of the same tokens* (one theme SSOT in styles; `packages/charts` reads it through its adapter) — this is the architectural form of the queued "visual refresh" card item, and where the x-axis tick-truncation cosmetic lands.
2. **Honest-state colors are semantic tokens** (`no-data`/`unbound`/`error`/`masked`) — the grid, the facet summary, and the lifecycle chip draw from the same scale (Law 11: one honest-state vocabulary everywhere).
3. **Density:** the lane is compact (36–40px step cards, icon = 7-verb category), the grid is data-dense (TanStack virtual rows), the step editor is a roomy single column. One accent color; state, not decoration, carries the palette.
4. **Zero plumbing tokens on the author plane** — enforced, not hoped (§3·QC-1).

---

## 2. The concept layer — new first-class concepts

| # | Concept | One line | Canonical grammar it EXTENDS (Law 10) | Reference precedent | Guarding fitness |
|---|---|---|---|---|---|
| C1 | **Step Contract** | every step (heads included) declares its authoring surface once; the lane projects it | `SPEC_CATALOG` schema-or-editor idiom + transform-op `PropSchema` registry | Power Query step settings panes | FF-STEP-AUTHORING-COMPLETE |
| C2 | **Capability Matrix** | kinds declare required capabilities; editors declare provided; admissibility + parity are DERIVED | `SpecManifestEntry` (additive field) + editor registration descriptor | k8s conformance suites; Backstage capability descriptors | FF-EDITOR-CAPABILITY-PARITY (matrix-driven) |
| C3 | **Authoring Lifecycle** | draft → validate → publish → revision, ONE grammar for every config document | config PUT boundary + honest-state chip grammar + Placement Law for the chrome band | Looker dev-mode/deploy; Grafana save-with-diff; dbt targets | FF-DRAFT-EXPLICIT-PUBLISH · FF-PUT-VALIDATED · FF-REVISION-ON-PUT |
| C4 | **Offer Port** | identifier-semantic fields declare a role; a role-keyed provider offers governed choices; the author never types an identifier | `PropSchema` field roles + FieldControl registry + `useBindVocabulary` precedent | Retool/IDE typeahead; our own binding autocomplete | FF-NO-NAKED-IDENTIFIER |
| C5 | **Binding Summary** | kind-agnostic `summarizeBinding(spec)` — the facet's summary zoom is a projection of ANY spec | desugar SSOT + `extractDeps` | Grafana panel datasource summary | FF-BINDING-SUMMARY-TOTAL |
| C6 | **Lineage Door** | `explainCell(ref) → LineageRecord` derived from the same graph that computed the value; a door on every rendered cell | Reactive Query Graph (rendering canon) + Cell honest-state grammar + Law 9 badges | Eurostat metadata flags; Power BI see-records; OpenLineage | FF-EXPLAIN-EVERY-CELL |
| C7 | **Shape Gallery** | DataSpec kinds become *starting shapes* projected from `SPEC_CATALOG` — the conceptual close of "one concept, one editor" | `SPEC_CATALOG` `make()` seeds (ADR-049 P1) — presets-are-declarations (ADR-049/0102 R3 lineage) | Power Query templates; Airtable view gallery | FF-PICKER-IS-CATALOG-PROJECTION |

### C1 — Step Contract

**What.** A `StepAuthoringContract` per step discriminant: `{ label:{ka,en}, category (7-verb), surface: schema | editorKey, provides: CapabilityId[] }`. Transform ops **already have** label+schema+category in the op registry — C1 is formally: (a) extend the same declaration to the four `SourceStep` head variants; (b) let a step declare `editorKey` where a `PropSchema` is genuinely too poor (the head variants; the cells row-grid), resolved through a boot-registered `registerStepEditor` — the exact `registerSpecEditors` idiom (`registerSpecEditors.ts`) one level down. The generic `TransformStepEditor` becomes the *dispatcher* (schema → Inspector; editorKey → registry), with no per-op branch — `FF-NO-DATASPEC-SWITCH` extended to steps.

**Why it is the root move.** The regression happened because head editing had no contract — the three-pane could *show* a value-cell head but had nothing declared to *edit* it with, so the restoration had to fall back to whole-kind dedicated editors. With C1, the dedicated editors are **decomposed and re-homed** as head/step editors (their field groups survive verbatim — TimeseriesEditor's code+years become the value-cell head editor; RowListEditor's row grid becomes the cells head editor; QuerySpecEditor's Advanced wells/filter/measure become the query head editor). Nothing is rebuilt; everything is re-declared at the right granularity.

**Arrow discipline.** Contract data (label/category/provides/editorKey string) = engine-side, serializable, lands in `specManifest()` → Constructor-introspectable. React editors = panel-side, resolved by key at boot. Same split `SPEC_CATALOG` already proves (`spec-catalog.ts:43-64`).

### C2 — Capability Matrix

**What.** Three declarations, one derivation, one probe layer:

1. `SpecManifestEntry.capabilities: CapabilityId[]` (additive) — what authoring THIS kind **requires**. Enumerated once from the dedicated editors' contracts, e.g. `timeseries: ['head.measure-code.edit','head.years.edit']`; `growth: + ['growth.single-multi.toggle']`; `pivot: ['pivot.rows.edit','pivot.keyField.edit','pivot.values.edit','pivot.colors.edit']`; `query: ['head.wells','head.filter-builder','head.measure-selector','encoding.edit','raw-json.write']`. `CapabilityId` = const union in core (typo-proof).
2. Editor registrations (`registerSpecEditor` / `registerStepEditor`) gain `provides: CapabilityId[]`.
3. **Derived admissibility** replaces the hand gate: `isWorkbenchAdmissible(kind) = required(kind) ⊆ union(provided by registered step/head editors + workbench core surfaces)`. `workbenchModel.ts:35` (`isWorkbenchShaped`) is re-derived from this — never hand-widened again. A future regression (an editor unregistered, a capability dropped) **degrades gracefully**: the kind falls back to its dedicated lane instead of shipping read-only — the 0104 incident becomes unrepresentable.
4. **Probe layer** (the honesty check): the fitness test holds a registry `CapabilityId → probe(render assertion)`. FF-EDITOR-CAPABILITY-PARITY reds when: a required id has no provider · a provider claim has no probe · a probe fails. Claims cannot lie; the current hand-written parity test (`editorCapabilityParity.fitness.test.tsx`) refactors into this — same probes, now *enumerated from the declaration* instead of from a human's memory of the incident.

**This is the generalization of the card's BINDING FIX** ("enumerate the removed surface's capability set FIRST, prove the survivor is a superset") from a discipline into machinery.

### C3 — Authoring Lifecycle (draft → publish)

**What.** One lifecycle grammar for every config document (DataSpec, source, page — the corruption incident hit sources and specs; pages get it for free):

- **Draft:** edits accumulate client-side against the loaded revision (localStorage-persisted for crash safety, keyed by doc id + base revision). Chip: `Draft — n changes` (amber, the hold's chip graduates). Server-side draft slots are **deferred** until a multi-device/multi-author trigger exists (named scoping decision — YAGNI now, expand-contract later).
- **Publish:** explicit action → **validated PUT**. Validation at the API boundary (contracts layer): shape (spec parses via the spec registry / page schema) + referential integrity (`datasetCode` exists; a source's dims ⊆ the cube DSD's dims; metric refs resolve). Reject = 422 with structured field errors, surfaced in the publish affordance — never a silent 200 that stores corruption.
- **Revision:** every successful PUT appends to an additive revision log (id, doc, actor, timestamp, full body — expand-contract: new storage, old reads untouched). Restore = republish an old body (a new revision — history is append-only, never rewritten).
- **Discard / undo:** discard = drop draft, reload published; undo-within-draft = the draft's local history.
- **Placement:** the chip + Publish/Discard band is ONE component placed by the Placement Law (`studio/placement/resolveSurface.ts`) in both zooms — not hand-mounted per host (DW-D lineage).

`DEFAULT_AUTHORING_HOLD` and its toggle are **deleted** — the hold was this model with the Publish button missing.

### C4 — Offer Port

**What.** `PropSchema` fields whose semantic is an identifier declare `role: 'measure-code' | 'source-ref' | 'metric-ref' | 'dim-code' | …`. A role-keyed `OfferProvider` registry (`resolveOffers(role, ctx) → Offer[]` — label, id, plane, scent like unit/coverage) feeds ONE typeahead FieldControl. Governed catalog + raw-cube codelists are the first two providers; the ADR-051 GAP-3 `source-ref` picker is this port's second consumer, not a separate build. This *reuses the proven pattern*: the binding autocomplete already ships a governed-vocabulary offer surface (`bindSuggestions.ts` / `useBindVocabulary`) — C4 is that idea promoted to a port for identifier fields.

### C5 — Binding Summary

**What.** Engine-side `summarizeBinding(spec, catalog) → BindingSummary { state: bound|empty|error, measures[], sources[], dims[], stepCount }`, computed via the desugar SSOT + `extractDeps` — so it is total over kinds *by construction*: any kind that resolves has a summary; "not bound" is reserved for a genuinely absent/empty spec. The DATA facet's summary zoom renders this record; the metric-facet's current metric-ref-only squint dies.

### C6 — Lineage Door ("explain this number")

**What.** `explainCell(nodeRef, cellRef) → LineageRecord { value, unit, state, metric?{id,label,definition}, source{datasetCode, provider, lastUpdated, vintage?}, coords, steps[{label, category}], ctx }` — **derived from the same reactive-graph node + desugared pipe that produced the value** (projection, never a parallel trace side-channel — parallel bookkeeping drifts; a projection cannot). Surface: an info door on rendered cells/points (canvas + portal), popover in author nouns; steward lens adds the lowered query; section export (Law 9) embeds it. v1 scope is the record above — no upstream DAG visualization (YAGNI; the record already IS the Eurostat-integrity identity made tangible: definition + source + vintage + transformations + coordinates).

### C7 — Shape Gallery

**What.** The `SpecTypePicker` (restoration R1) graduates: a gallery projected from `SPEC_CATALOG` (label, description, example, `make()` seed) — *including `pipeline`* — used for create and convert. Pre-DU5 it seeds the declared kind; **post-DU5 (the ⛔ door) kinds become pure starting shapes**: every seed stores `pipeline`, sugar kinds remain readable (expand-contract) but are no longer an authoring destination, dedicated editors and the fallback lane retire. That is the end-state of "one concept, not two sources" — one grammar, many doors in.

---

## 3. The five QC findings — resolved as consequences

| QC | Finding | Root cause (located) | Dies by | How |
|---|---|---|---|---|
| 1 | Raw TS signatures shown to authors (`Record<string, DimVal>[]`) | The tokens are **declared in the engine catalog as author-facing hints** — `spec-catalog.ts:201,204,219,239` (`SpecField.type` free-text + descriptions embedding TS types), projected verbatim | C1 + plane law | `SpecField.type` is reclassified `plane:'system'` (steward-lens only); author-plane field faces come from the Step Contract's schema/editor (the rows grid, the color-map control), never from a type hint. Fitness FF-NO-PLUMBING-TOKENS: author-plane render output of every catalog-driven editor contains none of the token set `Record<`, `Partial<`, `[]`, `DimVal`, `=>` |
| 2 | Metric-facet lies "data not bound" for a working pipeline spec | Facet summary reads metric-refs only — a per-kind squint, blind to 7 of 8 kinds | C5 | The facet renders `summarizeBinding` — total over kinds by construction; "unbound" only when truly empty. FF-BINDING-SUMMARY-TOTAL runs the stored-corpus fixtures through it: zero false-unbound |
| 3 | Duplicate metric options in perspective-scope dropdown | Options assembled by concatenating catalog sources instead of consuming one projection | DW-A (unchanged wave) + one invariant | The dropdown consumes the ONE `MetricCatalogView` selector (identity = metric id, deduped at the selector). FF-METRIC-OPTIONS-UNIQUE. The concrete double-source is located during DW-A and killed at its root, not masked by dedup alone |
| 4 | Pipeline conversion one-way (picker omits `pipeline`) | Picker is a hand-list, not a catalog projection | C7 | The gallery enumerates `SPEC_CATALOG` keys — `pipeline` appears because it is declared; a future kind appears for free. FF-PICKER-IS-CATALOG-PROJECTION (picker options ≡ catalog keys) |
| 5 | `code` fields unguarded free-text (P-OFFER violation) | Identifier fields carry no offer declaration — nothing in the grammar says "this is an identifier" | C4 | `role:'measure-code'` on every code field; typeahead offers governed metrics + raw-cube codes with scent. FF-NO-NAKED-IDENTIFIER: every catalog/step-contract field whose type-hint or key matches the identifier class declares a role |

---

## 4. The wave plan — folded into DW-C → DU6 → DW-A/B/D

**Reshape declared explicitly:** the blessed DW/DU relative order is preserved; three E-waves are inserted *before* DW-C, and E2 (universal spine) is inserted *before* DU6. Rationale: (1) **E0 preempts everything** — the authoring-hold means :3013 does not save; every subsequent journey-walk's "done" is untruthful until persistence is honest; (2) **E2 before DU6** — DU6 re-lays the model floor around the workbench; re-laying chrome around a still-forked editor would lay it twice (Strangler: strangle the fork first, then dress the floor). The engine track (ADR-046 Add.5 build, multi-code growth proof) runs in parallel per the card, owned by engine-specialist; surface waves stay WIP=1.

| Wave | Content | Canon anchor | Biting gate | Live journey (:3013) |
|---|---|---|---|---|
| **E0** | Authoring Lifecycle: draft chip + Publish/Discard band (placement-routed) · PUT validation (shape + referential) · revision log on PUT · delete `DEFAULT_AUTHORING_HOLD` | C3 · Law 9 (integrity) · Law 11 (honest chip) | FF-DRAFT-EXPLICIT-PUBLISH · FF-PUT-VALIDATED · FF-REVISION-ON-PUT | J-LIFECYCLE: edit → amber draft n → publish → reload persists → restore a prior revision → an invalid PUT is rejected with a readable reason |
| **E1** | Capability Matrix: `capabilities` on `SpecManifestEntry` · `provides` on editor registration · derived `isWorkbenchAdmissible` replaces `isWorkbenchShaped` · parity fitness refactored matrix-driven | C2 · Law 10 (extend the catalog) | FF-EDITOR-CAPABILITY-PARITY (matrix form: no orphan requirement, no unprobed claim, no failing probe) | J-PARITY: unregister one editor in a harness → its kind degrades to fallback (never read-only three-pane) |
| **E2a** | Universal spine, keystone kind: Step Contract machinery (head-variant contracts + `registerStepEditor`) · value-cell head editor (code-offer + years + coords) · **Offer Port** with `measure-code` + `source-ref` roles (GAP-3 folds in) · Shape Gallery incl. `pipeline` → **timeseries auto-admits** | C1 + C4 + C7 · ADR-046 Add.4 | FF-STEP-AUTHORING-COMPLETE · FF-NO-NAKED-IDENTIFIER · FF-PICKER-IS-CATALOG-PROJECTION · matrix green for timeseries | J-PIPE-TS: open stored timeseries → three-pane → edit code via offers (never typed) → per-step grid live → convert-on-first-edit disclosed → publish |
| **E2b** | growth head parity (lag/window tail + single↔multi as a declared capability) → growth auto-admits | C1/C2 | matrix green for growth (incl. `growth.single-multi.toggle`) | J-PIPE-GR: single↔multi both directions inside the lane |
| **E2c** | pivot step parity: rows/keyField/values/colors as rich step editors (kills the `Record<…>` faces) + **FF-NO-PLUMBING-TOKENS** lands platform-wide | C1 · Law 11 (QC-1) | FF-NO-PLUMBING-TOKENS · matrix green for pivot | J-PIPE-PV: author a pivot end-to-end, zero plumbing tokens on the author plane |
| **E2d** | transform parity (inline source rows grid + encoding step editor) → transform auto-admits; dedicated editors for E2a–d kinds demoted to steward-lens legacy (not deleted — DU5 deletes) | C1 | matrix green for transform | J-PIPE-TR: inline rows edited in-lane |
| **E3** | Binding Summary: engine `summarizeBinding` + DATA-facet summary rendering (QC-2) | C5 · Law 11 | FF-BINDING-SUMMARY-TOTAL (stored-corpus, zero false-unbound) | J-FACET: pipeline-bound chart shows an honest summary + door |
| **DW-C** | classifier scent 3→1 disclosure — *unchanged from the blessed plan* | redistribution verdict #3 | FF-CLASSIFIER-SCENT | per DESIGN-redistribution |
| **DU6** | model-floor redistribution (flow strip, browse+manage co-located, DataFlowMap de-dup) — *unchanged* | verdict #4 | FF-MODEL-BROWSE-EDIT-COLOCATED · FF-DATAFLOW-SINGLE-MOUNT | per DESIGN-redistribution |
| **DW-A** | ONE MetricCatalogView + **QC-3 folded**: perspective-scope options consume the one selector; double-source killed at root | verdict #1 | FF-ONE-METRIC-VIEW · FF-METRIC-OPTIONS-UNIQUE | per DESIGN-redistribution + dropdown shows unique options |
| **DW-B** | core-ops band on the DATA facet writing declarative TransformStep tails — now *cheaper*: the band reuses Step Contract editors | verdict #2 · C1 | FF-COREOPS-NOT-FOCUSVIEW | per DESIGN-redistribution |
| **E2e/f** | ratio-list + row-list (needs Add.5 `cells` head, engine track) · multi-code growth (needs its own equivalence proof) → auto-admit on matrix+equiv green | ADR-046 Add.5 · C2 | FF-EXPLICIT-CELLS-READ-SHARED · FF-PIPELINE-EQUIV · matrix green | J-PIPE-RL/RO |
| **E4** | Lineage Door v1: `explainCell` + cell info door (canvas + portal) + export embedding | C6 · Law 9 | FF-EXPLAIN-EVERY-CELL (every ok-cell in the stored corpus yields a complete record) | J-EXPLAIN: click a GDP cell → definition, source, vintage, steps, coords — in Georgian, author nouns |
| **DW-D** | interruption axis (confirm-dialog law) — *unchanged*; E0's publish/discard confirms consume it | verdict #5 | FF-MODAL-BLOCKING-ONLY | per DESIGN-redistribution |
| **E5** | Visual refresh: token-derived chart theme SSOT in `packages/styles` + charts adapter · workspace density/typography pass · x-axis tick fix | §1.5 · Law 3 (arrow: charts read tokens) | FF-NO-RAW-HEX (charts theme + workspace surfaces token-sourced) | J-VISUAL: GDP page + workbench side-by-side against the reference bar; owner eyeballs |
| **DU5 ⛔** | THE program door: default emission flips to `pipeline` · kinds become pure starting shapes (C7 end-state) · dedicated editors + fallback lane deleted · legacy resolvers retired | ADR-051 DU5 · C7 | FF-ALL-KINDS-SHAPED · FF-PIPELINE-EQUIV full-corpus · **full matrix green** · complete J-walk suite | J-ALL: every journey above re-walked on the flipped default |

Shippability: every wave is independently revertable and journey-walked (WIP=1, DoD = live walk, never gate-green alone). E2 sub-waves each end with a *visible* capability (a kind entering the three-pane at full power) — no long dark tunnel.

### One-way doors (owner adjudication)

1. **DU5** (existing ⛔, now enriched): emission flip + sugar kinds demoted to starting shapes + dedicated editors and fallback lane **deleted**. Everything before it is reversible; this is the single program door. Gate as tabled.
2. **Revision-log API contract** (E0): the revision record shape becomes a public contract once the panel reads it. Additive/expand-contract, but flagged: changing it later costs a migration. Approve the shape at E0 review.
3. **Capability-id vocabulary** (E1): ids land in `specManifest()` → visible to the Constructor surface. Renaming later is expand-contract but noisy. Approve the initial vocabulary at E1 review.
4. *Not* a new door: convert-on-first-edit (already decided, per-instance, disclosed).

---

## 5. Rejected alternatives (per major call)

**Universal spine via Step Contract (C1):**
- *Permanent dual regime* (dedicated editors for sugar kinds, three-pane for pipeline/query — i.e., freeze the restoration state): two authoring grammars for one concept — the owner's original "two sources" complaint, structurally permanent; picker/convert asymmetries and capability drift become load-bearing. Rejected: violates the mandate's "one pipeline does everything."
- *Rebuild dedicated-editor UIs inside the workbench as per-kind panes* (a `switch(spec.type)` in the workbench): N kinds × bespoke panes, violates FF-NO-DATASPEC-SWITCH/OCP — the exact anti-pattern ADR-049 P1 removed; the next kind costs a workbench edit. Rejected: declaration over dispatch.
- *Adopt an external query-builder/steps library*: re-litigates the settled TanStack-only verdict; no candidate carries our governed-noun plane, Cell honest states, or per-step live grid. Rejected on the settled decision + fit.

**Capability Matrix (C2):**
- *Keep hand-written parity assertions only* (today's FF): guards yesterday's incident, not tomorrow's — a new capability added to a dedicated editor silently misses the list; not introspectable; admissibility stays a hand gate. Rejected: the root cause (hand-maintained superset claims) survives.
- *Runtime DOM feature-detection for admissibility*: `render(config)` stops being deterministic — the gate decision would depend on empirical render outcomes at runtime. Rejected: violates the renderer-purity canon.
- *Matrix as a standalone YAML/doc*: a second SSOT beside `SPEC_CATALOG` that drifts from it. Rejected: Law 10 — extend the existing catalog, never a parallel bridge.

**Authoring Lifecycle (C3):**
- *Keep the hold + manual toggle*: a plumbing switch, not a model — authors either lose work (hold on) or risk corruption (hold off); the amber chip admits the defect without fixing it. Rejected: symptom patch.
- *Full git-style branching/per-user dev mode* (Looker-complete): M-5 overreach for a single-steward panel; merge semantics for JSON configs is a project of its own. Rejected: YAGNI now; the revision log is the expand-contract floor a future branching model stands on.
- *Continuous autosave + undo only* (Figma-complete): fits a private canvas; here a publish drives a **live public statistical portal** — the explicit publish IS the integrity boundary (Law 9). Autosave-to-draft is retained; autopublish is the part rejected.

**Lineage (C6):**
- *Trace/log side-channel instrumentation*: parallel bookkeeping drifts from the computation it describes; every pipeline change must remember to update it. Rejected: projection from the reactive graph is truthful by construction.
- *Lineage precomputed and stored in config*: lineage is derived data; storing it makes config carry results (Law 2 inversion) and it stales on every data refresh. Rejected.

**Offer Port (C4):**
- *Validate-on-blur free text*: the author still types identifiers — P-OFFER's letter violated even when validation catches typos; no discovery. Rejected.
- *Per-field hardcoded option lists*: duplicates the catalog per field, drifts, closed to new sources. Rejected: role-keyed provider registry is the OCP form, and the pattern is already proven by the binding autocomplete.

**Binding Summary (C5):**
- *Teach the facet about `pipeline` specifically*: the per-type special case — the next kind breaks it again. Rejected: anti-pattern by canon.
- *Hide the facet for non-metric specs*: information loss; the facet is the summary zoom of one-model-two-zooms — removing it forks the model. Rejected.

**Simple/power IA (§1.4):**
- *A "basic / advanced" editor mode switch*: two surfaces for one concept — the archipelago reborn one level up. Rejected: disclosure and lens, never bifurcation.
- *Steward-only workbench, authors get forms*: caps the non-programmer at forms — the mandate says simple AND powerful for the same person. Rejected.

**Wave order (§4):**
- *Blessed order untouched, E-waves appended after DW-D*: leaves the platform not-saving (hold) through five surface waves, and lays DU6's floor around a fork it must re-lay. Rejected: sequencing dishonesty.
- *Big-bang unification (all kinds at once in one wave)*: exactly how the 0104 regression happened — parity is provable only kind-by-kind. Rejected: Strangler or nothing.

---

## 6. Fitness ledger (new / changed)

| FF | Kind | Asserts |
|---|---|---|
| FF-EDITOR-CAPABILITY-PARITY | **changed** (matrix-driven) | no orphan required capability · no unprobed provider claim · no failing probe · admissibility derived, never hand-listed |
| FF-STEP-AUTHORING-COMPLETE | new | every registered transform op + SourceStep variant resolves schema-or-editor |
| FF-DRAFT-EXPLICIT-PUBLISH · FF-PUT-VALIDATED · FF-REVISION-ON-PUT | new | no unpublished write reaches the store · invalid PUT = 422 structured · every PUT appends a revision |
| FF-NO-NAKED-IDENTIFIER | new | every identifier-class field declares an offer role |
| FF-NO-PLUMBING-TOKENS | new | author-plane output of catalog-driven editors is free of the TS-token set |
| FF-BINDING-SUMMARY-TOTAL | new | stored corpus → zero false-unbound summaries |
| FF-EXPLAIN-EVERY-CELL | new | every ok-cell yields a complete LineageRecord |
| FF-PICKER-IS-CATALOG-PROJECTION | new | picker/gallery options ≡ SPEC_CATALOG keys |
| FF-METRIC-OPTIONS-UNIQUE | new (DW-A fold) | option identity unique at the selector |
| FF-NO-RAW-HEX | new (E5) | chart theme + workspace surfaces token-sourced |

---

## 7. Owner decision list

1. Bless the reshaped order (E0 first; E2 before DU6) — §4 rationale.
2. Approve the three doors in §4 (DU5 enrichment · revision contract shape at E0 · capability vocabulary at E1).
3. C3 scoping: client-side drafts now, server-side draft slots deferred — confirm the deferral.
4. C6 v1 scope: LineageRecord popover + export, no DAG visualization — confirm.

---

## 8. Lead elevation pass (orchestrator, 2026-07-22) — verdict: RECOMMEND

- **Verified in code:** the QC-1 root-relocation claim is TRUE — `spec-catalog.ts` declares raw TS signatures as author-facing hints, embedded even in the Georgian descriptions («Record<string, DimVal>[] — სტატიკური მონაცემები»). The fix is correctly engine-side; editor cosmetics would have masked it.
- **The thesis holds and is the platform's own move generalized** (ADR-038→041→049 lineage: declaration over dispatch, pushed one granularity deeper). The four seeds the lead offered are correctly unified under it rather than delivered as four features.
- **Refinement A (binding for E0):** E0 carries an apps/api surface (PUT validation + revision log) on the doc's own unverified storage assumption. E0 therefore OPENS with a short api-side design check (database-architect + senior-backend lens) that fixes the revision-record contract — door #2 is decided there, not mid-build.
- **Refinement B (binding for E4):** FF-EXPLAIN-EVERY-CELL asserts *structural totality*, not metadata omniscience — fields the provisioning genuinely lacks (e.g. vintage) render as DECLARED-ABSENT per Law 11 honest states; absent metadata is a governance-debt chip, never a fitness red.
- **Sequencing check passed:** E0-first is the honest order (nothing "journey-walks" truthfully while the platform doesn't save); E2-before-DU6 avoids laying the floor twice. The blessed DW/DU relative order survives intact.

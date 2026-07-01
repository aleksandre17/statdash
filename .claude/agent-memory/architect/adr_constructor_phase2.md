---
name: adr-constructor-phase2
description: ADR — Constructor (Phase 2) architecture; canvas/tree/inspector/preview model, registry editorMeta seam, capability-discovery palette, DataSpec authoring, publish/RBAC/i18n, round-trip guarantees
metadata:
  type: project
---

# ADR — Constructor (Phase 2): the JSON-generating authoring core

Status: PROPOSED (2026-06-23). Supersedes nothing; extends ADR-0026 (bootstrap runner) and the cube-profile section. North star (CLAUDE.md): "Constructor generates JSON, no code." The Constructor is a visual authoring app in `apps/panel` that PRODUCES the configs `apps/geostat` (the SDUI runner) renders.

Related: [[adr_platform_structure_rearchitecture]] (when libs go `@statdash/*` + a `contracts` package lands, the wire shapes below move there), [[project_semantic_layer_n26]] (MetricRegistry is a future palette axis), [[project_catalog_react_purity]] (palette already reads registry metas, not Shell modules).

---

## Context — what already exists (verified on disk, 2026-06-23)

The Constructor is FAR past "a wizard". The standing assets are strong and the design must build ON them, not replace them:

- **Live WYSIWYG canvas** — `apps/panel/src/canvas/CanvasView.tsx` renders the REAL `@geostat/react` `NodePageRenderer` (Layer 1, pointer-events:none) under a `CanvasOverlay` interaction layer (Layer 2). This is the Builder.io / Craft.js two-layer pattern, already implemented. Canvas renders against `staticStore` (empty rows) — a structural preview, no fetch.
- **Registry-driven palette** — `canvas/paletteEntries.ts` builds the palette purely from `nodeRegistry.list()` + `getByCapability(CAPS.*)`. A new registered node type appears with zero palette code change (open-registry discovery, skill §12).
- **Three-layer session model** — `types/constructor.ts`: Layer 1 Data (DataSources + NamedDataSpecs), Layer 2 Site (identity/nav/theme/bindings), Layer 3 Pages (flat `CanvasNode` map + ordered `nodeIds`). Held in a zustand store `store/constructor.store.ts` with full undo/redo history (`constructor.history.ts`).
- **Flat-store → engine-tree adapter** — `canvas/canvasPageAdapter.ts` `toNodePageConfig()` projects the flat `CanvasPage` into the engine `NodePageConfig` tree the renderer validates. Flat store (Identity Map, O(1) patch by id) + tree projection — deliberate and correct.
- **DataSpec authoring** — `features/data-layer/DataSpecEditor.tsx` is a type-picker over `SPEC_CATALOG` (9 discriminants) routing to per-type editors (query/timeseries/growth/ratio-list) with a JSON fallback for the rest. Query editor has FilterBuilder, PipelineBuilder, EncodingEditor, MeasureSelector — declarative, no functions (Law 2 honoured).
- **The OCP inspector seam is DESIGNED and 88% POPULATED** — `engine/react/src/engine/slice-meta.ts` defines `PropField`/`PropSchema` (typed field descriptors: type, label LocaleString, default, options, validation, `showWhen`, `group`) + `PropertyGroup` + `SlotDef`. The `NodeRegistry` stores `schema`/`defaults`/`slots`/`groups`/`caps` per type and exposes `getSchema()`, `getDefaults()`, `getSlots()`, `describeRegistry()`. **15 of 17 node metas already declare a `schema: XSchema`** (e.g. `nodes/hero/default/meta.ts` → `HeroSchema`). `propSchemaToJsonSchema.ts` bridges PropSchema → JSON Schema Draft-7 for external form generators.
- **Capability discovery, server side** — `GET /api/cube/:datasetCode/profile` (cube/index.ts) returns dimensions (conceptRole + isTime + members), measures (resolved units + source tier), and the actualRegion seam (populated/empty-by-design vs missing). `GET /api/bootstrap` + `GET /api/data-sources` complete the discovery surface.
- **Authoring API + version FSM** — `config/pages.ts`: page identity + append-only `page_version`; PUT appends a version atomically; POST `/:id/publish` promotes latest + demotes others atomically; lazy `migratePageConfig` on read with a 409 forward-compat guard; AuditLogger injected (who saved/published — the P3-5 RBAC trail).
- **Round-trip guarantees** — P3-1 round-trip fitness (55 tests), `migratePageConfig` (P3-3), locale-coverage fitness (P2-6), undefined-drop contract.

### The real gaps (not "build a Constructor" — close these seams)

1. **No Inspector consumer.** The PropSchema seam is populated in the engine but NO component in `apps/panel` reads `nodeRegistry.getSchema(type)` and renders a property panel. This is the single highest-leverage gap: every node already declares its editable shape; nothing renders it. The panel still relies on per-type bespoke editors only for DataSpecs.
2. **Two model shapes for the same thing.** The panel's `CanvasNode { kind, config, children:string[] }` is a panel-private remodel of the engine `NodeDef`. The adapter projects one to the other, but `CanvasNodeKind` is a HARDCODED union of 8 kinds (`types/constructor.ts`) — a Law-1/OCP violation: a new registered node type does NOT become placeable until that union is hand-edited. The palette is open-registry; the store model is closed-enum. They must be unified.
3. **Preview uses empty `staticStore` only.** Good for structure; insufficient for true WYSIWYG of data panels (a chart with no rows looks empty regardless of the DataSpec). No sampled-data preview path.
4. **DataSpec authoring is not profile-driven.** The editors let you type a DataSpec; they do not yet bind to a chosen dataset's `cube-profile` so the user can only build VALID, populated queries (measures/dims/members offered from the profile; actualRegion gating).
5. **No "propose the right chart" leap.** conceptRole→panel-type suggestion (geo→map, time→timeseries) is not wired, though `suggestedEncodings` (P3-2) is the precedent.
6. **Publish/RBAC/i18n authoring** exist server-side but the panel UI for role-gated publish and per-locale field authoring is partial.

---

## Decision

Adopt the **Tree + Inspector + Live-Preview triad** (Webflow/Builder.io/Grafana lineage) over free-canvas drag-drop, and close the six seams above. Concretely:

### D1 — Editing model: structured tree/outline + live preview + schema-driven inspector (NOT free canvas)

The config IS a `NodeDef` tree and the renderer IS registry-driven, so the editor manipulates the tree directly:

- **Outline/Tree pane** (left): the node hierarchy, drag-to-reorder/reparent, add/remove. Authoritative structure editor. Mirrors Webflow Navigator, Builder.io layers, Grafana's row/panel tree.
- **Canvas/Preview pane** (center): the EXISTING `CanvasView` (real `NodePageRenderer` + overlay). WYSIWYG via the SAME renderer — never a second rendering path (skill §12: renderer is pure `render(config)→UI`).
- **Inspector pane** (right): schema-driven property panel — the NEW consumer. Reads `nodeRegistry.getSchema(type,variant)` for the selected node and renders fields generically from `PropField[]`, grouped by `PropertyGroup`. NO bespoke UI per node type.

Rationale: free-canvas (absolute x/y) is wrong for a document-flow SDUI tree — it would invent positioning state the renderer cannot honour (Principle of Least Astonishment broken: what you drag ≠ what renders). The tree+inspector triad keeps the editor model congruent with the render model, guaranteeing lossless round-trip (skill §12 cornerstone). This is also how the closest reference platforms that target a *component tree* (Builder.io, Plasmic, Webflow) work; free-canvas (Figma) targets a *layer/coordinate* model, which we are not.

### D2 — The Inspector seam: `editorMeta` already IS `PropSchema` — make the panel consume it; extend, don't reinvent

The OCP seam exists: `PropField`/`PropSchema` on every slice meta. The decision is to **build the generic Inspector that consumes it** and to **complete + extend the schema vocabulary**, not to introduce a parallel `editorMeta`. Specifically:

- **New: `apps/panel/src/inspector/Inspector.tsx`** — given a selected node, `nodeRegistry.getSchema(node.type, node.variant)`, render one control per `PropField` keyed by `field.type`. A `FieldControlRegistry` (panel-side, mirrors `nodeRegistry`) maps `PropFieldType → control component`: `string→TextField`, `number→NumberField`, `boolean→Switch`, `color→ColorPicker`, `icon→IconPicker`, `LocaleString→LocaleField` (per-active-locale tabs, see D7), `options→Select`, `DataSpec→DataSpecBindingField` (D5), `ChartDef→ChartDefField`. `showWhen` drives conditional visibility; `group` drives accordion sections from `groups`. New `PropFieldType` = new control registration, Inspector unchanged (OCP).
- **Engine extensions needed (named for the engine/react specialist):**
  - **`PropFieldType` additions**: `'enum-ref'` (a value drawn from a runtime catalog — e.g. a measure code from the cube-profile, a dataSpec id, a token key) carrying a `source` discriminant (`'cube.measures' | 'cube.dimensions' | 'cube.members' | 'dataSpecs' | 'tokens' | 'pages'`). This is the bridge from static schema to capability-discovery (D4). Without it, profile-aware fields fall back to free strings (Law-1 risk).
  - **`PropField.coverage`** (optional `'localized'`): marks a field whose value must be a complete `LocaleString` over all active locales — the Inspector then enforces D7 + the locale-coverage fitness at authoring time, not just at the gold gate.
  - **Backfill the 2 metas missing `schema`** (`filter-bar`, `layout/card`) and add `schema` to the 3 panel slices (`panels/chart`, `panels/table`, `panels/kpi-strip`) so data panels are inspector-editable. Fitness function: "every registered, non-transparent slice declares a non-empty `schema`" (see fitness fns below).

### D3 — Unify the canvas model on the engine NodeDef (kill the closed `CanvasNodeKind` enum)

Replace the panel-private `CanvasNode { kind, config, children:string[] }` + hardcoded `CanvasNodeKind` union with a flat store of engine-shaped nodes keyed by id:

- Store entry = `{ id, type, variant, props: Record<string,unknown>, childIds: string[] }` where `type`/`variant` are ANY registered type (string), defaults seeded from `nodeRegistry.getDefaults(type)`. The closed 8-kind enum is deleted; placeability is decided by the registry (`rootOnly`, `slots.accepts`, `singleton`), not a hand-edited union.
- `canvasPageAdapter.toNodePageConfig` stays (flat→tree projection) but reads `type`/`variant`/`props`. The inverse `fromNodePageConfig` (tree→flat, for LOADING an existing page into the editor) is the missing half — add it; it is the round-trip's load side.
- Rationale: SSOT + OCP. The palette is open-registry; the store must be too. Today adding a node type silently fails to make it placeable. This is the Law-1 "no hardcoded names" rule applied to the editor's own model.

### D4 — Capability-discovery palette: profile ∩ registry ∩ DSD drives what is offered

The palette's power ∝ what it can auto-discover (ADR-0026 doctrine). Layer three discovery sources:

- **Registry** (have today): which node/panel types EXIST → base palette via `nodeRegistry.list()` grouped by capability.
- **Cube-profile** (have the API, wire the consumer): when a dataset is selected, fetch `GET /api/cube/:datasetCode/profile`. Drive: (a) which MEASURES/DIMENSIONS/MEMBERS are offered in DataSpec fields (D5); (b) the **actualRegion gate** — offer only dim-value combinations that realised data, so the user cannot build an empty-by-design chart; `actualRegion: null` (V26 not applied) degrades gracefully to "all combinations, no gate".
- **"Propose the right chart"** (new, modelled on P3-2 `suggestedEncodings`): a pure `suggestPanels(profile): PanelSuggestion[]` function maps conceptRole→panel type — `conceptRole==='geo'` → map/`georgraph`, `isTime===true` → timeseries, a numeric measure → selectable KPI/chart. Surfaced as a "Suggested" palette group. This is the headline UX leap and must be a pure, testable function (fitness: given a profile with a geo dim, suggests a map).

Add **`GET /api/registry/manifest`** (or serve `nodeRegistry.describeRegistry()` statically at build) so the panel does not import engine internals for the palette over the wire — keeps the panel→engine coupling at the published-contract boundary ([[project_panel_external_product]]).

### D5 — DataSpec authoring: profile-bound, declarative, function-free (Law 2)

Keep the existing per-type editors; bind them to the selected dataset's profile:

- DataSpec editing happens in Layer-1 (NamedDataSpec library) AND inline via the Inspector's `DataSpec` field on a data panel (a panel's `dataSpecId` references a NamedDataSpec — SSOT, reuse across panels).
- The Query editor's `MeasureSelector` / `FilterBuilder` consume `cube-profile.measures` / `.dimensions.members` (the `enum-ref` field source from D2) — the user PICKS from what the cube has; they never type a raw indicator code. This is the Grafana datasource→query→viz flow.
- A spec is valid only if its measures/dims exist in the profile and (when actualRegion available) resolve to a populated region. Surface a non-blocking warning when `unit.source==='none'` (no resolvable unit) — the profile already carries this signal.
- HARD invariant (Law 2 fitness): a serialized DataSpec contains no functions. The JSON-fallback editor already rejects type changes; extend the round-trip fitness to assert `typeof value !== 'function'` recursively on every authored spec.

### D6 — Save / publish / version / RBAC

Server FSM is done; wire the panel:

- **Draft** = the live zustand session, autosaved as a new `page_version` via PUT `/:id` (append-only — every save is a recoverable version). Debounced; the version history endpoint already exists for a "restore version" UI.
- **Publish** = POST `/:id/publish` (atomic promote). The runner picks it up via `/api/bootstrap`. Show the published-vs-draft delta before publish.
- **RBAC (unblocks P3-5)**: the canvas now exists, so P3-5 is buildable. `editor` can save drafts; `publish` requires `admin` (or a `publisher` role). Enforce server-side on the publish route (the authoritative gate — never trust the client) AND hide/disable the publish action client-side for non-publishers (UX). The AuditLogger already records who published.

### D7 — i18n authoring: every label authored in all active locales

- Active locales come from `config.site_config.locale` (SSOT) — the Inspector's `LocaleField` renders one input per active locale (tabs), never a single string.
- `PropField.coverage:'localized'` (D2) marks which fields are LocaleStrings; the Inspector blocks save / flags incompleteness when any active locale is empty — moving the V13/V14 locale-coverage check from the gold gate to authoring time (fail-fast, Postel toward the runner: emit only complete configs).
- Fitness reused: the existing locale-coverage fitness (P2-6) is the server-side backstop; the Inspector is the client-side shift-left.

### D8 — Round-trip safety: the editor emits ONLY valid, complete, current-schema, serializable configs

The non-negotiable invariant (skill §12: visual ↔ JSON lossless). Guarantee by construction:

- Every authored config carries `schemaVersion: CURRENT_SCHEMA_VERSION` and passes `migratePageConfig` as an identity (round-trip fitness P3-1).
- On SAVE, run the config through: (a) `migratePageConfig` (must be identity), (b) JSON serialize→parse→deep-equal (undefined-drop contract), (c) locale-coverage over active locales (D7), (d) every node `type` is registered + passes its `nodeRegistry.getValidate(type)`. Block save on failure with the specific node/field (fail-fast, not a silent drop).
- The flat-store ⇄ tree adapter (D3) must round-trip: `fromNodePageConfig(toNodePageConfig(p)) ≡ p`. New fitness.

---

## Rejected alternatives

1. **Free-canvas drag-drop (Figma/absolute-positioning model).** Rejected: introduces coordinate state the document-flow SDUI renderer cannot honour → breaks lossless round-trip and Principle of Least Astonishment (drag ≠ render). The render model is a tree; the editor must be a tree. (Considered because it "feels" more visual; the WYSIWYG preview pane already delivers the visual payoff without the model mismatch.)
2. **A parallel `editorMeta` registry distinct from `PropSchema`.** Rejected: `PropSchema` already IS the editor metadata, 88% populated, with a JSON-Schema bridge. A second seam = DRY violation + two sources of truth for "what is editable" (SSOT). Decision is to consume + extend the existing one.
3. **Bespoke property panel per node type (hand-written form per type).** Rejected: O(N) UI for N types, the exact anti-pattern the registry+schema seam exists to kill. A new node type would require panel code — violating "new type = new capability, inspector unchanged" (OCP) and Law 8.
4. **Preview via a separate runner iframe pointed at a draft URL.** Rejected for the primary path: adds a network/serialization hop and a second runtime, and the in-process `CanvasView` already embeds the real renderer (skill §12: same renderer, no fork). KEEP an iframe-against-published-draft as an OPTIONAL "full-fidelity preview" later (it gives real stores + real chrome) — but not the editing loop.
5. **Keep the closed `CanvasNodeKind` union "for type safety".** Rejected: it makes the store model closed while the palette is open — a new registered type can be dragged from the palette but not stored. Type safety is recovered via the registry + per-node validate, not a frozen enum (Law 1, OCP).
6. **Author DataSpecs as free-text against the dataset (no profile binding).** Rejected: lets users build empty/invalid charts, violating Law 1's intent (only valid, populated). The cube-profile + actualRegion exist precisely to gate this.

---

## Consequences

- **Positive:** new node type = register meta with a `schema` → it is auto-placeable (D3), auto-inspectable (D2), auto-suggested if it carries a conceptRole match (D4). The Constructor's surface grows with the registry, zero Constructor code per type (the platform-thinking payoff, Law 8). WYSIWYG holds by construction (one renderer). RBAC/i18n/round-trip become fitness-enforced, not hoped-for.
- **Negative / trade-offs:** (a) unifying the store model on engine NodeDef (D3) is a one-time migration of the existing canvas store + adapter + tests (Strangler-Fig: keep the adapter, swap the store shape behind it). (b) The `enum-ref` field type couples the engine schema vocabulary to the existence of a discovery source — mitigated by making `source` an open discriminant the panel resolves, so the engine stays app-agnostic (Law 3: the engine declares the *kind* of ref, the panel resolves it against the API). (c) Sampled-data preview (D-future) needs a sampling endpoint or client-side sampling — deferred (YAGNI until empty-preview proves insufficient in user testing).
- **ISO 25010:** maximises Maintainability (modularity, modifiability — one inspector for all types), Functional suitability (only valid configs emittable), Usability (suggest-the-chart). Trades a little up-front Effort (the D3 model unification) for long-run Evolvability.

---

## Fitness functions (encode the invariants — skill §5/§8)

1. **Every placeable type is inspectable** — for every `nodeRegistry.list()` entry that is not `transparent` and not a pure container, `getSchema(type,variant)` returns a non-empty `PropSchema`. (Closes the 2 missing node metas + 3 panel metas.)
2. **Store model is open** — there is no hardcoded node-type enum in `apps/panel`; a test registers a synthetic type and asserts it is placeable + inspectable with zero panel code change.
3. **Lossless flat⇄tree round-trip** — `fromNodePageConfig(toNodePageConfig(page)) ≡ page` for a corpus of pages (extends P3-1).
4. **Emitted configs are valid** — every config the editor would SAVE passes `migratePageConfig` as identity, serialize-round-trips (undefined-drop), is locale-complete over active locales, and every node passes its registered `validate`.
5. **No functions in config** — recursive assertion over authored DataSpecs + page configs (Law 2).
6. **Suggest-the-chart is sound** — `suggestPanels(profile)` proposes a map for a geo-conceptRole dim and a timeseries for an isTime dim (pure-function test).
7. **Publish is role-gated** — server publish route rejects a non-publisher JWT (extends auth tests).

---

## Phased roadmap (Strangler-Fig on the existing apps/panel canvas)

Each phase ends green and reverts independently. The existing canvas/palette/store/data-layer stay live throughout; we close seams behind them.

**Phase C0 — Schema completeness + manifest seam (engine-specialist).**
Backfill `schema` on `filter-bar`, `layout/card`, and the 3 panel slices. Add `PropFieldType` `'enum-ref'` (+ `source`) and `PropField.coverage`. Expose the registry manifest (`describeRegistry`) over a stable boundary for the panel.
*Fitness:* #1 (every placeable type inspectable). *Reversible:* additive, no consumer yet.

**Phase C1 — The Inspector (react-specialist + panel agent).**
Build `apps/panel/src/inspector/Inspector.tsx` + `FieldControlRegistry` consuming `getSchema`. Wire it to the selected node; edits flow through `updateNode`. LocaleField (per active locale) for `LocaleString`/`coverage:'localized'`.
*Fitness:* "selecting any node renders a property panel with no per-type code"; #4 (valid edits). *MVP — this is the highest-leverage phase; the whole point is one inspector for all types.*

**Phase C2 — Unify the store model on NodeDef (panel agent).**
Replace `CanvasNode`/`CanvasNodeKind` with the open `{type,variant,props,childIds}` model seeded from `getDefaults`. Add `fromNodePageConfig` (load side). Keep the adapter API.
*Fitness:* #2 (open model), #3 (lossless round-trip). *Reversible:* the adapter isolates the change; revert restores the enum.

**Phase C3 — Capability-discovery palette + DataSpec profile binding (panel agent).**
Fetch cube-profile on dataset select; bind MeasureSelector/FilterBuilder to profile members; actualRegion gate; `suggestPanels` "Suggested" group.
*Fitness:* #5 (no functions), #6 (suggest-the-chart). *MVP boundary:* suggest-the-chart is the headline; actualRegion gate degrades gracefully if V26 absent.

**Phase C4 — Publish / version / RBAC UI (panel agent + api unblock of P3-5).**
Draft autosave → version history → restore; publish action with server-side role gate + client-side hide for non-publishers; published-vs-draft delta.
*Fitness:* #7 (publish role-gated). *Unblocks P3-5.*

**Phase C5 — Round-trip hardening + i18n shift-left (engine + panel).**
Save-time validation pipeline (migrate-identity + serialize-roundtrip + locale-coverage + per-node validate) with specific error surfacing. Move locale-coverage to authoring time.
*Fitness:* #3, #4, all save-time invariants. *This is the "emit only valid configs" guarantee made structural.*

**MVP = C0+C1+C2+C4** → "the Constructor can author and publish a single-panel page that the runner renders identically" (the canonical Phase-2 fitness). C3 (discovery/suggest) and C5 (hardening) are the differentiators that follow.

**Later / YAGNI-gated:** sampled-data preview (only if empty-store preview proves insufficient); full-fidelity iframe preview against a published draft; site_config/chrome visual editor (chrome metas already JSON-serializable — extend the Inspector to chrome slots); multi-page site assembly polish.

---

## Engine/registry extensions — named for the implementation wave

- `slice-meta.ts`: add `PropFieldType` `'enum-ref'` with `PropField.source?: 'cube.measures'|'cube.dimensions'|'cube.members'|'dataSpecs'|'tokens'|'pages'`; add `PropField.coverage?: 'localized'`. (engine/react)
- `slice-meta.ts` / metas: backfill `schema` on `nodes/filter-bar`, `nodes/layout/card`, `panels/{chart,table,kpi-strip}`. (engine/plugins)
- `NodeRegistry`: no API change needed for the Inspector (getSchema/getDefaults/getSlots exist). Optionally add `placeableInto(parentType): string[]` derived from `slots.accepts` to centralise drop-acceptance (currently overlay-side). (engine/react)
- `apps/panel`: NEW `inspector/Inspector.tsx`, `inspector/FieldControlRegistry.ts`, `inspector/fields/LocaleField.tsx` etc.; REMOVE `CanvasNodeKind`, reshape store node to `{type,variant,props,childIds}`; ADD `canvasPageAdapter.fromNodePageConfig`; NEW `discovery/cubeProfile.ts` (fetch + cache) and `discovery/suggestPanels.ts` (pure). (panel agent + react-specialist)
- `apps/api`: optional `GET /api/registry/manifest` if the panel should not import engine for the palette over the wire; enforce publisher role on POST `/:id/publish`. (api — currently mid-flight; coordinate.)

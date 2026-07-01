---
name: adr-constructor-vision-north-star
description: ADR — Constructor (apps/panel) decision-grade VISION/north-star; best-in-class builder survey (Webflow/Builder.io/Plasmic/Grafana/Tableau/Notion/Figma/JSON-Forms/Sanity…), full renderer→authorable COVERAGE-GAP audit, non-programmer UX vision, packages decision, prioritized roadmap
metadata:
  type: project
---

# ADR — Constructor (apps/panel): the Authoring North Star

Status: PROPOSED (2026-06-24). Builds ON [[adr-constructor-phase2]] (the C0–C5 triad — now substantially BUILT on disk: Inspector, open store model, fromNodePageConfig, suggestPanels, capabilityGate, cube-profile, live preview, variant spine, validateConfig, generated JSON Schema). This ADR sets the NEXT horizon: from "a competent registry-driven builder" to "the best REAL builder a statistician with zero code can use to author ANYTHING our renderer can render." Holds YAGNI — the best real builder, not maximal features.

Related: [[adr_config_and_render_vision]] (config-object + SDUI renderer; validateConfig/JSON-Schema floor), [[adr_semantic_token_theming_spine]] (theming = a Constructor authoring axis), [[adr_shell_variant_style_spine]] (VariantDef → data-attrs; the variant authoring face), [[adr_no_privileged_element_capability_nav]], [[adr_element_config_schema_seam]] (per-slice schema, ISP), [[project_panel_external_product]] (panel ships externally; the registry IS the published contract), [[project_semantic_layer_n26]] (MetricRegistry = a future palette/binding axis).

---

## Context — what is ON DISK (verified 2026-06-24)

The Constructor is FAR past the Phase-2 ADR's "gaps". Verified standing assets:

- **Wizard** (`features/wizard`): 3 steps Data / Site / Pages (`WIZARD_STEPS`), stepper, per-step panels.
- **Live WYSIWYG canvas** (`canvas/CanvasView.tsx`): Layer-1 the REAL `NodePageRenderer` under a `SiteProvider` (pointer-events:none) + Layer-2 `CanvasOverlay` (selection frames + slot drop zones). Builder.io/Craft.js two-layer pattern, real.
- **structural | live preview** (`useLivePreviewStores`, `livePreview.ts`, `useDebouncedLivePage`): toggle between empty `staticStore` and the REAL stats cube via the SAME `buildStoreManifest` 'stats' builder the geostat runner uses; live is fail-soft (falls back to static + badge), debounced so an edit burst collapses to one query. First-cube-bound-wins.
- **Open-registry palette** (`canvas/paletteEntries.ts`): built purely from `nodeRegistry.list()` + `getByCapability(CAPS.*)` → capability-grouped (Data panels / Layout / Content). New registered type = palette row, zero code.
- **Capability gate + suggest** (`discovery/`): `gatePaletteEntries` (profile ∩ palette — hide data panels a dataset can't support, fail-OPEN), `suggestPanels` (pure conceptRole→panel: time→timeseries, geo→map, hierarchy→tree, measure→bar/kpi-strip), `cubeProfile.store` (Identity-Map cache, loading|ready|error), `cubeEnumOptions`.
- **PropSchema-driven Inspector** (`inspector/`): renders the WHOLE property panel GENERICALLY from `nodeRegistry.getSchema(type,variant)`, dispatching each `PropField` through `FieldControlRegistry` (Strategy+Registry, OCP). `SchemaSource` port inverts the registry dependency so chrome (`chromeSchemaSource`) renders through the SAME Inspector. Controls: Text/Number/Boolean/Color/Select/Json primitives + `LocaleField` (per-active-locale tabs, `coverage:'localized'`) + `EnumRefField` (cube.measures/dimensions/members + dataSpecs/dataSources/pages, dimension-scoped, fail-soft). `showWhen`/`getAtPath`/`setAtPath` nested write; `validateField`; grouped `<fieldset>/<legend>` (WCAG).
- **Unified open store** (`store/constructor.store.ts` + slices): `CanvasNode {id,type:string,variant?,props,childIds}` — the closed `CanvasNodeKind` enum is GONE (store as open as the registry). Flat Identity-Map + ordered `nodeIds`; full undo/redo (`constructor.history`); lifecycle FSM mirror (`constructor.lifecycle`); chrome authoring (`constructor.chrome`).
- **Lossless round-trip** (`canvas/canvasPageAdapter.ts`): `to/fromNodePageConfig` with `fromNodePageConfig(toNodePageConfig(x)) ≡ x`. Page-level `meta` carried by STRUCTURAL PASS-THROUGH (PAGE_STRUCTURAL_KEYS) so a NEW PageConfigBase field (frame/chrome/presentation/filterSchema/vars/modeOrder) round-trips with zero adapter edit.
- **DataSpec authoring** (`features/data-layer/`): `DataSpecEditor` type-picker over `SPEC_CATALOG` (9 discriminants) → per-type editors query/timeseries/growth/ratio-list + JSON fallback for by-mode/pivot/transform/custom. Query editor: `MeasureSelector`, `FilterBuilder`, `EncodingEditor` (label/value/color/pct/isTotal channels), `PipelineBuilder` (dnd-kit sortable TransformSteps, per-op StepForms: derive/lookup/sort/filter).
- **Variant spine** (`variant-meta.ts`): `VariantDef` (flag|enum → data-attr) folded into PropSchema as `variants.<name>` fields via `variantPropSchema`/`nodeSchemaWithVariants` → authored in the SAME Inspector, validated by the SAME generated schema.
- **Validation floor** (`packages/core/validation/config.ts`): `validateConfig` — structural floor BOTH apps/api (save) and packages/react (render) call (one fn, can't diverge). Generated `page-config.schema.json` (`emit-page-config-schema.ts` → `generatePageConfigSchema`) is the wire contract in `packages/contracts/schema`.
- **Publish/version/RBAC UI** (`features/page-workflow/`): PageBrowser, StatusBadge, WorkflowBar, SaveIssueList, VersionHistoryDialog; `save/saveGuard`.
- **Registered universe** (the palette today): nodes section/mode-bar/filter-bar/page-header/geograph/links/repeat/hero/stats-carousel + layout row/grid/columns/stack/card/divider/spacer/wrap; panels chart/kpi-strip/table/map/text/gauge; pages inner-page/container-page/tab-page; chrome app-header/app-footer/app-banner/inner-sidebar/locale-switcher (+ variants).

**Verdict:** we LEAD the field on three axes most builders fake: (1) the live canvas IS the real production renderer (no second render path — lossless by construction), (2) the palette/inspector/store are all one open registry (new capability = zero Constructor code), (3) capability discovery from a real cube profile. We LAG on authoring ERGONOMICS for a non-programmer: data binding still exposes ObsQuery/EncodingSpec field-name typing (not Tableau field-wells), no templates/starters, no command palette, no tree/outline pane, no insert-affordances beyond drag, advanced DataSpec branches (pivot/transform/by-mode/custom) are raw-JSON, and many "must be authorable" renderer capabilities are PARTIAL or NOT (the gap audit below).

---

## Part A — Best-in-class survey: the strongest idea to steal from each

Authoring-UX and architecture, the 1–3 ideas genuinely worth adopting (named, concrete):

**Component-tree builders**
- **Webflow** — the *Navigator/Style-panel* split: a structural TREE pane distinct from the visual canvas, and styles authored as named, reusable classes (not per-element overrides). STEAL: a left **Outline/Navigator tree** (we have none) + variant/style authoring as named declarations (we have the VariantDef spine — surface it as Webflow-style emphasis presets).
- **Builder.io** — *registered components with typed inputs* + *visual data-binding to a DataSource plugin* + *content model/SemVer*. STEAL: their `inputs` model is exactly our PropSchema; their **DataSource binding UX** (pick a source, map fields) is the template for our field-wells. Already aligned; double down.
- **Plasmic** — *component variants + interaction states authored visually*, and *code-component registration with controlled props*. STEAL: **variant matrix** authoring (author a node's emphasis/density presets and preview each) over our VariantDef.
- **Framer** — *smart layout + "everything has a sensible default so the canvas is never broken"*. STEAL: **never-broken-canvas** discipline (every add yields a valid, rendering node via getDefaults — we do this; make it a guarantee/fitness).

**WYSIWYG / page CMS**
- **WordPress Gutenberg** — *block inserter with search + categories + "/" slash-command insert in place*; *block patterns* (pre-composed starters). STEAL: **slash/command-palette insert** and **block patterns = our "starters"** (pre-built section+panel compositions seeded into a new page).
- **Wix / Editor-X** — *templates-first onboarding* (you never start from blank). STEAL: **template gallery** as the default entry to a new site/page.

**Internal-tool / low-code**
- **Retool** — *the right-hand Inspector with grouped, typed property controls + `{{ }}` binding chips*; *component-tree + query panel*. STEAL: our Inspector IS this; steal their **binding-chip affordance** (a field can be a literal OR a binding to a param/dataSpec — a `$ctx`/`$d` ref picker, not raw JSON).
- **Appsmith** — *widgets with show/hide/enable conditions authored in the property panel*. STEAL: a **VisibilityExpr builder** in the Inspector (we have `showWhen` for fields; the node-level `visibleWhen` gate is NOT authorable yet — see gap audit).
- **Budibase** — *data-first app creation (connect data → auto-generate screens)*. STEAL: **data-first flow** — "connect a cube → we propose a whole dashboard" (suggestPanels exists; extend to a full-page generator).

**Dashboard / BI (the closest domain)**
- **Grafana** — *panel editor = viz picker + field/transform + options, all live-previewed*; *transformations UI as a stacked pipeline*; *template variables at dashboard level*. STEAL: our PipelineBuilder mirrors transformations; steal the **viz-picker-with-live-thumbnail** and **dashboard-level variables editor** (our FilterSchema/ParamDefs — NOT authorable yet, big gap).
- **Looker Studio** — *field "chips" you drag into dimension/metric wells; calculated fields via a formula editor*. STEAL: **dimension/metric WELLS** — the single most important non-programmer idea; replace raw ObsQuery typing with drag-a-measure-into-the-value-well.
- **Tableau / Power BI** — *Show Me (suggest the viz from selected fields)*; *field wells (rows/columns/marks/filters shelves)*; *calculated fields*. STEAL: **"Show Me"** (we have suggestPanels — surface it as the headline), **shelves/wells** as the DataSpec authoring metaphor, **calculated field editor** over our DeriveExpr (we have the engine; expose a friendly formula box).
- **Metabase** — *the notebook/visual query builder: pick data → filter → summarize → visualize, in plain language, no SQL*. STEAL: the **notebook query metaphor** for `query` DataSpec (pick measure → filter → group → encode), the gentlest possible data-binding ladder.
- **Apache Superset** — *dataset semantic layer (metrics/columns defined once, reused) + viz-type gallery*. STEAL: **named metrics reused across panels** ([[project_semantic_layer_n26]] MetricRegistry) surfaced as a palette/well source.

**Document / design**
- **Notion** — *"/" slash menu, blocks that are trivially rearrangeable, progressive disclosure (simple by default, power on demand)*. STEAL: **slash insert + frictionless reorder + progressive disclosure** as the whole-editor north star for non-programmers.
- **Figma** — *components + variants + auto-layout; a property panel that adapts to selection*. STEAL: **variants as first-class** (VariantDef) and **auto-layout = our layout nodes** (stack/grid/columns) — author layout by choosing a layout node, never x/y.
- **Adaptive Cards Designer** — *a JSON-schema-driven card editor with a live card preview and an element palette, AND a visible JSON pane kept in sync*. STEAL: an **optional, READ-mostly JSON pane** (advanced escape hatch) that stays in lockstep — proves the lossless round-trip to power users without making JSON the primary surface.

**Schema/forms/CMS (declarative-config kin)**
- **JSON Forms** — *render a form purely from a JSON Schema + a UI Schema (layout/ordering separate from data schema)*. STEAL: the **UI-Schema/data-schema split** — our PropSchema mixes both (groups/order live with fields); a separate UI-schema would let one node declare multiple inspector layouts (basic/advanced). Consider for progressive disclosure.
- **Storybook controls/args** — *auto-generated controls from arg types; the "args table"*. STEAL: validation of our model — argTypes≈PropSchema; steal the **"reset to default"** + **per-control description/hint** affordances.
- **Sanity Studio** — *schema-as-code defines the studio; portable-text; real-time collaborative editing; structure builder*. STEAL: **structure/desk customization** (how the authoring surface itself is configured) and, longer-term, **real-time collaboration/presence**.
- **Contentful / Strapi** — *content modeling + field validations + draft/publish workflow + roles*. STEAL: validation of our workflow model (we have draft/publish/version/RBAC); steal **field-level validation messages + required/unique affordances** surfaced inline.

**Synthesis of the survey:** the field splits into (1) *coordinate/layer* editors (Figma/Framer free-canvas) — NOT our model, correctly rejected in the Phase-2 ADR; and (2) *component-tree + inspector + live-preview* editors (Builder.io/Plasmic/Webflow/Retool/Grafana) — exactly our model. The BI tools (Tableau/Looker/Metabase/Superset) own the *data-binding* ergonomics we most lack. So the north star = **our component-tree/inspector/live-canvas spine (already best-in-class) + BI-grade field-wells/Show-Me/calculated-fields for data binding + Notion/Gutenberg insert-and-reorder ergonomics + templates/starters**.

---

## Part B — COVERAGE-GAP audit (the hard requirement: NOTHING un-authorable)

For each renderer capability: authorable TODAY / PARTIAL / NOT, with the exact gap. This is the key deliverable — the spec for "non-programmer can build anything."

### Node / panel / chrome types
- Node/panel placement (drag from palette, getDefaults seed) — **TODAY**.
- Chrome slot selection + per-slot config (variant + config via chromeSchemaSource) — **TODAY**.
- Page-root type (inner-page/tab-page/container-page) — **PARTIAL**: round-trips via meta, but no UI to CHOOSE the page-root kind (tab-page vs inner-page) when creating a page. Gap: a page-template picker on page create.
- `slots.accepts` drop-acceptance — **PARTIAL**: overlay reports parent+slot, but accept-filtering by `slots.accepts`/`singleton`/`max` is not enforced in the drop handler (PageStep.handleDrop appends unconditionally). Gap: registry-driven drop validation.

### DataSpec branches (the data engine)
- `query` (ObsQuery + pipe + encoding) — **PARTIAL**: editable, but via field-NAME typing (MeasureSelector/FilterBuilder/EncodingEditor map channels to raw string field names), not field-wells. EncodingEditor covers label/value/color/pct/isTotal only. Gap: Tableau-style wells; rowLimit/fromDim/toDim not surfaced.
- `row-list` — **NOT** (JSON fallback). Gap: a row editor (code/label/color/negate/isTotal/pctOf per RowSpec).
- `timeseries` — **TODAY** (TimeseriesEditor) — but `code` is free text, not measure-picked from profile. Gap: bind code to cube.measures.
- `growth` — **TODAY** (GrowthEditor) — same free-text code gap; multi-code (string[]) UX unclear.
- `ratio-list` — **TODAY** (RatioListEditor) — pairs code/denom free text; profile-bind gap.
- `by-mode` — **NOT** (JSON fallback). Gap: a per-mode sub-DataSpec editor (recursive DataSpecEditor keyed by ModeId).
- `pivot` — **NOT** (JSON fallback). Gap: rows/keyField/valueFields/colors editor.
- `transform` — **NOT** (JSON fallback for the top-level transform spec; note the PipelineBuilder DOES author the steps inside `query.pipe`). Gap: a source+steps+encoding editor reusing PipelineBuilder.
- `custom` (`fn: string`) — **NOT** and SHOULD STAY NOT for non-programmers (a code-resolver ref). Gap: at most a dropdown of registered custom resolver names; never free code. (YAGNI/Law-2 honoured.)

### Transform pipeline ops (TransformStep — 20+ ops)
- Authored ops in PipelineBuilder StepForms: **derive, lookup, sort, filter** — **TODAY** (4 of ~20).
- melt, rename, cast, concat, template, addField, select, aggregate, rollup, group, reduce, window, join, joinByField — **NOT** (no StepForm; only the 4 above have forms; OP_OPTIONS lists only 4). Gap: this is the biggest single coverage hole. Each op needs a StepForm OR a generic schema-driven step editor (a PropSchema per op → reuse the Inspector machinery). DeriveExpr authoring is free-string/JSON — needs a formula/expression builder (Looker calc-field analogue).

### EncodingSpec
- label/value/color/pct/isTotal — **TODAY** (EncodingEditor). 
- Any other EncodingSpec channel (series, by, sort, suggestedEncodings integration, semantic `by→encoding.series` from [[project_semantic_layer_n26]]) — **PARTIAL/NOT**. Gap: encoding is hand-typed field names; should be field-wells fed by the resolved row fields / profile.

### Variants (VariantDef spine)
- Authored as `variants.<name>` PropFields in the Inspector (enum→select, flag→toggle) — **TODAY**. Strong. (Figma/Plasmic variant authoring achieved.)

### Presentation projectors
- `presentation.color` / `presentation.crumbs` (PresentationProjector.schema() → PropFields) — **PARTIAL**: the projector declares Constructor PropFields and they flow into generatePageConfigSchema, but there is NO Inspector surface that selects the PAGE (vs a node) and renders page-presentation fields. Gap: a Page Inspector (select the page root → render presentation + frame + chrome + modeOrder fields).

### FilterSchema / ParamDefs (page-level filters — the dashboard's controls)
- bars / ParamDef union (hidden/year-select/cascade/select/range/multi-select/chip-select) / DefaultSpec tiers / showWhen/enableWhen / effects / crossValidate / context mapping — **NOT**. This is a major gap: a statistical dashboard IS its filters, and none of it is Constructor-authorable today. The filter-bar node is placeable but its CONTENTS (the ParamDefs) are not editable. Gap: a FilterSchema authoring surface (Grafana template-variables editor analogue) — pick a dimension → choose a control type → bind options to cube.members → set default.

### VisibilityExpr (node visibleWhen gate)
- The boolean tree (eq/neq/in/isset/and/or/not/mode-is/mode-in/mode-not) — **NOT**. Gap: an Appsmith-style condition builder on a node ("show this section when geo = Tbilisi"). Today only field-level `showWhen` (a different, string-expression mechanism inside the Inspector) exists.

### Page config (frame / chrome / modes / i18n / vars)
- chrome — **TODAY** (chrome palette + inspector).
- frame — **PARTIAL** (round-trips via meta; no editor).
- modeOrder / ModeId (the year/range/mode machinery) — **PARTIAL**: mode-bar node placeable; modeOrder + per-mode config not authored.
- vars (VarMap / page variables consumed by presentation find/breadcrumbs) — **NOT**. Gap: a page-vars editor.
- i18n (active locales, per-locale field authoring) — **TODAY** (LocaleField + coverage:'localized' + useActiveLocales). Site activeLocales come from config (SSOT). Strong.
- schemaVersion — **TODAY** (stamped/round-tripped).

### Data-source binding
- DataSource CRUD (sdmx-json/rest/static) — **TODAY** (datasources feature + DataStep). 
- `dataSourceBindings` (context key → DataSource id) — **PARTIAL** (modeled in SiteDef; thin/absent UI).
- Per-page / per-store-key binding (multi-store) — **NOT** (first-cube-bound-wins only). Gap when a page needs >1 cube.

### ContentConstraint / actualRegion gating
- The capability gate hides unsupported data panels — **TODAY** (gatePaletteEntries). actualRegion-level "don't let me build an empty combination" — **PARTIAL/NOT**: the gate is measure-presence + geo-role only; it does not yet consult actualRegion to forbid empty-by-design dim combinations. Gap: wire actualRegion into binding validation.

### Methodology / ref-metadata
- Methodology/source/last-updated/preliminary badges (Project Law 9; the section `methodology` cap) — **PARTIAL/NOT**: the cap exists and shells render badges from config, but no Inspector fields author the methodology text/source/links/preliminary flags. Gap: a methodology fieldset on data nodes (this is a compliance requirement, ONS/IMF/Eurostat — high priority).

**Coverage scorecard:** roughly — TODAY: node/chrome placement, variants, i18n, 3-4 DataSpec types, 4 transform ops, basic encoding, datasource CRUD, capability gate, publish/version. PARTIAL: query wells, page-root choice, slot-accept, presentation, frame/modes, bindings, actualRegion, methodology. NOT (the real work): page-level FilterSchema/ParamDefs, VisibilityExpr builder, 16 transform ops, by-mode/pivot/transform/row-list DataSpec editors, page-vars, calculated-field/DeriveExpr builder. **The single highest-impact gaps for "build anything": (1) FilterSchema/ParamDef authoring, (2) the remaining transform ops, (3) field-wells data binding, (4) the Page Inspector (presentation/frame/modes/vars), (5) VisibilityExpr builder, (6) methodology fields.**

---

## Part C — The non-programmer authoring vision (a statistician, zero code, end-to-end)

Design principle stack: **never edit JSON · sensible defaults (never-broken canvas) · progressive disclosure (simple by default, power on demand) · pick-don't-type (everything bound to a real catalog) · live preview · undo always · error-prevention over error-messages · suggest-the-next-step.**

The end-to-end flow (the "golden path"):
1. **Start from a template, not blank** (Wix/Gutenberg). Pick "GDP dashboard" / "Regional indicators" starter → a real page with section+chart+table+filter already wired to a sample cube.
2. **Connect the data** (Budibase data-first): pick/point a cube DataSource → cube-profile loads → palette gates + "Show Me" suggestions appear.
3. **"Show Me" the chart** (Tableau): suggestPanels surfaces a "Recommended" palette group with reasons ("time axis → line chart"). One click inserts a fit-for-data, populated panel.
4. **Bind data by field-wells** (Looker/Tableau), NOT ObsQuery: the panel inspector shows MEASURE / DIMENSION / SERIES / FILTER wells; the author drags measure/dimension chips (from the cube-profile) into wells. The wells emit the `query` DataSpec + EncodingSpec under the hood. A "calculated field" box (DeriveExpr) for derived measures, with a friendly formula syntax (`value / total * 100`).
5. **Insert more blocks** (Notion/Gutenberg): "/" slash command or a "+" insert affordance in the tree/canvas — search a block, insert in place. Drag to reorder; the Outline/Navigator tree gives a bird's-eye structure.
6. **Add filters** (Grafana variables): a Filters panel — pick a dimension → choose control (dropdown/range/cascade) → options auto-bound to cube.members → set default. No ObsQuery, no ParamDef JSON.
7. **Style by presets** (Webflow/Figma variants): emphasis (hero/compact), density, color — chosen from VariantDef enums + the semantic-token palette, never raw CSS.
8. **Localize inline** (our LocaleField): every text field has per-locale tabs; incomplete locales flagged before publish.
9. **Methodology/integrity** (compliance): a methodology fieldset (source, last-updated, preliminary, link) on each data node — surfaced as the ONS/IMF badges.
10. **Preview live** (our structural|live toggle), **undo freely**, **publish** (draft→version→publish with role gate + published-vs-draft delta).

Cross-cutting affordances to add: **command palette** (Cmd-K: insert/navigate/run), **inline help/hints** (PropField.hint + per-control descriptions, Storybook-style), **reset-to-default** per field, **error-prevention** (drop-accept validation, gated palette, profile-bound options so invalid states are unreachable), **empty-state coaching** (a blank page invites "pick a template" / "Show Me").

The litmus test (a fitness function for the whole vision): *a statistician can build, from a blank site, a published multi-panel dashboard with filters, localized labels, and methodology badges — without ever seeing JSON, a field name they typed, or an error they couldn't have been prevented from causing.*

---

## Part D — Best-of-breed hybrid (where we LEAD / LAG)

**We LEAD (keep, double down):**
- Live canvas IS the production renderer (no second render path) — lossless WYSIWYG by construction. Most builders fake this; we don't.
- One open registry for palette + inspector + store + validation — new capability = zero Constructor code (Builder.io's dream, structurally enforced).
- Capability discovery from a REAL cube profile (gate + suggest + enum-ref options). Tableau's "Show Me" + Budibase's data-first, grounded in actual data.
- Lossless flat⇄tree round-trip + generated JSON-Schema wire contract + one validateConfig both server and client run.
- VariantDef spine = Figma/Plasmic variant authoring, declaratively.

**We LAG (build):**
- Data binding ergonomics (field-wells/Show-Me-front-and-center/calculated-fields) — we expose ObsQuery/field-names; BI tools expose chips-into-wells.
- Insert/navigate ergonomics (slash-command, command palette, Outline tree, templates/starters) — Notion/Gutenberg/Wix table stakes we lack.
- Whole renderer-capability coverage (FilterSchema, VisibilityExpr, the 16 transform ops, page-presentation, modes/vars, methodology) — see the gap audit.

**The hybrid:** our spine + BI data-binding + document-editor ergonomics + total coverage. Concretely the editor becomes **four panes**: Outline/Tree (left) · Live Canvas (center) · Inspector (right) · with a Data/Filters drawer and a Cmd-K palette — the Retool/Grafana/Builder.io layout, plus Looker wells in the Inspector and Tableau Show-Me in the palette.

---

## Part E — Packages decision (adopt vs build; respect the arrow)

The arrow: `contracts ← expr ← core ← charts ← react ← plugins ← apps/*`. Constructor deps live in `apps/panel` only (app layer) — they MUST NOT leak into `packages/*`. MUI is already the panel's UI kit.

**ADOPT (global deps in apps/panel):**
- **@dnd-kit** (core/sortable/utilities) — ALREADY in use (PipelineBuilder, DataStep). Keep; it's the right, accessible, headless DnD. Use for the Outline tree reorder + palette→canvas drag too. Justify: a11y, small, no opinion on rendering. (Do NOT add react-dnd — duplicate.)
- **cmdk** (command palette) — tiny, headless, the de-facto Cmd-K. For insert/navigate. Justify: huge UX leverage (Notion/Linear), ~small bundle, app-only.
- **A color picker** — `react-colorful` (2.8kB, zero-dep, accessible) behind the existing `ColorControl`. Justify: ColorControl is a primitive today; react-colorful is the minimal upgrade. App-only.
- **An icon picker / icon set** — we already have icon keys; adopt a single icon set the picker browses (MUI icons already present, or `lucide-react` for a cleaner set). Build the PICKER, adopt the SET.
- **An expression/formula input** — for DeriveExpr/calculated fields, a small code-input (`react-simple-code-editor` + a tiny tokenizer) — NOT a full Monaco (too heavy for a non-programmer formula box). Justify: bundle discipline; the formula language is small (our DeriveExpr string form).
- **A JSON viewer** (read-mostly advanced pane) — a lightweight pretty-printer (or `@textea/json-viewer`); the EDIT path stays the structured editors. Justify: the Adaptive-Cards "see the JSON" escape hatch without making JSON editable.

**BUILD ourselves (the seams that ARE our architecture — never outsource the SSOT):**
- The **Inspector + FieldControlRegistry** — already built; it IS our PropSchema seam. Do NOT replace with RJSF/JSON-Forms: our schema is richer (enum-ref/coverage/variants/cube-binding) and the round-trip must stay ours. (Borrow JSON-Forms' UI-schema/data-schema split as a CONCEPT, not the lib.)
- The **Outline/Tree** pane — build over our flat store + @dnd-kit; a generic tree lib would fight our Identity-Map model and drop-accept rules.
- The **field-wells / Show-Me / DataSpec editors / FilterSchema editor / VisibilityExpr builder / transform-op StepForms** — these are domain-specific to our DataSpec/ParamDef/VisibilityExpr/TransformStep unions. No library models them; they ARE the Constructor's value. Build them schema-driven where possible (a PropSchema per transform op → reuse the Inspector, not N bespoke forms).

**FACTOR OUT to a local package (later, when a 2nd consumer is real — YAGNI):**
- The PropSchema→control rendering (FieldControlRegistry + controls) could become `@statdash/inspector-kit` IF a second app needs it. Today one consumer (apps/panel) → keep in-app (no premature package). Flag for when the panel splits per [[project_panel_external_product]].

**REFUSE:** RJSF/JSON-Forms as the inspector engine (DRY/SSOT violation — we have the seam); react-dnd (dup of dnd-kit); Monaco for the formula box (bundle); any builder framework (Craft.js/Puck) that would impose a SECOND render model (we already render via the production renderer — adopting one would break lossless round-trip, the cornerstone).

---

## Decision

Adopt the **four-pane authoring shell** (Outline · Live Canvas · Inspector · Data/Filters drawer + Cmd-K) and drive the roadmap by the **coverage-gap audit (Part B)** prioritized so that "a non-programmer can build ANYTHING the renderer renders" is reached, in this order: total renderer coverage FIRST (you cannot author what has no surface), then BI-grade binding ergonomics, then document-editor ergonomics and templates. Hold YAGNI: build wells/StepForms schema-driven (reuse the Inspector), not as N bespoke forms; package nothing until a 2nd consumer is real.

---

## Rejected alternatives

1. **Adopt a builder framework (Craft.js / Puck / GrapesJS).** Rejected: each imposes its OWN node model + render path → a SECOND source of truth, breaking the lossless round-trip and the "one renderer" cornerstone we uniquely have. Our canvas already embeds the production renderer.
2. **RJSF / JSON-Forms as the Inspector engine.** Rejected: SSOT/DRY violation — PropSchema + FieldControlRegistry already IS our schema-driven form engine, and it carries vocabulary (enum-ref cube-binding, coverage:'localized', variants) no generic lib models. Borrow the UI-schema CONCEPT only.
3. **Free-canvas / coordinate editing (Figma model).** Rejected again (per Phase-2 ADR): the render model is document-flow tree; coordinate state would be un-honourable → broken round-trip + least-astonishment. Layout is authored by layout NODES (stack/grid/columns), not x/y.
4. **Expose ObsQuery / EncodingSpec / ParamDef / VisibilityExpr as raw JSON to "ship coverage fast".** Rejected for the non-programmer path: violates "never edit JSON" and lets users build invalid/empty configs. Raw JSON stays only as an advanced, read-mostly escape hatch (Adaptive-Cards pattern) and for `custom` resolvers.
5. **Build a full code editor (Monaco) for calculated fields.** Rejected: bundle cost + intimidates the non-programmer. The DeriveExpr string form is small; a light tokenized input suffices.
6. **Defer total coverage; polish ergonomics on the covered subset first.** Rejected: "build anything" is the user's hard requirement — an un-authorable capability (FilterSchema, transform ops) is a correctness gap, not a polish item. Coverage leads; ergonomics follow on a complete surface.

---

## Consequences

- **Positive:** the Constructor reaches "author anything the renderer renders" (the mandate), with non-programmer ergonomics matching BI tools, while preserving the three things we uniquely lead (one-renderer WYSIWYG, one-registry openness, real-data discovery). New capabilities keep costing zero Constructor code (registry-driven), and new transform ops/filter controls become schema-driven (reuse the Inspector). 
- **Negative / trade-offs:** large surface to build (FilterSchema editor, 16 StepForms, wells, Page Inspector, VisibilityExpr builder) — mitigated by reusing the Inspector/PropSchema machinery (schema-per-op) instead of bespoke forms, and by Strangler-Fig sequencing behind the existing live editor. Cmd-K/templates add app deps (bounded, app-only). The read-only JSON pane risks becoming a crutch — keep it advanced/collapsed.
- **ISO 25010:** maximises Functional suitability (completeness — everything authorable) and Usability (non-programmer flow), trading short-term build Effort; Maintainability preserved by schema-driven reuse (no per-op/per-control panel code); Compatibility/round-trip held by the one-renderer invariant.

---

## Fitness functions (encode the invariants)

1. **Coverage completeness** — for every DataSpec discriminant, every TransformStep op, every ParamDef type, and every VisibilityExpr op, an authoring surface exists (a test enumerates the unions and asserts a registered editor/StepForm/control — no union member falls through to raw JSON except `custom`). THE headline "build anything" gate.
2. **No raw JSON on the golden path** — a test authors a full dashboard (panel+filter+methodology+locale) through the structured surfaces and asserts the emitted config is valid WITHOUT touching the JSON pane.
3. **Pick-don't-type** — every data-bound field (measure/dimension/member/dataSpec/page ref) resolves options from a catalog (enum-ref), never a free string; a test asserts no data-binding control is a bare TextControl.
4. **Never-broken canvas** — inserting any registered type via getDefaults yields a config that passes validateConfig (every default is valid).
5. **Drop-accept soundness** — a node can only be dropped where `slots.accepts`/`singleton`/`max` permit (registry-driven), tested against the registry.
6. **Show-Me soundness** — suggestPanels proposes a map for a geo dim, a timeseries for a time dim (already on disk; keep).
7. **Lossless round-trip + valid emit** — `fromNodePageConfig(toNodePageConfig(p)) ≡ p` and every emitted config passes validateConfig + locale-coverage + the generated JSON Schema (extends existing).
8. **Inspector openness** — a synthetic registered type/op/control is authorable with zero Constructor code change (the OCP guarantee).

---

## Prioritized roadmap (Strangler-Fig on the live editor; each phase ends green, reverts alone)

MUST-DO for "non-programmer can build ANYTHING" (the mandate) vs GOLD-PLATING are marked.

**V0 — Coverage: page-level FilterSchema/ParamDef authoring [MUST].** A Filters drawer: pick a dimension (cube.dimensions) → choose control type (select/range/cascade/multi/chip/year) → bind options to cube.members → set DefaultSpec → showWhen/enableWhen. Emits FilterSchema into page.meta. *Closes the single biggest gap (a dashboard IS its filters). Fitness #1.*

**V1 — Coverage: the remaining transform ops + DeriveExpr formula box [MUST].** Schema-driven StepForms (a PropSchema per op → reuse the Inspector) for melt/rename/cast/concat/template/addField/select/aggregate/rollup/group/reduce/window/join; a friendly formula input for derive (DeriveExpr string form). *Fitness #1.*

**V2 — Coverage: remaining DataSpec editors [MUST].** row-list, by-mode (recursive editor keyed by ModeId), pivot, transform (reuse PipelineBuilder). *Fitness #1.*

**V3 — Coverage: Page Inspector [MUST].** Select the page root → render presentation projectors' PropFields + frame + modeOrder + page-vars + page-root-kind. Methodology fieldset on data nodes (compliance, Law 9). *Closes presentation/frame/modes/vars/methodology gaps.*

**V4 — Coverage: VisibilityExpr builder + drop-accept validation [MUST].** Node-level "show when" condition builder (eq/in/and/or/mode-is…) in the Inspector; registry-driven drop acceptance (slots.accepts/singleton/max) in the drop handler. *Fitness #5.*

**V5 — Binding ergonomics: field-wells + Show-Me front-and-center [MUST for "easy"].** Replace channel-name typing with MEASURE/DIMENSION/SERIES/FILTER wells fed by the profile (Looker/Tableau); surface suggestPanels as a prominent "Show Me / Recommended" group; profile-bind timeseries/growth/ratio-list codes (kill remaining free-text). *Fitness #3.*

**V6 — Document ergonomics: Outline/Tree pane + slash/Cmd-K insert [MUST for "easy"].** Left Outline (flat store → tree, @dnd-kit reorder/reparent); "/" + cmdk command palette insert-in-place. *Notion/Gutenberg/Webflow ergonomics.*

**V7 — Templates & starters [MUST for "easy"].** A template gallery (Wix/Gutenberg patterns): pre-composed pages/sites seeded into a new session; data-first "connect a cube → generate a dashboard" (extend suggestPanels to a full-page generator).

**V8 — Polish [GOLD-PLATING].** react-colorful color picker, icon picker, per-field hints/reset-to-default (Storybook), read-only synced JSON pane (Adaptive Cards), published-vs-draft visual delta, variant-matrix preview (Plasmic), multi-store/per-page binding, actualRegion-level binding validation.

**Later / YAGNI-gated:** real-time collaboration/presence (Sanity/Figma); factor `@statdash/inspector-kit` (only when a 2nd consumer is real, per panel-as-external-product); UI-schema/data-schema split for multi-layout inspectors (JSON Forms concept — only if basic/advanced layouts prove needed).

**MVP of THIS vision = V0+V1+V2+V3+V4** (total coverage — "can author anything") **then V5+V6+V7** (the "easy for a non-programmer" layer). V8 is differentiation, not correctness.

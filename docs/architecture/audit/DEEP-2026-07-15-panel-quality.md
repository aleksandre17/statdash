# DEEP AUDIT — `apps/panel` quality-gap LEDGER (framework/platform-grade)

**Commissioned by:** owner (standing priority — "the admin panel's framework- and platform-level QUALITY: concepts, standards, canon/canonism, architectures, aggregation, agnosticism"). NOT a feature ask; NOT a re-conception. The object model is SETTLED (ADR-041/042 stand verbatim; this audit does not re-open them).
**Method:** read-only first-principles pass over the live `platform/apps/panel/src` substrate (Inspector, dock-section registry, facet registry, `useCanvasController`, `constructor.store`, `setupCanvasRegistry`, `capabilityGate`, `pageSchemaSource`, `FieldControlRegistry`, `StudioShell`) benchmarked against the reference class (Builder.io · Puck · Form.io · JSON-Forms · Figma · Looker) and against ADR-043 (Projector Law) / ADR-044 (Publishable Identity). Builds on the prior framework-lens findings (arrow enforced, engine agnostic, PM-1 Cell seam KPI-only, 46 panel fitness tests) — those are not re-verified.
**Boundary honored:** read-only. No code changed. This doc is the sole write.
**Output shape:** each finding = `{current state (file:line) · framework-grade target · gap · canonical fix · size}`. Orderable WIP=1. Not a manifesto.

---

## Scoreboard (per-dimension verdict)

| # | Dimension | Verdict | One-line reason |
|---|---|---|---|
| 1 | CONCEPTS | **PARTIAL** | Projection model is real & registry-based (better than ADR-043 feared); but the **PLANE axis is 0-code** and the system-plane `vars` derive-graph leaks to the author as raw JSON. |
| 2 | STANDARDS | **PARTIAL** | WCAG strong, GoG whole; but **two drag transports coexist** (native HTML5 ⟂ dnd-kit) and **two i18n mechanisms** (LocaleString T-objects ⟂ i18next ⟂ ad-hoc ternary). |
| 3 | CANON / CANONISM | **PARTIAL (strong)** | 46 fitness tests, no node-`type===` branch in the dock; but **one live Law-1 breach** (`capabilityGate.needsGeo` sniffs `type`) + a hand-wired `resolve()` precedence ladder. |
| 4 | ARCHITECTURE | **PARTIAL (strong)** | Store is exemplary (thin wiring over pure reducer slices), `types.ts` under the 400 ceiling; the **one oversized module is `NestedItemControl.tsx` (549)**. |
| 5 | AGGREGATION | **PARTIAL** | Every registry is internally clean; but registration is **scattered across ≥5 composition points** with no single `composeConstructor()` / capability-manifest seam. |
| 6 | AGNOSTICISM | **PARTIAL → NO (H5)** | Engine is agnostic; the **panel bakes the Geostat tenant as seed constants** (`defaultLocale:'ka'` ×3, brand string, `year`/`range` perspectives) and is **MUI-locked** (82/228 non-test files). A second tenant cannot drive it zero-code today. |

**Overall:** the panel is **reference-class at its projection substrate and NOT yet platform-grade** on plane, transport, and agnosticism. It is genuinely a platform (registry-projected, special-case-free authoring, machine-enforced) — above Builder.io/Puck — but three concrete, bounded seams keep it from framework-grade.

---

## 1. CONCEPTS — one coherent model, or leaky concepts?

**What is genuinely coherent (state the strength honestly).** The panel HAS one conceptual spine and lives it:
- The Inspector is a single generic renderer over `PropSchema` resolved through a `SchemaSource` port (`inspector/Inspector.tsx:110-296`) — zero per-type form. A newly-registered type is inspectable for free. This is the JSON-Forms/RJSF class, done right.
- The dock body is a **registry**, not a hardcoded stack: `dockSectionRegistry` (`inspector/sections/dockSection.ts`) with `{ id, appliesTo, render, order }` sections; `RightDock` filters+sorts and renders (`studio/RightDock.tsx:143-153`).
- **The `inspect = projectParts ⊕ projectFacets` fold that ADR-043 warns about is, in the panel, already better than the doctrine implies.** `registerFacetSections()` (`inspector/sections/builtins.tsx:204-250`) derives ONE dock section **per registered facet by iterating `facetRegistry.list()`** — a generic loop, not a hand-written `⊕` term. A new facet is one `facetRegistry.register()` call in `builtinFacets.ts`; the dock is untouched (verified: STYLE/DATA/EVENTS/VISIBILITY/CHROME all registered, `builtinFacets.ts:40-133`). The only hand-registered sections are `element.schema` (parts), `page.*`, and `chrome-composition` — legitimate built-ins, not a per-type fold.

**GAP C1 — the PLANE axis is 0-code; the system plane leaks to the author (the deepest concept gap).**
- *Current:* `plane`/`steward`/`audience` appear **twice** in non-test source, both incidental (a command keyword; a role-lens comment). There is **no `PropField.plane`** and no dock filtering by audience. The live symptom: `pageSchemaSource` projects `vars` — the AR-36/42 derive-graph, a **system-plane** construct — to the author as a raw `type:'object'` JSON sub-editor (`features/page-config/pageSchemaSource.ts:67`), and `walkNodes.ts:12` treats `vars` as an authorable structural key. This is exactly Law 11 C3's "no plumbing tokens" violated, and CONCEPT §I1's "declaration models IDENTITY but not AUDIENCE."
- *Target (Looker/PowerBI canon):* every declared field carries its audience; the dock projects author-plane fields, hides system-plane, gates steward-plane behind the lens. `contract = shape ⊥ state ⊥ plane`, all three declared.
- *Canonical fix:* additive `PropField.plane?: 'author'|'steward'|'system'` (engine field, default `author`, OCP) → the dock/Inspector filters `renderField` by plane. Retire the raw-`vars` author projection (mark it `system`). This is PM-B / ADR-042 D4 / W3 — **already routed, not a re-fork.** Panel-local slice = "project by plane; stop leaking `vars`."
- *Size:* **M** (one engine field + a filter in `Inspector.renderField` + `dockSection` applicability; retire two leak sites). Deepest leverage — see VERDICT.

**GAP C2 — no `StateContract` in the panel; honest states are per-surface render logic, not a projected axis.** The canvas-never-lies work (PM-1 Cell seam) is KPI-only and lives in the engine; the panel has no declared per-element state contract the dock/canvas projects generically. This is CONCEPT §I1's STATE axis. *Fix:* rides the same plane/state generalization (PM-B). *Size:* M, sequenced behind C1. Not panel-local-only (engine `Cell`).

---

## 2. STANDARDS — full adoption, or partial?

| Standard | Status | Evidence |
|---|---|---|
| Schema-driven authoring (JSON-Forms/RJSF) | **WHOLE** | `Inspector.tsx` generic over `PropSchema`; `FieldControlRegistry` strategy dispatch. |
| Grammar of Graphics authoring | **WHOLE** | `features/data-layer/editors/query/EncodingEditor.tsx` + `MeasureSelector` + pipeline — the encoding grammar is authored, not hardcoded. |
| WCAG 2.1 AA | **WHOLE (strong)** | Inspector: ARIA tablist w/ arrow-key roving (`Inspector.tsx:203-249`), `<fieldset>/<legend>` disclosure, `aria-describedby` error assoc; dock resize `role="separator"` w/ `aria-valuenow` (`RightDock.tsx:158-171`); `CanvasToolbar` status live-region. Above the builder-class baseline. |
| **ONE dnd transport** | **PARTIAL / SPLIT** | **Two coexisting transports.** Native HTML5 `dataTransfer` drag: `canvas/CanvasOverlay.tsx`, `canvas/NodePalette.tsx`, `discovery/MetricPalette.tsx` (the **canvas insert path — the primary surface**). @dnd-kit: `outline/*`, `features/data-layer/fieldwells/*`, `features/site/NavEditor.tsx`, `editors/query/PipelineBuilder.tsx`, `editors/rowlist/RowListEditor.tsx` (`shared/dnd/DndProvider.tsx` exists). This is the STUDY's "two transports coexist" made concrete. |
| i18n completeness | **PARTIAL / INCONSISTENT** | **Three string mechanisms.** Inline bilingual `LocaleString` `T`-objects (25 files, e.g. `RightDock.tsx:51-57`); i18next `useTranslation` (4 files; `boot/initI18n.ts`); ad-hoc `en ? 'X' : 'Y'` ternary (`studio/DataModelBody.tsx:40-58`). Studio strings ARE translated (not English-only) but there is no ONE canonical string port. |

**GAP S1 — two drag transports.**
- *Target:* ONE dnd-kit transport for every drag surface (the STUDY's canonical-transport rule; Figma/Framer ship one). Native HTML5 drag on the canvas is the odd one out and is the least keyboard-accessible path (WCAG keyboard-move is weakest exactly where authoring matters most).
- *Fix:* migrate the canvas insert + palette drags onto `@dnd-kit` behind the existing `DndProvider`; retire `dataTransfer`. Delivers keyboard-move (WCAG) as a side-effect.
- *Size:* **M–L** (canvas overlay drop-zone measurement is the hard part; the palette/metric drags are mechanical).

**GAP S2 — three i18n mechanisms.** *Fix:* one string port — the `LocaleString` `T`-object is the config-consistent choice (it matches how content is authored); converge the i18next + ternary sites onto it (or a thin `t(LocaleString)` helper). *Size:* **M** (mechanical, wide).

---

## 3. CANON / CANONISM — one canonical way, or shadow paths?

**Strong:** `FF-NO-EXTERNAL-SPECIAL-CASE` is green; the dock names no concrete node type (facet applicability reads declared `caps`/`slot` predicates — `builtinFacets.ts:45,66,86,110,131`); 46 fitness tests machine-enforce the canon; the `if (type===)` hits in source are legitimate discriminated-union parsing (`canvasPageAdapter`) or **field-type** dispatch (`FieldControlRegistry`), not node-type branches.

**GAP N1 — the one live Law-1 breach: `capabilityGate.needsGeo` sniffs the type string.**
- *Current:* `discovery/capabilityGate.ts:41` — `return entry.type === 'map' || entry.type.includes('geo') || entry.caps.includes('map')`. The file's OWN header (`:22`) declares "Law 1: read from declared caps... never from a hardcoded panel-type list" — and then violates it three lines of logic later. A new geo panel named `choropleth` is silently un-gated.
- *Target:* the palette entry declares its data requirement; the gate reads the declared requirement (the same discipline `suggestPanels.ts:70` correctly uses when it reads a **dimension's** declared `conceptRole`).
- *Canonical fix:* add a declared `requires?: { conceptRole?: string }` (or a `needs-geo` cap) to `NodeSliceMeta`, projected into `PaletteEntry` (`canvas/paletteEntries.ts:68-80` already projects `caps`); `needsGeo` becomes `entry.requires?.conceptRole === 'geo'`. Zero type-sniff.
- *Size:* **S.** Highest leverage-per-cost quick win — it removes the single canonism breach and is a clean OCP declaration.

**GAP N2 — `FieldControlRegistry.resolve()` is a hand-wired precedence ladder (minor).** `resolve()` (`FieldControlRegistry.ts:76-105`) hard-codes steps 1–4 (coverage → enum-ref → options → nested) as `if` branches before the registry `.get(type)`. Each branch keys off a declared FIELD property (not a node type), so it is not a Law-1 breach — but "a new resolution rule = editing `resolve()`", the same hand-fold shape ADR-043 names one level down. *Fix:* a declared-precedence resolver chain (registered matchers). *Size:* S. Low priority (works, bounded).

---

## 4. ARCHITECTURE — SOLID at the component level

**Strong (benchmark-worthy):**
- **State management is exemplary.** `constructor.store.ts` (429 lines) is **thin wiring** — every action delegates to a pure reducer patch in a per-concern slice (`constructor.pages`, `.chrome`, `.lifecycle`, `.history`, `.selectors`). The 429 lines are almost entirely one-line `set(...)` delegations. This is the correct controller/store seam.
- `types/constructor.ts` = **183 lines**, well under the 400 ceiling.
- `useCanvasController.ts` (317) is a clean canvas↔store controller seam, reused by every surface — no forked wiring.

**GAP A1 — `NestedItemControl.tsx` (549) is the one oversized module.** It carries `DrillEditor` + `NestedFieldRow` + `ArrayListScreen` + `Breadcrumb` + drill-path model + focus-escalation + breadcrumb-hoisting in one file (`inspector/controls/NestedItemControl.tsx`, structure at `:119-390+`). Cohesive, but 4–5 responsibilities. *Fix:* extract `DrillEditor`, `ArrayListScreen`, `Breadcrumb`, and the drill-path/step model into siblings; keep `ArrayOfControl`/`ObjectControl` as the thin registry entry points. *Size:* S–M (mechanical split, high test coverage already present). Next offenders: `MetricEditor.tsx` (470, `studio/model`), `StudioShell.tsx` (353 — composition root + URL-binding effects, justified but watch).

**GAP A2 — `patchItemProp` residence dispatch is a 3-arm `if`-ladder (minor).** `useCanvasController.ts:248-258` branches `mut.target` over `node-props`/`filter-schema`/`site-chrome`. It reads a **declared residence tag** (not a type), so it is acceptable per ADR-041 — but a fourth residence adds a fourth arm. *Fix (only when a 4th residence arrives):* a residence→commit registry. *Size:* S. YAGNI-gated.

---

## 5. AGGREGATION — how capabilities compose

**Each registry is internally clean and introspectable:** `nodeRegistry` (slices) → `paletteEntries` is a pure projection (`paletteEntries.ts:68`); `dockSectionRegistry`; `facetRegistry` → `registerFacetSections`; `fieldControlRegistry`; `focusViewRegistry`; `perspectiveRegistry`; `presentation` projectors. This IS "ship capabilities, not one-offs."

**GAP G1 — registration is scattered across ≥5 composition points with no single aggregation seam (the owner's "aggregatives").**
- *Current:* the Constructor is assembled in pieces at different times/places: `setupCanvasRegistry()` wires plugin slices + store-builders + presentation projectors + anchor middleware, lazily via `App.tsx:77`; `registerBuiltinDockSections()` (module side-effect, called from `RightDock.tsx:16`) wires dock sections + facets + facet-sections; `fieldControlRegistry` self-populates at module-eval (`FieldControlRegistry.ts:126`); `perspectiveRegistry` gets its members inside `setupCanvasRegistry` (`setupCanvasRegistry.ts:45`). There is **no one place that answers "what is this Constructor composed of."**
- *Target:* ONE `composeConstructor(manifest)` seam / capability manifest — the composition root that aggregates every registration in declared order and is the single introspection point (the peer of `describeApp()` for the authoring app). This is also what makes AGNOSTICISM fixable (a second tenant swaps the manifest).
- *Canonical fix:* a `composition/` root that takes a `ConstructorManifest` (slices, facets, dock sections, controls, perspectives, tenant seeds) and performs every registration; `App` calls it once. No registry mechanics change — this is an aggregation seam over the existing clean registries.
- *Size:* **M.** Enables GAP G2/G3 (agnosticism) cleanly.

---

## 6. AGNOSTICISM — platform ≠ product, at the panel level (H5)

**Engine agnostic (verified prior); the PANEL bakes the Geostat tenant as seed constants.**

**GAP AG1 — tenant content hardcoded as panel constants (H5 fails today).**
- `defaultLocale: 'ka'` seeded in **three** places: `store/constructor.history.ts:70` (`INITIAL_SESSION`), `canvas/CanvasView.tsx:65` (`CANVAS_I18N = { locales: ['ka','en'], defaultLocale: 'ka', fallbackLocale: 'ka' }`), `store/mock-data.ts:33`.
- Product brand hardcoded: `features/auth/LoginForm.tsx:67` — "GeoStat Statistics Dashboard Platform".
- Tenant perspectives hardcoded in the composition root: `setupCanvasRegistry.ts:45-46` registers `year`/`range` with Georgian labels.
- *Target (H5):* a second tenant (different locales, brand, perspectives) drives the panel **zero-code** — these are injected from a tenant manifest, not baked.
- *Canonical fix:* hoist the seeds into the `ConstructorManifest` (GAP G1's seam): `manifest.tenant = { locales, defaultLocale, brand, perspectives }`. The panel reads the manifest; Geostat becomes ONE manifest instance, not the hardcoded default. (First-tenant-erosion discipline.)
- *Size:* **M** (composes with G1).

**GAP AG2 — MUI is the widget kit in 82/228 non-test files (~36%); framework-agnostic = NO.** `muiTheme.ts` correctly re-points MUI's palette vars at the agnostic DTCG token spine (`@statdash/styles`), so the **design tokens** are portable — but the **component vocabulary** (`Box`/`Typography`/`Chip`/`IconButton`/…) is MUI-locked pervasively. *Honest assessment:* this is acceptable for a single-product Constructor and NOT worth a speculative abstraction layer now (YAGNI — no second UI-kit consumer exists). *Flag, don't fix:* record it as a known coupling; the DTCG-token seam is the right hedge; only introduce a widget-kit port when a real second consumer appears. *Size:* — (deferred by design).

---

## RANKED HARDENING BACKLOG (highest architectural leverage first; each WIP=1)

| # | Slice | Dimension | Canonical target | Size |
|---|---|---|---|---|
| **1** | **Kill `capabilityGate.needsGeo` type-sniff** — declare `requires.conceptRole` on `NodeSliceMeta`, project into `PaletteEntry`, gate reads the declaration | CANON (N1) | zero type-sniff; the one live Law-1 breach removed | **S** |
| **2** | **PLANE axis, panel-local slice** — `PropField.plane` filter in `Inspector.renderField` + `dockSection` applicability; retire the raw-`vars` author projection (mark `system`) | CONCEPTS (C1) | `contract = shape ⊥ plane`; "projection with a plane" (Law 11 C3) lived, not narrated | **M** |
| **3** | **ONE composition root** — `composeConstructor(ConstructorManifest)` aggregating every registration + tenant seeds | AGGREGATION (G1) + AGNOSTICISM (AG1) | one introspectable seam; a 2nd tenant swaps the manifest (H5 becomes real) | **M** |
| **4** | **Unify drag onto ONE dnd-kit** — migrate canvas insert + node/metric palette off native `dataTransfer` | STANDARDS (S1) | one transport; keyboard-move (WCAG) falls out | **M–L** |
| **5** | **Split `NestedItemControl.tsx` (549)** — extract `DrillEditor`/`ArrayListScreen`/`Breadcrumb`/drill-model | ARCHITECTURE (A1) | SRP; the one oversized module retired | **S–M** |

*Below the line (real, lower leverage):* ONE i18n string port (S2, M) · declared-precedence `resolve()` chain (N2, S) · residence→commit registry when a 4th residence lands (A2, S, YAGNI-gated).

---

## VERDICT (one paragraph, benchmarked, no reassurance)

**Is `apps/panel` framework/platform-grade as architecture today? PARTIAL — reference-class at the projection substrate, not yet platform-grade on plane, transport, and agnosticism.** Benchmarked honestly, the panel is *above* Builder.io/Puck (registry-projected, special-case-free, 46 machine-enforced fitness tests, a generic Inspector, and — contrary to ADR-043's worry — a **registration-based facet fold, not a hand-wired `⊕`**), and its state layer is exemplary. But three concrete seams keep it from framework-grade: (1) the **PLANE axis is 0-code and the system-plane `vars` derive-graph leaks to the author as raw JSON** — the deepest gap, because it is the one place the canon ("projection with a plane") is narrated but not lived; (2) **two drag transports coexist** on the very surface (the canvas) where authoring is primary; (3) the panel **bakes the Geostat tenant as seed constants** (locale ×3, brand, perspectives) with **no single composition/manifest seam**, so H5 (a second tenant, zero-code) fails today. The **three highest-leverage hardening moves** are: **(1) kill the `capabilityGate` geo type-sniff** (S — the only live Law-1 breach, cheapest possible canon win); **(2) declare the PLANE axis and stop leaking `vars`** (M — closes the deepest concept gap, already routed via PM-B/ADR-042, no re-fork); **(3) introduce ONE `composeConstructor(manifest)` aggregation seam** (M — simultaneously fixes the scattered-registration and tenant-seed leaks, making the second-tenant test real). None re-opens ADR-041/042; every move is additive hardening on the settled substrate.

*— platform-architect, deep audit, 2026-07-15*

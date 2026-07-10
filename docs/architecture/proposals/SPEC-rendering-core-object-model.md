# SPEC — Rendering-Core Object Model: One Type System, One Tree, Two Residences

> **Status:** PROPOSED (design-only; no code in this commission) · **Author:** platform-architect (deep independent study, 2026-07-10)
> **Commission:** is the Constructor's rendering-core / object model the best canonical architecture — and if not, what is, and how do we migrate?
> **Trigger (owner):** `KpiStripNode` is a first-class typed node, but its KPI card (`KpiSpec`) is a nested prop-array item. "We're building a SYSTEM — everything composable should be its own type, edited uniformly, all the way down."
> **Relations:** reframes ADR-022 (D7 itemSchema) — *kept, canonized*; unblocks `SPEC-studio-shell-layout.md` — *resumes unchanged*; extends `SPEC-render-pipeline-target.md`; new engine work → **ADR-023**.

---

## 1. Verdict on the current model

**The current core is 70% of the canonical architecture already — but the remaining 30% is exactly where the owner's pain lives, and it is architectural, not cosmetic.**

Three verified findings that reshape the question (all cited to code):

**F1 — The "5-tier taxonomy" is a META vocabulary, not five mechanisms.** `registerSlice.ts:73` already collapses `node`/`page`/`panel` into ONE `nodeRegistry`; page-ness and panel-ness are *literal-pinned facets* (`PageSliceMeta.rootOnly: true`, `PanelSliceMeta.canHaveChildren?: false` — slice-meta.ts:186,215), i.e. "kind is a facet" is already the design for the node tier, with illegal states unrepresentable. The real fragmentation is: **three registries** (`nodeRegistry` / `chromeRegistry` / `filterControlRegistry`), **two composition mechanisms** (`SlotDef` tree slots vs `ChromeSlot` positional resolution), and **one unregistered tier** (nested items = plain data, no type identity).

**F2 — Nested items are already re-inventing node facets, per shell, ad hoc.** `KpiSpec` (core/data/kpi-spec.ts) carries `id` (≈ node id), `when: VisibilityExpr` (the *same grammar* as `view.visibleWhen`, evaluated by a second seam `kpiVisible` instead of renderNode step 0.5), `color` (≈ styles), `preliminary`/`methodologyUrl` (≈ the node-level `methodology` cap + integrity badges). `HeroCardDef` repeats `id`/`color`. `interpretKpi` re-implements per-item visibility, locale resolution and template expansion — duplicating the render pipeline in miniature. **This is the root cause**: when an element needs node facets but cannot be a node, each shell rebuilds the engine privately (DRY violation with a growth vector — every future item type repeats it).

**F3 — The config is already a uniform typed-object grammar; only the engine's type system fails to honor it.** `geostat.provisioning.json` uses `type` discriminants at every depth: nodes (`section`, `kpi-strip`), data specs (`point`, `yoy`, `query`), params (`year-select`, `select`), transform ops. The DATA is uniform, Law-2-clean, losslessly round-tripped (`canvasPageAdapter` flat⇄tree). The object MODEL over it (registries, meta shapes, selection/editing surfaces) is what's fragmented. **No config-format crisis exists — this is an engine-internal unification plus two targeted config promotions.**

So: not "wrong core, rebuild" — **right core, three seams short of canonical.** The renderer pipeline (renderNode's 12-step, zero type-branching, registry dispatch, versioned migration) is reference-grade and is *retained as-is*.

---

## 2. The study — reference-platform canon (expert distillation; no live web, marked where uncertain)

| Platform | Object model | The lesson we take |
|---|---|---|
| **DOM / React** | Everything is an element in one tree; semantics per tag | Uniform mechanism scales; semantics live in per-type schema, not per-tier machinery |
| **Figma** | ONE node model; a node *type* is a composition of trait mixins (`ChildrenMixin`, `GeometryMixin`…); one selection model, one inspector driven by which mixins are present | **Kind-as-facet is proven at scale.** The properties panel is generic over facets — our Inspector already is |
| **ECS / scene graphs** (Unity, Godot) | Entity = id; capabilities = data components; systems interpret | Facets are *data*; behavior lives in the interpreter (≡ our `caps` + renderNode) |
| **Builder.io** | Uniform `BuilderElement`; registered components declare typed `inputs`; a `list` input with `subFields` stays **data on the element** — deliberately NOT children | **The value band is a feature, not a gap.** The best commercial builder chose two residences |
| **Puck** | `slot` is a *field type* (`type:'slot'` vs `type:'array'`) — slot items are full registry-typed component instances; array items are data | **The crispest formulation: residence is a property of the composition site, not a different mechanism** |
| **Gutenberg** | Blocks all the way down; list-items were *promoted* from HTML content to nested blocks; header/footer chrome became `template parts` (same block mechanism); `supports` = declarative capability facets | Precedent for **promotion** (canvas-manipulable things become blocks — and it was worth the migration) and for **chrome joining the one mechanism** |
| **Sanity** | Every type registered in ONE schema registry; arrays of typed objects (`of:[{type}]`, `_key`-addressed); one generic form engine renders all | **One type system spanning both residences** — item types are first-class *types* without being tree nodes |
| **Grafana** | Panels first-class; `fieldConfig`/transformations/overrides = structured values; template variables = a *param model* distinct from widgets; Scenes experimented with everything-in-one-tree (incl. controls), Schema v2 returned to declarative JSON | **Statistics-grade canon:** data projections (columns, encodings) are values, not nodes; param definitions ≠ control widgets |
| **Vega-Lite** | Minimal orthogonal grammar; marks/encodings are typed sub-objects | **Grammar minimality (Law 4): never promote what composes better as a value** |

**Distillation — every leading platform converges on three bands:**

1. **Tree band** — instances with *identity + position + independent manipulation* (select, reorder, show/hide, style, bind). One node mechanism, one registry, one tree.
2. **Value band** — *typed, schema-validated, uniformly-edited* structured values living on a field (encodings, columns, subFields, Sanity objects). First-class **types**, not tree citizens.
3. **Facet band** — capabilities/kind expressed as declarative opt-ins on the type (Figma mixins, Gutenberg supports, ECS components — our `caps`/`rootOnly`/`canHaveChildren`).

The best systems give all three bands **one type system and one editing grammar**. Fragmentation is not "having a value band" (Builder.io/Sanity/Grafana prove it canonical); fragmentation is *multiple type systems* and *facet reinvention inside the value band*.

---

## 3. The canonical model — **One Type System, One Tree, Two Residences**

### 3.1 One Type System — `ObjectMeta`

Collapse the five META shapes into ONE base whose kinds are **refinements** (semantic honesty preserved in the types; mechanism unified):

```ts
// packages/react/src/engine — target shape (ADR-023)
interface ObjectMeta {
  type: string; variant?: string
  label?, icon?, category?, preview?
  schema?: PropSchema; defaults?; groups?; version?; i18n?
  slots?: Record<string, SlotDef>          // tree-band composition
  caps?: NodeCap[]                          // facet band (unchanged)
  // ── kind facets (all optional; literal-pinned by the refinements) ──
  rootOnly?: boolean; canHaveChildren?: boolean; transparent?: boolean; singleton?: boolean
  variants?: VariantSchema; navContribution?: NavContribution
  chrome?:  { slot: string; key: string; defaultRegion: string; defaultOrder: number }
  control?: { controlType: string; dimension?: string }
}
// The 5-tier union becomes DERIVED refinements — exported as today's names (byte-identical imports):
type PageSliceMeta   = ObjectMeta & { rootOnly: true }
type PanelSliceMeta  = ObjectMeta & { canHaveChildren?: false }   // leaf, unrepresentably
type ChromeSliceMeta = ObjectMeta & { chrome: {...} }
type FilterControlMeta = ObjectMeta & { control: {...} }
```

ONE `objectRegistry` ingestion path; `chromeRegistry` and `filterControlRegistry` become **facet-indexed views** over it (their `(slot,key)` / `controlType` lookups preserved verbatim). `registerSlice`'s three branches → one branch + view indexing. The Constructor's capability discovery browses ONE registry — nodes, chrome, controls, and (via §3.3) item types, all in one palette taxonomy.

`sliceType` never appears in config (verified — config carries only `type`), so this is **pure engine-internal: zero config migration**.

### 3.2 One Tree, Two Residences — composition grammar

**Residence is a property of the composition site** (Puck's law):

- **Slot** (`SlotDef` — unchanged): items are node instances of registered types — identity, position, canvas selection, full render pipeline. `accepts` gates types (already built, incl. render-time `warnSlotPlacement`).
- **Field with `itemSchema`** (D7/ADR-022 — unchanged): items are typed *values* — schema-validated, uniformly edited via the generic nested editor, path-addressed. **This is the value band's canonical editor, not a stopgap** (Builder `subFields` / Sanity lineage).

**Chrome joins the same grammar** (R4, deferred): the app frame becomes a registered `site-frame` object whose regions (`top/left/right/bottom/content`) are slots; chrome variants are types constrained by `accepts`; the page-override → site-default → `'default'` chain (ChromeSlot.tsx) is preserved as the *slot-config override cascade* (Grafana chain semantics, unified mechanism). Two documents (site manifest vs page config) remain — documents differ, the mechanism doesn't.

**One address grammar for selection + editing:** `(documentId, nodeId, propPath?)` — tree selection when `propPath` is absent, value drill when present. Both halves already exist (`selectNode` any-depth + D7's `prop-path.ts` numeric-segment grammar); this spec merely names them as ONE spine — exactly the breadcrumb spine `SPEC-studio-shell-layout.md` assumes.

### 3.3 The Promotion Law — which residence does an element get?

**An element belongs in the tree band iff the author manipulates it as a THING — operationally: it needs ≥2 node facets** from {identity `id` used for addressing, visibility expression, per-item style/variant, own data binding (DataSpec), RBAC, independent reorder-as-gesture}. Below the threshold it is a value (itemSchema). At or above it, a value type re-implementing those facets is **forbidden** — it must be promoted to a registered node type (FF-NO-FACET-REINVENTION, §6).

Applied to the current inventory:

| Element | Facets it carries today | Residence verdict |
|---|---|---|
| `KpiSpec` (kpi card) | id + `when` + `color` + value/trend data = **4** | **PROMOTE → `kpi-card` node** (R2 exemplar) |
| `HeroCardDef` | id + color/pageBg (style) = **2** | **PROMOTE → `hero-card` node** (R3) |
| `table.columns`, chart axes/encodings | none (projection config) | **VALUE** — Grafana fieldConfig / Vega canon; itemSchema stays |
| Filter controls (`ParamDef`) | param semantics, not canvas things | **VALUE** in `filterSchema` — Grafana template-variable canon says this is *correct*, not debt (M4.1's "no cross-tier slot" ruling confirmed) |
| Transform steps, visibility exprs, links | none | **VALUE** |

**The kpi-card promotion is the deep win, not a rename:** `KpiValueSpec` (`point`/`yoy`/`cagr`/`mean`/`share`/`expr`/`metric`) registers into the DataSpec grammar via `registerSpec` (the single extension path, packages/CLAUDE.md) → the card is a *leaf data panel* (`data: {type:'point',…}`) inheriting the ENTIRE renderNode pipeline for free: `view.visibleWhen` retires `when`, RBAC, error boundary, skeleton, export cap, metric→store routing (M1), per-card cross-filter reactivity. `interpretKpi`'s private mini-pipeline is strangled. `kpi-strip` becomes a styled container with `slots: { items: { field:'items', accepts:['kpi-card'] } }` — a shape renderNode already renders (step 5 named slots). Perf: 6 cards = 6 sync in-memory resolutions behind the lazy proxy — measured before contract (§6), expected negligible; buys per-card isolation.

### 3.4 Uniform-vs-semantic resolution

The lead's tension dissolves once "uniform" is placed correctly: **uniform TYPE SYSTEM and uniform EDITING GRAMMAR (Figma/Sanity), NOT uniform residence (DOM maximalism).** Semantics stay honest three ways: (1) kind facets are literal-pinned refinements — a panel with children is still unrepresentable; (2) rich types (`DataSpec`, `ChartDef`, chrome regions, param bindings) remain per-type schema vocabulary; (3) the statistical grammar keeps its Vega-like minimality — projections compose as values. "Unify the mechanism, keep the semantics" — confirmed, with *mechanism* precisely scoped to {type system, composition grammar, address grammar} and explicitly NOT to {residence}.

---

## 4. Migration — Strangler-Fig, phased, reversible

| Phase | Work | Boundary | Reversibility |
|---|---|---|---|
| **R0** | **ADR-023** (this model + promotion law) + fitness scaffold (FFs land red→green) | docs/tests | trivial |
| **R1** | **Type-system unification**: `ObjectMeta` + facet refinements; 5 META names re-exported as derived aliases (byte-identical import sites, the prop-schema re-export precedent); `registerSlice` → one branch + facet-indexed views (`chromeRegistry`/`filterControlRegistry` keep their lookup signatures) | `packages/react/engine`, zero config change, byte-identical render | full (aliases) |
| **R2** | **Exemplar promotion — `kpi-card`** (owner gate D-ROM-2): register type (leaf facet, `data` cap); `KpiValueSpec` types join `registerSpec`; kpi-strip `version: N+1` `migrate` lifts `KpiSpec[]` → `children: kpi-card[]` (`maybeMigrate` is engine-native, renderNode step 0); `when`→`view.visibleWhen`; **expand-contract**: both shapes render during the window; contract after provisioning + stored configs migrate; retire `interpretKpi` + `KpiItemSchema` | plugins + core (spec registration) + provisioning | expand phase fully; contract = one-way (D-ROM-2) |
| **R3** | **`hero-card` promotion** — same recipe (proves it generic), then FF-NO-FACET-REINVENTION becomes a *hard* gate for all future item types | plugins | same |
| **R4** | **Chrome residence** (owner gate D-ROM-4): `site-frame` object with region slots; ChromeSlot resolution = slot override cascade; chrome view retired. **Sequenced AFTER the SL-series ships** (the Studio's chrome-editing UX informs it); R1 already delivers chrome into the one type system, so R4 is deferrable indefinitely without fragmentation returning | react engine + manifest shape (expand-contract on `chrome` record) | staged |
| **R5** | **Param/control split** (param semantics vs widget type) — **DEFERRED, YAGNI-gated**: Grafana canon says the current shape is right; trigger only on a real consumer needing free-placed controls | — | — |

**Fold-in / supersession verdicts (the paused work):**
- **D7 / ADR-022 — REFRAMED, NOT SUPERSEDED.** `itemSchema` is the *permanent, canonical value-band editor* (Builder/Sanity lineage). Changes: kpi/hero itemSchemas retire in R2/R3 as those graduate; `OPAQUE_BY_DESIGN` + `SCHEMA_TODO` machinery stays; the Promotion Law becomes the gate deciding itemSchema-vs-node-type for every future field.
- **Placement Law / `SPEC-studio-shell-layout.md` — RESUMES UNCHANGED, strengthened.** Its scope axis (element vs nested-item) maps 1:1 onto residence; its breadcrumb spine IS the unified address grammar (§3.2); R2/R3 *reduce* its nested-item cases. No assumption invalidated — **the layout build can unpause immediately, before R1.**
- **M4.1 filter-bar ruling** ("no cross-tier slot") — confirmed correct; R5 is the honest eventual answer if ever needed.

---

## 5. ADR core — alternatives rejected (≥2)

- **ALT-A — Node-maximalism** (everything a tree node; Figma/DOM/Gutenberg-list purism; the strong reading of the lead's hypothesis). **Rejected:** promotes projections (12 table columns → 13 nodes of outline noise), destroys the statistical grammar's spec locality (Vega/Grafana counter-canon), violates Law 4 grammar minimality, and the best commercial builder (Builder.io `subFields`) deliberately chose otherwise. Uniformity of *mechanism* does not require uniformity of *residence*.
- **ALT-B — Status quo** (5-tier + D7 everywhere). **Rejected:** facet reinvention is unchecked and growing (F2 — each new item type rebuilds visibility/identity/style per shell); three registries = three capability surfaces the Constructor must browse (violates capability-discovery canon); two composition mechanisms; the owner's system-question stands unanswered.
- **ALT-C — Schema-only unification** (extend itemSchema until everything is editable; never touch registries/mechanisms). **Rejected as symptom patch:** editing uniformity without type-system uniformity leaves chrome/control types un-browsable in the one palette, leaves `kpiVisible`-style duplicate seams alive, and hard-codes the fragmentation the next tier (item types with data bindings) will hit again.
- **CHOSEN:** One Type System, One Tree, Two Residences + Promotion Law (§3) — the intersection of Figma (kind-as-facet), Puck (residence at the composition site), Sanity (one schema registry across bands), Grafana/Vega (statistics-grade value band), on our unbent arrow.

## 6. Fitness functions (invariants, not comments)

- **FF-ONE-TYPE-SYSTEM** — one ObjectMeta ingestion path; `registerSlice` has exactly one registry branch; a new kind = a facet, never a new registry.
- **FF-KIND-IS-FACET** — no `sliceType`/kind branching outside the registry-view layer (renderNode is already zero — locked).
- **FF-TWO-RESIDENCES-ONLY** — every composable element is a registered node type OR an itemSchema'd value OR `OPAQUE_BY_DESIGN` (extends `isOpaqueNested`); no fourth state.
- **FF-NO-FACET-REINVENTION** — a registered itemSchema may not declare fields aliasing reserved node facets (`id`-as-address, `when`/`visibleWhen`, `visibleToRoles`, style bags); schema scanner; hard gate from R3.
- **FF-PROMOTION-LOSSLESS** — for each promotion, `migrate(vN)` renders DOM-identical output over the exemplar corpus (provisioning pages) before contract; round-trip (`canvasPageAdapter`) stays lossless throughout.
- **FF-ONE-COMPOSITION-GRAMMAR** (R4) — chrome resolves through SlotDef + override cascade; no second slot mechanism survives.

## 7. Owner decisions / one-way doors

- **D-ROM-1** — adopt the model + run R1 (rec: **yes**; engine-internal, byte-identical, alias-reversible).
- **D-ROM-2** — promote `kpi-card` (rec: **yes**; expand phase reversible; the *contract* step — dropping `KpiSpec[]` acceptance — is the only one-way door, taken only after FF-PROMOTION-LOSSLESS is green on all stored configs).
- **D-ROM-3** — promote `hero-card` (rec: yes, after R2 proves the recipe).
- **D-ROM-4** — chrome residence timing (rec: **defer until after SL-series**; R1 removes the urgency).
- **D-ROM-5** — param/control split (rec: **defer, YAGNI** — Grafana canon endorses the current shape).

## 8. Where I agreed / departed from the lead's hypothesis

**Agreed:** the direction — one recursive typed-object model, kind as facet/capability, one slot mechanism, one selection+editing model, semantics preserved per-type. The middle position (Builder.io/Puck/Plasmic territory) is exactly where the canon sits.
**Departed:** (1) **"every composable element a first-class object in one tree" is over-strong** — the canon is one *type system* with **two residences**; the value band is a feature every reference platform keeps (ALT-A rejected). (2) **The current model is closer to the target than the intel suggested** — node/page/panel are already one mechanism with pinned facets (F1); the true debt is the chrome/control registries, the second composition mechanism, and *facet reinvention inside items* (F2) — which the tree-vs-item framing alone would have missed. (3) **D7 is not an artifact of the fragmented model** — it is the value band's permanent editor, reframed not superseded. (4) Controls are *correctly* not tree citizens (Grafana canon) — unification there would be a regression dressed as consistency.

# SPEC — The Canonical, Loosely-Coupled Studio IA (Fable ROOT-2)

> **Status:** PROPOSAL — decision-grade (owner reviews + picks the direction) · **Author:** platform-architect (2026-07-12) · **Read-only study, no code.**
> **Commission (owner, verbatim intent):** the Studio surfaces are *non-canonically arranged, too complex, hard to find things (even for him)*; the right dock shows page-config *out of place*; a blank page *offers only "section"*; chrome + *every element* must be reachable/contract-editable through *one generic mechanism*.
> **This resolves Fable ROOT-2** (the IA). ROOT-1/ROOT-3 (the object model) are resolved by ADR-041's port phases; this SPEC is the **authoring-IA projection** of that same port — not a fresh UI.
> **Grounds:** ADR-041 (Part grammar + Part port — the loose-coupling substrate) · ADR-038 (Bounded-Element Law — surfaces are generic projections) · ADR-039 (Composite selection) · ADR-037 / SPEC-worldclass-authoring-ui (Summary-Card dock · Stage · placement) · `work/items/0066` (the owner reform: P1 contextual dock · P2 simplify IA · P3 universal contract incl. chrome).

---

## 0. Thesis in one paragraph

The Studio has **two authoring mental models fighting for the same job.** Model A is the **contextual right dock** (select → edit its contract) — canonical, and already ~80% built. Model B is a **modal left rail of six peer surfaces** (Insert · Data · Layers · Pages&Site · Style · Data-model) where "where a thing lives" is a *destination you navigate to*, not a *consequence of what you selected*. Chrome lives in Model B (a list inside Pages&Site), page-config bleeds into Model A (a "Page" tab inside the element context), filter-bar's parts are reached by a hardcoded per-type bridge, and the palette is blind to what the page declares it accepts. **The canonical IA is Model A made total:** ONE canvas where everything (node · part · chrome) is selected; ONE contextual right dock that is a pure projection of the selected `PartAddress`'s declared contract; ONE left navigator (Add | Layers) generated from the registry + declared accepts; project-scope workspaces (Data-model, brand tokens) demoted from peer surfaces to summoned destinations. Every surface becomes `f(port/registry)` with **zero concrete-type knowledge** — the same loose-coupling law the port already enforces on the engine, now enforced on the UI.

---

## 1. Current-state map — the surfaces today and where they fight

**Rail (`rail.ts`):** six peer surfaces routed by `/studio/:surface` — `insert · data · layers · pages-site · style · model`. `model` re-homes onto a full-screen `FocusView`; the other five fill the **left dock**. The **right dock** (`RightDock.tsx`) is selection-contextual (element | page). The **canvas** (`CanvasView` + `CanvasOverlay`) is always mounted. A **bottom strip** holds page tabs.

| Surface | What it is | Canonical role | Coupling smell |
|---|---|---|---|
| **Insert** | `NodePalette` — registry-driven tiles, category-grouped | ADD (left) | Palette narrows only by *selected container*; when nothing is selected it shows the **whole registry**, but the canvas top-level only *accepts* `section` (drop-zones + auto-wrap). Palette ≠ what the page declares it accepts → the owner's "blank page only section." |
| **Layers** | `OutlineTree` — structural outline | GO (left) | A **second** structure view beside Insert; both are "the tree." Reads store directly — fine, but sits as a peer *destination* not a pane. |
| **Data** | governed `MetricPalette` (bind-by-noun) | element Data authoring | Correct as an author affordance, but it is a **whole rail surface** for what is one *section* of a data-bound element's contract (double home: Data surface vs the dock's data binding). |
| **Pages & Site** | Identity + Nav + **ChromePalette** | site/page config | Bundles three unlike things. **Chrome is a list here** — the ONLY way to select chrome; you cannot click chrome on the canvas. This is "chrome konfigebi" + "can't reach every element." |
| **Style** | brand-token editor (`themeOverrides`) | project theme | A whole rail surface for *global* tokens; per-element style (BE-2/StyleField) has no home yet → style is split (global surface vs not-yet per-element). |
| **Data-model** | steward modeler / dictionary (`FocusView`) | project workspace | Correct as a workspace, but sits in the rail as a *peer of element authoring*, competing for the same attention. |

**Right dock — the "page-config out of place" defect (owner #3), precisely.** `RightDock` derives scope from selection (`selKey ? 'element' : 'page'`) — good — but the header renders a **persistent `Element | Page` Tabs switch whenever a page exists** (lines 187-197). So selecting an element still shows a **"Page" tab** that swaps the whole dock to page-config. Page authoring is thus a *manual peek that lives inside the element context* — page-config bleeds into every element's surface. The canonical model (Figma/Framer) shows the selection's props and **nothing else**; page/document properties appear only when the selection is empty.

**The three named coupling smells (the loose-coupling violations):**

1. **A per-type bridge in the dock — `nodeContextEditors['filter-bar'] = FilterBarControlsBridge`** (`nodeContextEditors.tsx`). This is a **type-keyed map that reaches into filter-bar's internals from outside** — the exact anti-pattern ADR-038 §2 forbids (`registerNodeProjector('kpi-strip', …)` in disguise). Under ADR-041 a filter control is a `sourcedParts` part; it should enumerate + select + project *generically*, no bridge. (The controller **already** resolves parts through `enumerateParts`/`getPartSource` — the bridge is now redundant scaffolding.)
2. **Chrome is a separate selection species with a separate reach.** `chromeSel` (a third selection field), a separate `ChromePalette` (list), a separate `ChromeInspectorPanel` (dock branch `element.chrome`). Chrome cannot be selected on the canvas (`CanvasOverlay` renders node frames · drop frames · part frames — **no chrome frames**). Three selection species (`selectedNodeId · selectedItemPath · chromeSel`) = three dock branches = the Fable "selection triple."
3. **Two authoring homes → "where things live" is ambiguous.** The Placement Law's `relocated-surface` sends *site-scope* subjects (chrome, nav, global style, data-model) to **left-dock destinations**, while *element/page* subjects go to the **right dock**. A user restyling a header must know it is "site furniture" (Pages&Site, left) not "an element" (right dock) — a taxonomy the canon does not impose. Six rail destinations + a contextual dock is **two IAs**, and the seam between them is exactly what the owner (and users) cannot find.

**What is already canonical (keep — do not rebuild):** the dock **section registry** (`builtins.tsx` — page/element sections are declared entries, OCP); the **registry-driven palette** (`paletteEntries` — zero code per new type); the **Part-port controller** (`useCanvasController` already routes part selection/write through `enumerateParts`/`getPartSource`); the **placement law** (scope×weight → container, derived, no per-type literal); the **URL-as-SSOT routing**; the **focus-view escalation** (workspace subjects leave the dock, never cram it).

---

## 2. Canonical benchmark — how the leaders arrange {canvas · left · right · top}

| Platform | Left | Right | Selection model | Chrome / header |
|---|---|---|---|---|
| **Webflow** | **Navigator (tree)** + **Add panel (palette)** — tabbed, one dock | **Style + Element Settings** — contextual to selection | one selection over a DOM-like tree | header/footer are **ordinary elements**, selected on canvas |
| **Figma / Framer** | Layers tree + Assets | **Design / Prototype / Inspect** — *purely* contextual; empty selection → **page/canvas** properties | one selection; nothing selected → document | frames/components are just nodes; no "chrome surface" |
| **Notion** | (minimal) | inline properties | selection = the block; slash-menu inserts **in place** | no chrome concept — progressive disclosure via hover handles + `/` menu |
| **Builder.io / Puck / Plasmic** | insert palette + outline | inspector **generated from the component's fields** | one element in one JSON tree | header/footer are blocks/slots |

**The convergence (the minimal canonical surface set):**
- **ONE canvas** (center, home) — *everything* is selected on it, uniformly.
- **ONE left navigator** — **Add** (palette) and **Layers** (tree) as two panes of one dock, not two destinations. (Webflow's exact factoring.)
- **ONE right inspector** — a **pure projection of the current selection's contract**; empty selection → the page/document contract. No third "modal surface" competes with it.
- **ONE thin top bar** — page/preview/command/save. Project-scope settings (theme, data model) are **summoned destinations**, not peers of element authoring.
- **No separate chrome/style/data surfaces** — chrome is a selectable element; style/data/visibility/events are **sections of the one inspector**; the data-model/brand-token workspaces are behind the top bar.

No leader has (a) a second containment/selection grammar in the UI, (b) a per-type inspector bridge, or (c) two authoring homes. Our dock trunk matches the canon; our **rail is the divergence.**

---

## 3. The canonical loosely-coupled IA (the proposal)

### 3.1 The surface set — merge / move / remove

| Surface today | Verdict | Canonical home |
|---|---|---|
| Insert | **MERGE** → left **Navigator**, "Add" pane | left dock, pane 1 |
| Layers | **MERGE** → left **Navigator**, "Layers" pane | left dock, pane 2 |
| Data (Metric Palette) | **MOVE** → a **section of the contextual inspector** (a data-bound element's "Data" section) + a top-level *Insert* affordance for metric-bound panels | right dock section (+ palette) |
| Pages & Site · Identity/Nav | **MOVE** → the **page/site context** of the inspector (empty selection → page; a "Site" scope crumb for site-level) | right dock (page/site context) |
| Pages & Site · Chrome | **REMOVE the list** → chrome becomes **canvas-selectable** (§3.4) | canvas + right dock |
| Style (brand tokens) | **DEMOTE** → a **summoned project workspace** (top-bar "Theme"), + per-element style becomes an inspector **Style section** | top-bar destination + dock section |
| Data-model | **KEEP as workspace, DEMOTE from the rail** → summoned from the top bar / command (it is project-scope, not element authoring) | top-bar destination (`FocusView`) |

**Result — the canonical set:** **Canvas · Left Navigator (Add \| Layers) · Right Inspector (contextual) · Top bar**, plus **two summoned project workspaces** (Theme, Data-model). Six peer rail surfaces + a dock collapse to **two left panes + one right dock + two top-bar destinations.** "Where things live" becomes a single rule: *you author whatever you selected, on the right; you find/add on the left; project settings are behind the top bar.*

### 3.2 The contextual right-dock model (owner #3 — the P1 fix)

**The dock is a pure projection of ONE selection address.** Formally:

```
RightDock = renderContract( projectContract( selection ) )
selection : PartAddress | null          // ADR-041 Ph.3 — the ONE address
projectContract(null)         → page contract      (page config · perspectives · filters)
projectContract(pageAddress)  → page contract
projectContract(elementAddr)  → the element's declared ObjectMeta contract
projectContract(partAddr)     → the part's own declared contract (via enumerateParts)
```

- **Page-config is contextual, never bleeding.** Remove the persistent `Element | Page` Tabs. Page config renders **iff the selection is empty or the page itself** (deselect = canvas-background click, already `onSelect(null)`). Selecting an element shows **only its contract** — the Figma/Framer law. (A "Page" / "Site" scope is reached by *selecting nothing* or by a top-bar breadcrumb, not by a tab stapled onto every element's header.)
- **Sections are declared facets, not hardcoded branches.** The dock body already composes from the **section registry** (`dockSectionRegistry`). Style, Data (metric bind), Visibility, and Events (owner P3) become **registered sections whose `appliesTo` reads declared facets/caps** — a data-bound element shows Data because it *declares* a metric field, a styleable element shows Style because it declares `StyleField`. Zero per-type code; a new capability = a new declaration.
- **The per-type bridge is deleted.** `nodeContextEditors['filter-bar']` is removed: filter controls are `sourcedParts`, enumerated by the port, **selected on the canvas**, and projected into the dock like any other part (the `element.schema` section already renders a resolved `selectedBand` generically). The dock ends with **no `if (type === …)` anywhere.**

**Loose-coupling proof (dock):** the dock imports the **port** and the **section registry**; it names **no concrete element type**. `FF-NO-EXTERNAL-SPECIAL-CASE` (existing) guards it; deleting `nodeContextEditors` shrinks that gate's allowlist to `[]`.

### 3.3 The palette model (owner "blank page only section")

**The palette is a projection of the registry ∩ the accept-set the current insertion context declares.**

```
palette(context) = registry.list()
    .filter(notRootOnly)
    .filter(t => insertable(context, t))
insertable(ctx, t) = nestAccepts(ctx.container, t)            // direct
                   ∨ (ctx.isPageRoot ∧ wrapReachable(t))      // page → section → t (auto-wrap)
```

- **Blank-page fix:** when nothing is selected, the insertion context is the **page root**. The palette must offer **every type the page's slots declare `accepts`, plus every type reachable by the *declared* canonical auto-wrap** (`resolveInsertPlan`'s `wrap` branch: page → section → t). So a blank page offers the *full honest insertable set* — sections **and** every block a section can hold — each tile truthfully droppable (direct or wrap), instead of the current mismatch (palette shows all; only `section` drops at top-level). **Declared, not hardcoded:** the set falls out of `nestAccepts` + `resolveInsertPlan`, which read `slots.accepts` from the registry — a new page-root that accepts more widens the palette with zero palette code.
- **The gesture:** a wrap-insert may badge the tile ("adds inside a section") so the affordance is honest (guidance-by-affordance, never a block — `FF-NO-WORKFLOW-GATE`).
- **Chrome** enters this same model once chrome is a declared slot/part of the `site-frame` element (§3.4): the palette offers chrome regions where the site-frame declares them; no bespoke ChromePalette.

**Loose-coupling proof (palette):** already a pure projection of `nodeRegistry.list()` + `nestAccepts`; the fix only makes the **accept-set the page declares** the filter (it was over-showing). Guarded by `FF-PALETTE-CONTEXTUAL` / `FF-PALETTE-META-DRIVEN`.

### 3.4 Chrome + every element through ONE generic mechanism (owner P3 endgame)

Chrome is the **fourth containment grammar** (Fable §1c) and the last surface with bespoke reach. The canonical resolution (Webflow: header/footer are ordinary elements; ADR-041 ROOT-2: chrome regions fold in as a `slot`/`sourced` adapter of a **`site-frame` element**):

- **Canvas selection:** `CanvasOverlay` renders **chrome part-anchors** (one anchor family with node/part anchors after ADR-041 Ph.4). Clicking a header/sidebar/footer region selects it → **one `PartAddress`** → the dock projects its declared contract. No `chromeSel` species, no `ChromePalette`, no `ChromeInspectorPanel` special branch — all generic projections.
- **Interim (before the engine lands chrome-as-part):** render chrome frames in the overlay that dispatch to the *existing* `selectChrome` + `ChromeInspectorPanel`. This makes chrome **canvas-reachable immediately** (owner P3, visible) while the generic collapse rides ADR-041.

**The universal law:** *select anything (node · part · chrome · page) → the dock shows ONLY its declared contract, live.* One selection address, one projection, every element reachable on the canvas.

### 3.5 Progressive disclosure (simple default · power on demand)

- **Default view:** canvas + a compact contextual inspector showing the subject's **Summary card** (ADR-037) + its primary fields. A non-programmer sees a small, obvious surface.
- **Power on demand:** inspector **sections** (Style · Data · Visibility · Events · Advanced) expand; deep/rich subjects **escalate to a focus-view** (already built — the dock never crams). The left navigator defaults to **Add**; **Layers** on demand. Project workspaces (Theme, Data-model) stay hidden behind the top bar until summoned.
- **Statistics-grade AND non-programmer:** the same projection serves both — the depth is *disclosed*, never *front-loaded*.

### 3.6 The loose-coupling proof, whole

| Surface | Projection of | Names a concrete type? | Guard |
|---|---|---|---|
| Right dock | `projectContract(selection)` + section registry | **No** (after `nodeContextEditors` deleted) | `FF-NO-EXTERNAL-SPECIAL-CASE` → `[]` |
| Palette | `registry ∩ acceptsOf(context)` | No | `FF-PALETTE-CONTEXTUAL` |
| Canvas overlay | `walkNodes` + `enumerateParts` (+ chrome anchors) | No | `FF-ONE-PART-GRAMMAR` |
| Outline / Layers | `walkNodes` + parts | No | `FF-ONE-PART-GRAMMAR` |
| Selection | ONE `PartAddress` | No | `FF-ONE-SELECTION-ADDRESS` (ADR-041 Ph.3) |

Every surface reads the **port** or the **registry**; none encodes a type. That is ROOT-2 discharged: the IA is a set of generic projections of the same declarations the engine already governs.

---

## 4. Migration (Strangler-Fig — each step shippable + reversible)

Ordered by **felt impact first** (owner's reform model: visible → deploy → react). Steps S1–S4 are **apps-only, reversible, ship now**; S5–S6 ride ADR-041 and are **flagged for owner sign-off**.

| # | Step | Scope | Reversible | Owner sign-off? |
|---|---|---|---|---|
| **S1** | **Right dock purely contextual** — remove the `Element\|Page` Tabs; page-config renders only when selection is empty/page. Deselect (canvas-bg click) = page context. | apps (`RightDock.tsx`) | yes (restore Tabs) | no — pure P1 fix |
| **S2** | **Palette blank-page fix** — offer `page-accepts ∪ wrap-reachable`; badge wrap-inserts. | apps (`NodePalette` / `paletteEntries` filter) | yes | no |
| **S3** | **Delete `nodeContextEditors` filter-bar bridge** — filter controls selected on canvas + projected generically (the port path already exists). | apps (`nodeContextEditors.tsx`, `builtins.tsx`) | yes | no |
| **S4** | **Chrome selectable on canvas** — overlay renders chrome frames → existing `selectChrome`/`ChromeInspectorPanel` (interim bridge to §3.4). | apps (`CanvasOverlay`) | yes | no — but **high-visibility**, verify live |
| **S5** | **Collapse the rail** — Insert+Layers → one **left Navigator** (Add\|Layers); demote Data-model + Style to **top-bar summoned workspaces**; Data → inspector section; Nav/Identity → page/site context. | apps (`StudioShell`, `rail.ts`, surfaces) | yes (rail is data-driven) | **YES** — changes the rail the owner knows; high-visibility |
| **S6** | **Selection triple → one `PartAddress`; chrome-as-part of `site-frame`** — delete `chromeSel` species + `ChromePalette` + the `element.chrome` special branch; the dock's chrome path collapses into the generic projection. | engine + apps (rides **ADR-041 Ph.3 + Ph.6**) | Ph.3 yes; **Ph.6 one-way** | **YES** — rides the ADR-041 one-way de-alias, R2-gated |

**One-way / high-visibility flags for the owner:** **S5** (the rail the owner navigates by changes shape — recommend a live walkthrough before deploy) and **S6** (rides ADR-041's Phase 6 de-alias, the sole irreversible engine step; land only when `FF-DERIVED-CONTAINMENT` is corpus-green + owner sign-off). Everything S1–S4 is a strict superset of today, reversible, and independently shippable — the owner can react to each on `:3013`.

**"No worse than now" guardrail (per step):** every surface that moves is *re-homed, never removed* — page config, nav, identity, chrome, metric-bind, brand tokens, data-model all remain reachable; the change is *where the user looks*, made canonical, never *whether a capability exists*.

---

## 5. Recommended direction (the few sentences the owner picks from)

**Recommended surface set:** **Canvas · Left Navigator (Add \| Layers) · Right contextual Inspector · thin Top bar**, with **Theme** and **Data-model** demoted from peer rail surfaces to top-bar-summoned project workspaces — collapsing six modal destinations into two left panes + one right dock. **Contextual right-dock model:** the dock is `renderContract(projectContract(selection))` — a pure projection of the ONE selected `PartAddress`; page-config appears *only* when nothing (or the page) is selected, the persistent "Page" tab is removed, sections (Style/Data/Visibility/Events) are declared facets, and the `filter-bar` per-type bridge is deleted (filter controls become generic canvas-selectable parts). **Palette model:** `registry ∩ (page-accepts ∪ canonical-wrap-reachable)`, so a blank page honestly offers every block the page's declared slots accept — directly or via auto-wrap — not just `section`; chrome joins this model once it is a declared slot of the `site-frame` element and becomes canvas-selectable through the same one selection → one projection mechanism as every other element. Ship S1–S4 now (apps-only, reversible, visible); flag S5 (rail collapse) and S6 (selection-triple + chrome-as-part, riding ADR-041) for owner sign-off.

# SPEC — Canonical Studio Shell Layout + the Systematic Overflow Model

> **Milestone:** AR-49 M4.2 (shell-layout / overflow). **Scope:** `platform/apps/panel` only — Studio chrome. The dependency arrow is untouched; the *nested* full-fidelity drill rides the already-gated D7 engine seam (`SPEC-deep-authorability.md`), which this spec does **not** re-open.
> **Author:** platform-architect (sole author). **Status:** DESIGNED — phased into reversible apps-only build steps.
> **Predecessors it extends, never regresses:** `SPEC-authoring-reconception-M4-ia-canonical.md` (§2.11 Wave 7 tri-context dock), `SPEC-M4.1-contextual-authoring.md` (contextual-relevance law), `SPEC-deep-authorability.md` (§4 interaction taxonomy + weight formula, D7.1b drill-in). This is their **layout unification** — one placement model, not a second competing one.
> **Owner problem (2026-07-10):** the right dock "often doesn't fit / gets cramped" now that it hosts drill-in nested editors + schema-group tabs + page-scope panes. Wants a better-organized *structural* solution (inner-pages, popovers, relocation) so the user always sees exactly what the moment needs — simple, beautiful, clear.

---

## 0. TL;DR — the one reframe

**A cramped dock is not a sizing bug; it is a missing LAW.** Today the right dock is asked to hold things of four different *weights* and four different *scopes* at once, with no rule for where each belongs — so overflow is inevitable. The fix is not a wider column or more tabs; it is a **deterministic Placement Law** — a pure function `place(scope, weight) → surface` over a small **closed set of containers** — that makes a crammed dock *structurally unrepresentable*: any subject whose weight exceeds a container's budget **escalates to the next container automatically**. This is "make illegal states unrepresentable" (the M4 §1 thesis) applied to layout, and it is the same discipline the platform already uses for the *rendered* page (container-query cascade, [[grid-maximal-grammar]]) — now applied to the *authoring chrome*.

Everything the owner named — panel / popover / inner-page / relocate — is one of the closed surfaces; the drill-in and the deep-authorability taxonomy become **projections of the same law**, not a parallel system.

---

## 1. Reference-pattern study (problem → who-does-it-best → our-better)

The multi-panel overflow problem is solved by every mature builder with the **same five moves**. None, however, expresses them as a *single derived law* — each is a bag of hand-tuned conventions.

| Move | Who does it best | What they do | Our-better |
|---|---|---|---|
| **Bounded side panel + facet tabs** | **Figma** (Design/Prototype/Inspect), **Webflow** (Style ⟂ Settings) | The right panel is a *fixed-width, bounded* column; orthogonal facets of the selection are **tabs**, groups are **collapsible sections**. It never grows to fit depth. | Our facet tabs are **derived from the PropSchema's own `group`s** (M4 §2.11, already built) — a new group = a new tab for free (OCP), not a hardcoded triad. |
| **Popovers pop rich sub-editors OUT of the panel** | **Figma** (color / effects / export / component-props popovers) | A rich single-property editor does **not** live in the panel — it **pops over**, anchored to its row, transient. The panel stays bounded. | Popover admission is **weight-gated by the law** (glance-weight only), not per-editor convention — and it can anchor to the *canvas element* itself, not only the panel row. |
| **Relocate heavy/global config to dedicated full views** | **Webflow** (Page Settings / Project Settings as full pages), **Retool** (queries/data in a **bottom dock**), **VS Code** (Settings UI is a center *editor tab*, not a sidebar) | Global, workspace-weight, or pipeline editing is **evicted from the inspector** into its own surface. The inspector is reserved for the selected element. | The eviction rule is **scope-derived** (`site`/`data-model`/`workspace` scope → relocated surface), and the evicted pipeline is our **governed Model focus-view** (statistics-grade), not a generic query dock. |
| **Peek → full-page escalation for rich records** | **Notion** (side-peek → center-peek → full-page, same record) | The *same* content opens at three container weights; a rich record can escalate to the whole page. | Escalation is **automatic + deterministic** (weight-driven), not a user choice — and it terminates in our **focus-view** (canvas-region takeover), the pattern **Model mode already proves** in our code. |
| **Center/editor area hosts workspace-weight editing** | **VS Code** (editor tabs), **Figma** (prototype/present mode), **Framer** (component edit) | Anything workspace-weight takes over the **center**, with a breadcrumb/back — never a sidebar. | Our focus-view takes over **only the canvas grid-area** (rail + dock persist for orientation/escape), continuing the **same drill breadcrumb** — one navigation spine from field to workspace. |

**The synthesis (our-better thesis):** all five moves fall out of *one* rule — **surface = f(scope, weight)** — instead of five conventions. Because `weight` is *derived from the same schema/registry that drives rendering* (the deep-authorability §4 formula), placement is **self-maintaining and fitness-checked**: overflow cannot regress in. This is the quadrant no leader holds — a *governed, statistics-grade* tool whose *entire* surface allocation is a provable projection of its own config schema.

---

## 2. The canonical shell layout

The current 4-column grid is **architecturally sound** (it matches Webflow/Framer/Figma) and is **kept**. The redesign adds the two missing *overlay* surfaces (focus-view, popover) and hardens the dock into a clean zone contract. The **contextual canon holds**: left = **ADD/where**, right = **EDIT here**, canvas = **GO anywhere** (M4.1 §1).

```
┌─ Top bar — mode(Compose|Data-model) · locale · ⌘K · Save/Publish ───────────────┐
├─rail─┬─ LEFT DOCK (the "where" surface) ─┬─ CANVAS (home) ────┬─ RIGHT DOCK ──────┤
│ nav  │ Insert·Layers·Data·Pages&Site·    │ live page          │ Inspector          │
│ ⟂    │ Style·Model  →  scope: insert /   │  — or —            │  scope: element /  │
│      │ structure / global               │ FOCUS-VIEW host    │  page (EDIT)       │
├──────┴───────────────────────────────────┴────────────────────┴────────────────────┤
│ Bottom strip — page tabs + status                                                   │
└──────────────────────────────────────────────────────────────────────────────────────┘
   Overlays (NOT grid columns, summoned by the Placement Law):
     • POPOVER      — anchored to a field / canvas element      (glance-weight)
     • FOCUS-VIEW   — takes over the CANVAS grid-area, breadcrumb-back (workspace-weight)
     • ⌘K palette   — transient navigate / insert
```

**The closed set of containers (the whole vocabulary — nothing lives outside it):**

| # | Container | Scope it serves | Weight budget | Persistence |
|---|-----------|-----------------|---------------|-------------|
| A | **Rail** | surface-switch (nav) | — | persistent |
| B | **Left dock** | insert · structure · **global/site/data-model** | one surface | persistent |
| C | **Canvas** | the live home + **focus-view host** | — | persistent |
| D | **Right dock** (Inspector) | **element · page** EDIT | **form** (≤ budget) | persistent |
| E | **Popover** | **micro-target** (one property) | **glance** | transient |
| F | **Focus-view** | **workspace-weight** sub-editor | workspace | modal-in-canvas |
| — | Bottom strip / ⌘K | page-tabs / command | — | persistent / transient |

**The 3-zone right dock (hardens Wave 7 — one tier at a time, never stacked):**

```
┌ HEADER ─ context tabs (Element | Page)  XOR  drill breadcrumb ─┐  ← exactly ONE tier
├ BODY   ─ the schema-grouped form (accordion≤ / tabs>) OR one   │  ← flex-fill, owns scroll
│          centered guided empty-state — fill-by-construction    │
└ FOOTER ─ element actions (delete · visibility) ────────────────┘
```

The **defect this fixes:** today the dock header can show context-tabs *and* the Inspector's internal group-tabs *and* a breadcrumb, all competing. The rule: **the header shows the context tier XOR the drill breadcrumb** (drilling replaces context — you are in a sub-scope); **facet grouping lives in the BODY** (accordion/tabs, M4 §2.11 hybrid); actions live in the FOOTER. One tab tier is ever visible. This is the single-context guarantee (`FF-RIGHTDOCK-CONTEXTUAL`) extended to the *header*.

---

## 3. The systematic overflow model — the Placement Law (the core deliverable)

### 3.1 The two axes

Every editable subject in the Studio has a **scope** (what it edits) and a **weight** (how much room + how transient). Overflow is what happens when a subject is placed in a container too small for its weight. The law removes that possibility.

**SCOPE (five, closed):** `micro-target` (one property of the selected element) · `element` (the selected node/chrome) · `nested-item` (an array/object item inside the element's props) · `page` · `site/data-model/workspace` (global).

**WEIGHT — *derived, never hand-assigned*** (generalize the deep-authorability §4 formula to any subject with a PropSchema):

```
weight(subject) = fieldCount(schema)
                + 2 · (schema has a nested array/object with an itemSchema)
                + 2 · (schema carries a rich type: DataSpec | ChartDef | VisibilityExpr | MetricCalc)

  glance     : weight ≈ 1          (a single property)
  form       : weight ≤ FORM_BUDGET (fits the bounded dock column — default 8)
  workspace  : weight > FORM_BUDGET  OR dominated by a rich type
```

### 3.2 The Placement Function (`place(scope, weight) → container`)

| scope ↓ · weight → | **glance** | **form** | **workspace** |
|---|---|---|---|
| **micro-target** | **POPOVER** (anchored) | *(n/a — a form-weight single field is a section, not a target)* | — |
| **element** | POPOVER | **RIGHT DOCK** (Inspector, facet-grouped) | **FOCUS-VIEW** (e.g. full chart encoding) |
| **nested-item** | POPOVER (recolor, rename) | **DOCK DRILL** (breadcrumb replaces content — D7.1b) | **FOCUS-VIEW** (item is itself a workspace) |
| **page** | POPOVER | **RIGHT DOCK** — Page context (config · perspectives) | **FOCUS-VIEW** (filters pipeline, perspective builder) |
| **site / data-model / workspace** | — | **LEFT DOCK surface** (Pages&Site) | **RELOCATED surface / FOCUS-VIEW** (Model, raw pipeline, global Style) |

### 3.3 The escalation invariant (why cramming is impossible)

**Every container has a weight budget. A subject whose weight exceeds its container's budget escalates to the next container by the function above — automatically, deterministically.** The escalation ladder for an *element/nested* subject:

```
POPOVER (glance)  →  DOCK PANEL / DRILL (form)  →  FOCUS-VIEW (workspace)
```

and for a *page/global* subject the page/global form escalates **outward** to a relocated surface. Because `place()` is a pure function of derived `weight`, **no editor is ever hand-placed into a container too small for it** — the crammed dock the owner reported becomes a state the code cannot produce. This is the load-bearing fitness: **`FF-NO-CRAMMED-DOCK`** — the dock's rendered content weight ≤ FORM_BUDGET; anything heavier must have escalated to a focus-view.

### 3.4 The Focus-View — the owner's "inner-page", made canonical (and it already exists)

**Owner clarification (2026-07-10, binding):** by "inner-page" the owner means a SEPARATE, INDEPENDENT Studio PAGE/ROUTE you navigate OUT to (via a click / logical action), then return from — NOT a canvas-area overlay. So the focus-view container is realized as a **distinct Studio route/screen** (its own URL/route in the panel router), the **Notion full-page / Sanity document-route** model — reached by navigation, leaving the editing view, with a **breadcrumb/back** to return. Keep a MINIMAL top chrome (the breadcrumb-back + context title) for orientation, but it IS a separate screen, not a canvas grid-area overlay. **Model mode is the un-generalized precedent** (`enterDataModel` takes over) — the generalized `<FocusView>` becomes a real routed screen.

A **focus-view** carries a **breadcrumb/back** (breadcrumb-click or back returns) and **continues the same drill breadcrumb** so field → item → workspace is one spine. The design **extracts `<FocusView>` as the reusable shell and re-homes Model mode onto it** (proving it, zero regression), then registers a **focus-view target registry** (OCP: a new workspace editor — chart encoding, metric calc, filters pipeline — registers a target; the shell is unchanged). Benchmark: VS Code editor tab · Notion full-page · Figma present-mode. Our-better: it **keeps the rail + dock** (never a disorienting full-screen) and **shares the breadcrumb** with the dock drill — one navigation model, not two.

---

## 4. Unification with the existing drill-in + deep-authorability taxonomy (one model, not two)

The owner's explicit requirement. The deep-authorability §4 taxonomy (INLINE / DRILL-IN / POPOVER / INNER-PAGE) is **exactly `place()` restricted to `scope = nested-item`** — it is not a separate system, it is the nested-item column of §3.2:

| Deep-authorability §4 tier | = Placement Law | Container |
|---|---|---|
| INLINE accordion (`weight ≤ 4`) | nested-item · form (light) | rendered **in-place** in the DOCK body (no drill) |
| DRILL-IN + breadcrumb (`weight > 4`) | nested-item · form | **DOCK DRILL** (D7.1b — breadcrumb replaces dock content) |
| POPOVER (transient micro-edit) | nested-item · glance | **POPOVER** |
| INNER-PAGE / focus-view (rich-type dominated) | nested-item · workspace | **FOCUS-VIEW** |

So D7.1b's "list → active item → breadcrumb, only the active shows" **is** the dock-drill cell; the `≤4 fields → inline` threshold **is** the glance/form boundary; the "inner-page" **is** the focus-view. **One weight primitive** (§3.1) now governs *both* the nested-editor taxonomy *and* the whole-shell placement — retiring the risk of two competing thresholds. The breadcrumb is the single spine tying dock-drill and focus-view together (`Section › filter-bar › account (select)` continues seamlessly whether the last frame is a dock-drill or a focus-view).

---

## 5. The relocate decisions (what leaves the cramped dock, by scope)

Systematic answer to the owner's "relocate some things" — each verdict is `place()` applied, not taste:

| Thing (where it is today) | Derived scope · weight | Verdict |
|---|---|---|
| **Page config** (Page context pane) | page · form | **STAY** in dock Page context — correctly placed. |
| **Perspectives list** (Page pane) | page · form | **STAY** in dock Page context; the *perspective editor* (dimension pins) → POPOVER/drill by its own weight. |
| **Filters pipeline** (`FiltersDrawer`, Page pane) | page · **workspace** (a bar × many cube-bound ParamDefs) | **ESCALATE → FOCUS-VIEW.** It is workspace-weight; stacking it in the dock is the reported cram. Reached from the Page context **and** from the selected filter-bar node (the D7.3 node→filterSchema bridge = the drill entry). |
| **Raw-data pipeline** (`SourceAuthoringPanel` etc., Model) | data-model · workspace | **RELOCATED → Model FOCUS-VIEW** (already the D8 plan; the law confirms it — never in the dock). |
| **Global tokens / theme** | site · workspace | **Style LEFT-DOCK surface** (global) — element-level style stays a **dock facet tab** (element scope). The scope-split names the existing division. |
| **Chart encoding / metric calc** (rich `ChartDef`/`MetricCalc`) | element/nested · workspace | **FOCUS-VIEW** — a narrow column cannot hold a full encoding; escalate. |

The dock is thereby reserved for **element + page, form-weight** — its correct, un-crammed remit.

---

## 6. Phased apps-only build plan (each reversible, fitness-guarded)

All steps are `apps/panel` only. **SL-0 first (the law as code), then the containers, then the wiring.** Wave 7 (tri-context dock) and D7.1b (drill-in) are prerequisites already built/in-flight.

| Step | Scope | Files/areas | Fitness guard |
|---|---|---|---|
| **SL-0 — Placement primitive** | Extract `weight(subject)` (generalize deep-auth §4) + pure `resolveSurface(scope, weight) → Container` strategy. **No UI change** — the law as testable code first. | new `studio/placement/weight.ts`, `studio/placement/resolveSurface.ts` | **FF-PLACEMENT-DERIVED** — surface is a pure fn of scope×weight; no hardcoded per-editor placement. |
| **SL-1 — Dock zone contract** | RightDock header = context XOR breadcrumb; facet tabs → body; 3-zone (header/body/footer). | `studio/RightDock.tsx`, dock CSS | **FF-DOCK-ONE-HEADER-TIER**, **FF-DOCK-ZONES** (extends FF-RIGHTDOCK-FILLS). |
| **SL-2 — Focus-View shell** | Extract reusable `<FocusView>` (canvas-region takeover + breadcrumb-back + Esc); re-home Model mode onto it; focus-view target **registry** (OCP). | new `studio/FocusView.tsx`, `studio/focusViewRegistry.ts`, `StudioShell.tsx` (canvas-area host), `useCanvasController` (Model→FocusView) | **FF-FOCUSVIEW-CANVAS-REGION** (rail+dock persist; Esc/back returns), **FF-MODEL-IS-FOCUSVIEW** (Model composes the shared shell — no fork). |
| **SL-3 — Popover primitive** | `<EditPopover>` anchored glance-edit surface; route glance-weight micro-edits (recolor, rename) to it via `place()`. | new `studio/EditPopover.tsx`, wire from the nested-editor + canvas overlay | **FF-POPOVER-GLANCE-ONLY** (popover hosts only glance-weight; heavier escalates). |
| **SL-4 — Overflow escalation + budget guard** | Dock, on a subject whose weight > budget, escalates to focus-view (drill spine already exists; add the workspace rung). Continue one breadcrumb across dock-drill↔focus-view. | `studio/RightDock.tsx`, drill-stack, `FocusView` | **FF-NO-CRAMMED-DOCK** (dock content weight ≤ FORM_BUDGET), **FF-OVERFLOW-DETERMINISTIC** (place() verdict == actual container). |
| **SL-5 — Relocate audit** | Move remaining mis-placed editors per §5 (filters pipeline → focus-view; confirm raw-pipeline D8; style scope-split). | `features/filters`, `features/perspectives`, Model surface, Style surface | **FF-PLACEMENT-AUDIT** — every registered editor's actual container == `resolveSurface` for its (scope, weight). |

**Recommended order:** SL-0 → SL-1 → SL-2 → SL-3 → SL-4 → SL-5. The law (SL-0) is the contract; the containers (SL-1/2/3) realize it; the wiring (SL-4/5) enforces it end-to-end.

---

## 7. Decisions / owner one-way-doors

- **D-SL-1 — Focus-view takes over the *canvas grid-area*, not the whole viewport** (UX call, reversible). Recommend canvas-area takeover: rail + dock persist for orientation and one-key escape, matching Model mode; less jarring than full-screen. Alternative (immersive full-screen) rejected — disorienting, breaks the shared breadcrumb spine.
- **D-SL-2 — `FORM_BUDGET` default = 8** (tunable, reversible). The glance/form/workspace thresholds (§3.1) are one tunable constant, not per-editor magic. Owner may retune; the *law* is unaffected.
- **D-SL-3 — The dock stays bounded (240–560px); depth pops OUT** (architectural, reversible). We do **not** let the dock widen to hold workspace editors (a widened column is still a column — Figma/Webflow confirm bounded panels). Workspace escalates to focus-view instead. Flag for visibility.
- **No new one-way door / no arrow crossing.** All of SL-0..SL-5 is `apps/panel` chrome. The *full-fidelity nested drill* still rides the **already-gated D7 `itemSchema`** engine seam (deep-authorability §9) — this spec introduces no new packages change. The focus-view/popover/placement primitives are pure apps.

---

## 8. Rejected alternatives (≥2, per ADR discipline)

1. **Just make the dock wider / add more tabs (the sizing fix).** *Rejected* — symptom patch (Law 6). A wider column still crams a workspace editor; more tab tiers compound the header collision. The root cause is a missing placement law, not a missing pixel.
2. **User-relocatable panels (VS Code movable docks).** *Rejected — YAGNI.* Our authors are not IDE power-users rearranging workbench zones; the Placement Law already puts each subject in the right container deterministically. Movable panels add config surface and break the "the tool leads; only what's needed" doctrine (M4 §1.5). The determinism *is* the ergonomics.
3. **A second interaction taxonomy for the shell, distinct from deep-authorability §4.** *Rejected* — this is exactly the "two competing models" the owner warned against. §4 is unified as the nested-item column of one Placement Law (§4 of this spec); one weight primitive governs both.
4. **Notion-style user-chosen peek/full-page escalation.** *Rejected* — a manual choice re-introduces "the user must decide where it fits." Ours escalates *automatically* by derived weight, so the user never manages placement; the tool leads.

---

## 9. Invariants honored + fitness map

- **Placement is derived, not hand-coded** — FF-PLACEMENT-DERIVED, FF-OVERFLOW-DETERMINISTIC, FF-PLACEMENT-AUDIT.
- **Cramming is unrepresentable** — FF-NO-CRAMMED-DOCK (dock ≤ FORM_BUDGET; workspace escalates), FF-DOCK-ONE-HEADER-TIER.
- **One coherent model** — the deep-authorability §4 taxonomy + D7.1b drill-in are projections of `place()` (§4); one weight primitive, one breadcrumb spine.
- **Contextual canon preserved** — left = ADD, right = EDIT, canvas = GO (M4.1 §1); focus-view + popover are the overflow valves, not new mental models.
- **No regression** — tri-context dock (Wave 7), collapse/resize, D7.1b drill, schema-group tabs, Model mode, page panes all **kept and re-homed** by the law; strict superset ("in no case worse than now").
- **Doctrine (M4 §1.5)** — every escalation *reveals* the right room and *never blocks*; no workflow gate is introduced (FF-NO-WORKFLOW-GATE stands).
- **Arrow / Config-is-data / role-is-lens / WCAG 2.1 AA** — apps-only chrome; focus-view + popover inherit the Inspector's grouped `<fieldset>`/labelled controls + keyboard model; breadcrumb + Esc are keyboard-first (Law 9).

**Pre-existing invariants untouched:** FF-RIGHTDOCK-CONTEXTUAL/FILLS/SINGLE-EMPTYSTATE, FF-CANVAS-ALWAYS-HOME, FF-ROLE-IS-LENS, FF-DRILL-ANY-DEPTH, FF-PALETTE-CONTEXTUAL, the dependency-arrow ESLint gate.

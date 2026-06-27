# VISION #1 — `mode` as a first-class VIEW / STATE axis (not a privileged concept)

> Status: VISION (draft for team iteration). Author: architect (Opus). Design-only — **zero code changed**.
> Scope: the architectural role of `mode` across config + engine (`packages/core`) + react (`packages/react`) + the page contract, and how it composes with the shipped data-binding doors.
> Verdict in one line: **AGREE WITH A REFRAME.** `mode` is sound as an *organising axis*, but it must be elevated as **one instance of a generic, declarative "view" axis** — a named selection of (state ⇒ data-scope + filters + layout) derived as a **pure function of state** — **not** as a privileged `timeMode` concept. The win the user wants (one mode ⇒ machinery vanishes; switching a mode brings its data+filters+layout as a unit; no duplication/dead-code) is *only* reached by the reframe; elevating `mode`-as-is would relocate the smell, not remove it.

---

## 0. Executive summary (read this first)

1. **Two parallel mode systems already coexist in the codebase** — this is the root smell, not "mode is tangled" in the abstract.
   - **(A) The privileged `timeMode` weave (legacy):** `ctx.timeMode` (a *named* field beside the generic `dims`, `core/context.ts:57-62`), `ContextMapping.timeMode` (`filter-params.ts:292-295`), the `by-mode` DataSpec branch keyed on `ctx.timeMode` (`data-spec.ts:181`, resolver `registry/resolvers.ts:141-163`), `rangeKey`/`timeToggle`/`timeModes` on the filter params (`filter-params.ts:113,248-250`), and the **bar-visibility default-resolution gate + `alwaysResolve` hoist** (`useFilterState.ts:88-112`).
   - **(B) The generic `ModeContext` / `modeRegistry` system (newer, Grafana-inspired):** open `ModeId` string, a `register()`-driven registry (`mode/registry.ts`), `RenderContext.mode` (`types/context.ts:65`), `mode-is`/`mode-in`/`mode-not` visibility ops (`visibility.ts:25-28`), `page.modeOrder`, `navMode`.
   - These are **two answers to the same question**, half-migrated. System (B) is *almost* the reframe this document argues for — but it is incomplete (it governs *visibility and nav*, not *data-scope and filters*), and (A) is still load-bearing for the data + filter path. The duplication between them is itself a Shotgun-Surgery generator: a new mode touches both.

2. **The recent dynamics bugs are symptoms of (A), made executable.** The bar-visibility gate, the `alwaysResolve` flag, the duplicated span params, the mode-clearing effects (`geostat.provisioning.json:1218-1239`) are all *workarounds for the fact that mode mutates shared filter state imperatively* instead of *selecting a view declaratively*. They are evidence, catalogued in §1.

3. **Field convergence is unambiguous (§2):** no leading platform makes a *time-specific* "mode" a primitive. They model a **generic, named, declarative perspective** (Power BI **bookmarks** = named captured state; Tableau **parameters + dashboard actions**; Superset **tabs + native-filter scoping**; Grafana **template variables + conditional/repeat**) and **derive the view from state** (Vega-Lite **`params`** drive everything; Elm/Redux **`view = f(state)`**). The convergent primitive is **"a named state, and the rendered artifact is a pure function of it."**

4. **The four orchestrator questions resolve decisively (§3):**
   - Q1 — `mode` is **ONE of N cross-cutting axes**, not special. Canonical = a generic **`view` axis** (a registry of named view-states); `time-mode` (year/range) is the first instance. **REFUTES the "privileged `mode`" framing; UPHOLDS Law 1.**
   - Q2 — Today shared content is **partly duplicated** (the `account` selector and `mode`/`measure` hidden params live in *both* bars; the two bars are near-identical shells). A view axis must be **composition-over-duplication** or it relocates the smell. The reframe makes shared filters/sections declared **once**, scoped per-view.
   - Q3 — `mode ↔ data-source` coupling is **a genuine locality win IF expressed as "a view selects its data-scope (query/time-binding)", and a coupling smell IF expressed as "a mode owns a store."** The store is orthogonal to mode (the data-binding ADRs already made store a routed manifest). The binding lives in the **view definition's *scope*, resolved by the existing selectors**, never in a `mode→store` hardcode.
   - Q4 — Elevating `mode`-as-is **relocates** the anti-patterns (into a fatter mode object + the same two systems). The reframe **eliminates** them: the `by-mode` branch, the bar-visibility gate, `alwaysResolve`, the duplicated span params, and the mode-clearing effects all **dissolve** into "view = f(state)" + per-view scope.

5. **Verdict: AGREE-WITH-REFRAME.** Adopt **`view`** (working name) as the generic axis: a **declarative `ViewDef`** = `{ id, label, when?, scope?, filters?, layout? }`, of which `time-mode`'s `year`/`range` are two instances. Render *any* artifact as `view = f(activeState)` via the **existing selector/resolver spine** (no new evaluator). Collapse systems (A)+(B) into (B)-extended. The **one-view property** is structural: a page with one `ViewDef` (or none) carries **zero** view machinery — no `by-mode`, no visibility gate, no toggle, no clearing effects — because `f(state)` with a single state is just `f`. This is graceful degradation by construction.

6. **The data-binding doors compose cleanly (§6):** a `ViewDef.scope` is *exactly* a place to attach a **semantic-layer metric ref**, a **store key** (multi-store), a **time-binding** (`timeDimension`), or a **blend** — the view becomes the natural authoring seam the Constructor needs, and the named doors (`D-HREF`, `D3-PLANNER`, the metric-level view) hang off `ViewDef.scope` without privileging any of them.

7. **This is a Strangler-Fig migration (§7):** `timeMode` stays as a *Postel-tolerated alias* during transition; existing configs render byte-identically; the engine grows the generic path beside the legacy one and the legacy one is retired view-by-view. Locked by fitness functions (§8): *single-view page has zero mode machinery*, *no per-view content duplication*, *view = pure function of state (no imperative mode mutation)*, *`view` axis is Law-1 generic (no privileged `timeMode` field in new code)*.

**The seams are deliberately left open for team critique (§9).** This is vision #1.

---

## 1. AUDIT — where `mode` is woven, and the concrete smells (file:line evidence)

### 1.1 The two parallel systems (the root finding)

| Aspect | System A — privileged `timeMode` (legacy, data+filter path) | System B — generic `Mode*` (newer, visibility+nav path) |
|---|---|---|
| State home | `ctx.timeMode` — a **named field** beside `dims` (`core/context.ts:57`) | `RenderContext.mode: ModeContext` (`react/.../context.ts:65`), read from the URL param via `useModeContext` (`ModeContext.tsx:32-47`) |
| Identity | `TimeMode = ModeId` alias (`context.ts:11-13`) — "Backward compat alias — widened from closed union" | open `ModeId = string` + `modeRegistry` (`mode/registry.ts`) |
| Data branch | `by-mode` DataSpec keyed on `ctx.timeMode` (`data-spec.ts:181`; resolver `resolvers.ts:141-163`; warm-key `spec.ts:96-97,126-129`) | — (System B does not reach the data path) |
| Filter coupling | `ContextMapping.timeMode` (`filter-params.ts:292-295`); `ParamYearSelect.rangeKey`/`rangeLabel` (`filter-params.ts:111-118`); `BarDef.timeToggle`/`timeModes` (`filter-params.ts:247-250`) | — |
| Visibility | legacy `{ op:'eq', param:'mode' }` (string param match) | `mode-is`/`mode-in`/`mode-not` ops using `ModeContext.current` (`visibility.ts:25-28,52-55`) |
| Nav | — | `navMode` filter (`SiteRenderer.tsx:146`), `modeOrder` sort (`navUtils.ts:125-130`) |
| Switch | imperative `applyEffects(timeModeKey, id, state, effects, setMany)` (`SiteRenderer.tsx:175`) — **mutates shared filter state** | `set` writes the URL param (`ModeContext.tsx:42-44`) |

**Finding:** the platform has *already started* the right migration (System B is the generic, registry-driven, Law-1-aligned shape) but stopped at visibility/nav. The **data-scope and the filter-bar** — the parts the user feels as "kneaded everywhere" — are still on System A's privileged `timeMode`. The reframe in §4 finishes B and retires A.

### 1.2 Catalogued smells (named, with evidence)

1. **Privileged concept violating Law 1.** `timeMode` is a *named field* on `SectionContext` (`context.ts:57`), distinct from the generic `dims: Record<string,DimVal>`. The header even apologises for it ("timeMode is UI meta-state … kept separate from dims for that reason"). A single privileged axis is exactly what Law 1 forbids; the moment a *second* axis appears (and `navMode` + `compare` mode already exist — `context.ts:75-77` "N37 compare mode") the privileged field can't generalise and you get a *second* parallel mechanism — which is precisely how System B was born. **Smell: privileged dimension → divergent change.**

2. **Shotgun Surgery / scattered aspect.** Adding or changing a mode touches: `data-spec.ts` (by-mode), `resolvers.ts` (branch), `spec.ts` (warm-key), `filter-params.ts` (rangeKey/timeToggle/ContextMapping), `useFilterState.ts` (visibility gate + alwaysResolve), `visibility.ts` (mode ops), `navUtils.ts` (modeOrder), the provisioning JSON (two bars + effects). One concept, ~9 edit sites. **Smell: Shotgun Surgery.**

3. **Mode-as-mutation (imperative, not declarative).** Switching mode runs `applyEffects` that **clears the other mode's keys** (`geostat.provisioning.json:1218-1239`: range clears `account`/`measure`; year clears `fromYear`/`toYear`). This is the antithesis of `view = f(state)` — the state is *mutated on transition* rather than *the view being a pure projection of state*. It is also why bugs cluster here: the cleared keys then get **re-filled by default resolution**, which forced the bar-visibility gate (#4). **Smell: temporal coupling + Law 2 violation (logic-as-effect, not declarative).**

4. **The bar-visibility default-resolution gate.** `useFilterState.ts:88-112` is a 25-line comment-justified workaround: defaults must *not* resolve for a param whose bar is hidden in the current mode, else the year re-pins in range mode and "the timeseries shows a single bar." This entire mechanism exists *only because* mode mutates shared filter state. Under `view = f(state)` an inactive view's filters are simply not in the active state — nothing to gate. **Smell: workaround-as-architecture.**

5. **`alwaysResolve` — a hoist flag to escape the gate.** `filter-params.ts:97-101` + `useFilterState.ts:99-112,230-232`: span-derived params (`spanFrom`/`spanTo`) are *page-level* state but the bar-gate would suppress them, so a flag hoists them out. This is a flag papering over a mis-placement: page-level state shouldn't live in a bar at all. **Smell: speculative-generality flag / mis-located state.**

6. **Duplicated span params + duplicated shared filters.** In the accounts page (`geostat.provisioning.json:1084-1206`): `mode` (hidden) is declared in **both** `range-bar` and `year-bar`; `measure` (hidden) in both; `account` exists as a **full select** in `year-bar` and would need re-declaration to persist across modes. `fromYear`/`toYear` live only in `range-bar`, `year` only in `year-bar`. The two bars are near-identical shells differentiated by `showWhen:{mode:range}` vs `showWhen:{mode:{neq:range}}` (`:1149-1151,1201-1205`). **Smell: duplication across mode containers (Q2's exact risk, already present).**

7. **`by-mode` as a data-level branch.** `by-mode` (`data-spec.ts:181`) makes *the data spec itself* mode-aware, so every chart/table that differs by mode carries a `{modes:{year:…, range:…}}` envelope (e.g. point-value vs CAGR KPIs). This duplicates the *shared* parts of the two specs and scatters the mode concept into the data vocabulary. **Smell: divergent change in the data union.**

8. **One mode is NOT simpler today (the user's key test, failing).** Even a page that only ever wants `year` still drags: a `mode` hidden param, `timeMode` in `ContextMapping`, `ctx.timeMode='year'` defaulting everywhere, the `by-mode` resolver registered, the visibility gate active. The machinery does **not** vanish at N=1. This is the clearest proof the current model is mis-factored: **the cost of mode is paid even when there is no mode.**

9. **Dead/ghost & alias debt.** `TimeMode` is explicitly a "backward compat alias" (`context.ts:11-13`); `STUB_CTX = { timeMode:'year', dims:{} }` (`useFilterState.ts:63`) hardcodes the privileged default; the legacy `{op:'eq',param:'mode'}` path coexists with `mode-is` ("Old `{op:'eq',param:'mode'}` still works" — `visibility.ts:25`). Two vocabularies for one concept = drift surface. **Smell: parallel vocabularies / lava-flow alias.**

**Audit conclusion:** the pain is real and the user's instinct ("mode is kneaded everywhere; one mode isn't simpler") is *correct and verifiable*. But the cause is not "mode isn't elevated enough" — it is "mode is **two half-built systems**, one of them a **privileged, imperative, mutation-based** weave." Elevating the *privileged* one is the wrong lever (§4).

---

## 2. RESEARCH — how the field models a "mode / view / perspective" axis

**Question put to the field: is a time-specific "mode" ever a first-class primitive? Answer: no. The primitive is a generic named state, with the view as a pure function of it.**

| Platform | Mechanism | First-class "mode"? | What to steal |
|---|---|---|---|
| **Vega-Lite** | `params` (variables, bound to inputs/selections) drive *everything*; `facet`/`concat`/`repeat` compose views; **no "mode" concept** | **No.** Params are the only state; marks/encodings are `f(params)` | **The canonical model: one generic param/state vocabulary; the spec is a pure function of it.** There is no privileged axis — exactly Law 1. Our `view` axis = a *named bundle* of param values + scope. |
| **Power BI** | **Bookmarks** = a named captured state (filters + visibility + selection); **field parameters** = swap which field a visual uses; report **pages** | **No "mode"** — bookmarks are *generic named states* | **Bookmarks are the reframe.** A "mode" = a named captured state. Switching = apply a bookmark (declarative state), not run effects. Field parameters ≈ our per-view `scope` (swap the measure/query). |
| **Tableau** | **Parameters** (typed variables) + **dashboard actions** (set parameter / filter on event); **stories** (ordered named snapshots) | **No.** Parameter-driven; view reacts to parameter | **Parameter + reactive view.** A param changes → calc fields/filters recompute. No mode object — the param *is* the axis. Stories ≈ ordered views. |
| **Superset** | **Tabs** (layout containers) + **native filters** with **filter scoping** (which charts a filter targets) + filter cross-tab persistence | **No.** Tabs are layout; filters are scoped state | **Filter scoping** is the answer to Q2: a filter is declared once and *scoped* to the views it applies to — composition, not duplication. |
| **Grafana** | **Template variables** (incl. `custom` = a fixed option list — *this is the closest to "mode"*), **conditional/repeat** by variable, **library panels** (shared, referenced once) | A custom variable *is* a generic mode, but it is **just a variable** — never privileged | **A "mode" is just a (custom) variable.** Repeat/condition by variable = views as `f(variable)`. Library panel = shared content referenced once (Q2). The code's own headers cite Grafana — but Grafana's variable is **generic**, which the privileged `timeMode` is not. |
| **Observable Framework / Plot** | Reactive cells; inputs (`view`/`Inputs`) are state; outputs are `f(inputs)`; no mode | **No** | Reinforces `view = f(state)` with no special axis. |
| **Elm / Redux (the CS core)** | `view : Model -> Html`; state is the single source, the view is a **pure projection**; transitions are pure `update : Msg -> Model -> Model` | n/a | **`view = f(state)`.** No view-local mutation; transitions produce a new state, the view re-derives. This is the antidote to the mode-clearing effects (#3). |
| **IR / DB / OLAP** | A **named query/perspective** over a cube; **faceting / trellis / small-multiples** = the *same* spec rendered across a dimension's values; a **materialized view** = a named, scoped projection | n/a | **Faceting** is the deep form of the user's "switching a mode brings its data+filters+layout": a *facet/trellis* is literally "render this view per value of an axis." A `ViewDef` is a **named facet of state** (one value, or a small set). |
| **State machines / statecharts (Harel)** | A mode = a **state**; transitions are explicit; *but* well-designed statecharts keep the state **orthogonal** (parallel regions) so independent axes don't multiply | n/a | **Orthogonal regions** = Law 1 for modes: `time-mode`, `compare`, `nav-mode` are *parallel* axes, not one privileged `mode`. Confirms: do **not** fold all axes into one `timeMode`. |

**Convergent pattern (what every reference agrees on):**

> **There is no privileged "mode." There is (a) a generic vocabulary of named state/params, and (b) the rendered artifact is a pure, declarative function of that state. A "mode" is just a named bundle of state values; switching it is *applying a state*, not *running effects*; shared content is *declared once and scoped*, not duplicated; and rendering-per-value is *faceting*.**

The codebase's own System B (`modeRegistry`, open `ModeId`, `mode-is`) is *already a partial implementation of this convergent pattern* — which is strong corroboration that the reframe is the codebase's own latent direction, not an external imposition.

---

## 3. The four orchestrator questions — resolved with evidence

### Q1 — Is `mode` special, or one of N cross-cutting axes? → **ONE of N. Generic `view` axis.**

**Evidence it is not special:** (a) Law 1 forbids a privileged dimension and the code already pays for the violation (the `timeMode`-beside-`dims` apology, the two parallel systems). (b) A *second* axis already exists in two forms — `compare` mode (`context.ts:75-77`) and `navMode` (`SiteRenderer.tsx:146`) — proving "mode" is plural. (c) Every surveyed platform models it generically (§2). (d) Statecharts' **orthogonal regions** say the right shape for several independent toggles is *parallel generic axes*, never one privileged super-axis.

**Resolution:** Canonical = a generic **`view` axis** — a registry of named view-states (`modeRegistry` generalised). `time-mode` (`year`/`range`) is the *first instance*; `compare`, future `scenario`/`forecast`, even `navMode` are *peers*. This **refutes the user's "privileged `mode` origin point" literally** while **honouring its intent**: the *axis* is the origin-point organising concept, but it is generic, so Law 1 holds and N axes coexist without a second mechanism. *(Naming: `view` vs `perspective` vs `scenario` is an open question — §9.)*

### Q2 — Shared content: composition or duplication? → **Must be composition; today it is partly duplication; the reframe fixes it.**

**Evidence of present duplication:** `mode`/`measure` hidden params in both bars; `account` in both; two near-identical bar shells (§1.2 #6). If `view` became a *container* that re-declares its content, this duplication would *deepen* — the exact relocation risk the orchestrator flagged.

**Resolution (the design constraint):** a `ViewDef` must be a **filter/scope projection over shared, once-declared content**, not a content container. Borrow **Superset filter scoping** + **Grafana library panels** + **Vega-Lite faceting**: filters and sections are declared **once** at page level; each `ViewDef` declares *which* of them are active and *how* they are scoped (e.g. `year` view ⇒ `time` is a single-select; `range` view ⇒ `time` is a from/to clamp — **the same `time` dimension**, different *binding*, not a different param). This makes Q2's answer **composition by construction**; §8 locks it with a "no per-view content duplication" fitness function.

### Q3 — `mode ↔ data-source` coupling: locality win or coupling smell? → **Both, depending on framing. Bind the *scope*, not the *store*.**

**Evidence:** the data-binding ADRs already made the **store a routed manifest** (`buildStoreManifest`, `resolveStore`, node `storeKey`) — store is *orthogonal to mode*. So "a mode owns a store" would be a **coupling smell** (it would re-privilege mode over the store axis). But "switching to the *range* view changes the **data-scope** (unbounded time read + post-clamp) vs the *year* view (single-year pin)" is a **real, already-present locality fact** — it's exactly the `rangeMode` branch in warm-key/extractRequirements (`spec.ts:174-182`) and the `by-mode` point-vs-CAGR split.

**Resolution:** the binding lives in **`ViewDef.scope`** — a *declarative data-scope*, resolved by the **existing selectors/resolvers**, never a `mode→store` literal. `scope` carries the things that already differ by mode: the **time-binding** (`timeDimension` single-year vs `[from,to]` clamp — already a first-class shape, `data-spec.ts:115-119`), optionally a **metric ref** or **store key** (so a view *may* point at a different store via the existing manifest, but through the generic key, not a privileged coupling). The "active mode loads its data source" becomes "the active view's *scope* is what the selectors resolve" — a lazy/locality win that is *just the normal data path scoped by the active state*, with **no new coupling**. The lazy-load is real (you only resolve the active view's requirements — `extractRequirements` already prunes), but it is a property of *state-driven resolution*, not of mode owning a store.

### Q4 — Eliminate vs relocate? → **Elevating `mode`-as-is RELOCATES; the reframe ELIMINATES.**

- **Elevating the privileged `timeMode` (the literal proposal):** you get a fatter `mode` object and you *keep* both systems, the `by-mode` branch, the visibility gate (now "mode container visibility"), the clearing effects (now "mode enter/exit"), and the duplication (now "per-mode-container content"). The smells **move into the container**. *Relocation.*
- **The reframe (`view = f(state)` + generic `view` axis + per-view scope):**
  - `by-mode` branch → **dissolves**: a node's spec is resolved against the active view's `scope`; no `{modes:{…}}` envelope (the spec differences become *scope* differences the selectors already apply). *(Edge: genuinely *different* node shapes per view — e.g. a KPI that is point-value in year and CAGR in range — become two nodes each gated by `when: view-is(...)`, i.e. **visibility**, composing with System B, not a data-union branch. §9 open Q.)*
  - bar-visibility gate (`useFilterState.ts:88-112`) → **deleted**: an inactive view's filters aren't in the active state; nothing to suppress.
  - `alwaysResolve` → **deleted**: page-level state (span) is declared at page level, not in a bar.
  - mode-clearing effects → **deleted**: switching applies a state (the view's scope); no key-clearing, because shared keys aren't cross-pinned (the `time` dimension is *the same* dimension, bound differently per view).
  - duplicated span/shared params → **deleted**: declared once, scoped per view.
  - **one-view simplicity** → **achieved**: `f(state)` with one state is `f`; a single-view page declares no `view` axis and carries none of the machinery (§4.4).

  *Elimination*, with the smells removed at root, not moved.

**Q4 is the decisive question and it favours the reframe unambiguously.**

---

## 4. DESIGN — the canonical architecture (if sound; it is, with the reframe)

### 4.1 The first-class abstraction: `ViewDef` (the generic axis)

```
// declarative, JSON-serializable, Constructor-authorable. No functions.
interface ViewDef {
  id:       string                 // 'year' | 'range' | 'compare' | … (open, registry-resolved)
  label:    LocaleString
  // WHEN this view is active — derived from state, not a stored toggle.
  // Default: active when the view-axis param === id (the Power BI bookmark model).
  when?:    VisibilityExpr         // reuses the EXISTING evaluator (visibility.ts)
  // SCOPE — the data-scope this view selects (Q3). Declarative; resolved by existing selectors.
  scope?: {
    timeBinding?: TimeDimensionSpec    // year-pin vs [from,to] clamp — already first-class
    store?:       string               // OPTIONAL store key (multi-store manifest) — generic, not privileged
    metric?:      string               // OPTIONAL semantic-layer metric ref (R1 door)
    dims?:        Record<string,DimVal>// view-scoped dim pins (e.g. a default region)
  }
  // FILTERS active in this view — references to page-level filters (declared ONCE) + per-view binding.
  filters?: Array<{ ref: string; bind?: 'single' | 'range' | 'multi' }>
  // LAYOUT differences are visibility, not duplication: nodes carry when: view-is(id).
}

interface ViewAxis {            // page-level
  param:   string               // URL param holding the active view id (was ContextMapping.timeMode)
  views:   ViewDef[]            // ordered (replaces modeOrder)
  default?: string
}
```

`ViewAxis` **generalises** `modeOrder` + `ContextMapping.timeMode` + the bar `timeToggle`/`timeModes` into one declared axis. `time-mode` is `{ param:'view', views:[{id:'year', scope:{timeBinding: singleYear}}, {id:'range', scope:{timeBinding:[from,to]}}] }`.

### 4.2 `view = f(state)` — rendering as a pure projection (no new evaluator)

The active view id is **read from URL state** (already true — `ModeContext.tsx:32-47`). Every downstream artifact is derived:

- **Which filters/bars show** = `f(active view)` via the existing visibility evaluator (`visibility.ts`), `when` defaults to `view-is(id)`. (System B's `mode-is` generalised to `view-is`.)
- **What data a node resolves** = `interpretSpec(spec, ctxScopedByActiveView, store)` — the *only* change is that `ctx` is **scoped by the active view's `scope`** before resolution (the time-binding, optional store/metric). The selectors/resolvers are **unchanged**; they already consume a `ctx`. The `by-mode` branch is *replaced by scoping the ctx*, not by a new branch.
- **Switching a view** = `setViewParam(id)` — writes the URL param. **No effects, no key-clearing.** Because shared filters reference the *same* dimension across views (bound differently), there is no cross-pin to clear. This deletes `applyEffects(timeModeKey, …)` (`SiteRenderer.tsx:175`) for the mode case.

This is the Elm/Redux/Vega-Lite model, implemented on the spine the codebase already has (URL-param state + selectors + visibility evaluator). **No new interpreter, no new vocabulary beyond `ViewDef`/`ViewAxis`.**

### 4.3 Composition-not-duplication (Q2 locked)

Page declares filters and sections **once**. `ViewDef.filters[].ref` points at them; `bind` says how the active view binds a *shared* dimension (year-pin vs clamp). The two bars collapse into **one filter set, projected per view**. Shared content (`account`, the section shells) is declared once; per-view *differences* are `when: view-is(id)` visibility, the Superset-scoping / Grafana-library-panel model. **No second bar, no duplicated `mode`/`measure`/`account`.**

### 4.4 The one-view property (graceful degradation by construction)

The user's headline requirement, made structural:

- A page with **no `ViewAxis`** (or a single-view one): there is no view param, `ctx` is scoped by nothing (identity), every node resolves with its plain spec, the visibility evaluator sees no `view-is` gates. **Zero machinery instantiated** — no registry lookup, no toggle node, no clearing effects, no bar gate. `f(state)` with a constant state is just `f`.
- This is enforced, not hoped: **FF-ONE-VIEW-NO-MACHINERY** (§8) asserts a single-view page's resolved render touches none of the view code paths.

Contrast today: a one-mode page still drags `timeMode='year'`, a `mode` hidden param, the `by-mode` registration, the gate (§1.2 #8). The reframe is the *only* design where N=1 is genuinely free.

### 4.5 Collapsing A + B (the de-duplication of the two systems)

- `ctx.timeMode` (privileged) → **retired**; the active view id lives in `ctx.dims` as a generic axis value *or* in a dedicated `ctx.view` that is itself a generic `Record`-style slot (open Q §9: is the view-id a `dim` or a sibling generic slot? — leaning *generic slot* to keep it out of the data-dim space, but **registry-driven, not a named `timeMode`**).
- `by-mode` DataSpec → **retired** in favour of ctx-scoping + `when`-gated nodes (with a Postel desugar so existing `by-mode` configs keep resolving — §7).
- `mode-is`/`mode-in`/`mode-not` → **generalised** to `view-is`/`view-in`/`view-not` (or kept as aliases — they already read `ModeContext.current`, which becomes "active view id").
- `modeRegistry` → **becomes `viewRegistry`** (same open-string registry; the right shape already).
- `rangeKey`/`timeToggle`/`timeModes`/`ContextMapping.timeMode` → **subsumed** by `ViewAxis` + `ViewDef.scope.timeBinding`.

Result: **one** system, generic, declarative, Law-1-clean.

---

## 5. How this makes the JSON config cleaner (before/after on the real page)

**Today** (`geostat.provisioning.json:1084-1239`, paraphrased): two bars (`year-bar`, `range-bar`) each re-declaring `mode`/`measure`; `account` in both; `showWhen:{mode:…}` on each; `fromYear`/`toYear` vs `year` split; a `ContextMapping.timeMode`; **two clearing `effects`**; per-node `by-mode` / `mode:'year'|'range'` envelopes throughout (`:36,136,172,…`).

**Reframed** (target shape):
```
"viewAxis": {
  "param": "view", "default": "year",
  "views": [
    { "id":"year",  "label": {…}, "scope": { "timeBinding": { "dim":"time", "range":"all"      } } },
    { "id":"range", "label": {…}, "scope": { "timeBinding": { "dim":"time", "range":[{"$ctx":"fromYear"},{"$ctx":"toYear"}] } } }
  ]
},
"filters": { /* ONE set: account (select), time (year-or-range, bound per active view), measure (hidden) */ },
/* nodes carry data specs with NO by-mode; per-view-only nodes carry "when": {"op":"view-is","view":"range"} */
```
- `mode`/`measure` declared **once**; `account` **once**; no second bar; **no `effects`**; no `ContextMapping.timeMode`; `by-mode` envelopes gone (scope-driven). The config shrinks and stops encoding mode as cross-cutting noise — it becomes **one declared axis + clean nodes**.

---

## 6. Composition with the data-binding "named doors" (§ parallel mandate)

`ViewDef.scope` is the natural attach-point — each door hangs off it *generically*, none privileged:

- **Semantic layer (R1, shipped):** `scope.metric` = a `MetricDef` ref. Switching view can switch the *metric* (point measure ↔ CAGR-derived metric) — this is the canonical home for the year/range KPI difference, replacing `by-mode` KPI envelopes with a metric ref per view. **The semantic layer becomes how views differ in *what they measure*.**
- **Multi-store (shipped manifest):** `scope.store` = a store key. A view *may* read a different cube (e.g. a `forecast` view → a projections store) via the existing `resolveStore`/manifest — generic key, Q3-clean (no `mode→store` hardcode).
- **Static-by-reference (`static` kind, shipped):** a view can scope to a static snapshot store (e.g. a `published` view pinned to an extract) — composes as just another store kind.
- **Data blend (`blend` step, shipped B0–B2):** a `compare`/`benchmark` view can carry a `blend` in its scope's pipe (primary + secondary on a shared dim) — the view is the *authoring seam* for "show this alongside that."
- **Time-binding (`timeDimension`, first-class):** already the year-pin vs clamp difference — `scope.timeBinding` is its home, deleting `fromDim`/`toDim` duplication and the `rangeMode` detection scatter.
- **Constructor authoring seam:** a `ViewDef` is a **declarative, schema-introspectable** object → the Constructor gets a "Views" panel (add a view, pick its scope's metric/store/time-binding, choose which filters/sections it shows). This is the **capability-discovery** win — views become a browsable, authorable capability instead of hand-woven JSON.
- **Doors stay deferred, now with a home:** `D3-PLANNER` (symmetric blend), the **metric-level blended view** (Malloy/Cube), `D-HREF` envelope — all attach to `scope` when their trigger fires, without re-privileging mode.

**Net:** the view axis is the *organising frame* the data-binding doors were missing — it gives "switch the perspective ⇒ its data+filters+layout come together" a single declarative home, built on already-shipped binding primitives.

---

## 7. Strangler-Fig migration path (non-breaking; existing configs keep rendering)

Architecture leads, code follows (Law 7); `timeMode` is tolerated (Postel) until retired.

- **P0 — Name + ADR.** Ratify `view`/`ViewDef`/`ViewAxis` naming (resolve §9 Q1). Promote `modeRegistry`→`viewRegistry` as an alias (no behaviour change). *Two-way door.*
- **P1 — `ViewAxis` parser + `ctx`-scoping (additive).** Engine reads `page.viewAxis` *or* falls back to deriving one from legacy `modeOrder`+`ContextMapping.timeMode` (a desugar). Add the **scope-the-ctx-by-active-view** step before `interpretSpec`. Legacy `by-mode` still resolves (untouched). Byte-identical when no `viewAxis` is declared. Land **FF-ONE-VIEW-NO-MACHINERY** + **FF-VIEW-IS-PURE-FUNCTION**.
- **P2 — `view-is`/`view-in`/`view-not` = `mode-is` aliases.** Generalise the visibility ops (System B already 90% there). `mode-*` kept as aliases.
- **P3 — `by-mode` desugar.** A core desugar lowers `{type:'by-mode', modes}` → scope-selected resolution (the active branch resolved against the scoped ctx), so existing configs render unchanged while the union member is deprecated. Land **FF-BYMODE-DESUGAR-EQUIV** (row-identical to today).
- **P4 — Migrate the geostat page (the first real config).** Rewrite accounts/GDP pages to `viewAxis` + one filter set + `when`-gated nodes. Delete that page's `effects`, second bar, duplicated params. Prove byte-identical render via the existing round-trip fitness tests.
- **P5 — Retire System A.** Once all configs are migrated: remove the bar-visibility gate + `alwaysResolve` (`useFilterState.ts:88-112,230-232`), `ContextMapping.timeMode`, `rangeKey`/`timeToggle` privileged paths, the `by-mode` resolver (kept only as a desugar shim or removed), and the `ctx.timeMode` field. Each removal guarded by a green fitness suite.
- **P-final — Constructor "Views" panel.** Author views visually over the `ViewDef` schema.

Every step additive/aliased; no stored config breaks at any point (expand-contract).

---

## 8. Fitness functions (lock the invariants)

- **FF-ONE-VIEW-NO-MACHINERY** — a page with zero or one `ViewDef` resolves with **no** view code path touched: no `viewRegistry` lookup, no ctx-scoping mutation, no `view-is` gate evaluated, no toggle node emitted. *(The user's headline property, executable.)*
- **FF-VIEW-IS-PURE-FUNCTION** — switching the view param produces a render that is a pure function of `(config, state)`: no key is mutated/cleared on transition; the same `(config, state)` always yields the same render. *(Deletes the mode-clearing-effects class of bug.)*
- **FF-NO-PER-VIEW-DUPLICATION** — no filter/section is declared more than once across views; shared content is referenced, not copied. *(Q2 lock; would fail on today's two-bar config.)*
- **FF-VIEW-AXIS-GENERIC (Law 1)** — no new code introduces a privileged `timeMode`/named view field on `SectionContext`; the active view is registry-resolved + generic. The `timeMode` field is deprecated and absent from new specs.
- **FF-BYMODE-DESUGAR-EQUIV** — every existing `by-mode` spec lowers to scoped resolution that is **row-identical** to today (Postel/Strangler safety).
- **FF-VIEW-SCOPE-DECLARATIVE (Law 2)** — `ViewDef.scope`/`filters`/`when` are pure JSON (no functions/`fetch`/`if`); the view is resolved by the renderer/selectors, never by config logic.
- **FF-VIEW-ROUNDTRIP** — a `ViewAxis` survives `JSON.parse(JSON.stringify())` and the Constructor round-trip unchanged.

---

## 9. OPEN QUESTIONS for team iteration (the seams left for critique)

1. **Naming.** `view` vs `perspective` vs `scenario` vs keep `mode` (generalised)? `view` collides with "viewport/render-view"; `perspective` is OLAP-accurate; `scenario` implies forecasting. The *concept* is settled (generic named state + `f(state)`); the *word* is open. **Recommend `view` provisionally; flag for the team.**
2. **Where does the active view id live in `ctx`?** A generic `dims['<axis>']` entry (maximally Law-1, but pollutes the data-dim space and could be mistaken for a query dim) vs a dedicated generic `ctx.viewState: Record<string,string>` slot (cleaner separation, but a second map). Statecharts' orthogonal-regions favour a **separate generic slot** holding *N* parallel axes (`time-mode`, `compare`, `nav`). **Lean: separate generic `viewState` map; not `timeMode`, not in `dims`.**
3. **Per-view *node shape* differences (the hard `by-mode` residue).** When a view needs a genuinely *different node* (point KPI vs CAGR KPI), is it (a) two nodes each `when: view-is`, (b) a `scope.metric` swap on one node, or (c) a retained thin `by-mode` for the rare irreducible case? **Lean: (b) metric-swap as the primary mechanism (semantic layer is the home for "what we measure"), (a) for structural differences, (c) only as a deprecated escape.** Needs validation against every current `by-mode` use.
4. **Multiple simultaneous axes.** If `time-mode` AND `compare` are both active (orthogonal regions), how do their scopes compose (scope merge order, conflict resolution)? Faceting (render the cross-product) vs sequential scope application. **Deferred door, but the model must not preclude it.**
5. **Faceting / small-multiples.** Is "render this view across *all* values of an axis" (trellis) in scope now, or a later door? It is the deep generalisation of the user's "switch brings its unit" (switch = pick one facet; trellis = show all). **Recommend: design the `ViewDef` so faceting is a later additive door, not built now (YAGNI).**
6. **Is `navMode` a `ViewDef` too, or a distinct concern?** It currently filters nav sections (`SiteRenderer.tsx:146`). Folding it in unifies; keeping it separate respects that nav is a different region. **Open.**
7. **URL/permalink semantics.** With several view axes as URL params, what is the canonical permalink + default-elision rule (Law 9: URL = permalink)? **Needs a small spec.**
8. **Migration blast radius.** P4 rewrites the flagship geostat configs; confirm the round-trip fitness coverage is strong enough to prove byte-identity before deleting System A (P5).

---

## 10. Decision

**AGREE WITH REFRAME.** Elevate the *axis*, not the privileged `mode`. Adopt a generic, declarative **`view` axis** (`ViewAxis` + `ViewDef`) of which `time-mode` is the first instance; render every artifact as **`view = f(active state)`** on the existing selector/visibility spine; make **scope** (not store-ownership) the data coupling and the home for the shipped data-binding doors; collapse the two parallel mode systems into one; and guarantee the **one-view-is-free** property structurally. Migrate via Strangler-Fig with `timeMode`/`by-mode` Postel-tolerated and fitness-locked, retiring the privileged weave only when the suite is green. This **eliminates** (not relocates) the bar-visibility gate, `alwaysResolve`, the mode-clearing effects, the duplicated span/shared params, and the privileged-dimension violation — and gives the data-binding doors the organising frame they lacked.

*Vision #1 — strong, evidence-grounded, seams open for the team (§9).*

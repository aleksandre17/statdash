# Experience Concepts — §1 THE INTERACTION LAYER (the named gap)

> Cards EXP-01..05. Index + grounding + ranking: `experience-concepts.md`. Analysis only.
> All ride **one shipped seam stack**: `NodeBase.on[]` → `NodeAction` union (today = `filter` only,
> the OCP extension point) → EventBus `PlatformEventMap` → `perspectiveState` writer + `ctx.set` →
> permalink-from-registry. Adoption = **assembly, not invention**; the fitness is the same
> shrinking-list coverage pattern we already trust.

---

### [EXP-CONCEPT-01] Dashboard Actions — full declarative action union (Tableau · Grafana · Retool · Builder.io)
- **What it is** — Tableau's signature: a dashboard *action* maps a trigger (select/hover/menu) to a typed
  effect — **Filter, Highlight, Go-to-URL, Change-Parameter, Set-value, Go-to-sheet**. Grafana data links +
  Retool `component.events[].action` are the same declarative event→action wiring. We shipped the *shape*
  (N36 `node.on[]`/`NodeAction`) but only the `filter` action, and it is un-authorable.
- **Does it strengthen US? — STRENGTHEN-MOST (crown).** The largest single capability gap vs every BI
  leader, and the *cheapest* to close — the substrate is already in the tree. An interactive
  national-accounts dashboard without "click a region → filter / highlight / drill / set scenario" is a
  static report; this is the line between "renderer" and "dashboard."
- **Fit** — rides the empty `NodeAction` union (OCP: new action = new discriminant, `node.on[]` unchanged),
  the EventBus, the perspectiveState writer, the permalink registry (action result is shareable). **Net-new
  only at the authoring + coverage-gate layer** — the engine seam exists.
- **FULL-adoption plan, every layer:**
  - **contracts/core** — extend `NodeAction`: `HighlightAction` (EXP-02), `SetPerspectiveAction` (write
    `perspectiveState[param]=id`), `SetParamAction` (what-if/field param, EXP-04/05), `UrlAction` (lift from
    `DataLinkDef`), `DrillAction` (EXP-03). Add `listNodeActions()` SSOT enumerator beside `listTransformOps()`.
  - **react** — one `dispatchNodeAction(action, row, ctx)` reducer fanning out: filter→`ctx.set`,
    perspective→perspectiveState set, url→navigate, highlight→EventBus emit. Add triggers
    `legend:click`/`point:click` (already in `PlatformEventMap`).
  - **charts/plugins** — chart/table/map/kpi shells already emit `row:click`/`legend:toggle`; wire them to
    `dispatchNodeAction` per matched `node.on[]` handler (today only ChartShell/TableShell do filter).
  - **panel** — a new **Interactions** Inspector tab: per-node `on[]` editor (trigger select + action list,
    each action a registry-driven PropSchema via the *existing* generic Inspector — same as transform-step
    authoring). Action fields bind pick-don't-type to cube fields / authored params / perspectives (Law 2).
  - **api/provisioning** — none (pure config; `node.on[]` already serializes).
  - **Fitness that PROVES adoption** — a **6th coverage axis**: enumerate `listNodeActions()`, assert each
    has a runtime dispatch case + an authoring schema or sits in `COVERAGE_TODO`. Plus
    `nodeActionPermalink.fitness` (every state-writing action lands in the URL = shareable).
- **Effort M/L · two-way (additive union, config-only) · Class G · P1-crown.**
- **Raises-the-bar** — Tableau actions are imperative config; ours = a **declarative, coverage-gated,
  permalink-addressable action algebra** where the builder *cannot* drift from the runtime. The interaction
  layer becomes as governed as the data layer.

---

### [EXP-CONCEPT-02] Cross-highlight — dim, don't filter (Tableau · Power BI)
- **What it is** — selecting a mark *highlights* matching marks across panels (dims the rest) without
  removing data — the lighter cousin of cross-filter. We emit `row:hover` on the bus but no panel consumes
  it to highlight; no `HighlightAction` exists.
- **Does it strengthen US? — STRENGTHEN.** Cross-filter is destructive (changes every panel's data);
  highlight is the exploratory default users reach for first. Highlight-on-hover across chart + table + map
  for region/sector cohorts is high-value, low-risk.
- **Fit** — rides EventBus `row:hover`/`row:leave` (already emitted) + a new `HighlightAction` in the EXP-01
  union + the variant/token spine for the dim state (`[data-dimmed]`, runtime-zero, reuses the variant
  resolver). No new substrate.
- **FULL-adoption plan** — core: `HighlightAction { type:'highlight'; key }`. react: a `HighlightContext`
  keyed by row-id subscribing to the bus. charts/plugins: each shell maps the highlighted key set to
  ApexCharts native highlight or a `--dimmed` token opacity. panel: a one-line Interactions toggle.
  **Fitness:** a jsdom shell test — hover on chart mark A dims non-A in the sibling table (clones
  `crossFilter.shell.test`). **a11y:** highlight must not be color-only (WCAG) — pair dim with
  `aria-current`/text; reduced-motion suppresses transition.
- **Effort S/M · two-way · Class M · P2** (after EXP-01 lands the union).
- **Raises-the-bar** — highlight derived from the *same neutral row identity* the a11y twin uses → one
  selection model drives pixels, accessible text, and highlight together.

---

### [EXP-CONCEPT-03] Drill — hierarchical in-place drill + drill-through pages (Power BI · Tableau)
- **What it is** — **Drill-down**: expand a mark to its children along a hierarchy (region→subregion,
  sector→subsector) *in place*. **Drill-through**: jump to a detail page carrying the clicked context as
  filters. We have navigate-with-params (`DataLinkDef.target:'page'` builds an href with row params) — basic
  drill-through plumbing — but no in-place drill and no first-class "detail page that receives drill context."
- **Does it strengthen US? — STRENGTHEN** (drill-through: marginal→complete; drill-down: net-new).
  National-accounts data IS hierarchical (SDMX codelists are `LTREE`, DB-03) — drill-down along a classifier
  hierarchy is natural and currently absent. Drill-through formalizes what `DataLinkDef` half-does.
- **Fit** — drill-down rides the classifier LTREE hierarchy the engine already resolves
  (`core/src/data/codelist.ts`) + perspectiveState (the drill path is *state*: `drillPath=[R1,R1.2]` is
  another orthogonal axis → reuses the Lattice, permalink-addressable, zero new substrate). Drill-through
  rides existing `DataLinkDef` navigate + the params builder; lift to a `DrillAction` in EXP-01.
- **FULL-adoption plan** — core: represent drill level as a perspectiveState axis
  (`registerPerspectiveScopeKey('drill')`) so "drilled to subregion" is a permalink; `DrillAction` resolves
  the next LTREE level. react/charts: a drill affordance (breadcrumb + clickable mark) reading the classifier
  hierarchy. panel: Interactions tab picks the drill hierarchy from cube dimensions (pick-don't-type). api:
  none (LTREE already served). **Fitness:** "a drill action's hierarchy resolves to a registered classifier
  with ≥2 LTREE levels"; permalink round-trip of `drillPath`.
- **Effort M/L · two-way (drill-through) / one-way-ish (drill-as-axis touches Lattice) · Class M · P2.**
- **Raises-the-bar** — drill-as-a-perspective-axis composes orthogonally with vintage / scenario /
  perspective in the **Perspective Lattice** — no BI tool makes drill a first-class composable axis (Power BI
  drill is panel-local, non-shareable).

---

### [EXP-CONCEPT-04] Field parameters — reader-swappable measure/dimension (Power BI)
- **What it is** — Power BI **field parameters**: a control whose *values are fields* (measures/dimensions);
  the reader picks "GDP vs Employment" or "by Region vs by Sector" and the **same viz** re-plots. Distinct
  from a data filter (subsets rows) — this swaps *what is encoded*.
- **Does it strengthen US? — STRENGTHEN.** One authored panel serves N measures/breakdowns → big
  duplication-removal for a stats portal + a citizen-grade reader affordance. We have field-wells (author-time
  binding) but no *reader-time* field swap.
- **Fit** — rides perspectiveState (a field-param is an axis whose option values are field ids) + the
  field-wells `binding.ts` (already turns a field id into a DataSpec encoding) + the ParamDef registry. The
  renderer re-binds the spec's measure/encoding from the active field-param value at interpret time.
- **FULL-adoption plan** — core: a `field-param` ParamDef (values = cube field ids) + a resolver injecting
  the chosen field into the bound DataSpec's encoding (reuse `buildSuggestedSpec`/`binding`). react: a
  field-param control shell (segmented control/select). panel: author in the Filters drawer — the ParamDef
  registry auto-surfaces it (coverage gate's `paramDefs` allowlist is empty → gated by construction). api:
  none. **Fitness:** coverage gate already enumerates `PARAMDEF_TYPES` → `field-param` is auto-gated; plus a
  binding fitness "field-param value ∈ cube fields and re-binds to a valid encoding."
- **Effort M · two-way · Class G · P2.**
- **Raises-the-bar** — as a perspectiveState axis it composes with perspective + vintage in the Lattice and
  is permalink-shareable (Power BI field params are not orthogonally composable, not URL-addressable).

---

### [EXP-CONCEPT-05] What-if / scenario parameters feeding derive (Power BI what-if · Tableau parameters)
- **What it is** — a **numeric/scenario parameter** (slider/input: assumed growth rate, deflator, FX rate)
  that feeds a *calculation*, not a data subset. Power BI's what-if generates a parameter table + measure;
  Tableau parameters feed calculated fields.
- **Does it strengthen US? — STRENGTHEN** (net-new; high domain fit). National accounts is a *modeling*
  domain — "what if growth is 3%?" projections, constant-price rebasing. We have filter params (subset data)
  and the **sandboxed `packages/expr` + derive ops**, but no scenario parameter flowing a scalar into a
  derive expression.
- **Fit** — rides `packages/expr` (whitelisted, eval-free) + the derive transform op + perspectiveState
  (scenario = an axis → shareable "3%-growth view"). The `$ref` taxonomy (`core/src/ref/ref.ts`, 5 scopes,
  one dispatcher) is the natural home for a `$param` scenario ref into a derive expression.
- **FULL-adoption plan** — core: a `scenario`/`number` ParamDef whose value is reachable as a `$param` ref
  inside derive/expr; the derive op reads it from ctx. react: a numeric/slider control shell. panel: authored
  in Filters; the derive-step expression assist (CON-07 plan) offers the scenario param in autocomplete
  (sourced from authored params — pick-don't-type). api: none. **Fitness:** "a `$param` ref in a derive
  resolves to an authored scenario ParamDef"; broken-ref check (CON-16) extends to scenario refs. Law-2
  preserved: a *value* flows into a *whitelisted* expression, never code.
- **Effort M/L · two-way · Class G · P2.**
- **Raises-the-bar** — what-if on a *provably sandboxed* expression substrate (DAX/Tableau calc are open;
  ours is whitelisted) + scenario-as-permalink-axis = a shareable projection neither tool offers.

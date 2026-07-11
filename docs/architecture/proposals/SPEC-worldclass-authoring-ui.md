# SPEC — The World-Class Authoring UI (Summary-Card Inspector · the Stage · the Data-Flow Spine)

> **Milestone:** AR-49 M4.3 (the unified authoring-UI reconception). **Scope:** `platform/apps/panel` (Studio chrome + inspector + stages); ONE already-gated engine dependency (D7 `itemSchema`, ADR-022) for the deep-schema drain — nothing else crosses the arrow.
> **Author:** platform-architect (sole author, independent study). **Status:** DESIGNED — phased, reversible, right-side-first.
> **Relationship to predecessors:** EXTENDS `SPEC-studio-shell-layout.md` (the Placement Law stays as the kernel — §1 gives the honest verdict on where it was right and where it was incomplete), `SPEC-authoring-reconception-M4-ia-canonical.md` (Wave 7 dock), `SPEC-deep-authorability.md` (D7/SCHEMA_TODO), `SPEC-M4.1-contextual-authoring.md`. Benchmark ground: `docs/architecture/BENCHMARK-REFERENCE-PLATFORMS.md` Part II (same honesty constraint: expert distillation, no live web; every claim about *us* is cited to code).
> **Owner problem (2026-07-11):** "the right side clearly doesn't fit" — STILL, after SL-0..SL-5. Also standing: pipelines must be VISIBLE, no scattered/duplicated functionality, canonical only.

---

## 0. TL;DR — three findings, three moves

**Findings (why the right side still doesn't fit, after the Placement Law):**

1. **The Placement Law is a *negative* law.** It says where heavy things must NOT be (the dock) and evicts them — but it never answers what the dock POSITIVELY shows in their place, so eviction produced *invisibility* (the filters pipeline shrank to a doorknob button; chart encoding simply doesn't exist in the dock). A right panel that is simultaneously **sparse** (a chart's element context is ~3 real fields across orphaned tabs) and **miscast** (rich values fall back to raw-JSON textareas — `FieldControlRegistry` registers `JsonControl` for `DataSpec`/`ChartDef`/`object`/`array`) *looks wrong at every selection*. That is the owner's "doesn't fit", in both senses.
2. **The escalation terminal loses the subject.** The focus-view (correctly a separate screen per the owner's binding clarification) renders the *editor* without the *thing being edited* — a form in a void. Every reference platform keeps the artifact in view at workspace depth (Grafana panel editor, Superset/Looker Explore, Figma/Framer enter-component, Retool's canvas-over-query-dock). Escalating out of the dock currently feels like being thrown out of the tool, not given a bigger room.
3. **The law weighs incomplete schemas.** `weight()` is derived from the PropSchema — but the chart's schema is 3 fields + a documented `SCHEMA_TODO` backlog (axes, legend, tooltip, label, height, stacked…), so the law honestly concludes "form-weight" about a subject that is workspace-weight *by intent*. The completeness gate's exclusion list neuters the placement law.

**Moves (the unified design — each is the best-of-breed pattern per axis, combined):**

1. **The Summary Corollary → the Summary-Card Inspector (the acute fix).** The dock shows a **glance projection of everything in scope** — scalars inline, every rich/heavy subject as a constant-size, *populated* **summary card** ("bar · GDP (current) · by year", "3 bars · 7 controls", "GDP ÷ population · GEL per capita") with one "open" affordance. Editors are *placed* by the law; summaries are *always present*. The dock becomes constant-weight by construction — it cannot overflow AND nothing is buried. (Figma's value-summary rows, generalized.)
2. **The Stage (focus-view v2): the subject rides along.** Every workspace container renders **the live subject + its editor + the shared breadcrumb spine** — the Grafana/Explore triptych as a reusable contract (`FF-STAGE-HAS-SUBJECT`). Named stages: **Chart Studio**, **Filters**, **Perspectives**, **Metric Calc**, **Model**. Still a separate screen (the owner's routed-screen decision is kept); what changes is what's ON it.
3. **The Data-Flow Spine (pipelines visible).** The Model stage's home becomes a **flow map** — `source → dataset/spec → metric → used-by` — projected from registries we already own (`dataSources`/`dataSpecs`/semantic catalog/`computeMetricImpact`); and every data-bound element's inspector carries a **lineage summary card** (the governed chain at the point of use). One pipeline concept, two projections — never buried, never duplicated.

---

## 1. Honest verdict on the Placement Law (kept · extended · superseded-where)

**KEPT (it is reference-grade):** the two-axis kernel (`scope × derived weight → container`), the closed container set, the escalation ladder, the derived-not-hand-placed discipline, the one breadcrumb spine, the bounded dock (240–560px, D-SL-3), the routed focus-view screen (owner-binding §3.4). No reference platform expresses placement as a *derived law* — that remains our-better.

**INCOMPLETE (the three findings above), therefore EXTENDED by two corollaries:**

- **The Summary Corollary (new law):** `dock ⟵ summarize(subject)` for EVERY subject in scope; `place(scope, weight)` locates only `edit(subject)`. Eviction of an editor NEVER means invisibility of the subject. (The SL-5 FiltersDrawer affordance was the first, hand-made instance; this generalizes it into the inspector's grammar.)
- **The Stage Contract (container upgrade, not a new container):** the `focus-view` container's realization gains a mandatory **subject slot** — the live artifact, rendered by the same renderer the canvas uses. `FocusView` (SL-2) is the shell; the Stage is its completed contract.

**SUPERSEDED:** §3.4's "minimal chrome + editor body" realization of the focus-view (form-only) — replaced by the Stage triptych. The SL-5 bespoke filters affordance — replaced by the general summary-card grammar. Everything else in `SPEC-studio-shell-layout.md` stands.

---

## 2. Per-axis benchmark — who is best, the mistake to avoid, our-better

*(Expert distillation; per-axis winners chosen for the mechanism, not the brand. "Our-better" is always grounded in a seam we own.)*

| Axis | Best in class — the mechanism | The mistake to avoid | Our-better (seam) |
|---|---|---|---|
| **A. Right-panel / inspector** | **Figma** — ruthlessly selection-scoped; task-first sections (Layout/Fill/Effects); every rich value shown as a **legible summary row** (swatch + hex), rich editing pops OUT; instances expose a *curated* prop subset. **Webflow** — orthogonal facets as tabs (Style ⟂ Settings). **Retool** — property groups **with the evaluated value previewed under each field**. **Sanity/Contentful** — the form is *generated from the schema*. | Superset's legacy control panel (an endless accordion of every option) and Plasmic's overloaded three-deep right panel — *panel = dumping ground*. Raw JSON in a panel (nobody ships this; we currently do). | Sections derived from the PropSchema's own groups (already built, OCP) + the **summary-card grammar** for rich values (§3.1) + the **completeness gate** making "every renderable prop authorable" a build failure — no leader proves panel completeness. |
| **B. Overflow / deep editing** | A composite: **Figma** popovers (rich single property) · **Sanity** stacked panes (nested documents, each level a pane) · **Notion** peek escalation (side → center → full page, same record) · **Superset/Looker Explore + Grafana panel editor** (workspace-weight subject gets a dedicated screen **with the subject live at its center**) · **Retool** bottom query dock (heavy editor coexists with canvas). | A form-only modal/screen detached from the artifact (old CMS admin pattern) — *exactly what our focus-view v1 is*. User-managed placement (movable panels) — the user shouldn't decide where things fit. | ONE **derived** escalation ladder (the law; no leader derives it) terminating in a **Stage that carries the subject** (§3.2). Depth choice is automatic; the WYSIWYG loop is never broken. |
| **C. Canvas ↔ inspector** | **Figma/Webflow** — canvas is the primary instrument; panel always describes the selection; every edit reflects instantly. **Framer** — *enter a component* to edit its internals in place (the stage gesture on the canvas itself). | Mode-heavy tools where editing happens away from the live artifact; selection that doesn't round-trip canvas ⇄ tree ⇄ panel. | Canvas-always-home + selection-derived dock context are BUILT and correct — kept. The gap was only at workspace depth; the Stage closes it. Double-click a chart = enter its Studio (the Framer gesture, D-W3). |
| **D. Navigation / layers / breadcrumb** | **Webflow** Navigator + the **canvas-bottom ancestry breadcrumb**; **Figma** Layers. **Notion** breadcrumb-as-path. | Two competing navigation spines (tree vs breadcrumb vs tabs disagreeing). | `OutlineTree` + the ONE breadcrumb spine across dock-drill ↔ stage (built, SL-1/SL-2) — kept. M4.1 Thread B (canvas drill + ancestry bar) already specifies the rest; no change here. |
| **E. Data & pipeline authoring — PROMINENT** | **Grafana panel editor** — the gold standard at the point of use: live panel on top, the query rows + ordered transform pipeline beneath it, each step previewable. **Observable/Hex** — the pipeline IS the document (a visible DAG). **Sigma/dbt/Power BI** — lineage graphs. **Retool** — queries always visible in their own dock, never buried. | **Metabase's admin-buried modeling** — data definition hidden behind an admin/role wall, invisible from the consuming surface. *This is precisely our current Model-lens burial.* | The **Data-Flow Spine** (§3.3): a governed flow map projected from registries we already own + a lineage card on every data-bound element. Statistics-grade twist: the chain carries agency/unit/preliminary badges (Law 9) — lineage no BI tool shows to a *non-modeler at the point of binding*. The M3 honesty boundary (calc = simple, raw ingest = expert) is preserved — visibility ≠ editability. |
| **F. Command / keyboard / undo** | **Linear/Figma** ⌘K quick actions · **Notion/Gutenberg** slash-insert · Figma's named version history. | A palette that duplicates (rather than fronts) the same actions the UI exposes. | ⌘K (built) + undo/redo command-pattern stack (built, `constructor.history.ts`) + N4 slash-insert (registered). Stages must register their commands in the same palette (one command registry) — small W-E item. |
| **G. Component / reuse** | **Figma** components/instances with per-instance overrides; **Webflow** symbols/classes. | Copy-paste as the only reuse (drift). | N1 (governed symbols — instances rebind a governed metric) is already a registered candidate; out of scope here, the section grammar (§3.1) is designed so a future "instance" context needs no new inspector model. |

**The synthesis nobody else has:** every leader hand-designs each surface; ours are **projections** — the palette from the node registry, the inspector from the PropSchema, the summaries from the same schema + value, placement from the derived law, the flow map from the data registries, guidance from the impact graph. One config tree, six derived surfaces, each fitness-gated. That is the platform's structural moat; this spec completes the two projections that were missing (summary, stage) and wires the one that was buried (flow).

---

## 3. The unified design

### 3.1 The Summary-Card Inspector (Move 1 — the acute right-side fix)

**The grammar.** The dock body is composed of **sections from ONE registry** — no more hardcoded `Chip + Inspector + ContextEditor + Divider + VisibilitySection` stack in `RightDock.tsx`. A section is declared data: `{ id, appliesTo(selection), render, order }`. Built-in sections: *schema groups* (the existing generic Inspector, unchanged), *data/lineage* (§3.3), *visibility* (re-registered, not hardcoded), *node context bridges* (`nodeContextEditors`, absorbed), *actions* (footer). Page context re-composes the same way: *page config*, *perspectives*, *filters* — three registered sections, one visual grammar, instead of three heterogeneous panes with dividers.

**The card.** Inside a section, every field routes by the existing `fieldControlRegistry` — with ONE change of default: rich/opaque types (`DataSpec`, `ChartDef`, `object`/`array` without `itemSchema`, and any subject whose Placement-Law verdict is `dock-drill`+heavy or `focus-view`) render a **`SummaryCard` control**, never `JsonControl`:

```
┌─ Data ────────────────────────────────┐
│ ▦ GDP (current prices)   GEL mn · ✓  │   ← populated glance: metric, unit, integrity badge
│   query · by year · 2010–2025        │   ← the DataSpec summarized, not dumped
│                        [Open editor →]│   ← opens at the law-derived depth (Stage)
└───────────────────────────────────────┘
```

Summaries are **derived** from the schema + value (a per-rich-type `summarize(value) → {primary, secondary, badges}` registered beside the control — OCP, one registration per rich type, with a generic field-count fallback so *no* type ever regresses to raw JSON). The filters card ("3 bars · 7 controls") and the calc card ("GDP ÷ population") are instances of the same grammar — the SL-5 bespoke affordance is retired into it.

**Why this closes the acute problem:** the dock now holds only scalars + constant-height cards → **constant weight, cannot overflow** (`FF-DOCK-CONSTANT-WEIGHT` strengthens FF-NO-CRAMMED-DOCK from "escalate the heavy" to "the dock's content is bounded by construction"). And it is never sparse: a chart's Data/Encoding/Filters presence is *visible and populated* even though their editors live in stages. Raw JSON disappears from the default path (`FF-NO-RAW-JSON-DEFAULT`; JsonControl survives as a dev-flag escape hatch only).

### 3.2 The Stage (Move 2 — focus-view completed)

**Contract.** A stage = `{ subject, editor, breadcrumb }` on the routed focus-view screen (the owner's separate-screen decision is unchanged):

```
┌ ← Back · Compose › GDP section › chart ────────────────────────────────┐
│ ┌───────────── SUBJECT (live) ─────────────┐ ┌── EDITOR (right panel) ─┐│
│ │                                          │ │ Data      [governed]    ││
│ │        the actual chart, rendered        │ │ Encoding  [wells+ShowMe]││
│ │        by the same renderer,             │ │ Axes / Legend / Tooltip ││
│ │        live against real data            │ │ Style                   ││
│ └──────────────────────────────────────────┘ └─────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────┘
```

- The **subject slot** renders the real artifact via the same components the canvas uses (`FF-STAGE-HAS-SUBJECT`: every registered stage renders its subject live; a stage without a subject is a build failure — Model's "subject" is the catalog/flow map itself).
- The **editor slot** is the *same right-panel grammar* as the dock (§3.1 sections at full budget) — muscle memory transfers; the stage is "your inspector, given the whole room, with the subject in front of you" (D-W2 recommends editor-on-the-right for exactly this reason).
- The breadcrumb spine continues (built, SL-1/SL-2). Esc/Back returns loss-free (built).
- `focusViewRegistry` becomes the **stage registry**: a target now declares `renderSubject` + `renderEditor` (additive; the two existing targets migrate).

**The named stages (each reuses existing machinery — no second engine):**

| Stage | Subject (live) | Editor (reused seams) | Entry points |
|---|---|---|---|
| **Chart Studio** (flagship) | the selected chart, real renderer + real rows | governed metric picker (semantic catalog) · **field-wells + Show Me** (`fieldwells/binding.ts`, `showme/ShowMe.tsx` — today reachable only in steward Model!) · encoding/axes/legend/tooltip via the generic Inspector over the drained schema | dbl-click chart on canvas · Data/Encoding card "Open" · ⌘K |
| **Filters** | the page's actual FilterBar, rendered live, controls interactive | the existing bars/controls list + `ParamDefEditor` (already escalates; gains the subject) | Filters card (Page context) · filter-bar node bridge (D7.3) |
| **Perspectives** | the live page at the previewed perspective (the pane's preview switcher, promoted) | `PerspectiveDefEditor` list (existing) | Perspectives card |
| **Metric Calc** | the metric's preview value + impact ("used by 4 panels") | `CalcBuilder`/`ExprTreeEditor` (M3.0, existing) | Model flow map · lineage card |
| **Model** | the **Data-Flow map** (§3.3) — the catalog IS the subject | the existing `MetricCatalogManager` + `DataModelingPanel` editors, opened per flow-map node | rail (built) · lineage card links |

### 3.3 The Data-Flow Spine (Move 3 — pipelines visible)

**(a) The flow map — Model stage home.** A left-to-right graph, *projected* (read-model, no new stored state):

```
source (SDMX/Excel) ─▶ dataset / spec ─▶ metric (governed) ─▶ used by: pages · panels
   [status chip]         [DataSpec]        [unit · agency ·      (computeMetricImpact
                                            preliminary]          reverse index — exists)
```

Every node is clickable → its editor opens in the stage's editor slot (source → `SourceAuthoringPanel`, spec → `DataSpecEditor`, metric → `MetricEditor`/calc). The current `ModelSurface` vertical stack (catalog manager + modeling panel with no visible relationship) is re-homed as the flow map's detail editors — Strangler, nothing deleted. The steward/author lens split stays exactly as AR-50 M5b built it: authors see the same map read-only (the Data Dictionary becomes the map's browse mode — one surface, two lenses, not two surfaces).

**(b) The lineage card — point of use.** Every data-bound element's Data section (§3.1) shows the chain as chips: `SDMX geostat ▸ na_gdp ▸ GDP (current) ▸ this chart`, each chip a link into the corresponding stage (steward) or its dictionary card (author). This is Sigma/Power-BI lineage brought to the *authoring* panel with governance badges (Law 9) — and it makes the pipeline visible from the place authors actually stand, killing the "buried behind Model" complaint at its root (`FF-LINEAGE-AT-POINT-OF-USE`).

### 3.4 Schema-completeness drain (Move 1's precondition for honesty)

The dock/stage can only be as truthful as the schema. With summary cards in place, draining `SCHEMA_TODO` is *safe* (a heavy field lands as a card, never a cram): scalar viz-refinements (label, height, stacked, dataLabels…) go straight into schema groups; nested objects (axes/legend/tooltip) ride the already-gated D7 `itemSchema` seam (ADR-022) and surface in the Chart Studio's editor slot. Two hygiene gates found during this study: `ChartGroups` references fields (`view.legend`, `view.tooltip`) that do not exist in `ChartSchema` (silently dropped groups) → `FF-GROUP-FIELDS-EXIST` (every `PropertyGroup` field must exist in the schema); and the SCHEMA_TODO exclusion list gets a ratchet (may only shrink).

---

## 4. Duplication / coherence audit (the owner's "scattered functionality")

| # | Finding (cited) | Verdict |
|---|---|---|
| 1 | **Metric binding appears as two concepts**: MetricPalette (left Data surface, drag/bind) and `data.query.measure` enum-ref (dock). One write path, byte-identical by design — *not* a true duplication, but presented as two ideas. | UNIFY PRESENTATION: the Data summary card IS the same governed picker; the palette remains the drag source. `FF-ONE-BIND-CONCEPT` (one write path — already true; keep gated). |
| 2 | **DataSpec authoring is a split brain**: the rich editors (`DataSpecEditor`, field-wells, Show Me) are reachable ONLY inside steward Model, while node-level data fell to raw JSON. Same grammar, two experiences. | FIX BY REUSE: Chart Studio mounts the SAME editors for node-scope specs (§3.2). No fork; the imbalance dissolves. |
| 3 | **RightDock composes ad hoc**: `VisibilitySection`, `nodeContextEditors`, page panes hardcoded/stacked outside any grammar. | SECTION REGISTRY (§3.1) absorbs all of them — one grammar, one registry. |
| 4 | **`ChartGroups` dead field references** (`view.legend`, `view.tooltip` not in schema) — drift the completeness gate missed. | Fix + `FF-GROUP-FIELDS-EXIST`. |
| 5 | **Page authoring in two homes** (left Pages&Site = site identity/nav/create; right Page context = page config/perspectives/filters). | CORRECT, not duplication — the law's site-vs-page scope split. Name it in the UI (left surface heading "Site"; the dock tab stays "Page"). |
| 6 | **Model stage stacks two unrelated managers** (metric catalog above raw modeler) with the relationship invisible. | The flow map (§3.3) makes the relationship THE surface. |

---

## 5. Phased roadmap (right-side first · each step reversible · fitness-gated)

| Phase | What ships | Files/areas (indicative) | Fitness | Tag |
|---|---|---|---|---|
| **W-A — Summary-Card Inspector** (the acute fix, FIRST) | Dock section registry (absorb visibility/context/page panes) · `SummaryCard` control + `summarize()` registry · rich types re-registered from JsonControl → SummaryCard · generalize the filters affordance into the grammar | `studio/RightDock.tsx`, new `inspector/sections/*`, `inspector/controls/SummaryCard.tsx`, `FieldControlRegistry.ts` | FF-DOCK-CONSTANT-WEIGHT · FF-NO-RAW-JSON-DEFAULT · FF-SUMMARY-EVERYWHERE (every in-scope subject has a glance projection) | reversible |
| **W-B — Stage contract** | `FocusView` gains the subject slot; registry targets declare `renderSubject`; Filters + Perspectives stages get their live subjects | `studio/FocusView.tsx`, `focusViewRegistry.tsx`, `features/filters`, `features/perspectives` | FF-STAGE-HAS-SUBJECT | reversible |
| **W-C — Chart Studio** | The flagship stage: live chart + governed picker + field-wells/Show-Me + drained schema; dbl-click-to-enter gesture | new `studio/stages/ChartStudio.tsx`, reuse `features/data-layer/*`; schema drain in `packages/plugins` (scalars now; nested via D7) | FF-STAGE-HAS-SUBJECT · FF-SCHEMA-COMPLETE ratchet · FF-GROUP-FIELDS-EXIST | reversible; nested drain rides ⛔ D7 (ADR-022, already owner-gated) |
| **W-D — Data-Flow Spine** | Flow map as Model home (projection; lens = read-only vs edit) · lineage card in the Data section | `studio/model/FlowMap.tsx`, `ModelSurface` re-home, `inspector/sections/data.tsx` | FF-LINEAGE-AT-POINT-OF-USE · FF-FLOWMAP-IS-PROJECTION (no new stored state) | reversible |
| **W-E — Coherence sweep** | Audit-table verdicts (§4) · stages register ⌘K commands · placement-audit v2 over the extended law | across | FF-PLACEMENT-AUDIT v2 · FF-ONE-BIND-CONCEPT | reversible |

**Order rationale:** W-A alone makes the right side *look and be* right (bounded, populated, no JSON) — the owner's acute pain — before any stage exists (cards can open the existing form-only focus-view until W-B upgrades it). W-B/W-C then make "Open editor" land somewhere worthy. W-D pays the visibility mandate. Every phase is independently shippable and revertable.

---

## 6. Decisions / owner gates

- **D-W1 — SummaryCard as the DEFAULT for rich/opaque values** (reversible). Recommend YES; JsonControl demoted to a dev-flag escape.
- **D-W2 — Stage layout: editor as a right panel inside the stage** (vs bottom strip). Recommend right — inspector muscle memory; bottom (Retool/Grafana query rows) reserved for the Filters stage where the subject is horizontally wide. Reversible CSS-level choice.
- **D-W3 — Double-click a canvas chart enters Chart Studio** (the Framer enter-component gesture; complements M4.1 Thread B's drill). Recommend YES. Reversible.
- **D-W4 — Flow map becomes the Model stage HOME** (vs a tab beside the catalog). Recommend home — the map is the orientation; lists are its details. Reversible.
- **No new one-way doors.** The only packages-crossing work is the already-gated D7 (ADR-022) nested-schema drain; W-C sequences behind it without blocking (scalar drain proceeds).

---

## 7. Rejected alternatives (ADR discipline; ≥2)

1. **Widen/split the right dock into stacked panes (Sanity desk in a 560px column).** Rejected — a column is a column; nesting panes into it reproduces the cram at higher density. Sanity's pattern works at full-window width, which is what the Stage provides.
2. **Retool-style persistent bottom dock for heavy editors.** Rejected as the *general* terminal — statistical authors are not query developers living in a second dock; vertical space belongs to the canvas; two permanent chrome regions violate "the tool leads, one room at a time." (Its *idiom* survives inside the Filters stage layout.)
3. **Keep the form-only focus-view and tune it (better typography, sections).** Rejected — root cause is the missing subject, not form styling; the owner's continued dissatisfaction after SL-0..5 is the empirical proof (Law 6: root cause, never symptom).
4. **In-canvas overlay workspace (Figma-style modal-in-canvas) instead of the routed screen.** Rejected — contradicts the owner's binding 2026-07-10 clarification (separate page/route); the Stage delivers the same WYSIWYG property on the routed screen.
5. **A graph database / stored lineage model for the flow map.** Rejected — the map is a pure projection of registries we already own (`FF-FLOWMAP-IS-PROJECTION`); storing it would create a second truth (violates Config = SSOT).

---

## 8. Invariants honored

Arrow untouched (apps-only; D7 already gated) · Law 1 (summaries/lineage are dimension-generic) · Law 2 (cards/stages/map are projections of config + registries — no logic in config) · Law 4 (Grafana/Explore/Figma patterns adopted whole as one contract) · Law 9 (badges in cards + lineage; stages inherit the Inspector's WCAG grouping/keyboard model; the flow map is keyboard-navigable, not color-only) · role-is-lens (map browse vs edit) · M3 honesty boundary (visibility ≠ editability of raw ingest) · Guided-Canvas doctrine (cards are affordances, never gates; FF-NO-WORKFLOW-GATE stands) · "in no case worse than now" (every existing editor survives, re-homed).

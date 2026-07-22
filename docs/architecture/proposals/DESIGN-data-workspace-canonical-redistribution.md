# DESIGN — Data-Workspace Canonical Redistribution (ADR-051 DU6+, the owner's 5 problems)

> **Status:** proposal (design-only). **Author:** platform-architect. **Date:** 2026-07-20.
> **Trunk:** 0102. **Extends** ADR-051 (One Data Workspace) — DU6 *elevated* from polish to a
> principled redistribution, + four mini-waves. **Touches no engine, no object model
> (ADR-038/041/042), no metric/spec grammar (ADR-034/045/046)** — surface/IA + disclosure +
> placement-routing only; additive, Strangler, revert-clean. **Owner license (binding):**
> *"reject, look into the foundations, refine… bring it to the best platforms."* Each item
> carries a verdict — **ADOPT / REFINE / RESPECTFULLY REJECT** — vs the reference class, plus a
> jargon-free paragraph so the owner decides.

## 0. Thesis (read first)

Four of the five problems are **one root cause** and we already own the cure, unpointed at the
data workspace: **surfaces were placed by hand and forked ad-hoc, instead of *projected from
one declaration* and *placed by the Placement Law*.**

- Metrics have a single write-SSOT (`semanticCatalog.store`) + read-resolver
  (`useMetricCatalog`) — but 5 forked governed-metric UIs. → **#1.**
- The **Placement Law** (`resolveSurface(scope,weight)→container`, `studio/placement/`) exists
  precisely so *"an oversize subject escalates out of the dock by construction; a crammed dock
  is unrepresentable."* The data workspace never routes through it — so table ops land in a
  full-screen workbench (**#2**), the Model floor stacks three heavy objects in one column
  (**#4**), and editors/guards place themselves by taste (**#5**).

Two canonical moves: **A —** metric = a first-class *projected* object (one view, declared
modes, one home); **B —** route every data-workspace surface through the Placement Law. **#3**
is the honest exception: the classifier renderer is world-class (SDMX-DSD `parentCode` tree,
governed labels + honest `code only` fallback, debt chips) — a *disclosure-default* tuning,
not an architecture defect. One real gap surfaces under #5 (the ladder has no modal) — closed
in §5.

---

## 1. Metrics scattered — ONE SSOT, 5 governed surfaces + 2 legitimate neighbours

**Ground truth (verified).** Governed-metric surfaces (the consolidation set): `MetricCatalog
Manager` (steward CRUD), `DataFlowMap` (**double-mounted** — `ModelSurface` interactive +
`DataDictionarySurface` read-only), `DataDictionarySurface` (author dense list), `MetricPalette`
(**×3** — `DataFacetField`, `GetHead`, `DataWorkbench`). *Not* metric homes and kept apart:
`CubeInventory` (raw floor) and `PromoteMetric` (the raw→governed mint, correctly in the
workbench). Write-SSOT + read-resolver are already single → fix the **surfaces**.

**SDMX reconciliation (the floor law).** Raw *measure* (SDMX primary measure) → **Sources**
floor. *Classifier* (DSD codelist) → **Sources** floor. Governed *metric* (Looker/dbt/Cube
measure def) → **Model** floor. So `CubeInventory`/`PromoteMetric` must **not** collapse into
the metric home — they are the raw floor and the cross-floor mint.

**Verdict — REFINE.** The owner's "scattered, one SSOT" is right; "co-locate browse+manage" is
necessary but not the strongest target. The reference class treats the metric as **one
definition with many views** — Looker's LookML surfaces as Explore fields, the field picker,
docs, and lineage; dbt `metrics:` surfaces in docs, the DAG, the semantic API. That is exactly
our Bounded-Element law (ADR-038) applied to the metric: *declare once, project everywhere; a
new surface is a new projection, never a hand-forked palette.*

**Canonical redesign.**
1. **ONE home** on the Model floor, **co-locating browse + manage** (no mutually-exclusive
   lens — §4), like Metabase's model detail / Looker's model page.
2. **ONE `MetricCatalogView` with declared *modes*** (a projection of the catalog, not a fork):
   `pick` (tiles+bind = today's MetricPalette) · `manage` (list + edit-in-drill + delete-guard)
   · `entry` (read-only cards) · `flow` (the source→metric→used-by projection = DataFlowMap) ·
   `browse` (shared searchable list). Each reads the same `useMetricCatalog()`; none
   special-cases a metric type (`FF-NO-EXTERNAL-SPECIAL-CASE` analogue). A new metric surface =
   a new *mode*, never a fourth `<MetricPalette>`.
3. **The 5 loci collapse to 1 home + N projections:** `MetricCatalogManager`→`manage`;
   `DataDictionarySurface` list→`entry`/`browse` (screen stays as the author landing, stops
   re-implementing); `DataFlowMap ×2`→**one** `flow` mount (§4); `MetricPalette ×3`→`pick` (the
   3 call-sites keep their props, render the one view).

Pure projection/SSOT/lossless (Law 2); no engine change.

**Owner paragraph.** *You're right the same metric shows up in too many places. The deepest fix
isn't just "put browsing and editing on one screen" — it's treating each metric as one defined
thing the app can **show in different ways** (a pick-list, an editor, a read-only card, a flow
diagram) from that **one** definition. Today we have five hand-built copies that drift apart. I
propose one metric view with a few "modes," and every place just asks for the mode it needs.
The metric gets **one home** (the Model page) where you browse and edit side-by-side. Raw cube
measures and classifiers stay on Sources (they're the raw ingredients); the "promote raw →
governed" button stays in the workbench. How metrics are stored doesn't change.*

---

## 2. Basic table ops buried — a placement mis-classification

**Ground truth.** `table/default/TableNode.ts` `TableGroups` exposes only Columns/Footer/Data-
integrity (cosmetic). Every *data* op (pick measure, sort, filter, aggregate, reshape) lives
behind the DATA facet (`DataFacetField.tsx`) = read-only summary + one door into `DataWorkbench`
(a full-screen **focus-view**). So a basic op means **leaving the canvas**. (Correction to a
prior note: the door is now kind-agnostic — `canWorkbench = !!escalation`; the old `spec.type`
gate is gone.)

**Verdict — ADOPT the instinct, REFINE the mechanism (don't dumb down the workbench).** The
reference class agrees emphatically: Airtable puts sort/filter/group on a field's inline menu;
Retool configures sort/column inline; Grafana keeps "one more transform" a click away without a
takeover; Power BI splits the *fields well* (quick) from the *Power Query Editor* (full). In
Placement-Law terms the diagnosis is exact: *"sort by X," "top-N," "pick a measure" are
`form`/`glance`-weight subjects routed to a `workspace`-weight container.* `deriveWeight` bands
them `flat`/`grouped` (→`dock-panel`), not `oversize` (→`focus-view`). They were mis-placed
because the DATA facet had no `form`-weight rung between "summary" and "full workbench."

**Canonical redesign — the core-ops band.** Between the DATA-facet summary and the workbench
door, add a **core-ops band**: the 3–4 highest-frequency ops as inline governed controls that
**append/patch declarative `TransformStep`s on the pipeline tail** (reuses the existing ~18-op
registry; no new verb): *Measure* (the `pick` mode of §1), *Sort* (→`{op:'sort'}`), *Filter*
(top-N/simple predicate →`{op:'filter'}`), *Aggregate* (when the shape invites). Rules: (1)
**declarative, projection-only** — the band and the workbench edit the *same tail*; the band is
a shortcut view of the first steps, never a parallel editor (respects `FF-ONE-SPEC-EDITOR`).
(2) **placement-derived** — renders because these ops resolve to `dock-panel`/`popover`, not by
a bespoke call (§5). (3) **no dumbing down** — the workbench door stays whole for multi-step /
reshape / combine / promote; the band is *simple perception*, the workbench *full power*
(`[[pipeline-full-power-simple]]`). (4) **projection of op *categories*** (the 7-verb grammar's
`category`), so a new op joins the band by declaration.

**Owner paragraph.** *Today, to sort a table or show the top 10 you must leave the page and open
the big data workbench — like Excel making you open a separate program to sort a column. The
best tools (Airtable, Retool) put everyday actions **right where the table is** and keep the
powerful editor one click away. I propose a small "quick actions" strip in the table's Data
panel — pick the measure, sort, simple filter — that quietly writes the same recipe steps the
workbench would. The workbench stays exactly as powerful; we add the missing easy lane in front
of it. Simple things become simple; powerful things stay possible.*

---

## 3. Sources classifiers hidden behind 3 collapse levels

**Ground truth.** `SourcesBody → CubeInventory → DimensionRow → CodelistTree`, each
`open=false`. At rest: 3 cube titles, zero classifier signal. The renderer is excellent
(SDMX-DSD forest, governed labels, honest `code only` fallback, `dimLabelDebt` chips) — the
defect is **disclosure default + information scent**, not the renderer.

**Verdict — ADOPT.** The owner's "default-expanded dims / column of classifiers" is exactly
right and matches the standard: SDMX DSD browsers (Eurostat NACE/COFOG, .Stat) show the
dimension list by default, codelists one click down; Power BI/Superset show fields expanded.
Cheapest high-value fix in the set.

**Canonical redesign** (no renderer change): (1) **scent on the *closed* cube card** — add a
compact dimension-name line (`time · region · sector · …`, truncated) so a steward reads a
cube's vocabularies without opening it. (2) **default-expand the *dimension list*** when a cube
opens (rows visible, not the codelists): one click → all classifier names + member counts +
`time` badge + debt chips. Collapse depth for *seeing the schema* drops **3→1**. (3) **codelist
stays click-to-open per dimension** (they're large; `CodelistTree` already opens roots ≤8):
drilling a *specific* codelist is 2 clicks — correct. I **reject** auto-expanding codelists or
auto-opening every cube (noise). Optional (live-walk call): a right-side cube-detail *drawer*
(`dock-drill`, Superset style) if the cube list grows long — but in-place default-expansion is
lighter and sufficient at today's scale.

**Owner paragraph.** *You're completely right, and this is the easiest win. The classifier
display itself is already excellent — it's just hidden three clicks deep, so opening Sources
shows three cube names and nothing about what's inside. I propose: (1) a small hint of each
cube's classifiers on its closed card ("time · region · sector"); (2) when you open a cube,
show its full classifier list **immediately** (not collapsed), like Eurostat's browser. Opening
a *specific* code list stays one more click, because expanding every one at once is a wall of
text. No change to the display — just stop hiding it.*

---

## 4. Model floor cluttered — one tall column (DU6)

**Ground truth.** `ModelSurface` (steward) stacks, with only `<Divider>`s: `DataFlowMap`
(Region 0, densest, **first**) → `MetricCatalogManager` → `DataModelingPanel` (the whole raw
modeler). The author lens (`DataDictionarySurface`) **also** mounts `DataFlowMap` (double-mount,
first in both). `DataModelBody` gates the two by a `browse | edit` lens that makes the
dictionary and modeler **mutually exclusive**.

**Verdict — REFINE (break the column; de-dup the map); RESPECTFULLY REJECT the
mutual-exclusion.** The tall column is a placement failure — three `site`-scope objects of very
different weight stacked with no structure; the reference class sections this (Looker model
page, dbt docs nav+content, Grafana settings tabs). And treating "read the model" vs "edit the
model" as two toggled screens is the wrong model — Looker, dbt docs, Metabase all read+edit in
one place. The honest constraint (`FF-AUTHOR-NO-QUERY`) is *not* "author can't see the model" —
it's "author can't reach the raw *pipeline modeler*."

**Canonical redesign — sectioned floor, ONE flow strip, lens = modeler-visibility only:**
- **Orientation strip:** `DataFlowMap` (`flow` mode) — **one** mount, **collapsible**, default
  collapsed to its summary line. Demoted from "first & huge" to orientation.
- **Primary region:** the Metric Catalog (`MetricCatalogView`, §1) — **browse+manage
  co-located**; the lens only swaps `entry`↔`manage` *within the region*, never a screen swap.
- **Steward-only disclosure:** "Sources & pipelines" (`DataModelingPanel`) behind a tab/
  disclosure, hidden under the author lens.

So the lens now gates exactly one thing — the raw modeler's visibility. This **dissolves the
mutual-exclusion** while *strengthening* `FF-AUTHOR-NO-QUERY` (the query cliff becomes a panel
the author never opens, not a whole screen they're locked out of). Sectioning *is* the "site
scope manages its own internal weight" clause of `resolveSurface`. `DataDictionarySurface`
keeps its author-landing role but renders the shared view (`entry`/`browse`) + the shared flow
strip — no re-implementation, no second map.

**Owner paragraph.** *The Model page is one long column — a big flow diagram on top, then the
metric editor, then the whole raw modeler, separated by thin lines; and the diagram is the
first, biggest thing in **both** views. I propose sectioning it like the best data tools: the
flow diagram becomes a small collapsible "orientation" strip; the metric catalog becomes the
main area where you browse and edit **together**; the raw modeler tucks behind a "Sources &
pipelines" panel only stewards see. I'm also pushing back on one thing: today you must **choose**
between "browse" and "edit" views of the model — the best tools never make you choose, so I'd
merge them. The author still never meets the raw query screen — it's just a panel they don't
open, instead of a whole mode they're locked out of.*

---

## 5. Popups where inline clutters — the Placement Law already IS the policy

**Ground truth.** `MetricEditor` opens **in-place** in `MetricCatalogManager`, replacing the
*whole region* (shoving the column). Delete-guard = inline `<Alert>` (informative — fine).
`PerspectiveDefEditor` renders **per-row**. `EditPopover.tsx` **already exists** — a *law-gated
glance-only* popover (`FF-POPOVER-GLANCE-ONLY`); the RightDock "projection of selection" is
clean.

**Verdict — ADOPT the instinct, REFRAME onto the law we built.** The strongest form isn't
"popover vs modal by taste" — it's the Placement Law:
`resolveSurface(scope,weight)→{inline·popover·dock-panel·dock-drill·focus-view·relocated}` is a
principled, least-astonishment, fitness-proven container policy. The defect is that the named
spots don't route through it. Policy = *no surface hand-places its editor; every one asks
`resolveSurface`.*

| Spot | scope × weight | law → | fix |
|------|----------------|-------|-----|
| MetricEditor (full form) | `nested-item` in the site catalog, `nested` | **dock-drill** | drill *within* the catalog region; don't take over the column |
| quick-bind / recolor / rename (1 prop) | `micro-target`, `flat` | **popover** | reuse `EditPopover` |
| table sort toggle (1) | `micro-target`, `flat` | **popover** | §2 glance ops pop over the element chrome |
| table core-ops cluster | `element`, `grouped` | **dock-panel** | §2 core-ops band |
| PerspectiveDefEditor (rich per-row) | `nested-item`, `nested`/`oversize` | **dock-drill / focus-view** | route per-row editing to a drill, not inline expansion |

**The genuine gap — the ladder has no modal; name a second axis.** The ladder is deliberately
modal-free (authoring "takes over" via `focus-view`, not a modal). But *blocking/destructive
decisions* (delete that orphans consumers; unsaved-changes conflict) have **no home** in an
*authoring* ladder — they are an *interruption*, not a place authoring happens. **Proposal:**
name a second, orthogonal axis — **interruption** — with one narrow container `confirm-dialog`
(a modal), admitted **only** for destructive/blocking decisions, law-gated like `EditPopover`:

- `FF-MODAL-BLOCKING-ONLY` — a `confirm-dialog` whose subject is an *authoring form* is refused
  (self-guard), making "a modal crept into authoring" unrepresentable.
- Delete-of-a-*referenced* metric stays the informative inline guard (a *refusal*, not a
  decision). Delete-of-an-*unreferenced* metric is the legitimate `confirm-dialog` case.

This closes a real Placement-Law gap; I'll fold it into the ADR-049/SL Placement lineage as an
addendum.

**Owner paragraph.** *You're right that some things should pop up instead of shoving the layout.
The good news: we already built the rule — a small law that decides whether any editor belongs
inline, in a pop-over, in the side panel, in a drill-in, or on its own screen. A few older spots
(the metric editor, the per-row perspective editor) ignore it and place themselves by hand, so
the metric editor shoves the whole column aside. The fix: make every editor **ask the law**. One
honest gap: the law has no "blocking dialog," which is exactly right for a **destructive
confirm** ("delete this metric?"). So I propose adding that as a **separate, tightly-limited**
thing — allowed **only** for a yes/no destructive or conflict decision, never for editing a
form. That keeps modals from creeping back everywhere.*

---

## 6. Wave sequence (WIP=1, reversibility, agent)

DU6 absorbs **#4**. The rest open as `DW-` mini-waves. **Move B (route through the Placement
Law) is a cross-cutting constraint every wave honors**, plus a trailing cleanup wave.

| Wave | # | Scope | Revert | Agent | FF |
|------|---|-------|--------|-------|----|
| **DW-C** (first) | #3 | Disclosure defaults on `CubeCard`/`DimensionRow` + closed-card scent chips; no renderer change | clean (flags + one line) | senior-frontend | `FF-CLASSIFIER-SCENT` |
| **DU6** | #4 | Sectioned Model shell; DataFlowMap→one collapsible strip; lens = modeler-visibility only (dissolve exclusion) | clean (recompose; no engine/store) | senior-frontend | `FF-DATAFLOW-SINGLE-MOUNT` · `FF-MODEL-BROWSE-EDIT-COLOCATED` |
| **DW-A** (after DU6) | #1 | Extract `MetricCatalogView` (modes); repoint the 5 surfaces | clean (extraction; SSOT untouched) | senior-frontend + me (mode-contract review) | `FF-ONE-METRIC-VIEW` · `FF-METRIC-NO-FORKED-PALETTE` |
| **DW-B** | #2 | Core-ops band writing pipeline-tail `TransformStep`s; door unchanged | clean (additive; reuses ops) | senior-frontend + engine-specialist (step-append helpers) | `FF-COREOPS-INLINE` · `FF-COREOPS-NOT-FOCUSVIEW` |
| **DW-D** (trailing) | #5 | Route MetricEditor/PerspectiveDefEditor via `resolveSurface`; add `confirm-dialog` axis | clean (routing + one guarded container) | senior-frontend + me (Placement-Law ADR addendum) | `FF-DATA-SURFACE-PLACEMENT-DERIVED` · `FF-MODAL-BLOCKING-ONLY` |

**Order rationale:** DW-C first (highest scent-per-effort, delights immediately). DU6 next (it
reshapes the floor DW-A's home lives on — DW-A depends on the lens reconciliation). DW-A→DW-B
(both benefit from the sectioned floor + `pick` mode). DW-D trails (its *law-half* is a
constraint earlier waves already obey; its *cleanup-half* is small).

**DoD per wave:** `pnpm lint` + `tsc -b apps/panel` + the wave FF **and** a live J-walk on
`http://192.168.1.199:3013` (gate-green is never "done"). Journeys: **J-DATA-SCENT** (DW-C),
**J-MODEL-FLOOR** (DU6), **J-QUICK-SHAPE** (DW-B).

---

## 7. Needs a live screenshot to finalize (`:3013`)

1. **#3 (DW-C)** — at-rest Sources density: confirm scent line + whether in-place expansion
   suffices or a cube-detail *drawer* is warranted (depends on live cube count). *Highest value.*
2. **#4 (DU6)** — the tall column at real height: confirm strip/primary/disclosure proportions
   and the double-map redundancy.
3. **#2 (DW-B)** — the table DATA facet in situ: confirm what it renders today so the core-ops
   band slots between summary and door without disturbing the honest-state summary.

(#1 and #5 are code-confirmed; the J-walks validate them at build time.)

---

## 8. Invariants introduced (additive to `placement.fitness` / `oneDataWorkspace.fitness`)

`FF-ONE-METRIC-VIEW` (all governed-metric surfaces render from `MetricCatalogView`; no fork) ·
`FF-MODEL-BROWSE-EDIT-COLOCATED` (no browse-XOR-edit screen toggle for the catalog) ·
`FF-DATAFLOW-SINGLE-MOUNT` · `FF-COREOPS-NOT-FOCUSVIEW` (sort/filter/measure-pick resolve to
`dock-panel`/`popover`, write declarative steps) · `FF-CLASSIFIER-SCENT` (classifier names ≤1
disclosure from Sources) · `FF-DATA-SURFACE-PLACEMENT-DERIVED` (no hand-placed editor) ·
`FF-MODAL-BLOCKING-ONLY` (a `confirm-dialog` admits only a destructive/blocking decision).

## 9. Bounds held

No engine / object-model (ADR-038/041/042) / metric (ADR-034/045) / spec (ADR-046) change;
config stays SSOT, declarative, lossless (Law 2). Every wave additive/Strangler + revert-clean.
The only near-one-way element is the `confirm-dialog` axis — itself a *narrowing* guard (it
forbids, it opens no new authoring path). Option B (ADR-052 reference-binding) unaffected, still
after ADR-051.

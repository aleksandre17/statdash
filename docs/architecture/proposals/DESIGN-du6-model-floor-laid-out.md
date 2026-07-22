# DESIGN — DU6: the Model floor, laid out (apex re-lay)

> **Status:** design (owner order 2026-07-22 — DU6+DW-A pulled forward; lead reviews, then
> build slices). **Author:** platform-architect. **Chapter of**
> `DESIGN-data-workspace-canonical-redistribution.md` (one body — its §4 verdicts stand; this
> chapter **supersedes §4's remedy detail** and the §6 DU6 row). Owner directive (verbatim
> bar): «საერთოდ არ მომწონს ეს გვერდი… ასე ერთად შეტენილი, რა ზევით რა ქვევით… არა
> საერთაშორისო გაიდლაინების სტანდარტის, არც პლატფორმის დონის და არც ფრეიმვორკის ხარისხის.»
> Binds the ACCEPTED elevation design's visual language
> (`DESIGN-0104-elevation-reference-class.md` §1.5) and its §1.1 four-floor ladder. Folds
> owner inputs **0107** (metric scoping), **0110** (data-door grammar «რა დატაა და როგორ
> აიგო»), and **DW-A** (ONE MetricCatalogView).

## 1. Diagnosis — why the floor is crammed (the root, not the symptom)

The Model floor today (`DataModelBody`) is a **browse-XOR-edit screen swap** over two tall
columns: steward → `ModelSurface` (= `DataFlowMap` first & biggest → `MetricCatalogManager` →
the *entire* `DataModelingPanel`: source list + add/upload + spec list + workbench takeover);
author → `DataDictionarySurface` (= `DataFlowMap` **again** → metric cards dense with
`id/code/format` meta → dimension cards). The owner's "რა ზევით რა ქვევით" has a precise
structural answer: **the floor hosts THREE primary objects** (governed metric · named DataSpec
· raw source) **because Floor 3 of the accepted ladder was never built as a floor** — so Specs
and residual source-CRUD squat on Model, and the map is mounted twice to orient two forks of
the same content. The reference class (Looker model page, dbt Explorer, Power BI model view,
Airtable schema) is unanimous: **one primary object per view, progressive detail, lineage as a
first-class orientation — never four dense widgets stacked.** The cure is not reordering the
column; it is finishing the declared ladder and giving the Model floor its one object.

## 2. The floor's information architecture

**The ONE primary object of the Model floor is the governed METRIC.** Everything else is
positioned relative to it:

- **Above** it: the workspace ladder — the floor selector grows to the accepted §1.1 three
  in-workspace floors: **წყაროები (Sources) · მოდელი (Model) · სპეც-ები (Specs)** — this IS
  the owner's "what's above, what's below," made a visible, navigable spine. (Floor 4,
  elements, stays on the canvas; the ladder ends with a non-toggle link chip «ელემენტები —
  კანვასზე ↗».)
- **Beside** it (left rail): the metric catalog list — `MetricCatalogView` `browse` mode
  (DW-A), scope-grouped (0107), dense quiet rows.
- **In front** (detail canvas, the floor's center): the selected metric's detail — the 0110
  grammar at metric grain: **რა დატაა** (definition · unit · source · methodology) + **როგორ
  აიგო** (build path) + **used-by** — read for the author, editable in place for the steward.
- **Behind** (steward plane, disclosed not relocated): ids/codes/format monospace meta, edit
  and promote actions, the «სხვა გვერდების» scope group.
- **Not here at all** (moved to their own floors): the spec list + workbench (→ Specs floor),
  source CRUD/upload (→ Sources floor). The Model floor stops hosting the raw modeler
  entirely — a stronger form of §4's "steward disclosure" remedy, which this chapter
  supersedes.

**Layout (master-detail, the reference-class shape):**

```
┌ Data workspace header: floor ladder (წყაროები · მოდელი · სპეც-ები · [კანვასზე ↗]) ┐
├────────────────────┬──────────────────────────────────────────────────────────────┤
│ CATALOG RAIL       │ DETAIL CANVAS                                                │
│ search             │  nothing selected → MODEL OVERVIEW = DataFlowMap             │
│ ▾ ამ გვერდის (n)   │    (THE one mount; nodes navigate: metric→select in rail,    │
│   metric rows      │     spec→Specs floor, source→Sources floor)                  │
│ ▾ საიტის (n)       │  metric selected → METRIC DETAIL                             │
│   metric rows      │    header: label · unit · scope chip · [steward: id/code,    │
│ ▸ სხვა გვერდების   │      promote ↑, edit, delete-guard]                          │
│   (steward only)   │    § რა დატაა   — definition · source · coverage · method.   │
│ ▸ განზომილებები    │    § როგორ აიგო — build path (governed nouns; E3 deepens)    │
│   (collapsed)      │    § გამოყენება — used-by pages/elements                     │
└────────────────────┴──────────────────────────────────────────────────────────────┘
```

**Component plan (senior-frontend buildable):**

- `studio/DataWorkspaceBody.tsx` — the floor selector projects from a small **`DATA_FLOORS`
  declaration** (`{id, icon, labelKa, labelEn, body}[]`, `useStudioRoute.ts`): a new floor = a
  new declaration, the selector/deep-links/tests derive (OCP; the Bounded-Element idiom at
  shell scale). `DataFloor` union gains `'specs'`.
- `studio/specs/SpecsBody.tsx` (new) — the extraction of `DataModelingPanel`'s spec half: the
  spec list (dense rows, §3d) + `ShowMe` + the full-width `DataWorkbench` takeover + the URL
  cube-seed consumer (`CUBE_SEED_PARAM` effect moves here verbatim). The workbench is mounted
  **as-is** — this wave never reaches inside it (the E2 caution honored).
- `studio/model/ModelFloorBody.tsx` (new) — replaces `DataModelBody` + `ModelSurface` +
  `DataDictionarySurface` (all three retire; Strangler, one wave). Master-detail grid
  (container-query stacked when narrow, per `data-modeling-panel.css` idiom): rail ≈ 300px,
  detail flexible with `maxWidth: 880` prose column.
- Rail list: pre-DW-A it renders from `useMetricCatalog()` via the dictionary's proven row
  model (`buildMetricGroups` re-grouped by scope); DW-A then formalizes it as
  `MetricCatalogView mode="browse"` — the shell does not change when DW-A lands.
- Detail: `MetricDetail` (new) — the dictionary's card content **promoted to the detail
  grain** + the steward's `MetricEditor` mounted **in place of the read card** when editing
  (the parent §5 placement verdict — the detail canvas IS the catalog region's drill; no
  column shove, no screen swap).

**Entry/exit paths (the floor never dead-ends):**

| Gesture | From → To |
|---|---|
| Sources «დაათვალიერე workbench-ში» | Sources floor → **`?dataFloor=specs`** + cube-seed params (retargeted from `model`; the seed consumer moves with the spec half) |
| Promote raw→governed (workbench `PromoteMetric`) | Specs floor → success affordance deep-links `?dataFloor=model&metric=<id>` (the new metric selected in its home) |
| Metric detail «სპეც-ის გახსნა» (spec-backed metric; DU6-WB) | Model floor → Specs floor with that spec selected |
| Flow-map node click | metric → rail selection (same floor) · spec → Specs floor · source → Sources floor — the map is the cross-floor switchboard, fulfilling "lineage as a first-class rail" |
| Canvas DATA facet door | unchanged (focus-view workbench); the ladder's «კანვასზე ↗» is the way back up |

**URL grammar (Law 9, permalink):** `?dataFloor=model&metric=<id>` — rail selection rides the
URL; `?page=<id>` (already present) drives 0107 scope ranking. Deep-linkable, restorable,
shareable.

## 3. Functional redistribution

**a) The lens dissolves (the §4 REJECT, executed).** The `browse | edit` ToggleButtonGroup and
the `role === 'steward' ? <ModelSurface/> : <DataDictionarySurface/>` swap are deleted. On the
re-laid floor the role lens gates exactly two things, both *within* the one surface (elevation
§1.4 — "the lens adds; it never relocates"): (1) **edit affordances** in the detail (author =
read-only entry; steward = edit-in-place, promote, delete-guard); (2) **steward-plane
visibility** (monospace id/code/format meta, the «სხვა გვერდების» scope group). The raw query
cliff is now not even on this floor — `FF-AUTHOR-NO-QUERY` strengthens again: the Specs
floor's workbench is a place the author reaches only through the governed door, and the Model
floor contains nothing to lock away.

**b) DataFlowMap — ONE mount, two projections.** The single mount is the detail canvas's
**overview state** (nothing selected) — the floor's orientation, exactly the dbt-Explorer /
Looker "model overview" idiom. When a metric is selected, its lineage renders as the detail's
**textual build-path chain** (source → cube/spec → metric → used-by chips), NOT a second map
mount. `DataDictionarySurface`'s read-only mount and `ModelSurface`'s interactive mount both
die with their hosts. `FF-DATAFLOW-SINGLE-MOUNT` = exactly one `<DataFlowMap>` in the studio
tree.

**c) MetricCatalogView with the 0107 scope axis (DW-A, landing on this floor).** Rail groups,
in order: **«ამ გვერდის მეტრიკები»** (`scope: page:<current>` from `?page=`) → **«საიტის
მეტრიკები»** (`scope: site` — the additive default, today's behavior) → **«სხვა გვერდების»**
(steward-only, collapsed) → **«განზომილებები»** (collapsed; read-only dimension detail cards —
the dictionary's capability preserved without a second screen). The **promote gesture**
(page→site) is a steward action in the detail header — a direct, revertible governance
widening (steward can re-scope back), so **no modal** (`FF-MODAL-BLOCKING-ONLY` untouched);
delete keeps the parent §5 semantics (referenced = inline refusal guard; unreferenced =
`confirm-dialog`). Offer ranking (pickers/palettes rank page-scope first) is DW-A's C4-side
half, unchanged from 0107. QC-3 (duplicate options) dies in the same wave at the one selector.

**d) Row grammar — dense, chip-only (decided here, per the owner's "busy rows" signal).**
- **Metric row (rail):** label (primary) · unit (secondary, dimmed) · scope chip *only when
  page-scoped* · «გამოთვლადი» chip when calc. **Nothing else** — no `id:`/`code:`/`format:`
  meta on rows (`FF-METRIC-ROW-QUIET`); that meta lives in the detail, steward-plane. 36–40px.
- **Spec row (Specs floor):** name (primary) · shape chip (`type`) · **amber draft chip only
  when a draft exists** — the row-level Publish/Discard buttons of today's dense
  `AuthoringLifecycleBand` are **removed from rows**; acting on a draft happens in the
  workbench head band (one action home, quiet rows). Post-E3 (DU6-WB) the row gains ONE quiet
  binding-summary line (`summarizeBinding`: measures · dims · step count) — the 0110 grammar
  at list grain, still no buttons.

**e) `DataModelingPanel` dissolves (the floor-squatters go home):**

| Today (in DataModelingPanel) | Destination |
|---|---|
| Spec list + `ShowMe` + workbench takeover + cube-seed consumer + lifecycle bands | **Specs floor** (`SpecsBody`) — verbatim extraction |
| Source list + `SourceAuthoringPanel` (add/edit) | **Sources floor** — steward disclosure on/under `CubeInventory` («წყაროს პარამეტრები» per source + one add-source door); comprehension (cards) and administration (CRUD) co-located, one floor |
| `ExcelUpload` button | **merge into the Sources floor's ONE onboard section** — `CanonicalUpload` is documented as the sole upload mount, yet this second door is live today (surfaced defect). If the two ingest formats are genuinely distinct, both live *inside* the one onboard section; never a second door on another floor |
| `DataModelingPanel` itself | retires (with `ModelSurface`, `DataDictionarySurface`, `DataModelBody`) |

## 4. Visual direction (the accepted §1.5, applied to this floor — zero new tokens)

1. **Tokens only** — every color/space/type value from `packages/styles` `@layer`; zero raw
   hex (E5's `FF-NO-RAW-HEX` scope includes this floor).
2. **Density rhythm** = §1.5.3 verbatim: rail compact (36–40px rows, the lane rhythm), detail
   a roomy single column (`maxWidth: 880`), overline section headings (the existing
   `SectionHeading` idiom). One accent; **state, not decoration, carries color** — scope chips
   and lifecycle chips draw from the semantic/honest-state scales, never decorative palette.
3. **Georgian-first typography**: the metric's Georgian label is the detail's headline
   (`h5`-class weight); en secondary; monospace strictly steward-plane (ids/codes are plumbing
   to an author — the plane law, QC-1's lesson, applied to chrome).
4. **Honest states**: catalog `idle`/`error`/`empty` render as informative text in the detail
   canvas (today's dictionary behavior, kept); an unselected rail is never a blank — the
   overview map IS the empty state's content.
5. **Progressive disclosure**: closed groups show counts («სხვა გვერდების · 12»); the detail
   opens on the რა-დატაა section; steward meta sits last.

## 5. Wave slicing (E2-caution made explicit: floor-IA first, workbench-adjacent after)

The accepted "E2 before DU6" rationale was *"don't re-lay the floor around a fork twice."* The
fork is **inside the workbench**; none of the floor-IA slices reach inside it — they move
mounts and re-home lists. So the IA slices are pullable NOW; only the workbench-adjacent parts
wait.

| Slice | Content | Buildable | Canon anchor | Biting gate | Live journey (:3013) |
|---|---|---|---|---|---|
| **DU6-IA-1** | `DATA_FLOORS` declaration + Specs floor extraction (`SpecsBody`, seed-consumer retarget `model→specs`) + source-CRUD/upload re-home to Sources floor + `DataModelingPanel` retires | **NOW** (pre-E2; workbench mounted as-is) | §1.1 ladder · ADR-051 | `FF-FLOOR-IS-DECLARED` (selector ≡ declaration) · `FF-ONE-SPEC-EDITOR` (unchanged, re-proven) | **J-LADDER**: Sources → browse-in-workbench lands on Specs floor seeded → back up the ladder; no dead courier path |
| **DU6-IA-2** | `ModelFloorBody` master-detail: rail (scope-grouped list) + `MetricDetail` (read + steward edit-in-place) + DataFlowMap single mount (overview state) + lens dissolution + quiet rows | **NOW** (pre-E2; touches no workbench file) | verdict #4 · §1.4 lens law | `FF-DATAFLOW-SINGLE-MOUNT` · `FF-MODEL-BROWSE-EDIT-COLOCATED` (lens swaps no surface) · `FF-METRIC-ROW-QUIET` | **J-MODEL-FLOOR** (re-cut): open floor → overview map → pick metric → detail answers რა/როგორ/სად → steward edits in place → author lens shows same surface read-only |
| **DW-A** | `MetricCatalogView` modes formalized + `MetricPalette`×3 repointed + 0107 scope axis full (scope on `MetricDef`, promote gesture, offer ranking) + QC-3 killed at the one selector | after DU6-IA-2 (its home exists) | verdict #1 · 0107 · C4 | `FF-ONE-METRIC-VIEW` · `FF-METRIC-OPTIONS-UNIQUE` · 0107's FF (page-first ranking) | **J-SCOPE**: page-scoped metric authored → ranks first on its page's offers → promote → appears site-wide |
| **DU6-WB** | Build-path chains via `summarizeBinding` (metric detail «როგორ აიგო» named steps + spec-row summary line) + metric-detail «სპეც-ის გახსნა» door + DW-B core-ops adjacency | **after E2a + E3** (needs C5; touches workbench doors) | 0110 · C5 · verdict #2 | `FF-BINDING-SUMMARY-TOTAL` (E3's, consumed) | **J-DATA-DOOR**: any spec kind → row + detail show honest რა-დატაა + named როგორ-აიგო chain |

WIP=1; each slice revert-clean (mount moves + new shells; no engine, no store-shape, no
grammar change). DoD per wave = lint + `tsc -b` + the slice's FFs + the live J-walk (never
gate-green alone).

## 6. Rejected alternatives (the core IA call)

1. **Tabs within the Model floor** (Metrics | Dictionary | Flow | Modeler): preserves every
   fork — dictionary vs manage stay separate destinations, the map stays a widget, and a tab
   IS the browse/edit exclusion reborn horizontally. Below the "one definition, many views"
   bar. Rejected.
2. **Single column, reordered + collapsible sections** (parent §4's original minimal remedy):
   fixes stacking order, not the root — the floor still hosts three primary objects, and the
   owner has now rejected the column at the bar of international UI. Superseded by this
   chapter.
3. **Graph-first model canvas** (Power BI model view as the primary surface): our model is
   metric-catalog-shaped (a semantic layer), not table-relationship-shaped; a graph primary
   buries definition/search/scope — the daily verbs. The map earns the *overview* slot, not
   the primary. Rejected.
4. **Specs as a steward disclosure on Model** (parent §4's "Sources & pipelines" tab, the
   previous remedy): hides a first-class object (named DataSpec with an E0 lifecycle) behind a
   disclosure on the wrong floor, and contradicts the accepted §1.1 ladder that already names
   Floor 3. Rejected — the ladder is built honest instead.

## 7. Invariants added · bounds held

`FF-FLOOR-IS-DECLARED` (floor selector/deep-links project from the `DATA_FLOORS` declaration)
· `FF-METRIC-ROW-QUIET` (rail rows carry no id/code/format meta; ≤2 chips) — joining the
parent §8 set; `FF-DATAFLOW-SINGLE-MOUNT` and `FF-MODEL-BROWSE-EDIT-COLOCATED` keep their §8
meaning with the sharpened assertions above. Parent §9 bounds hold unchanged: no engine /
object-model / metric / spec-grammar change; surface, IA, and placement only.

**Owner paragraph.** *You said the page is crammed with no above-and-below — you're right, and
the reason is structural: this one screen is hosting three different things (metrics, specs,
raw sources) because the third floor of the data workspace was never built. The fix: the
workspace gets its honest three floors — **Sources → Model → Specs** — and the Model floor
keeps exactly ONE thing: the governed metric. Left, a clean searchable list grouped by "this
page's" and "site-wide" metrics; center, the selected metric's full story — what the data is,
how it was built, where it's used — which stewards edit right there. The flow diagram appears
once, as the floor's overview when nothing is selected, and its nodes navigate you between
floors. No more browse-vs-edit switch, no more double diagram, no more raw modeler crammed
underneath. This is how Looker, dbt and Power BI lay out their model pages — one object per
screen, detail on demand.*

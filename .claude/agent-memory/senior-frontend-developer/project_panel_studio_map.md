---
name: panel-studio-map
description: "THE consolidated Studio map — shell M1.2, IA S1-S5, dock zones SL1-SL4, role lens M2, data-flow M4.3/M5b: every landed slice's seams in one place"
metadata:
  type: project
---

> CONSOLIDATED (lead curation 2026-07-15) from 10 sibling files — one map, zero knowledge dropped.
> Owning agent: trim superseded detail in place on next touch (distillate, not log).

## panel rightdock zones sl1
> AR-49 SL-1 — RightDock hardened into a header/body/footer 3-zone contract; ONE header tier (context switch XOR promoted drill breadcrumb); breadcrumbSlot seam hoists D7.1b breadcrumb from body to dock header; FF-DOCK-ONE-HEADER-TIER / FF-DOCK-ZONES.

**AR-49 SL-1 — RightDock 3-zone contract (DONE 2026-07-10, branch
feat/ar49-m0-metric-first-authoring, commit 2fda5ae; apps/panel only, arrow held).**
Spec: `docs/architecture/proposals/SPEC-studio-shell-layout.md` §6 (SL-1) + the
3-zone diagram lines ~65-74/104/133-137. Hardens Wave 7 + D7.1b into an explicit
HEADER / BODY / FOOTER structure, killing the "header tab-tier collision."

**The 3 zones (`studio/RightDock.tsx` + `studio.css`):**
- **HEADER** (`.studio-dock__header`, fixed) — exactly ONE tier via a ternary:
  `promoted ? <breadcrumb> : pageId ? <context Tabs> : <overline>`. Context switch
  (Element | Page) XOR the drill breadcrumb — never stacked. Collapse IconButton is
  chrome, always present, NOT a tier.
- **BODY** (`.studio-dock__content`, the SOLE `flex:1 1 auto; min-height:0; overflow:auto`
  scroll region, testid `dock-content`) — the facet-grouped Inspector (its group
  accordion/tabs stay HERE, never the header) + form, or a single guided empty-state.
- **FOOTER** (`.studio-dock__footer`, fixed) — element actions (Delete), extracted OUT of
  the scrolling `nodePanel`. Rendered only when `scope==='element' && selected && !chromeSel`.

**The breadcrumb-promotion seam — `inspector/breadcrumbSlot.tsx` (the load-bearing
decision).** The D7.1b drill breadcrumb is owned DEEP in the body by
`NestedItemControl`'s DrillEditor (component-local `steps` state). To realize
"header = breadcrumb when drilled" WITHOUT lifting that state, the drilled editor
PROMOTES its breadcrumb up into a host slot:
- Port lives in the **inspector layer** (the breadcrumb PRODUCER), NOT studio — else
  `inspector → studio` inverts the sanctioned `studio → inspector` direction (RightDock
  already imports Inspector/schemaSource). DIP: low-level module defines the interface,
  high-level (RightDock) provides it. This was the key placement correction (first draft
  wrongly put it at `studio/DockHeaderSlot.tsx`).
- `BreadcrumbSlotContext` (nullable) + `useBreadcrumbSlot()` (consumer) +
  `useBreadcrumbHost()` (host → `{ slot, promoted }`). Ownership is a STACK (modal-stack
  pattern): most-recently-drilled editor owns the header; a source's own crumb refreshes
  keep stable `order` so drilling deeper never reshuffles. Handles a node with 2+ drillable
  array fields deterministically.
- **DrillEditor** (`NestedItemControl.tsx`): `useId()` slot id + two effects — sync
  promote/release on `drilled = activeCrumbs.length>1`, and release-on-unmount. In-body
  breadcrumb renders `{drilled && !hoisted && <Breadcrumb/>}` where `hoisted = drilled &&
  slot!=null`. **Fail-soft = zero D7.1b regression:** no host (isolation tests, any other
  mount) → `slot` null → breadcrumb renders in-body exactly as before. NestedItemControl.test
  (no provider) unchanged/green.

**FFs — `studio/dockZones.fitness.test.tsx` (+11 tests):**
- **FF-DOCK-ONE-HEADER-TIER** — top level: header has context tabs + no Breadcrumb nav;
  facet grouping (Inspector) in `.studio-dock__content`, never `.studio-dock__header`;
  drilling a `links` item (real registered node, `items` array itemLabel 'label') promotes
  breadcrumb to header + context tabs YIELD (`within(header).queryByRole('tab')` null) + not
  duplicated in body; back-nav restores context; source ternary `promoted ?`.
- **FF-DOCK-ZONES** (extends FF-RIGHTDOCK-FILLS) — 3 zones present on element select; body
  is sole `dock-content`; Delete is in `.studio-dock__footer` not body; no footer in Page
  context.

**GATE:** tsc -b apps/panel 0; vitest panel **100 files / 678 PASS** (0 fail); eslint 0
errors (2 baseline warnings). All Wave-7/D7.1b FFs preserved.

**Observation Duty / residual smell (flagged to lead):** the SPEC's strong reading is
"breadcrumb replaces dock CONTENT" (drill = whole-body takeover, sibling scalar fields
hidden). SL-1 realizes the HEADER-tier swap (breadcrumb replaces the context switch) but the
D7.1b drill is still an INLINE-per-field affordance — sibling fields remain visible in the
body while the header shows the item's crumb. Full body-takeover is coupled to SL-4 overflow
escalation + a DrillEditor↔Inspector integration rework; deliberately NOT attempted here to
avoid regressing the inline drill. See [[project_placement_law_primitive]],
[[project_panel_studio_shell_m12]], [[feedback_contextual_relevance_canon]].

---

## panel focus view sl2
> AR-49 SL-2 — Focus-View as a SEPARATE Studio screen (studio/FocusView.tsx + focusViewRegistry.tsx); Model mode re-homed off the left dock onto it; FF-FOCUSVIEW-SEPARATE-ROUTE + FF-MODEL-IS-FOCUSVIEW.

**AR-49 SL-2 — the Focus-View container (DONE 2026-07-11, branch feat/ar49-m0-metric-first-authoring, commit f141b3c; apps/panel-only, arrow held, config byte-identical).** Spec: `SPEC-studio-shell-layout.md` §3.4/§6. Realizes the Placement Law's heaviest container (`resolveSurface` already emits `'focus-view'`; this is its UI realization). Builds on [[project_placement_law_primitive]], [[project_panel_rightdock_zones_sl1]], [[project_panel_studio_m2_role_lens]].

**Owner clarification (binding, §3.4):** the Focus-View is NOT a canvas grid-area overlay — it is a SEPARATE Studio screen you navigate OUT to (Notion full-page / Sanity document-route), breadcrumb-back to return. This SUPERSEDES the spec's original SL-2 `FF-FOCUSVIEW-CANVAS-REGION` ("rail+dock persist") — the new FF is **FF-FOCUSVIEW-SEPARATE-ROUTE** (rail+dock NOT the primary chrome; grid gone, not covered).

**"Route" mechanism = SCREEN STATE, not a URL (judgment call, flagged D-SL-2a).** The panel has NO shell-level router: `App.tsx` is an auth/boot state machine (`login|loading|ready`); StudioShell paints the editing chrome directly. `react-router-dom` is a dep but used only INSIDE CanvasView (the rendered runner), not the shell. So the faithful minimal realization is a screen state: **StudioShell renders `<FocusView>` in place of the whole `.studio-shell` grid when `focusViewTargetId != null`**; back returns to the shell loss-free (surface/selection/role live in the same store, untouched). Adding a router would fight the state machine for no gain this step.

**Files:**
- `studio/FocusView.tsx` — reusable shell: minimal top chrome (`<section role=region>` + `<header>` breadcrumb-back Button + Breadcrumbs "Compose › {title}"); resolves the target from the registry; WCAG focus-in-on-enter (`backRef.current.focus()` in useEffect) + Esc→onBack; fail-soft on unknown id (calls onBack). Shares the SL-1 breadcrumb spine — it is a `useBreadcrumbHost()` HOST wrapping the body in `BreadcrumbSlotContext.Provider`, so a nested drill inside a target promotes into the focus-view header (dormant for Model, live for future nested targets).
- `studio/focusViewRegistry.tsx` — OCP target table `FOCUS_VIEW_TARGETS: Record<id, {id, title:{ka,en}, render:(ctx)=>ReactNode}>` (data, mirrors RAIL_ENTRIES) + `getFocusViewTarget(id)`. One entry today: `'data-model'` → `<ModelSurface/>`. New workspace editor = one row; shell unchanged.

**Model re-home (FF-MODEL-IS-FOCUSVIEW) — MAXIMAL REUSE, zero entry-point change.** Kept ALL M2 entry plumbing byte-identical: `enterDataModel = setRole('steward')+setSurface('model')`, the top-bar Compose⇄Data-model switch, the rail `model` stewardOnly entry, the ⌘K `open-data-model` command, the `effectiveSurface` model→default projection. The ONLY change: StudioShell derives `focusViewTargetId = effectiveSurface==='model' ? 'data-model' : null` and branches the render. So `activeSurface==='model'` (steward lens) IS the route state. Removed `import {ModelSurface}` + the `renderSurface case 'model'` from StudioShell — **ModelSurface's ONLY render site is now the registry** (the fitness source-scan proves it: no studio file except the registry imports ModelSurface). Back = `exitDataModel` (setRole author → projection returns the grid).

**Why the rail `model` entry STAYS (constraint, not choice):** both `roleIsLens.fitness` AND `authorNoQuery.fitness` assert `RAIL_ENTRIES.filter(stewardOnly)` is EXACTLY `[model]`. Removing it would redden two preserved FFs. So `model` stays a StudioSurface + stewardOnly rail entry; clicking it just routes to the focus-view (setSurface('model')→branch) instead of filling the left dock.

**FFs:** `studio/focusView.fitness.test.tsx` — FF-FOCUSVIEW-SEPARATE-ROUTE (in steward+model: `.studio-shell` null, rail nav null, contentinfo null, region present, Back present + returns; focus on Back) + FF-MODEL-IS-FOCUSVIEW (registry has data-model target whose render `.type.name==='ModelSurface'`; source-scan: only the registry imports ModelSurface).

**Test-update gotcha:** the old StudioShell.test Model tests asserted a `role="heading"` "Data model" (the left-dock heading). FocusView has NO heading role — title lives in a Breadcrumb (Typography). Rewrote to assert `getByRole('region',{name:'Data model'})` + Back button + rail-absent. ModelSurface.test unchanged (renders ModelSurface standalone, no FocusView parent → its own region-focus effect still wins).

**GATE:** tsc -b apps/panel 0; lint 0; full `src/studio` 28 files/200 PASS + command 10 PASS + placement/dockZones/rightDock/oneEmptyState 50 PASS + chromeTokenDriven 5 PASS. CSS `.studio-focusview*` token-driven (no brand literal → chrome fitness green).

**Observation flagged:** `resolveSurface.ts` comment still says focus-view "realized later, SL-4" — now stale (realized SL-2). Left untouched (placement primitive is a preserve-boundary); reconcile the comment when SL-4 wires placement→container escalation. Also §3.4's leftover "keeps the rail+dock" our-better line contradicts the binding owner-clarification at the top of the same section (separate screen) — a doc self-contradiction to clean when the spec is next touched.

---

## panel editpopover sl3
> AR-49 SL-3 EditPopover — the glance-weight micro-edit container (studio/EditPopover.tsx); placement-routed via placeSubject('micro-target'); nested-item RENAME is the wired glance path; FF-POPOVER-GLANCE-ONLY

SL-3 completes the Placement Law container trio (dock / focus-view / POPOVER,
see [[project_placement_law_primitive]], [[project_focus_view_sl2]]). Files:
`studio/EditPopover.tsx`, `studio/editPopover.fitness.test.tsx`,
`inspector/controls/useRowRename.tsx`, and a wire-in in
`inspector/controls/NestedItemControl.tsx` (ArrayListScreen).

**The container:** `<EditPopover>` = MUI `Popover` (Modal-based → focus-trap on
open + restore-focus-to-anchor on close for free) + `role=dialog` + title as the
accessible name + Esc/click-away dismiss. Props: `open, anchorEl, onClose(reason),
title, shape?, children`. `onClose` reason is `'escape' | 'backdrop' | 'commit'`
(Esc conventionally cancels; commit/backdrop keep — caller decides).

**Self-guard (FF-POPOVER-GLANCE-ONLY):** the container calls
`placeSubject('micro-target', shape)` (default `{flatFields:1}`) and renders
`null` unless the result is `'popover'`. So a nested subject (→ dock-drill) or a
rich/over-depth one (→ focus-view) is REFUSED — admission is law-derived, not
per-caller taste. The guard uses the SAME primitive, so it can't drift.

**The wired glance path:** the §3.2 nested-item · glance RENAME. `useRowRename`
hook owns the draft/commit/popover; ArrayListScreen shows a `✎` rename button per
row (ONLY when `itemLabel` is defined — a nameless "Item N" has no single property).
Rename writes just the itemLabel field; a LocaleString keeps its other locales
(writes only the active locale via a spread, not writeLocale — no activeLocales
needed), a plain string stays a string. SL-4/SL-5 route the rest.

**Judgment call (flagged):** spec names `studio/EditPopover.tsx`, but `inspector`
is BELOW `studio` (RightDock renders Inspector; FocusView imports
inspector/breadcrumbSlot). No intra-app lint gate enforces layering, and the spec
itself designs inspector/canvas to import `studio/placement` (SL-1). EditPopover
imports only React+MUI+the pure placement kernel (NOT inspector) → no file-level
cycle. Kept in studio/ per spec. IF intra-app layering is ever enforced,
EditPopover + placement/ should move to a shared kernel below both.

**Why extracted `useRowRename`:** NestedItemControl hit the 600-line hard ceiling
(post-edit-laws BLOAT BLOCK) — the rename is its own concern anyway (one-body).

**How to apply:** any future glance micro-edit (recolor, toggle) reuses
`<EditPopover>` with its own control as `children` — do NOT invent a second popover.
Route to it only after `resolveSurface`/`placeSubject` says `'popover'`.

---

## panel overflow escalation sl4
> AR-49 SL-4 — overflow escalation WIRED at the nested-item drill boundary; a workspace-weight subject escalates dock→focus-view via resolveSurface (not hand-placed); one breadcrumb spine; FocusEscalation port + dynamic focus-view target; FF-NO-CRAMMED-DOCK live.

**AR-49 SL-4 — overflow escalation (DONE 2026-07-11, branch feat/ar49-m0-metric-first-authoring, commit follows SL-3 9aa3e12; apps/panel only, arrow held, config byte-identical).** Spec: `SPEC-studio-shell-layout.md` §6 SL-4 + §3.3 (POPOVER→DOCK/DRILL→FOCUS-VIEW). Builds on [[project_placement_law_primitive]], [[project_panel_focus_view_sl2]], [[project_panel_rightdock_zones_sl1]], [[project_panel_editpopover_sl3]].

**What it wires:** the drill boundary now consults the Placement Law before entering a nested subject. A WORKSPACE-weight subject escalates OUT to a focus-view instead of drilling the bounded dock; FORM-weight stays a dock-drill (D7.1b unchanged). Deterministic — the container is `resolveSurface('nested-item', weight)`, never a per-type literal.

**The seam (mirrors breadcrumbSlot — DIP):**
- `inspector/controls/nestedItemPlacement.ts` (PURE) — `schemaSubjectShape(PropSchema)→SubjectShape` (the domain→abstract translation the pure kernel must NOT do), `fieldSubjectShape(field)`, `nestedItemContainer(schema)`, `shouldEscalate(schema)`. Rich types = `{DataSpec, ChartDef}` (the PropFieldType projection of the law's abstract `hasRichType`). Opaque array/object (no itemSchema) counts as ONE flat control.
- `inspector/focusEscalation.tsx` (PORT) — `FocusEscalationContext` + `useFocusEscalation()`. Request = `{ fieldPath, title:{ka,en}, render:(bind:FieldBinding)=>ReactNode }`. `FieldBinding={value,onChange}` is a LIVE store binding the HOST supplies (escalation unmounts the dock, so a captured value would go stale). Null host → in-dock drill (fail-soft, zero D7.1b regression).
- `NestedItemControl.tsx` DrillEditor — `openItem`/`drill` branch: `escalation && shouldEscalate(schema)` → `escalateTo([...steps, step], title)` (escalate) else `setSteps` (in-dock). `escalateTo` builds `render=(bind)=><DrillEditor field id value={bind.value} onChange={bind.onChange} initialSteps={nextSteps}/>` — the SAME DrillEditor rooted at the top-level field, SEEDED with the full drill path (new `initialSteps` prop → `useState(initialSteps??[])`), so the ONE breadcrumb spine (field › item › …) continues in the focus-view. An ARRAY sub-field never escalates on `drill` (its list is form-weight; items escalate on `openItem`); an OBJECT sub-field escalates when workspace.
- `studio/StudioShell.tsx` (HOST) — `[escalation,setEscalation]` + `focusEscalation={escalate:setEscalation}` provided AROUND RightDock only. `escalatedTarget` (useMemo on `[escalation, selectedNode, patchProp]`, NOT `controller.*` — avoids an exhaustive-deps warning) builds `bind={value:getAtPath(sel.props,fieldPath), onChange:next=>patchProp(fieldPath,next)}` LIVE from the store → `makeEscalatedTarget`. Render precedence: escalatedTarget > model focus-view > shell. Back = `setEscalation(null)` (loss-free; selection untouched).
- `studio/focusViewRegistry.tsx` — `makeEscalatedTarget(req,bind)` builds a dynamic `FocusViewTarget` (id `ESCALATED_TARGET_ID`) so the escalated subject rides the SAME shell as static targets. `studio/FocusView.tsx` gained an optional `target?` prop (dynamic wins over `targetId` registry lookup); SL-2 `targetId` usage unchanged.

**Judgment calls (flagged):** (1) `nestedItemPlacement.ts` imports `../../studio/placement` — inspector→studio, nominally against the render direction, but SL-1's design explicitly wires consumers (Inspector, nested-item editor) to call `placeSubject`; placement is a pure kernel meant to be shared. No intra-app lint gate. Consistent with SL-3's EditPopover flag: if intra-app layering is enforced, `placement/` should move to a shared kernel below both. (2) A workspace-weight TOP-LEVEL object field that renders its form on mount (not via a drill) is NOT covered — escalation is wired at the drill boundaries (open item / drill sub-field) where nested-item subjects are entered; a rich SUB-field inside it still escalates via `drill`. (3) NestedItemControl hit the 600-line BLOAT ceiling → extracted pure helpers to `nestedItemControl.helpers.ts` (readAt/writeAt/joinPath/pathToId/fixedSchemaSource/makeDefaultItem/fieldLabel/itemTitle/summarize*).

**No real workspace subject in current metas yet** — all authored itemSchemas are form-weight, so escalation is proven with a REPRESENTATIVE fixture (a DataSpec-bearing item = rich → focus-view). The first REAL escalation lands with SL-5's relocate targets (filters pipeline / chart encoding).

**FFs:** `nestedItemPlacement.fitness.test.ts` (FF-OVERFLOW-DETERMINISTIC I — schema→shape→container == law verdict; rich/deep → focus-view; form → inline/dock-drill) + `nestedItemControl.escalation.fitness.test.tsx` (FF-NO-CRAMMED-DOCK live — workspace item fires escalate + no in-dock form; request carries fieldPath+name; escalated render mounts the seeded editor with a continuous Series › GDP breadcrumb + live binding; FORM item still dock-drills, escalate never fires; fail-soft with null host).

**GATE:** tsc -b apps/panel 0; full panel suite 104 files / 705 PASS (0 fail — StyleSurface.test is a known flake that times out under parallel load, passes isolated); lint 0 errors (2 baseline warnings). All SL-0/0b/1/2/3 + D7.1b FF-NESTED-ITEM-EDITOR preserved.

---

## panel studio ia s1 s4
> SPEC-studio-ia-canonical S1–S4 (owner's felt Studio-IA complaints) — dock purely contextual, palette honest+droppable, per-type filter-bar bridge deleted, chrome canvas-selectable. Non-obvious couplings + residual gaps.

**SPEC-studio-ia-canonical S1–S4 (DONE 2026-07-12, branch feat/ar49-m0-metric-first-authoring,
apps-only except the S4 packages/react anchor).** Every surface a GENERIC projection of the
ADR-041 Part port — no `if type===`. Spec: `docs/architecture/proposals/SPEC-studio-ia-canonical.md`
(S5/S6 are OWNER-SIGN-OFF, NOT done).

**S1 — RightDock purely contextual (`studio/RightDock.tsx`).** DELETED the persistent
`Element|Page` Tabs + the `scopeOverride`/`prevSelKey` peek state. `scope = selKey ? 'element' :
'page'` is now PURELY derived; page-config is reached ONLY by DESELECTING (canvas-bg click →
`onSelect(null)`), never a tab stapled onto an element (owner defect: "page-config out of place").
Header is now `promoted ? <breadcrumb> : <overline>` (one tier, no tab tier). The `no-selection`
empty-state branch is now UNREACHABLE (element scope ⟹ selKey ⟹ selected||chrome) — removed.
Updated `rightDock.fitness` + `dockZones.fitness` (they asserted the tabs) — the tests now assert
overline-XOR-breadcrumb + "deselect IS the page context".

**S2 — palette honest AND droppable (`canvas/NodePalette.tsx` + `insertNode.ts` + `useCanvasController`
+ `CanvasOverlay`).** Two COUPLED halves — a palette-only fix would have shipped a lie (offer a tile
that bounces):
- **Palette projection:** new `pageRootInsertability(pageType, type): 'direct'|'wrap'|'blocked'`
  (insertNode.ts). When NOTHING selected, `NodePalette` filters to `!== 'blocked'` using the new
  `pageType` prop (threaded from `controller.page?.type` via InsertSurface) — the honest
  `page-accepts ∪ wrap-reachable` set, DECLARED from slot `accepts`. Absent `pageType` ⇒ permissive
  page-root (isolated-mount back-compat). Wrap tiles carry a `data-wrap` badge ("adds inside a section").
- **Drop path (the ROOT-CAUSE DRIFT):** `controller.handleDrop` was FORKED off `insertNode.ts`'s
  stated single path — it did raw `insertNode(parentId)` (NO wrap), so a wrap-reachable tile dropped
  at the page root either bounced (overlay `slot.accepts` reject) or made an INVALID tree. Now it
  routes through `resolveInsertPlan(page, parentId===pageId?null:parentId, type)` + `planInserts` +
  `insertNodes` (the SAME path ⌘K uses) → auto-wraps page→section→type, selects the LEAF
  (`ops.at(-1)`). `CanvasOverlay.handleDrop` accept relaxed: `direct || (accepts.includes(AUTOWRAP_
  CONTAINER) && nestAccepts(AUTOWRAP_CONTAINER, type))`. Updated `paletteContextual.fitness` case (c).
  Residual (flagged, per [[project_panel_insert_accept_graph_gap]]): homeless content blocks (hero/
  text/links/…) are OMITTED at page root (blocked) — reachable only inside an added open container.

**S3 — per-type dock bridge DELETED (`inspector/sections/builtins.tsx`).** Removed the
`element.context` section + the whole `studio/nodeContextEditors.tsx` seam (the type-keyed
`{'filter-bar': FilterBarControlsBridge}` map — the ADR-038 anti-pattern). Filter controls are
`sourcedParts`: canvas-selected → `element.schema` projects the ParamNode generically (LIVE-proven
`filterItemSelect.e2e`). Updated `dockSection.test` (dropped `element.context` from the registered
list). **RESIDUAL DEAD CODE (flagged):** `FilterBarControlsBridge.tsx` is now app-UNREFERENCED —
kept ONLY because `filterControlDrill.fitness` (a must-stay-green gate) renders it directly.
**Functional delta:** add/remove/reorder of filter controls from the ELEMENT context is gone, but
RE-HOMED in Page › Filters (`FiltersDrawer`) — no capability loss ("re-homed, never removed").
Recommend removing the bridge component + its gate in a follow-up once nothing needs it.

**S4 — chrome canvas-selectable.** See [[project_panel_canvas_chromeconfig_defect]] PART B (SHIPPED):
`ChromeSlot` authoring-gated `data-canvas-chrome-slot` anchor + overlay chrome frames + `selectChrome`
arm. Only packages/react touch in S1–S4 (dist rebuild).

**GATES:** lint 0 err (58 react-refresh warns baseline); `tsc -b apps/panel`=0 + `tsc -b --force`=0;
vitest panel **121 files / 814 PASS / 0 fail**; packages react+plugins chrome tests pass; e2e
bandItemSelect/filterItemSelect/chromeNavAuthoring/studioRouting/summaryCardInspector all pass.

---

## panel studio ia s5
> SPEC-studio-ia-canonical S5 (collapse the 6-surface Studio rail → canonical Add|Layers navigator + Inspector + top-bar workspaces). Non-obvious couplings (dock-dependency fork, contextual palette move) + gate re-encodings.

**SPEC-studio-ia-canonical S5 DONE (2026-07-12, branch feat/ar49-m0-metric-first-authoring,
apps-only, reversible, NOT committed).** Collapsed the six modal rail surfaces
(`insert·data·layers·pages-site·style·model`) into the canonical set: **Canvas · Left
Navigator (Add|Layers) · Right Inspector · Top bar**. Spec:
`docs/architecture/proposals/SPEC-studio-ia-canonical.md` §3.1. Builds on [[project_panel_studio_ia_s1_s4]].

**BEFORE→AFTER re-home (every surface re-homed, never removed):**
- `insert` → **Add** pane (rail, relabeled `Add`/`დამატება`); `layers` → **Layers** pane. `RAIL_ENTRIES`
  (`studio/rail.ts`) shrank to these TWO. `STUDIO_SURFACES` (`types/constructor.ts`) dropped `data`.
- `data` (MetricPalette) → **DELETED as a surface** (`surfaces/DataSurface.tsx` + test removed);
  metric-bind is now a CONTEXTUAL inspector section `element.data` (`inspector/sections/builtins.tsx`,
  order 20, `appliesTo: wholeNodeSelected && controller.selectedBindable`) — shows the governed
  MetricPalette ONLY when a data-bound element is selected. AR-51 onboard-data CTA re-homed into the
  Add pane (`surfaces/InsertSurface.tsx`, keeps `data-testid=onboard-data-cta`).
- `model` (Data model) → unchanged full-screen FocusView, just REMOVED from the rail; summoned from
  the top-bar Compose⇄Data-model toggle (already existed) + `/studio/model` route (⌘K/deep-link).
- `style` (Theme) + `pages-site` (Site) → DEMOTED off the rail, summoned from NEW/existing top-bar
  icon buttons (`onOpenStyle`/`onOpenSite` → `setSurface`), but kept as **left-dock surfaces**, NOT
  focus-views (see fork below). `SURFACE_HEADINGS` made an EXPLICIT map (not derived from RAIL_ENTRIES)
  so these non-rail dock surfaces keep a visible heading + named landmark.

**THE DESIGN FORK (why Theme/Site are NOT full-screen like Data model):** first cut promoted them to
FocusView workspace targets (registry rows). BROKE two things: (1) the Site workspace hosts
`ChromePalette`, whose selection opens `ChromeInspectorPanel` **in the RightDock** — a focus-view has
NO RightDock, so `chromeNavAuthoring.e2e` (S4 chrome selection) would break structurally; (2) a
full-screen theme editor HIDES the live canvas, killing the "rebrand=data" live-repaint payoff.
Resolution: `WORKSPACE_SURFACES` (StudioShell) maps ONLY `model→data-model` to a focus-view; Theme/Site
render in the left dock (canvas+inspector stay visible), summoned from the top bar. Reverted the
`theme`/`site` focusViewRegistry rows. The task's "fold into top-bar workspace" is satisfied WITHOUT
full-screen.

**FITNESS GATE RE-ENCODINGS (invariant preserved, mechanism moved off the rail):**
- `dataModelReachable.fitness` + `roleIsLens.fitness` + `StudioShell.test`: the "Data-model reachable
  in any lens" proof moved from the RAIL button to the TOP-BAR (`banner`) 'Data model' button;
  structural anchor changed from `RAIL_ENTRIES.some(id==='model')` to
  `FOCUS_VIEW_TARGETS` contains `data-model`.
- `bootComposition.test`: it used `/studio/data` to mount the palette; now seeds a bindable **chart**
  node (top-level `data.query.measure` enum-ref → `isMetricBindable` true; kpi-strip's metric is
  NESTED in `items[]` so kpi is NOT top-level bindable) + selects it (`selection:{nodeId}`) so the
  inspector Data section mounts the palette. apexcharts is externalized in panel vitest → a chart node
  is jsdom-safe.
- e2e: `boot`/`steward`/`a11y` select the seeded chart (`CHART_NODE_ID`, Layers outline) to reveal the
  palette instead of clicking rail 'Data'; `boot` scopes the bind-announcement to
  `palette.getByRole('status')` (multiple aria-live regions coexist in the inspector context — plain
  `page.getByRole('status')` is strict-mode-ambiguous). `chromeNavAuthoring`/`dataModelReachable`/
  `dataFlowVisible` re-point their reach to the top-bar button.

**GATES:** lint 0 err (58 warn baseline); `tsc -b apps/panel`=0 + root `tsc -b --force`=0; panel vitest
**120 files / 815 pass / 0 fail**; e2e studioRouting(4)+boot(2)+chromeNavAuthoring+steward+
dataModelReachable+dataFlowVisible+filterItemSelect+bandItemSelect+summaryCardInspector all GREEN.
apps-only (no packages/* touched → no dist rebuild).

---

## panel studio shell m12
> AR-49 Studio shell — M1.2 scaffold + M1.3a/b (wizard deleted) + M1.4 DONE (writable brand editor, Strata skin, themeVars live-preview, TokenCatalogViewer, TopBar regions, FF-CHROME-TOKEN-DRIVEN); IA, useCanvasController seam

AR-49 M1.2 (branch feat/ar49-m0-metric-first-authoring) built the **Studio authoring
shell** as an ADDITIVE, flag-gated alternative to the 3-step wizard. Spec:
`docs/architecture/proposals/SPEC-authoring-reconception-M1.md` (§8 phasing). Wizard is
UNTOUCHED and remains the default (Strangler). All new code is `apps/panel/src` only —
arrow untouched (Law 3).

**Feature flag — REMOVED in M1.3b.** Was `src/config/flags.ts` `studioShellEnabled()`
(localStorage `statdash.studioShell` over env `VITE_STUDIO_SHELL`). Deleted at commitment
(clean removal — git is the rollback, nothing left to toggle to). `App.tsx` now mounts
`<StudioShell/>` (lazy) UNCONDITIONALLY — no branch. `config/flags.ts`, `flags.test.ts`,
`App.studioFlag.test.tsx`, and the `VITE_STUDIO_SHELL` entries in `.env.example`/`vite-env.d.ts`
are gone. New boot test: `App.boot.test.tsx` (asserts App boots straight into the Studio).

**Shell structure** (`src/studio/`): CSS-grid `StudioShell.tsx` with 5 landmark regions —
`StudioTopBar` (header/banner: wordmark "Strata", page switcher, ⌘K, relocated
`PageWorkflowBar`, logout), `ActivityRail` (nav: icon buttons from `rail.ts` RAIL_ENTRIES),
left dock (aside: the summoned surface), canvas (main: the REAL lazy `CanvasView`,
always-mounted home), `RightDock` (aside: selection-contextual Inspector), bottom
(contentinfo: page tabs). Rail→surface map: Insert=NodePalette+ChromePalette,
Data=MetricPalette(primary)+Advanced disclosure(ShowMe), Layers=OutlineTree,
Pages&Site=identity+nav (thin), Style=read-only token viewer, **Model=LOCKED disabled slot
(M2)**. Store: added `activeSurface`/`setSurface` + `useActiveSurface` selector +
`StudioSurface`/`DEFAULT_STUDIO_SURFACE` type — ADDITIVE to the wizard slice (activeStep/
completedSteps stay until M1.3 deletes them); preserved across undo/redo.

**Key reuse seam — `src/studio/useCanvasController.ts`:** the canvas↔store glue
(bindMetric/handleDrop/patchProp/setVisibleWhen/deleteSelected + dragging &
previewPerspectiveId view-state) EXTRACTED from PageStep's inline closures, built from the
SAME shared primitives (nodeSchemaSource/metricBinding/setAtPath/makeNode + store actions).
Byte-identical writes. PageStep keeps its inline copy (frozen) until M1.3 deletes the
wizard and points the surviving canvas here. This is the DRY seam — don't re-fork it.

**Token-driven chrome:** `StudioShell.tsx` imports `@statdash/styles/css/index.css` (the
FIRST time the panel loads the DTCG token layer — the wizard never did). Resolves via the
`@statdash/styles`→packages/styles/src alias in BOTH vite.config + vitest.config. Kept in
the StudioShell lazy chunk (not main.tsx) so the wizard path never pulls it. `studio.css`
reads only `var(--color-*/--spacing-*/--font-*)` — NO hardcoded brand literals (sets up
M1.4 FF-CHROME-TOKEN-DRIVEN + the Strata preset).

**Thin adapters flagged for M1.3** (scaffold, not forks): DataSurface Advanced = ShowMe
only (full source/spec/DataSpecEditor/Excel relocation is M1.3); PagesSiteSurface nav
reorder + real "+add page" (still the `notify('coming')` stub) are M1.3; StyleSurface
writable themeOverrides editor is M1.4.

**M1.3a DONE (2026-07-09, ADDITIVE — wizard NOT deleted, flag NOT flipped; M1.3b awaits
owner):** relocated the last wizard-only capability via EXTRACT-AND-DELEGATE (not fork —
the DRY seam the brief mandates). New shared components consumed by BOTH the wizard step
and the Studio surface: `features/data-layer/DataModelingPanel.tsx` (the full source/spec
browser+editor lifted from DataStep; container-query responsive via
`data-modeling-panel.css` — 2-col in the wide step, stacked in the 300px dock) and
`features/site/{SiteIdentityEditor,NavEditor}.tsx` (lifted from SiteStep; NavEditor takes
`onAddPage` so the wizard keeps its stub while Studio wires real create). DataStep/SiteStep
are now THIN frames (header+waterfall-gate) around the shared bodies — behavior
byte-identical. `DataSurface` mounts DataModelingPanel LAZY under the Advanced accordion
(only on expand — keeps the 60kB data-layer chunk out of the eager 12.7kB StudioShell
chunk). `PagesSiteSurface` = SiteIdentityEditor + NavEditor + lazy `PageBrowser` for real
"+add page" (done⁺, exceeds wizard stub). StyleSurface stays read-only (parity; writable =
M1.4). RightDock/TopBar/Insert/Layers already fully covered PageStep in M1.2 — no work
needed. Parity checklist: `docs/architecture/proposals/M1.3-parity.md` (no
wizard-deletion boundary hit). GATE: tsc 0, eslint 0, panel vitest 65 files/421 tests PASS
(added DataModelingPanel/DataSurface/PagesSiteSurface tests = +3 files/+11), vite build OK.

**Test gotchas:** (1) App defaults to `ka` locale (site.activeLocales empty → falls back to
ka) so rail aria-labels are Georgian in App-level tests; seed `updateSite({defaultLocale:
'en',activeLocales:['en']})` for English assertions (StudioShell.test does this). (2) A
test that lazy-loads StudioShell via `<App/>` needs a generous `findBy` timeout (~20s) —
vitest transforms the whole subsystem graph on first dynamic import. (3) Render StudioShell
with NO active page (default store) to keep the always-mounted canvas in its no-page state
and avoid the heavy lazy CanvasView mount. (4) MetricPalette search box: query
`getByPlaceholderText('ძებნა…')` (no `searchbox` role). See
[[project_panel_m0_boot_gaps]], [[project_panel_live_canvas]], [[project_semantic_token_spine]].

**M1.3b DONE (2026-07-09 — COMMITMENT step, owner-authorized; reversible via git):**
DELETED `features/wizard/*` entirely (ConstructorWizard, WizardStepper, index.ts,
steps/{DataStep,SiteStep,PageStep}) — every remaining export was wizard-only (grep-confirmed;
the shared bodies `features/site/*` + `features/data-layer/DataModelingPanel.tsx` survive,
they live OUTSIDE features/wizard by design). Removed the flag machinery (above). Removed
the dead wizard-only store state: `WizardStep` type, `WIZARD_STEPS`/`WizardStepMeta`
(types/constructor.ts); `goToStep`/`markStepDone` actions + `activeStep`/`completedSteps`
init + their undo/redo-preserve lines (constructor.store.ts); `useWizardStep`/
`useCompletedSteps` selectors. Renamed the slice `WizardSlice → StudioUiSlice`
(constructor.history.ts) — it now holds only `activeSurface`/`selectedNodeId`/`chromeSelection`.
PageStep's inline canvas closures died WITH the wizard; the surviving Studio canvas uses
`useCanvasController` (the DRY seam M1.2 extracted) — so no re-fork was needed. Writes/undo-redo
intact. NOTE: PageStep still had its own inline canvas copy (never migrated to the controller)
— deleting the wizard simply removed that frozen duplicate, exactly as the M1.2 plan intended.

**GATE (M1.3b, 2026-07-09):** tsc -b apps/panel = 0; eslint = 0 errors (2 pre-existing
accepted warnings: useLivePreviewStores, DsdVersionPanel); vitest panel = 64 files / 416
tests PASS (incl. boot smoke + boot-parity + mainI18nInit + the new App.boot). Provable
only live: the Studio against a running api+db (MetricPalette population).

**M1.4 DONE (2026-07-09 — writable brand editor + Strata skin; additive, reversible):**
The read-only StyleSurface became a WRITABLE brand-token editor.
- **Live-preview mechanism (was MISSING entirely):** `themeOverrides` was stored + saved
  (api-actions) but NEVER applied to the DOM — no theme code existed. Built it in
  `studio/themeVars.ts`: `buildThemeVars(...layers)` maps tokenKey→value layers to an inline
  custom-property style object, using `TOKENS_CATALOG[key].cssVar` (self-describing, Law 8 —
  new token previewable, zero code). StudioShell applies
  `buildThemeVars(STRATA_PRESET, site.themeOverrides)` as `style=` on the `.studio-shell`
  root; chrome AND the live canvas descend from it, custom props inherit → an edit repaints
  BOTH on next render. THE data flow: store.site.themeOverrides → shell inline vars → cascade.
- **Strata preset = PURE DATA in the app (NOT packages/styles):** `studio/strata-preset.ts`
  `STRATA_PRESET: Record<tokenKey,cssValue>` (accent azure #14508C family + teal secondary
  #2A9D8F + navy heading #0B2E52 + radii.card 10px). Deliberately app-scoped: tokens.css is
  brand-NEUTRAL by design (a consumer rebinds role values); the panel is one such consumer.
  It is the base skin layer; themeOverrides overrides it live → owner "retunes Strata" by
  writing overrides, reset falls back to Strata. Brand hex lives ONLY here (data).
- **TokenCatalogViewer.tsx** — the ONE reusable catalog-grouping/editor (kills the M1.3a
  observation-(a) duplication). Controlled (value/defaults/onChange/onReset), groups
  TOKENS_CATALOG, per-token control by `descriptor.group` (color→native swatch + text,
  else text), reset-per-token, bilingual labels. Scoped by `BRAND_TOKEN_GROUPS`
  (color/font-*/radii) — Refine lens (M3) drops the filter for the exhaustive editor.
- **TopBar regions filled (observation (b)):** locale PREVIEW toggle (ephemeral useState
  override in StudioShell, reuses useActiveLocales — no persist) + brand/theme IconButton
  → setSurface('style'). StudioTopBar signature grew: locales/onLocaleChange/onOpenStyle.
- **FF-CHROME-TOKEN-DRIVEN + FF-THEME-EDIT-DATA:** `studio/chromeTokenDriven.fitness.test.ts`
  scans the chrome FRAME (studio.css + StudioShell/StudioTopBar/ActivityRail/RightDock) for
  brand literals (hex/rgb/hsl, comments stripped) — editor CONTROLS (TokenField swatch
  #8896a5 neutral) are out of scope by design. Loads sources via `import.meta.glob('?raw')`
  (panel tsconfig has NO @types/node — do NOT use node:fs in panel tests). Planted-literal
  test proves it bites. FF-THEME-EDIT-DATA: STRATA_PRESET all-string, all real catalog keys.
- **GATE (M1.4, 2026-07-09):** eslint studio = 0; tsc -b apps/panel = 0; vitest panel =
  69 files / 441 tests PASS (+5 files / +25 vs M1.3b). packages/styles NOT touched (no styles
  build needed). MetricPalette *population* still provable only live (api+db).
- **Brand choices to flag for owner:** the Strata hex values (azure #14508C / teal #2A9D8F /
  navy #0B2E52 / radii.card 10px) are my design call for "institutional trust × modern
  clarity" — retunable live in the editor.

**M2.0 (Steward role lens) DONE — see [[project_panel_studio_m2_role_lens]].**

---

## panel studio m2 role lens
> AR-49 M2.0+M2.1+M2.2 — Steward role LENS (useRole seam, FF-ROLE-IS-LENS) + M2.1 modeler relocated + M2.2 in-tool metric AUTHORING (studio/model/*, semanticCatalog store, saveSemanticCatalog live loop, FF-CATALOG-EDIT-SAFE/ONE-SSOT/AUTHORING-SERIALIZABLE/ID-IMMUTABLE).

> ⚠️ SUPERSEDED (2026-07-11, SL-2): Model mode is NO LONGER a "summonable left surface … never a route" — it re-homed onto the Focus-View SEPARATE SCREEN (`activeSurface==='model'` now routes to `<FocusView>` in place of the whole shell grid). Entry plumbing below (top-bar switch, rail entry, ⌘K, effectiveSurface projection) is UNCHANGED — only the container moved. See [[panel-focus-view-sl2]].

> ⚠️ SUPERSEDED AGAIN (2026-07-11, AR-50 M5b — commit bb7a74c): role now splits CONTENT, not VISIBILITY. `stewardOnly`+`visibleRailEntries` GONE; `model` rail entry ALWAYS visible. Nav decoupled from identity — entering the destination is pure `setSurface('model')`, never `setRole`. Full new-state + gotchas: [[panel-data-model-reachable-m5b]]. So M2.0 detail below ("Model ABSENT in author", "exactly one stewardOnly entry", enter/exit `setRole`, effectiveSurface projection, StudioShell as the one useRole call site) is FALSE now.

**UX DEFECT FIX — one-action Data-model workspace switch (DONE 2026-07-10, same branch, commit ce4ee1b; apps/panel-only, arrow held).**
The M2.0 discoverability defect: reaching metric authoring took TWO clicks on TWO look-alike
"Model" controls (top-bar toggle that only flipped the invisible lens → then a second identical
"Model" rail icon that silently appeared bottom-left, the only one that opened the surface).
Fix adopts the Framer/Webflow "design ⇄ build" pattern:
- **StudioTopBar** — the old `onToggleRole` "Model mode" `<Button>` is REPLACED by a segmented
  `<ToggleButtonGroup>` Compose | Data model switch (SchemaOutlined + DashboardCustomizeOutlined;
  props now `onOpenDataModel`/`onExitDataModel`). Selecting "Data model" is ONE action; current
  workspace = selected segment (aria-pressed). No longer a `HubOutlinedIcon`/"Model" twin of the rail.
- **StudioShell** — composes `enterDataModel = setRole('steward') + setSurface('model')` and
  `exitDataModel = setRole('author')` via `useSetRole` (dropped `useToggleRole`). FF-ROLE-IS-LENS held.
- **rail.ts** — `model` entry relabeled "Model" → **"Data model"** ({ka:'მონაცემთა მოდელი'}); this is
  the SURFACE_HEADINGS SSOT so the dock heading follows. GOTCHA: StudioShell.test regexes were
  `/Model/` (case-sensitive) → broke on lowercase "Data model"; use `/Data model/`.
- **ModelSurface.tsx** — now focuses its region on mount (`role="group"` "Data model workspace",
  tabIndex=-1) so focus lands in the opened surface (WCAG 2.4.3).
- **⌘K seam NOW BUILT** (was DEFERRED below): `commandModel.workspaceCommands()` emits an
  always-available `action:'open-data-model'` command (kind 'action', keywords metric/define/…);
  `useCommandRunner` handles it BEFORE the `!page` guard via `useSetRole`+`setSurface`. In
  `buildCommands` full mode only (not slash-insert).
- GATE: tsc 0, eslint 0 err, vitest panel **87 files / 556 PASS / 0 fail**. (Note: lines ~97-102
  below describing the "Model mode" toggle + "⌘K DEFERRED" are now SUPERSEDED by this section.)

---

**M2.2 — in-tool metric AUTHORING (DONE 2026-07-09, same branch; apps/panel-only, arrow held).**
The headline: a Steward defines a governed metric in Model mode; it saves to site_config
and appears in the Author's MetricPalette with NO reload. All new code under
`apps/panel/src/studio/model/`:
- **semanticCatalog.store.ts** — editable working copy (`ManifestMetric[]`/`ManifestDimension[]`,
  the WIRE shape), lazy `ensure()` from `fetchCatalogManifest()` (same /api/bootstrap channel
  bootstrapCatalog uses), upsert/remove by id + `dirty`. SEPARATE from `discovery/metricCatalog.store`
  (that = READ palette projection of the engine registry/describeApp; this = authoring copy).
  FF-CATALOG-ONE-SSOT means one PERSISTED catalog, not one in-memory store.
- **saveSemanticCatalog.ts** — the loop: `configApi.site.update({metrics,dimensions})` (PUT
  /api/config/site is a per-KEY upsert → targeted, saveSite untouched, ISP) → `applyCatalogLive`
  = registerManifestMetrics/Dimensions + `useMetricCatalogStore.invalidate()` → palette re-reads
  describeApp. Fail-soft (403→forbidden). GOTCHA: registerMetrics is last-write-wins with NO
  unregister, so CREATE/EDIT are live but DELETE only clears from palette after reload (flagged).
- **metricDraft.ts** (pure) — `formatKeyOptions()` from LIVE `FORMATTERS` registry keys (FormatKey
  is NOT exported from core; use the registry — Law 8 zero-code extend); `draftFromMeasure` unit
  pre-fill from CubeResolvedUnit; slug id rules.
- **metricValidation.ts** (pure, FF-CATALOG-EDIT-SAFE) — code∈profile.measures, dims keys∈dimensions,
  members real; legal immutable id, unique-on-create, required label; profile-null → WARNING not error.
- **metricImpact.ts** (pure) — reverse index via schema-driven `metricRefFields`+`getAtPath` (NOT a
  naive string scan; inject `nodeSchemaSource.getSchema`).
- **MetricEditor.tsx** — pick dataset(cubeApi.datasets)→measure(cubeProfile.store)→govern; id DISABLED
  on edit (FF-ID-IMMUTABLE). **MetricCatalogManager.tsx** — list+editor host+impact banner+delete-guard.
  Wired into ModelSurface region 1 (above the relocated DataModelingPanel).
- **WIRE-CONTRACT FINDING (Observation Duty):** `agg` and `description` are MetricDef fields but NOT
  ManifestMetric fields, and `registerManifestMetrics` does NOT map them → authoring them = DEAD data
  (dropped at boot seam). OMITTED from the editor; need contracts+engine change to author (out of scope).
  Spec §4.1 lists agg but §5.2's "carries every field" omits it — internal spec contradiction.
- **DEFERRED:** calc/derived editor (M2.5, disabled placeholder seam) + dimension authoring (M2.4 —
  store preserves existing dimensions through save).
- **GATE:** eslint apps/panel/src 0 err (2 pre-existing warnings), tsc -b apps/panel 0, vitest panel
  **84 files / 516 PASS** (+8 files: metricDraft/metricValidation/metricImpact/semanticCatalog.store/
  saveSemanticCatalog/MetricEditor/MetricCatalogManager/catalogAuthoring.fitness). e2e NOT run —
  playwright package unresolvable in this worktree's node_modules (only browser caches present); loop
  proven at vitest integration level. ModelSurface.test findByText bumped to 20s (eager graph grew).

---

**M2.1 — relocate the modeler (DONE 2026-07-09, same branch).** ModelSurface is now REAL:
`surfaces/ModelSurface.tsx` lazy-mounts the SHARED `features/data-layer` `DataModelingPanel`
(no fork — Strangler host-swap) under a synchronous bilingual Steward caption ("Define the
governed data model…"). `DataSurface.tsx` STRIPPED of the "Advanced" Accordion/lazy/Suspense →
now MetricPalette only (author lens = governed nouns, no query cliff). Author who needs to model
flips the M2.0 lens → Model surface (same live canvas). Metric Editor is still M2.2 (NOT built).
New FF: `studio/authorNoQuery.fitness.test.ts` (FF-AUTHOR-NO-QUERY) — raw-globs `./surfaces/*.tsx`,
strips comments FIRST (DataSurface prose now names DataModelingPanel), asserts no author surface
references DataModelingPanel/DataSpecEditor/Query|Pivot|Transform|GrowthEditor/`features/data-layer`;
excludes the single `stewardOnly` surface (ModelSurface), anchored to RAIL_ENTRIES. Tests: rewrote
DataSurface.test (palette present + modeling machinery ABSENT), new ModelSurface.test (caption sync +
lazy DataModelingPanel mounts + reads store), updated StudioShell.test Model-caption assertion.
GATE: eslint 0 err, tsc -b apps/panel 0, studio+data-layer 21 files/104 PASS, boot smoke/composition/
i18n/App.boot 6 PASS, **Playwright e2e boot.e2e.ts 2/2 PASS** (offline bridge — author boot still
renders populated MetricPalette + binds a metric, no crash). e2e bridge gotcha: shim `@playwright/test`
→ cache `705bc6…`, but `node_modules/playwright` junction → cache `361ceb…` (TWO 1.61.1 copies →
"two versions" error); run CLI from the SHIM's cache: `node <705bc6…>/playwright/cli.js test boot.e2e.ts`.

---

AR-49 **M2.0 — the Steward role LENS** DONE (2026-07-09, branch
feat/ar49-m0-metric-first-authoring; additive, reversible, zero regression). Spec:
`docs/architecture/proposals/SPEC-authoring-reconception-M2.md` §2/§9. **M2.0 ONLY** —
modeler relocation = M2.1, Metric Editor = M2.2 (NOT built here). All work in
`apps/panel/src/studio` (arrow held, packages/ untouched). Builds on [[project_panel_studio_shell_m12]].

**`studio/useRole.ts` — THE swappable seam (the load-bearing decision).** `type
Role='author'|'steward'`. Source = tiny zustand `persist` store, localStorage key
`statdash.role`, default `author`; exported as `useRoleStore` FOR TESTS ONLY (UI must not
touch it). `useRole()` = the SINGLE reader; `useToggleRole()`/`useSetRole()` for mutation.
Heavy doc comment: NOT a security/enforcement boundary — a user CAN flip the toggle;
`role==='steward'` is NOT proof of authorization. Rebind the `useRole()` BODY to a JWT/auth
claim later (AR-30) without touching a single consumer — that's the preserved-not-built seam.

**M2.0 mechanics (rail `stewardOnly`/`visibleRailEntries` visibility gate, StudioShell as
the one `useRole` reader, `effectiveSurface` role-projection, the top-bar `role`/`onToggleRole`
toggle) are SUPERSEDED by AR-50 M5b — see the banner + [[panel-data-model-reachable-m5b]].**
Still current from M2.0: `useRole.ts` seam (default author, `useRoleStore` for tests only,
rebind body to a JWT claim later); FF-ROLE-IS-LENS `studio/roleIsLens.fitness.test.ts`
(raw-glob `?raw`, comments stripped; no consumer reaches `useRoleStore`/`statdash.role`; no
consumer gates UI on an auth/tenant primitive — `logout` is a session action, allowed).

---

## panel data flow spine m43
> AR-49 M4.3 Move 3 — Data-Flow Spine makes pipelines VISIBLE; a projected flow map (source→spec→metric→used-by) is the Model-stage home; one component, two lenses (steward interactive / author read-only); FF-FLOWMAP-IS-PROJECTION.

AR-49 **M4.3 · Move 3 — Data-Flow Spine (pipelines visible)** DONE 2026-07-11, branch
feat/ar49-m0-metric-first-authoring, commit **593eac2**; apps/panel-only, arrow held.
Design SSOT: `docs/architecture/proposals/SPEC-worldclass-authoring-ui.md` §3.3 + §2 row E.
Closes the owner's repeated "pipelines STILL not visible" (Metabase admin-burial mistake).
Builds on [[panel-data-model-reachable-m5b]] (the role-lens content split) + [[project_placement_law_arc]].

**What shipped — a projected flow map, the Model-stage HOME:**
- **`studio/model/dataFlow.ts`** (pure, tested) — `projectDataFlow({metrics, pages, getSchema,
  dataSources, locale, query?}) → DataFlowModel`. Projects `source → dataset/spec → metric →
  used-by` from registries we ALREADY own (Law 2, no stored graph — `FF-FLOWMAP-IS-PROJECTION`):
  - source = metric `dataSource` storeKey, grouped; joined to the Layer-1 `DataSourceDef`
    registry (`useDataSources`) for kind (`type`) + connection `status` badges when the id matches;
    un-sourced metrics fall into one `UNSOURCED_ID='—'` bucket, ordered LAST.
  - spec = base metric's SDMX `code`(s); derived metric's `calc` INPUT measure refs.
  - metric = governed noun + unit/methodology/calc/additivity badges (Law 9).
  - used-by = `computeMetricImpact` (the SAME reverse index the metric editor's governance banner
    uses — one truth). 0 blocks ⇒ surfaced "not yet used" dead-end candidate (`unusedMetrics`).
- **`studio/model/DataFlowMap.tsx`** — legible left-to-right flow, grouped by source; each metric a
  grid flow-row (spec-chips → metric cell → used-by chip) with decorative aria-hidden arrows.
  Keyboard-navigable, bilingual, fail-soft (idle/empty/error). Testids: `data-flow-map`,
  `flow-source-<id>`, `flow-metric-<id>`, `flow-open-<id>` (interactive only), `flow-usedby-<id>`.
- **ONE component, TWO lenses** (SPEC §3.3 "not two surfaces"): the SINGLE `onOpenMetric?` prop is
  the whole split. Steward `ModelSurface` passes it (map click opens that metric's editor in the
  MetricCatalogManager below — never a dead end); author `DataDictionarySurface` omits it →
  read-only. Component imports NOTHING from `features/data-layer` → FF-AUTHOR-NO-QUERY stays green
  even though the author surface imports it.

**Wiring seams:**
- `MetricCatalogManager` gained `openRequest?: {id, token}` (`MetricOpenRequest`). Consumed via
  React's RENDER-PHASE "adjust state on prop change" pattern (stores `seenToken`), NOT a useEffect —
  the `react-hooks/set-state-in-effect` rule is an ERROR here; a synchronous setState-in-effect
  fails lint. The token (monotonic) lets a repeat click on the same metric re-open; the
  `status==='ready'` guard handles the async catalog-load race (fires on the render that turns ready).
- `ModelSurface`: flow map is **Region 0** (home/orientation) above MetricCatalogManager +
  DataModelingPanel; `openMetric(id)` bumps the token.
- `DataDictionarySurface`: read-only flow map inserted at top of the ready block; **retired the
  standalone "Sources" chips section** (the flow's origin column subsumes it — owner's "no
  scattered/duplicated" mandate). Its test's `dict-source-*` asserts → `flow-source-*`.

**GATE:** tsc -b apps/panel 0 (mine; note the shared worktree had Move-1's untracked
`inspector/summaryCard.fitness.test.tsx` failing tsc on missing node:fs/path/process types — NOT
mine, flagged); eslint 0; vitest studio/model+surfaces+fitness **71 PASS**; **Playwright
`e2e/dataFlowVisible.e2e.ts` 1 PASS live in Chromium** (author sees the read-only map with both
sources + all governed metrics; steward click on `flow-open-gdp.current` opens the editor).

**GOTCHAS (reusable):**
- Run panel e2e with **`cd apps/panel && pnpm exec playwright test <file>`** — `node
  ../../node_modules/playwright/cli.js test <file>` hit the "two versions of @playwright/test /
  did not expect test.beforeEach()" error for a NEW spec (supersedes the M5b note that the raw
  cli.js worked). Rebuild `packages/*/dist` first (`pnpm -r --filter "./packages/*..." run build`).
- Playwright webServer boots on **:5173** (not the owner's manual :3013) — same real Vite bundle.
- MetricEditor emits benign MUI "out-of-range value for select" console warnings when opened in the
  e2e (its code/dataSource selects have no options in the mock cube profile) — warnings, not errors;
  the `pageerror` guard does not trip.

---

## panel data model reachable m5b
> AR-50 M5b — data-model destination made first-class/always-visible + read-only Data Dictionary (author lens); role splits CONTENT not visibility; FF-DATA-REACHABLE; Playwright substring-name + stale-dist gotchas.

AR-50 M5b — "built ≠ buried" (G6). DONE 2026-07-11, branch feat/ar49-m0-metric-first-authoring, commit **bb7a74c**; apps/panel-only, arrow held. Supersedes the visibility-gate half of [[panel-studio-m2-role-lens]]; builds on [[panel-focus-view-sl2]].

**The problem:** the whole data-model capability was unreachable from a DEFAULT author session — the `model` rail entry was `stewardOnly` (hidden) and the only entry (`enterDataModel`) FLIPPED the author to steward AND dropped them into the raw query modeler. So "reachable" existed only by escalating into the query cliff.

**The fix — decouple NAVIGATION from IDENTITY; split CONTENT, not visibility:**
- **`rail.ts`** — removed `stewardOnly` field + `visibleRailEntries`. `model` entry is ALWAYS in the flat rail. `ActivityRail` lost its `role` prop (maps `RAIL_ENTRIES` directly).
- **`studio/DataModelBody.tsx`** (NEW) — the destination BODY: ONE predicate `role==='steward' ? <ModelSurface/> : <DataDictionarySurface/>` + an in-place lens toggle (`Browse` ⇄ `Edit (Steward)`, `useSetRole`). This is now the **SOLE mount site of ModelSurface** (the focus-view registry renders `<DataModelBody>`, not ModelSurface directly). Kept out of `surfaces/` so FF-AUTHOR-NO-QUERY (globs `./surfaces/*.tsx`) doesn't scan it, and out of `focusViewRegistry.tsx` to avoid the react-refresh only-export-components warning (registry exports data/functions).
- **`surfaces/DataDictionarySurface.tsx`** (NEW) — read-only dbt-docs-grade view: reads `useMetricCatalog()` (the runner-identical `describeApp()` projection) + `readCatalogLabel`; renders Sources (derived dataSource groups) + Metrics (grouped, w/ provenance: id/code/format/methodology) + Dimensions. NO bind/edit/drag, NO query machinery. In `surfaces/` so FF-AUTHOR-NO-QUERY scans + guards it. Focuses region on mount (WCAG 2.4.3).
- **Entry = pure nav** — rail entry, top-bar switch, ⌘K `open-data-model` all just `setSurface('model')`, never `setRole`. `StudioShell` no longer reads role (`useRole`/`useSetRole` removed); `effectiveSurface` role-projection removed (`activeSurface` used directly). `StudioTopBar` prop `role` → `dataModelActive: boolean` (switch reflects the active SCREEN, not the lens). `useCommandRunner` dropped `useSetRole`.
- After my change **role affects ONLY the data-model destination body** — the compose shell (rail/surfaces/palette) is role-independent; a steward in compose sees exactly what an author sees.

**Fitness (canon preserved, re-anchored off the removed `stewardOnly`):**
- **FF-DATA-REACHABLE** (NEW) — `studio/dataModelReachable.fitness.test.tsx` (jsdom, renders real StudioShell from the documented default session: rail entry present → one click → focus-view → `data-testid=data-dictionary` present, modeler caption absent, role still author) + **`e2e/dataModelReachable.e2e.ts`** (the LIVE Chromium leg — the brief's real DoD).
- **FF-AUTHOR-NO-QUERY** re-anchored: instead of "exactly one `stewardOnly` rail entry", assert ModelSurface is the SOLE surface whose source matches the machinery regex (every other surface, incl. the Dictionary, is clean).
- **FF-ROLE-IS-LENS** re-anchored: "role splits content not visibility" — no RailEntry has `stewardOnly`; the split predicate `role==='steward'` + `DataDictionarySurface` live in `DataModelBody.tsx`.
- **FF-MODEL-IS-FOCUSVIEW** updated: "ModelSurface imported ONLY via `/DataModelBody.`" (was `/focusViewRegistry.`); target body `el.type.name` is now `DataModelBody`.

**GATE:** `tsc -b apps/panel --force`=0; **vitest panel 109 files / 737 PASS / 0 fail** (the 4 pre-existing FF-STRATA-CONTRAST failures the brief warned of were already green — likely fixed by prior commit 0969c7d); `eslint .`=0 err (2 pre-existing warnings, none mine); **Playwright e2e 4 PASS / 1 skip (a11y, pre-existing axe self-skip)** live in Chromium.

**TESTING GOTCHAS (reusable):**
- **Playwright `getByRole({ name })` is SUBSTRING+case-insensitive by default** (unlike Testing Library's byRole name = exact). Adding the always-visible "Data model" rail entry silently broke `boot.e2e`/`a11y.e2e` where `{ name: 'Data' }` now matched "Data model" too. Fix: scope rail clicks to `getByRole('navigation', { name: 'Studio surfaces' }).getByRole('button', { name: 'Data', exact: true })`. Note a PRE-EXISTING collision too: after a chart node is selected the RightDock Inspector renders a prop-group toggle whose accessible name is exactly "Data" — so even `exact:true` is ambiguous unless rail-scoped.
- **RTL `getByRole('button', { name })` with a STRING is EXACT** — so `{ name: 'Data' }` there does NOT match "Data model"; only the `/Data/` REGEX variant does. The vitest breakages were all `new RegExp(name)` / `/Data/` loops → switch to string names.
- **Running panel e2e needs FRESH `packages/*/dist`** — the Vite dev server imports built dist; a stale dist (here `packages/expr/dist` missing a `parseFormula` export) white-screens the app and every spec fails at the banner assertion. Rebuild first: `pnpm -r --filter "./packages/*..." run build`.
- **Playwright CLI invocation that works in this worktree now:** `cd apps/panel && node ../../node_modules/playwright/cli.js test <name>` (the `.bin/playwright` shim isn't linked; `npx/pnpm exec playwright` fail with "not recognized"). The older junction/shim bridge in [[project-panel-playwright-e2e]] is no longer needed — the project-local `node_modules/playwright/cli.js` resolves.

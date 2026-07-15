# BLUEPRINT — the whole-panel canonical re-lay (`apps/panel`, the Constructor)

**Commissioned by:** owner ("re-lay the ENTIRE panel as ONE coherent, canonical, non-programmer system; I need to go through EVERYTHING as a whole, not a narrow slit"). This is the WHOLE-panel IA, not an element list.
**Anti-circle contract (binding):** the object model is SETTLED — **ADR-041/042 stand verbatim, not re-opened.** Nothing here is a new grammar or a 52nd vision. Every move below is either (a) **re-homing an existing surface** (no new component) or (b) **already-routed work** (PLANE = W3/PM-B; honest canvas = W1; metric-first = W2; composition seam = audit GAP G1). The re-lay is the **coherent whole-ordering of settled work under ONE IA** — this doc's only new content is the IA and the sequence. This IS ROADMAP **H1 made real** (a non-programmer authors end-to-end); it maps to the roadmap, it does not fork it.
**Grounded in:** the live panel (`platform/work/authoring-truth/03-studio.png`, `04-node-selected.png`, `07-model.png`), `StudioShell.tsx` / `StudioTopBar.tsx` / `RightDock.tsx` / `ActivityRail.tsx` (the real region skeleton), the prior audit `audit/DEEP-2026-07-15-panel-quality.md`, and the non-programmer builder reference class (Retool · Builder.io · Webflow · Framer · Notion · Looker/Studio).

---

## 0. The diagnosis in one line

The panel already HAS the six regions the reference class uses (top / rail / left panel / canvas / inspector / bottom). It is not the skeleton that fails the non-programmer — it is that **the four moments are not legible in it**: DATA is hidden behind a whole-screen top-bar switch (feels like leaving the tool), PUBLISH is a strip squeezed mid-top-bar, REFINE leaks the system plane as raw JSON, and every capability has 2–3 doors. The fix is not new regions — it is to **re-cast the existing regions as the four moments, promote DATA to the front door, and enforce three laws.**

---

## 1. THE WHOLE-PANEL IA — the ONE map

Reference-class invariant (Retool/Webflow/Framer/Builder all obey it): **top = global context + the ship verb · a left MODE-RAIL = "what am I working on" (data is a first-class mode, never a screen you leave) · center = the live artifact · right = the selected thing's settings · bottom = navigate the artifact.** Our panel keeps all five regions; it re-labels them as the four moments and moves three scattered controls home.

```
┌─ TOP BAR ─ global context + the PUBLISH terminal ───────────────────────────────┐
│ Strata   project ▸ page          KA|EN  ☀︎   ⌘K            [ Save ] [ Publish ▾ ] │  ← MOMENT 4 (top-right = "ship it")
├──────┬──────────────┬──────────────────────────────────────┬─────────────────────┤
│ RAIL │ LEFT PANEL   │            CANVAS (always live)       │   INSPECTOR         │
│      │ (mode body)  │                                       │  (selection         │
│ Data◀│  sources +   │                                       │   contract,         │
│ Add  │  metric dict │            the artifact               │   AUTHOR plane      │
│ Layers│ palette /   │        (honest · boxed)               │   only)             │
│ Site │  tree / etc. │                                       │                     │  ← MOMENT 3
│ Style│              │      MOMENT 1 (Data) · MOMENT 2       │                     │
├──────┴──────────────┴── BOTTOM: page tabs · status ─────────┴─────────────────────┤
```

### Region homes — every surface, its ONE canonical seat

| Region | Canonical owner | Moment | What lives here (and ONLY here) |
|---|---|---|---|
| **TOP BAR** | `StudioTopBar` | global + **4 PUBLISH** | wordmark · breadcrumb (`project ▸ page`) · preview (locale, light/dark) · ⌘K · **the lifecycle terminal top-right** (Save · Publish · History · Version — `PageWorkflowBar` re-seated) · logout. **Removed from here** → the Compose⇄Data switch, the "Site & chrome" button, the "Brand & theme" icon, the page `Select` (all move to the rail / bottom). |
| **LEFT RAIL** | `ActivityRail` | the moment switcher | ONE ordered mode list — **`Data · Add · Layers · Site · Style`** — Data first = the front door. Today the rail carries only `Add | Layers`; the re-lay unifies all five entry points onto it. |
| **LEFT PANEL** | `renderSurface` dispatch | **1 DATA / 2 COMPOSE** | the active mode's body: **Data** → sources + the governed-metric dictionary (`DataModelBody`; drilling to *define* opens the full-screen modeler via the existing `FocusView`, entered FROM the rail, not a top-bar switch); **Add** → the metric-first palette; **Layers** → the tree; **Site** → identity · nav · chrome (`PagesSiteSurface`); **Style** → brand tokens (`StyleSurface`). |
| **CANVAS** | `CanvasView` | **2 COMPOSE** | the one always-live artifact — honest (live-or-declared-empty) and boxed (§2 CONTAINMENT). |
| **INSPECTOR** | `RightDock` / `DockBody` | **3 REFINE** | the selection's declared contract, **author plane only** (§2 PLANE). Already purely selection-derived (no Element\|Page tab) — the remaining fix is plane-filtering. |
| **BOTTOM** | `studio-bottom` | navigation | page tabs + status — the ONE home for "which page am I editing" (the top-bar page `Select` is retired). |

**Why this is the front door the owner asked for:** DATA becomes rail-mode #1. Onboarding a source and defining a metric is the first thing the rail offers, in place — never a Compose⇄Data-model *screen swap* that reads as leaving the tool (today's `07-model.png` is reached by a top-bar segmented switch and feels disconnected). This is the Looker/Studio "data source first" discipline and the Webflow left-rail-CMS-mode discipline, applied to governed statistics.

---

## 2. THE THREE LAWS — concrete mechanisms + today's file-anchored violations

### LAW A — PLANE: every control declares its audience; the author sees author-things only
**Mechanism (already routed as W3 / PM-B — additive, OCP, no object-model change):**
- Add `plane?: 'author' | 'steward' | 'system'` to `PropField` (engine, `packages/react` PropSchema; default `'author'`) and to `FacetDescriptor` (`facetRegistry`).
- `DockBody` / `Inspector.renderField` filter by the active audience: **author** sees `author` only; **steward** additionally sees `steward` behind the role lens; **`system` is projected to no one** by default.
- The invariant is machine-held: `FF-NO-UNPROJECTED-DECLARED-FIELD` (ADR-043) red-lights any declared field with neither an author projection nor an explicit non-author plane. This makes "no plumbing tokens" (Law 11 C3) a build gate, not a hope.

**The exact system-plane fields leaking to the author today (hide — screenshot `04`/`03`):**
| Leak (author-visible now) | File anchor | Verdict |
|---|---|---|
| `vars` — the page/node derive-graph (`_selKey`, `regionObj`, `_regionSel`, `_direct…`) rendered as a raw `type:'object'` JSON sub-editor + a "Variables" group | `features/page-config/pageSchemaSource.ts:67` + `pageGroups` `:77`; node-level via `walkNodes.ts` | `plane:'system'` — drop the Variables group from the author projection |
| `presentation.crumbs` — breadcrumb object (`by · op · prefix · source`, "6 fields → Open") | projected via `presentationPropSchema()` re-prefixed, `pageSchemaSource.ts:53` | `plane:'system'` (derived breadcrumb config) |
| **coordinate `dim→value`** ("კოორდინატი (dim→value) · not set → Open") — the raw dimension-binding selector | the DATA facet contract (`inspector/facets/builtinFacets.ts`, data facet) | `plane:'system'` — the author binds a **metric**, never a raw `dim→value` coordinate |
| free-text `field` / raw `type` on the bound item ("ველი" free path, "ტიპი") | element item contract | `field` → `plane:'system'` (a raw path token; author picks a metric) |
| **VISIBILITY** — `view.visibleWhen` (`op · perspective`, "ხილვადობა · 2 fields") | `inspector/facets/builtinFacets.ts:105` | facet `plane:'steward'` — advanced, behind the lens (not author-default) |
| any residual `[object] N fields → Open` escape hatch | across facet contracts | either give it an author projection or mark it `system` (the FF forbids a third state) |

### LAW B — CONTAINMENT: a thing holds its own content; nothing renders outside its box
**Mechanism (ADR-041, already the law — this is enforcement, not a new grammar):** every element renders its children through the ONE layout-node containment grammar (children live at a `PartField` and paint inside the parent's box). No element paints a sibling/child through a bespoke wrapper outside that grammar. Enforce as `FF-ELEMENT-BOXES-OWN-CONTENT` (extends the existing `FF-DERIVED-CONTAINMENT`): no render path emits children outside the layout-node slot.
**Today's top violations (canvas/render side — the owner's "sections leaking inner content"):**
- the **bespoke page-root `<div>` wrapper** and the legacy **`row` node** — both paint structure outside the layout-node grammar (settled retire-targets; layout-node is the SSOT). Retire → route through the layout-node slot.
- the structural-preview **empty box** under a section (screenshots `03`/`04`, the dead map/table area) reads as a box that holds nothing / leaks — its render-contract must go through §2 LAW C's honest state, not paint an unbounded void. (`canvas/CanvasView.tsx:13-20,135-142` — structural preview renders empty shells; confirm the section render-contract on build.)

### LAW C — ONE-PLACE: each control in exactly ONE canonical home (⌘K is the only allowed second path)
**Rule:** every capability is registered to exactly one region home (the table in §1). The command palette (⌘K) is the sole permitted accelerator — an audience-agnostic universal path, not a duplicate home. Enforce as `FF-ONE-HOME-PER-CAPABILITY`.
**Today's top violations (the owner's "logic scattered across header/left/right — I never know where what is"):**
| Capability | Doors today | Canonical home |
|---|---|---|
| **Data model** | THREE — the rail entry, the top-bar `Compose⇄Data-model` segmented switch (`StudioTopBar.tsx:100-123`), and the ⌘K command (the shell's own comment names all three, `StudioShell.tsx:170-176`) | rail mode **Data** (⌘K stays as accelerator; retire the top-bar switch) |
| **Page navigation** | TWO — the top-bar page `Select` (`StudioTopBar.tsx:59-71`) and the bottom-strip Chips (`StudioShell.tsx:315-327`) | **bottom strip** (retire the top-bar `Select`) |
| **Site & chrome** | TWO — the top-bar "Site & chrome" button (`StudioTopBar.tsx:136-150`) and canvas chrome-region click | rail mode **Site** (canvas click deep-links INTO it — one home, one deep-link) |
| **Brand / theme** | top-bar "Brand & theme" icon (`StudioTopBar.tsx:151-155`), separate from the rail | rail mode **Style** |
| **Lifecycle (save/publish/history)** | `PageWorkflowBar` squeezed mid-top-bar between page-switcher and locale (`StudioTopBar.tsx:73`) | top-**right** terminal (the reference-class "ship it" corner) |

---

## 3. THE COHERENT RE-LAY SEQUENCE (Strangler; each step a VISIBLE whole-improvement on :3013)

Ordered by **whole-coherence-visibility** — what single motion makes the whole panel most visibly canonical to the owner, not which is easiest.

| # | Motion (whole-visible) | What the owner SEES change | Maps to | Size |
|---|---|---|---|---|
| **1** | **The Four-Moment Shell** — unify all five entries onto ONE ordered rail (`Data · Add · Layers · Site · Style`, Data first); move the lifecycle to a top-right **Publish terminal**; strip the top bar's scattered doors (Compose⇄Data switch, Site button, Brand icon, page `Select`). Pure re-homing of existing surfaces + LAW C consolidation. | the WHOLE panel now reads as the four moments; **Data is the front door**; "where is what" is answered; no capability has two doors | H1 IA · LAW C | **S–M** |
| **2** | **PLANE the Inspector** — `PropField.plane` / `FacetDescriptor.plane`; dock filters to the author plane; hide the six leak classes in §2 LAW A. | screenshot `04` stops showing `dim→value` / `vars` / `op·perspective` / raw `field` — REFINE becomes an author surface, not a JSON editor | W3 · PM-B · LAW A | **M** |
| **3** | **Honest + Boxed Canvas** — chart/table render live-or-declared-empty (kill the dead map/table blank box); every element boxes its children through the layout-node grammar (retire bespoke page-div + `row`). | tables open, charts render or say honest-empty, sections stop leaking their inner content | W1 · LAW B | **M** |
| **4** | **Metric-first Compose** — the Add palette leads with governed metrics; drag-a-metric-onto-canvas → KPI/chart/table is the primary gesture (the binding plumbing stays `plane:'system'`). | composing starts from a governed metric (moment 1→2 flows), not a raw block | W2 | **M** |
| **5** | **ONE composition seam** — `composeConstructor(manifest)` aggregating every registration + tenant seeds (locale/brand/perspectives), so the whole is introspectable and a 2nd tenant can drive it zero-code. | (under the hood) the panel is one coherent, agnostic whole — no baked Geostat | audit GAP G1/AG1 | **M** |

*Below the visible line (real hardening, not re-lay):* one dnd-kit transport (audit S1, M–L) · split `NestedItemControl.tsx` (549, audit A1, S–M) · one i18n string port (audit S2, M). Sequence after the five.

---

## 4. VERDICT

**Reachable as a coherent whole on the settled substrate? YES — and cheaply, because the re-lay is 90% re-homing, not building.** The panel already has the reference-class region skeleton and every surface the four moments need (`InsertSurface`, `LayersSurface`, `StyleSurface`, `PagesSiteSurface`, `DataModelBody`/`FocusView`, the generic `Inspector`); nothing here re-opens ADR-041/042. The gap to canonical is IA legibility + three laws, and each law is already routed work (PLANE=W3/PM-B, honest=W1, metric-first=W2) sequenced under ONE vision instead of as disconnected slices — which is exactly the owner's ask. **The single first motion to drive now: Step 1 — the Four-Moment Shell (one rail with Data first + a top-right Publish terminal, top bar stripped of its scattered doors).** It is the most visible whole-improvement (the entire panel instantly reads as the four moments and "where is what" is answered), it makes Data the front door in one move, it is low-risk (re-homes existing surfaces, zero object-model change), and it lays the legible frame that Steps 2–5 land cleanly into.

*— platform-architect, 2026-07-15*

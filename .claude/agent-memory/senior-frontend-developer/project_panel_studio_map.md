---
name: panel-studio-map
description: "THE Studio shell map (CURRENT STATE ONLY, distilled 2026-07-22) — RightDock zones, Focus-View pattern, EditPopover, overflow escalation, role lens, data-flow spine, useCanvasController seam. Wave-by-wave build history (SL-0..SL-5, S1-S5, M1.2-M2.2) dropped; superseded by AR-52 (see [[project_panel_four_moment_shell]], [[project_panel_plane_inspector]], [[project_panel_concern_refine]])."
metadata:
  type: project
---

> Distilled 2026-07-22 from a 58KB wave-log (SL-0..SL-5/S1-S5/M1.2-M2.2, AR-49/50). Only
> durable current-state mechanism facts kept; historical "what changed in which commit"
> narrative dropped (git-derivable). Rail/top-bar arrangement described here is SUPERSEDED
> by [[project_panel_four_moment_shell]] (AR-52 relay Step 1) — that is the current IA.

## RightDock — 3-zone contract
`studio/RightDock.tsx` + `studio.css`. HEADER (`.studio-dock__header`, fixed) = exactly ONE
tier via ternary: `promoted ? breadcrumb : pageId ? contextTabs : overline` — a drill
breadcrumb and the context switch never stack. BODY (`.studio-dock__content`, the sole
`flex:1 1 auto; min-height:0; overflow:auto` region, testid `dock-content`) = the
concern-grouped Inspector (see [[project_panel_concern_refine]]) or a guided empty-state.
FOOTER (`.studio-dock__footer`, fixed) = element actions (Delete), only when
`scope==='element' && selected && !chromeSel`.

**Breadcrumb-promotion seam (`inspector/breadcrumbSlot.tsx`).** A drilled nested-item editor
(component-local `steps` state) PROMOTES its breadcrumb into a host slot instead of the header
lifting that state. Port lives in the INSPECTOR layer (the producer), not studio — DIP, low-level
module defines the interface. Fail-soft: no host → renders in-body exactly as a bare drill would.
`FocusView` is also a breadcrumb host, so a nested drill inside an escalated target promotes into
the focus-view header too.

## Focus-View — a separate Studio screen, not a canvas overlay
**Owner-binding (§3.4):** Focus-View is Notion-full-page/Sanity-document-route style — you
navigate OUT to it, breadcrumb-back returns. NOT a grid-area overlay; rail+dock are NOT
present inside it. The panel has no shell-level router (`App.tsx` is an auth/boot state
machine); realized as SCREEN STATE: `StudioShell` renders `<FocusView>` in place of the whole
`.studio-shell` grid when `focusViewTargetId != null`.
- `studio/FocusView.tsx` — minimal chrome (`role=region` + breadcrumb-back Button), resolves
  target from the registry, WCAG focus-in-on-enter + Esc→back, fail-soft on unknown id.
- `studio/focusViewRegistry.tsx` — OCP target table `FOCUS_VIEW_TARGETS: Record<id,{id,title,render}>`.
  A new full-screen workspace editor = one row; shell unchanged.
- **Dynamic escalated targets:** `makeEscalatedTarget(req,bind)` builds a target on the fly
  (id `ESCALATED_TARGET_ID`) so an escalated nested-item subject rides the SAME shell as
  static targets — see overflow escalation below.

## EditPopover — the glance-weight micro-edit container
`studio/EditPopover.tsx` = MUI `Popover` (focus-trap + restore-focus for free) + `role=dialog`.
**Self-guard:** calls `placeSubject('micro-target', shape)` and renders `null` unless the
verdict is `'popover'` — admission is law-derived (see [[project_placement_law]]), never
per-caller taste. Wired path today: nested-item RENAME (`useRowRename` hook + `NestedItemControl`
ArrayListScreen's `✎` button, only when `itemLabel` is defined). Any future glance micro-edit
(recolor, toggle) reuses `<EditPopover>` — never a second popover.

## Overflow escalation — dock-drill → focus-view at the nested-item boundary
A WORKSPACE-weight nested subject escalates OUT to a focus-view instead of drilling the bounded
dock; FORM-weight stays a dock-drill. Deterministic — the container is
`resolveSurface('nested-item', weight)`, never a per-type literal. `nestedItemPlacement.ts` (pure)
derives the shape (rich types = `{DataSpec,ChartDef}`; opaque array/object = one flat control).
`inspector/focusEscalation.tsx` is the PORT (`FocusEscalationContext`/`useFocusEscalation()`) —
request = `{fieldPath, title, render:(bind)=>ReactNode}`; `FieldBinding={value,onChange}` is a
LIVE store binding the HOST supplies (escalation unmounts the dock, a captured value would go
stale); null host → in-dock drill (fail-soft). The port is a discriminated union:
`source:'node-field'` (host binds selected-node field live) | `source:'self-bound'` (editor
sources its own store — page-scoped subjects, e.g. filters pipeline, chart encoding).
`StudioShell.tsx` is the HOST — provides `focusEscalation` around RightDock only; render
precedence: escalatedTarget > model focus-view > shell; back = clear escalation (loss-free).
**Reuse this port for any workspace-weight surface** — do not invent a second escalation path.
Known audited-but-not-yet-wired candidates: visibility expr, perspectives builder.

## Role lens — CURRENT final state (AR-50 M5b, "built ≠ buried")
Navigation is decoupled from identity; **role splits CONTENT, not visibility.**
`studio/useRole.ts` — `Role='author'|'steward'`, zustand `persist`, default `author`; NOT a
security boundary — rebind the body to a JWT/auth claim later without touching a consumer. The
data rail entry is ALWAYS visible (no `stewardOnly` gate). `studio/DataModelBody.tsx` is the SOLE
mount site of `ModelSurface`: `role==='steward' ? <ModelSurface/> : <DataDictionarySurface/>` + an
in-place Browse⇄Edit toggle; `DataDictionarySurface` is a read-only dbt-docs-grade view
(sources/metrics/dimensions, no bind/edit/query machinery). Entry (rail click, top-bar switch,
⌘K) is pure nav (`setSurface('model')`), never `setRole` — a steward in compose mode sees exactly
what an author sees. **FF-AUTHOR-NO-QUERY**: `ModelSurface` is the SOLE surface matching the
raw-query regex. **FF-ROLE-IS-LENS**: no RailEntry has `stewardOnly`.

## Data-Flow Spine — pipelines made visible (AR-49 M4.3)
`studio/model/dataFlow.ts` (pure) `projectDataFlow({metrics,pages,getSchema,dataSources,locale})`
→ a `source → dataset/spec → metric → used-by` flow model, PROJECTED from registries already
owned (no stored graph). `used-by` reuses the SAME reverse index the metric editor's governance
banner uses. `studio/model/DataFlowMap.tsx` — ONE component, TWO lenses via a single
`onOpenMetric?` prop: steward `ModelSurface` passes it (click opens that metric's editor); author
`DataDictionarySurface` omits it (read-only). Imports NOTHING from `features/data-layer`, so
FF-AUTHOR-NO-QUERY stays green on the author surface that embeds it.

## The canvas mounts the REAL renderer, not a mock preview
The Constructor mounts the real `@statdash/react NodePageRenderer` as a live WYSIWYG canvas
(`apps/panel/src/canvas/`) — the store keeps a flat `CanvasPage` (nodes map + nodeIds);
`canvasPageAdapter.toNodePageConfig` projects it into the engine's `NodePageConfig` tree. It
mounts behind a `SiteProvider` with `staticStore` (empty rows in structural mode) — never a real
API call; selection/drop-zone interaction is a separate transparent overlay. Drop zones come
straight from `nodeRegistry.getSlots(type)`; the palette from `nodeRegistry.list()` filtered by
`!rootOnly` — no new SliceMeta/SlotDef field is ever invented for this.

**Undeclared engine deps (flagged, latent):** `packages/react` imports `i18next` and
`packages/plugins` imports `react-router-dom`/`react-apexcharts`/`leaflet` WITHOUT declaring them
— unresolvable from engine source dirs under pnpm isolation. `apps/panel` declares them + pins
each via `resolve.alias` (see [[project_build_bundler_gotchas]] for the general pattern). The
long-term fix is `packages/react`/`packages/plugins` owning these as real deps.

## useCanvasController — the canvas↔store glue (DRY seam, reuse don't re-fork)
`studio/useCanvasController.ts` — bindMetric/handleDrop/patchProp/setVisibleWhen/deleteSelected
+ dragging/previewPerspectiveId view-state, built from shared primitives
(nodeSchemaSource/metricBinding/setAtPath/makeNode + store actions). This is THE canvas-write
path; any new canvas-driven mutation extends it rather than forking a parallel closure.

## Token-driven chrome + the Strata tool-skin
`StudioShell.tsx` loads the DTCG token layer in its lazy chunk; `studio.css`/chrome files read
only `var(--color-*/--spacing-*/--font-*)`, no hardcoded brand literal (guarded by
FF-CHROME-TOKEN-DRIVEN; see [[project_css_fitness_comment_stripping_gotcha]] for a scan
blind-spot found in a sibling gate). `studio/strata-preset.ts` is the TOOL's own brand skin
(azure/teal/navy) — app-scoped data, distinct from the AUTHORED SITE brand (`site.themeOverrides`,
see [[project_panel_canvas_craft_and_brand]]). Both compose through the SAME
`buildThemeVars`/`applyThemeOverrides` mechanism; Strata always wins on `:root:root` for the tool
chrome + MUI portals, the site's brand paints only `.canvas-root`.

Related: [[project_placement_law]] (the scope×weight→container law these containers realize),
[[project_panel_plane_inspector]] + [[project_panel_concern_refine]] (AR-52 dock content axes,
current over the historical facet/plane sections this file used to carry).

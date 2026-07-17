---
name: panel-nav-chrome-authorable
description: AR-49 deep-authorability — left-bar nav is per-entry editable (updateNavItem + inline editor) and chrome is reachable in Pages&Site; the nav-wire schema gap (no icon/hidden) that blocks per-entry icon/visibility
metadata:
  type: project
---

**Chrome + left-bar nav made authorable (2026-07-11, commit d687043, branch
feat/ar49-m0-metric-first-authoring; apps/panel only, arrow held).** Closed the
owner's repeated dead-end ("chrome not visible" / "can't touch the left-bar nav").

**Nav per-entry editing (the real gap):** `NavEditor` (`features/site/NavEditor.tsx`)
had add/reorder/delete but NO per-entry edit and the store had NO `updateNavItem`
action — a nav entry's label/target were unreachable once created. Added
`updateNavItem(id, patch: Partial<NavItem>)` (constructor.store.ts, history-tracked,
byte-identical to the other nav reducers) + an inline per-row editor: label ka/en
(TextField) + target-page `<TextField select>` sourced from `usePages()`. ONE row
open at a time (`editingId` state — contextual-relevance canon). Order stays
drag-reorder (`reorderNav`). label/target/order round-trip + persist (the `/nav`
wire carries them).

**Chrome reachability:** `ChromePalette` relocated `InsertSurface` → `PagesSiteSurface`
(chrome is SITE furniture, not page content — see [[project-panel-canvas-chromeconfig-defect]]
PART C). Selecting → `ChromeInspectorPanel` in the RightDock (already wired; no RightDock edit).

**THE persistence-integrity boundary (flagged, NOT faked):** the nav wire — `NavRow` /
`NavCreateBody` / `NavUpdateBody` (`lib/api.ts`) + server `/nav` + `fromApiSite` — carries
ONLY `label` / `page_id` / `ord` / `parent_id` / `depth`. There is NO `icon` and NO
`hidden`/visibility column. So per-entry ICON and VISIBILITY (which the brief listed) are
NOT persistable end-to-end, and the runtime `NavEntry` (`{label,icon,items,path,color}`,
SiteContext.tsx) renders icon+color that `canvasSiteChrome.ts` hardcodes
(`CANVAS_NAV_ICON='document'`, color ''). Shipping icon/visibility controls would be a
fake un-persistable UI (least-astonishment/integrity violation). ROOT fix (cross-lane,
NOT done here — needs backend migration + packages/contracts + runner nav aggregation):
add `icon`/`hidden` columns to the nav schema + wire adapters, THEN author them. Flagged.

**LIVE proof harness:** `apps/panel/e2e/chromeNavAuthoring.e2e.ts` (real Chromium) — boot
author lens → Pages&Site → chrome-palette visible → click a chrome slot → `chrome-inspector`
opens → nav "Edit Home" → fill Label(en) "Homepage" → the entry a11y-name AND the live
canvas InnerSidebar `[data-nav-entry] a` rail link repaint (WYSIWYG via
projectCanvasSiteChrome). `support/mockApi.ts` seeds ONE page-backed nav row (`NAV_ROW`,
exported `NAV_ENTRY_LABEL`). GATE: vitest panel 769 pass, full e2e 8 pass, lint 0 err.

**Boundaries held:** never touched RightDock.tsx / fieldControlRegistry / nodeProjection
(Move 1) nor ModelSurface / features/data-layer (Move 3). See [[project-panel-studio-shell-m12]].

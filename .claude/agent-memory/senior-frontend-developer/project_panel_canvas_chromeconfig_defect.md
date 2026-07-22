---
name: project-panel-canvas-chromeconfig-defect
description: Canvas chrome fidelity — the canvas now paints the WHOLE app shell (AppChrome, not just page content), chrome is canvas-selectable via a data-canvas-chrome-slot anchor, and chrome is reachable from Pages&Site. Current-state distillate of a multi-part fix (PART A-E).
metadata:
  type: project
---

Real path: `platform/apps/panel/src/canvas/CanvasView.tsx`.

**Current state (all parts SHIPPED):** `CanvasView` mounts `<AppChrome><NodePageRenderer/></AppChrome>`
inside `SiteProvider` + `AuthoringAnchorContext(true)` — REUSING the runner's own 4-region
orchestrator (top=header/banner, bottom=footer, right, overlay; `<main>{children}</main>`), so the
canvas paints the EXACT shell the live site does (Webflow full-page model), not just page content.
Chrome renders even with an EMPTY `site.chrome` because `resolveChrome` mounts EVERY registered
slot at its default variant (see [[project_chrome_shell_mechanisms]]). Deliberately NO
FrameProvider on the canvas (`usePageFrame()`='default', chrome visible) — the `'canvas'` frame
would hide chrome, which is the runner's edit-mode intent, not the canvas's.

**Chrome is canvas-selectable.** `ChromeSlot` (packages/react) reads `AuthoringAnchorContext` and,
only under the authoring canvas, wraps its output in a `display:contents` div stamping
`data-canvas-chrome-slot`/`-key` (layout-inert, byte-identical off-canvas). `CanvasOverlay`
queries that attribute, frames every AUTHORABLE region (filtered by
`chromeRegistry.getMeta(slot,key)?.schema?.length>0` — the SAME filter ChromePalette uses), and a
click routes to `onSelectChrome(slot,key)` → the existing chrome-selection arm →
`ChromeInspectorPanel`. `ChromeRegion` (used by AppChrome for top/left/right/bottom/overlay)
stamps the SAME `<PartAnchor field={slot} index={0}>` `ChromeSlot` does, so header/footer are
selectable identically to the sidebar (not just the sidebar, which was the earlier, narrower fix).
This anchor family is a deliberately INTERIM sibling of `data-part-*` (not yet a declared Part) —
folds into the ONE PartAnchor when chrome becomes a declared part (ADR-041 Ph.6).

**Chrome is reachable from Pages&Site.** Chrome (header/sidebar/footer) is SITE furniture, not
page content, so `ChromePalette` lives in `PagesSiteSurface` (own "ჩარჩო" overline), not buried at
the bottom of the page-content `InsertSurface`. Selecting a chrome element opens
`ChromeInspectorPanel` in the RightDock via the already-wired `chromeSel` arm. The top-bar Site
button is labelled VISIBLY "Site & chrome" (was an icon-only, un-findable "Pages & Site") and opens
`PagesSiteSurface`, which hosts `ChromeCompositionPanel` (the whole-set enable/disable/swap-variant
editor) directly.

**Registry flag (real gap, not faked):** `app-banner` has ONLY a `hidden` variant registered — no
visible default banner shell exists, so a banner cannot render on the canvas until one is
authored/registered.

**Root cause behind the ORIGINAL hollow-rail defect (historical, now closed — kept for the
pattern, since it recurs):** `CanvasView` built a `<SiteProvider>` WITHOUT `chromeConfig` /
`nav={[]}` / no `chrome` prop, so `useChromeConfig()`/`useSiteNav()`/`useSiteChrome()` all
resolved to empty defaults → the InnerSidebar rendered hollow (0 nav links) and, in an earlier
pass, `useChromeConfig()` even THREW (caught by `NodeErrorBoundary`, swallowing page children).
Stayed green because jsdom has 0-rect geometry and the sibling unit test happened to pass its own
chromeConfig, masking the product gap. Fix root: `canvasSiteChrome.ts::projectCanvasSiteChrome`
projects the authoring session (SiteDef + CanvasPage[]) into the engine's site-context shapes
(nav/chrome/chromeConfig) — the panel's analogue of what `RendererSurface` passes the runner.
**The general lesson:** any NEW SiteProvider mount (test or product) must feed a REAL
nav/chrome/chromeConfig triple or it silently degrades to the empty-chrome default — don't let a
test's own compensating setup mask a product gap.

Related: [[project_chrome_shell_mechanisms]], [[project_panel_studio_map]] (canvas seam),
[[project_facet_axis_style_facet]] (chrome facet),
[[project_panel_canvas_craft_and_brand]] (PART E, chrome BRAND — sibling thread).

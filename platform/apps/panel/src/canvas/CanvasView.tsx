// ── CanvasView — live WYSIWYG canvas for the Constructor (N35) ────────────
//
//  Turns the form-only Constructor into a true WYSIWYG editor: the REAL
//  @statdash/react NodePageRenderer is the canvas, with an interaction overlay
//  on top. Two stacked layers (Builder.io / Craft.js pattern):
//
//    Layer 1  renderer  — NodePageRenderer drawing the live NodePageConfig,
//                         pointer-events:none so it is purely visual.
//    Layer 2  overlay   — CanvasOverlay: selection frames + slot drop zones,
//                         pointer-events re-enabled per interactive element.
//
//  Data: by DEFAULT the canvas renders against a staticStore (empty rows) wrapped
//  in a SiteProvider — never a real API call. Charts/tables render their empty/
//  placeholder state, which is exactly the structural preview the editor wants.
//
//  G3.1 — LIVE PREVIEW (opt-in): a structural|live toggle in the canvas chrome
//  lets the author preview against the REAL stats cube. Live mode swaps the
//  `stores` prop for a map built through the SHARED 'stats' store-builder
//  (buildStoreManifest) — the SAME seam the geostat runner uses. The toggle is
//  view-state local to this component (transient, like `dragging`), defaulting to
//  structural so the canvas opens zero-fetch and byte-identical to pre-G3. Live is
//  FAIL-SOFT: no cube-bound source / profile error / API unreachable falls back to
//  the static store and shows a non-blocking badge — the editor never crashes.
//
//  Registry: the engine registries (node/store-builder/projector slices +
//  perspectives) are populated by `setupCanvasRegistry()` as an EXPLICIT boot
//  step in `App.startApp` (before the app reaches 'ready'), NOT as a side effect
//  of this module loading. CanvasView therefore ASSUMES the registry is already
//  populated — which holds because the app boots it before any surface mounts,
//  including for a brand-new / empty site with no page yet. Tests that render
//  CanvasView in isolation run the same boot step in a `beforeAll`.
//
//  Law 3: CanvasView lives in apps/panel — the engine stays app-agnostic. It
//  consumes NodePageRenderer as-is; no fork.
//
import { useState, type CSSProperties } from 'react'
import {
  MemoryRouter,
  // The invariant-reset seam (v6-sanctioned): the app now mounts a real BrowserRouter
  // at its root (studio surface routing), so this preview MemoryRouter would otherwise
  // be an illegal NESTED <Router>. Nulling the location/route context just above it makes
  // the preview a fully ISOLATED routing island — its in-memory `?perspective=` search
  // stays OFF the real Studio address bar, exactly as intended (the renderer's filter
  // permalink must never leak into `/studio/...`).
  UNSAFE_LocationContext,
  UNSAFE_RouteContext,
} from 'react-router-dom'
import { SiteProvider }       from '@statdash/react'
import type { NavEntry, ChromeConfig } from '@statdash/react'
import { NodePageRenderer, AuthoringAnchorContext } from '@statdash/react/engine'
import type { NodePageConfig, ChromeEntry } from '@statdash/react/engine'
// The SAME 4-region chrome orchestrator the runner wraps every page in
// (apps/geostat LocaleGuard: <AppChrome><NodePageRenderer/></AppChrome>). Reused, NOT
// forked (Law 6/7) — so the authoring canvas paints the EXACT app shell the live site
// does (header/banner/footer + the region layout), the Webflow "full page incl. shell"
// model. Arrow-legal (apps → plugins).
import AppChrome              from '@plugins/chrome/AppChrome'
import { CanvasOverlay }      from './CanvasOverlay'
import { CanvasToolbar }      from './CanvasToolbar'
import { useLivePreviewStores, type PreviewMode } from './useLivePreviewStores'
import { useDebouncedLivePage } from './useDebouncedLivePage'
import type { NodeBase }      from '@statdash/react/engine'
import './canvas.css'

const CANVAS_I18N = { locales: ['ka', 'en'], defaultLocale: 'ka', fallbackLocale: 'ka' }

// Empty defaults: a CanvasView mounted without site chrome (isolated tests, a
// brand-new session) behaves EXACTLY as before this seam existed — the shells fold
// to their fail-soft states (hollow-but-safe rail). Module-scoped constants so they
// are shared, stable references (no re-render churn from a fresh {}/[] each render).
const EMPTY_NAV:    NavEntry[]                   = []
const EMPTY_CHROME: Record<string, ChromeEntry> = {}

export interface CanvasViewProps {
  /** The live NodePageConfig being edited — rendered verbatim by the engine. */
  page:            NodePageConfig
  selectedNodeId?: string
  /** The selected value-band item path within the selected node (ADR-038). */
  selectedItemPath?: string
  /** True while a palette item is being dragged — reveals drop zones. */
  dragging?:       boolean
  /**
   * The perspective the author is PREVIEWING (the Perspectives-pane switcher's local
   * selection). The canvas renders `perspective = f(previewState)` — the SAME
   * perspectiveState SSOT the live renderer reads — by seeding the canvas router's
   * URL with the axis param. Constructor-LOCAL (the author's preview, distinct from
   * runtime URL state); absent ⇒ the engine folds to perspectives[0] (the SSOT
   * default), so the canvas opens on the default perspective with no param.
   */
  previewPerspectiveId?: string
  onSelectNode:   (nodeId: string | null) => void
  /** Select a value-band item (a declared bounded child) instead of the whole node.
   *  A chrome region is also a part — the overlay dispatches this with the site-frame
   *  id + `chrome.<slot>` path (S6), so no chrome-specific handler is needed. */
  onSelectItem?:  (nodeId: string, path: string) => void
  onDropNode:     (parentId: string, slotKey: string, nodeType: string) => void
  /** Reserved for node-to-node moves (drag an existing node into another slot). */
  onMoveNode?:    (nodeId: string, targetParentId: string, targetSlot: string) => void
  /**
   * Bind a governed metric (dragged from the Metric Palette) onto a block on the
   * canvas — the drag half of AR-49 M0 item 9's bind affordance. The overlay's
   * node frames become metric drop targets; the write is the host's byte-identical
   * metricBinding write (spec §3). Absent ⇒ metric drops are ignored.
   */
  onBindMetric?:  (nodeId: string, metricId: string) => void
  /**
   * The site's REAL chrome inputs — the panel's analogue of the runner's
   * manifest.{nav,chrome,chromeConfig} (projected by projectCanvasSiteChrome). These
   * make the canvas WYSIWYG: the InnerSidebar rail renders the authored nav links +
   * slot config instead of a hollow default. Absent ⇒ empty/fail-soft (unchanged
   * pre-seam behaviour), so isolated mounts still render safely.
   */
  nav?:          NavEntry[]
  chrome?:       Record<string, ChromeEntry>
  chromeConfig?: ChromeConfig
  /** Preview locale for chrome content (the top-bar ka|en switch); defaults to ka. */
  locale?:       string
  /**
   * The previewed SITE's own brand as applied CSS custom properties — the panel's
   * `buildThemeVars(site.themeOverrides)`, the SAME map+transform the runner applies
   * to `manifest.themeOverrides` (@statdash/styles.applyThemeOverrides). Set on the
   * canvas ROOT so the previewed site's brand (accent family, header/sidebar/footer)
   * paints TRUE — the site's theme, NOT the surrounding Studio tool's Strata skin
   * ("the canvas never lies"). Absent ⇒ the canvas inherits the ambient theme
   * (isolated mounts / a brand-less site), byte-identical to pre-seam.
   */
  themeVars?:    CSSProperties
}

export function CanvasView({
  page, selectedNodeId, selectedItemPath, dragging, previewPerspectiveId,
  onSelectNode, onSelectItem, onDropNode, onBindMetric,
  nav = EMPTY_NAV, chrome = EMPTY_CHROME, chromeConfig, locale, themeVars,
}: CanvasViewProps) {
  // Preview mode is canvas view-state — transient and local to this component
  // (the same pattern as `dragging`; there is no persisted canvas-view-state slice
  // in the constructor store).
  //
  // W1 · Canon C2 — LIVE is the DEFAULT: the canvas never lies. Real data paints by
  // default so the author sees the truth of the page; 'structural' survives ONLY as
  // an explicit opt-out perf mode, and when chosen the canvas wears a visible veil
  // (below) declaring "preview off — values are not real", so its empty/zero shells
  // can never be mistaken for real observations. (Live is fail-soft: no cube-bound
  // source / API down degrades to the structural map with the 'unavailable' badge.)
  const [mode, setMode] = useState<PreviewMode>('live')

  // ── Dark-mode canvas PREVIEW (Studio-level, distinct from authored chrome) ─────
  //  A Studio control that lets the author see the page in dark WITHOUT touching the
  //  authored config: the page's own AppHeader sun/moon is CONTENT (clicking it selects
  //  the header), so it can never preview the tool's own render. This toggle reuses the
  //  ONE sanctioned dark mechanism — `data-theme="dark"` on the canvas root — the exact
  //  attribute the runner/tenant sets on <html> (tokens.css). Because the site brand
  //  (`themeVars`) is applied INLINE on this SAME root, brand-set tokens still win and
  //  the unbranded rest goes dark — byte-identical to how the runner composes brand+dark
  //  (no parallel theming path). View-state local + transient (like `mode`), default
  //  light so the canvas opens exactly as before.
  const [themePreview, setThemePreview] = useState<'light' | 'dark'>('light')

  // Resolve the store map for the requested mode. Structural ≡ pre-G3 static map
  // (byte-identical). Live builds through the shared 'stats' builder and degrades
  // to the static map (status 'unavailable') on any failure — never throws.
  const { stores, status } = useLivePreviewStores(mode)

  // G3.2 — request-volume guard: in live mode, only the SETTLED page descriptor
  // drives the data-fetching renderer (Layer 1), so an edit burst collapses to a
  // single live query. Structural mode is identity passthrough (byte-identical,
  // instant). The overlay (Layer 2) keeps the live `page` so selection/drop stay
  // responsive — the debounce is scoped to the data-fetch layer only.
  const renderedPage = useDebouncedLivePage(page, mode)

  const rootClass = `canvas-root scroll-fancy${dragging ? ' canvas-root--dragging' : ''}`

  // Perspective PREVIEW — seed the canvas router URL with the active axis param so the
  // live renderer switches perspective. The renderer's perspectiveState SSOT derives
  // entirely from the URL filter param (FilterProvider reads location.search on mount →
  // usePerspectiveContext.current), so the canvas needs no engine prop: setting the
  // initial entry IS the wiring. The param key is the page's axis key — the SAME
  // derivation SiteRenderer uses (Object.keys(page.perspectives)[0]). Absent preview /
  // no axis ⇒ '/' ⇒ the engine folds to perspectives[0] (the SSOT default). The
  // previewed id is driven by the dock Perspectives pane (the P-final SSOT) — the
  // canvas paints the page's OWN perspective-bar node faithfully as content (W1 · G9);
  // there is no second perspective switch in the canvas chrome.
  const perspectiveKey = Object.keys(renderedPage.perspectives ?? {})[0]
  const previewEntry   = perspectiveKey && previewPerspectiveId
    ? `/?${encodeURIComponent(perspectiveKey)}=${encodeURIComponent(previewPerspectiveId)}`
    : '/'

  return (
    <div
      className={rootClass}
      data-testid="canvas-root"
      style={themeVars}
      // The ONE sanctioned dark scope (tokens.css). `light` leaves the attribute OFF so
      // the base `:root` tokens / the site brand paint unchanged (default). Set to dark,
      // the page + its AppChrome resolve the DTCG dark tokens for this subtree only.
      data-theme={themePreview === 'dark' ? 'dark' : undefined}
    >
      {/* Canvas chrome — preview-mode toggle + theme-preview toggle + fail-soft badge. */}
      <CanvasToolbar
        mode={mode}
        status={status}
        onModeChange={setMode}
        themePreview={themePreview}
        onThemePreviewChange={setThemePreview}
      />

      {/* W1 · Canon C2 — the honest "preview off" veil. Structural mode is an explicit
          opt-out that paints empty/zero shells; the veil declares that plainly (icon +
          TEXT, never colour-only — Law 9) so the author can never mistake a structural
          shell for a real observation. Layer-inert (pointer-events:none) so selection +
          editing keep working underneath; only present in the opt-out mode. */}
      {mode === 'structural' && (
        <div className="canvas-veil" data-testid="canvas-structural-veil">
          <span className="canvas-veil__label" role="note">
            <span className="canvas-veil__icon" aria-hidden="true">◑</span>
            სტრუქტურული რეჟიმი — ცოცხალი მონაცემები გამორთულია; მაჩვენებლები არ არის რეალური
          </span>
        </div>
      )}

      {/* Layer 1 — the real renderer, visually live but non-interactive. The router's
          initialEntries carries the previewed perspective param (keyed so a preview
          switch remounts FilterProvider → fresh perspectiveState). */}
      <div className="canvas-layer canvas-layer--renderer" aria-hidden="true">
        {/* Reset the router contexts so the preview MemoryRouter is a legal ISOLATED
            island under the app BrowserRouter (v6 forbids a nested <Router> unless the
            location context is cleared first). RouteContext is reset too so relative
            resolution inside the preview never inherits the outer `/studio/...` matches. */}
        <UNSAFE_LocationContext.Provider value={null as never}>
          <UNSAFE_RouteContext.Provider value={{ outlet: null, matches: [], isDataRoute: false }}>
            <MemoryRouter key={previewEntry} initialEntries={[previewEntry]}>
              <SiteProvider
            stores={stores}
            nav={nav}
            chrome={chrome}
            chromeConfig={chromeConfig}
            pages={{}}
            locale={locale}
            i18n={CANVAS_I18N}
          >
            {/* Turn ON the band-item render anchors (ADR-038) — ONLY in the authoring
                canvas, so a band-owning shell stamps a queryable, layout-inert anchor
                per declared item for the overlay to frame. Off the canvas the same
                boundary is a zero-DOM Fragment (byte-identical live output). */}
            <AuthoringAnchorContext.Provider value={true}>
              {/* WYSIWYG parity — the canvas renders the app SHELL, not just page content.
                  Wrapping the page in AppChrome (the runner's own orchestrator) paints the
                  header · footer · banner regions AROUND the page, so the owner SEES and
                  can select the whole chrome, exactly like the live site (and like Webflow
                  shows the full page). The regions render even when `site.chrome` is empty:
                  resolveChrome mounts EVERY registered slot at its default variant (fail-
                  soft), so the declared chrome is always present + authorable.
                  We deliberately do NOT provide a FrameProvider — usePageFrame() then
                  defaults to 'default' (chrome VISIBLE). The 'canvas' frame would HIDE
                  chrome (its original edit-mode intent); the Webflow model wants it shown. */}
              <AppChrome>
                <NodePageRenderer page={renderedPage} />
              </AppChrome>
            </AuthoringAnchorContext.Provider>
              </SiteProvider>
            </MemoryRouter>
          </UNSAFE_RouteContext.Provider>
        </UNSAFE_LocationContext.Provider>
      </div>

      {/* Layer 2 — interaction overlay. */}
      <CanvasOverlay
        page={page as NodeBase}
        selectedNodeId={selectedNodeId}
        selectedItemPath={selectedItemPath}
        dragging={dragging}
        onSelect={onSelectNode}
        onSelectItem={onSelectItem}
        chrome={chrome}
        onDrop={onDropNode}
        onBindMetric={onBindMetric}
      />
    </div>
  )
}

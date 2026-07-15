import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Box, Typography, Chip, GlobalStyles } from '@mui/material'
// Token SSOT — the shell chrome reads @statdash/styles DTCG custom properties
// (studio.css). Importing it here (not in main.tsx) keeps the token layer in the
// Studio's own lazy chunk, so the default wizard path never loads it (Strangler:
// the shell is purely additive behind the flag).
import '@statdash/styles/css/index.css'
import './studio.css'
import { ActivityRail } from './ActivityRail'
import { StudioTopBar } from './StudioTopBar'
import { RightDock } from './RightDock'
import { StudioEmptyState } from './StudioEmptyState'
import { SURFACE_HEADINGS } from './rail'
import { useCanvasController } from './useCanvasController'
import { InsertSurface } from './surfaces/InsertSurface'
import { LayersSurface } from './surfaces/LayersSurface'
import { PagesSiteSurface } from './surfaces/PagesSiteSurface'
import { StyleSurface } from './surfaces/StyleSurface'
import { FocusView } from './FocusView'
import { makeEscalatedTarget, type FocusViewTarget, type FocusViewTargetId } from './focusViewRegistry'
import { FocusEscalationContext, type FocusEscalationRequest, type FieldBinding } from '../inspector/focusEscalation'
import { getAtPath } from '../inspector/showWhen'
import { useConstructorStore, usePages, useActivePageId, useSite } from '../store/constructor.store'
import { useActiveSurface, useSetSurface } from './useStudioRoute'
import { DEFAULT_STUDIO_SURFACE } from '../types/constructor'
import { useActiveLocales, PLATFORM_LOCALES } from '../inspector/useActiveLocales'
import { buildThemeVars } from './themeVars'
import { STRATA_PRESET } from './strata-preset'
import { useCommandPalette } from '../command/useCommandPalette'
import { SuspenseFallback } from '../shared/SuspenseFallback'
import type { StudioSurface, Locale } from '../types/constructor'

// Heavy surfaces stay in their own chunks (mirrors PageStep's split): the live
// canvas pulls the REAL @statdash/react renderer + ApexCharts; the palette pulls
// cmdk. Only loaded when the shell paints / ⌘K opens.
const CanvasView = lazy(() =>
  import('../canvas/CanvasView').then((m) => ({ default: m.CanvasView })),
)
const CommandPalette = lazy(() =>
  import('../command/CommandPalette').then((m) => ({ default: m.CommandPalette })),
)

// ── The full-screen workspace surfaces (SPEC-studio-ia-canonical S5) ────────────
//  A surface that re-homes onto the full-screen FocusView (in place of the editing
//  grid) rather than the left dock. Data model is the sole one: browsing/modeling the
//  data model needs no canvas, so it takes over the screen (unchanged since SL-2).
//  Theme + Site are ALSO demoted off the rail (SPEC S5) but stay left-dock surfaces
//  summoned from the top bar — deliberately NOT full-screen, so the live canvas stays
//  visible while a rebrand / nav edit repaints it (the "rebrand = data" payoff). This
//  map is the OCP seam: a future canvas-less workspace is one row + one registry target.
const WORKSPACE_SURFACES: Partial<Record<StudioSurface, FocusViewTargetId>> = {
  model: 'data-model',
}

// ── StudioShell — the AR-49 Studio (canvas-always-home + activity rail) ────────
//
//  The anti-waterfall authoring surface (spec §2): ONE live canvas, always mounted
//  as the home; the wizard's three "steps" become NON-ordered summonable surfaces
//  in a left dock, swapped by an icon activity rail. Every subsystem is MOUNTED,
//  never forked — the canvas/inspector/palette/outline are the same components the
//  wizard uses; the shell only re-homes them and threads them through one shared
//  canvas controller.
//
//  The only authoring surface (AR-49 M1.3b — the 3-step wizard is retired).
//  Accessibility (WCAG 2.1 AA, Law 9): landmark regions (header/nav/main/aside/
//  footer), a keyboard-reachable rail, and an Inspector that appears on selection.
export function StudioShell() {
  const controller = useCanvasController()
  // The active surface is DERIVED from the URL (`/studio/:surface`) and `setSurface`
  // is a real navigation — the URL is the single source of truth (no shadow store flag).
  const activeSurface = useActiveSurface()
  const setSurface = useSetSurface()

  // The role LENS is NOT read here anymore. AR-50 M5b decoupled navigation from
  // identity: entering the Data-model destination is pure navigation (setSurface), and
  // the role lens splits only that destination's CONTENT (DataModelBody, in the
  // focus-view registry — author→dictionary, steward→modeler). The shell threads no
  // role, so opening the destination never escalates the lens.
  const pages = usePages()
  const activePageId = useActivePageId()
  const setActivePage = useConstructorStore((s) => s.setActivePage)
  const site = useSite()
  const cmdk = useCommandPalette()

  // ── Selected page ↔ `?page=` — deep-linkable, SINGLE-WRITER binding ───────────
  //  The surface owns the path segment; the selected canvas page rides a query param
  //  so a pasted `/studio/<surface>?page=<id>` opens that page and Back/Forward restore
  //  it. The STORE is the sole SSOT (woven through the canvas controller, lifecycle, and
  //  every setActivePage caller); the URL is a one-way PROJECTION of it (Effect B, below).
  //  Effect A applies genuine URL events (deep-link, Back/Forward) into the store — and
  //  deliberately does NOT depend on / guard against `activePageId`. An earlier two-way
  //  form did, which let a store change re-trigger Effect A and REVERT itself; against
  //  Effect B the two sides then swapped forever (the infinite page-nav loop). setActivePage
  //  is idempotent (zustand bails on an identical value), so Effect A re-running after
  //  Effect B settles the URL is a no-op — the binding reaches a fixpoint.
  const [searchParams, setSearchParams] = useSearchParams()
  const urlPageId = searchParams.get('page')
  useEffect(() => {
    if (urlPageId && pages.some((p) => p.id === urlPageId)) {
      setActivePage(urlPageId)
    }
  }, [urlPageId, pages, setActivePage])
  // Effect B (store -> URL): a ONE-WAY projection + boot INITIALIZER only. It must NEVER
  // clobber a URL that already names a VALID page. On a fresh boot/deep-link the hydrated
  // store page (initFromApi seeds pages[0] = most-recently-updated, ORDER BY updated_at DESC)
  // may NOT match ?page=<id>; without this guard B keeps asserting the store's stale value
  // onto the URL while A chases it back — the two swap forever (the boot loop, exempt only
  // for whichever page is currently most-recently-edited). Precedence: a valid URL deep-link
  // WINS (A reconciles store<-URL, B stands down); only an absent/invalid param lets B
  // initialize URL<-store.
  useEffect(() => {
    const urlNamesValidPage = !!urlPageId && pages.some((p) => p.id === urlPageId)
    if (activePageId && activePageId !== urlPageId && !urlNamesValidPage) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('page', activePageId)
          return next
        },
        { replace: true },
      )
    }
  }, [activePageId, urlPageId, pages, setSearchParams])

  // Locale: the site's first active locale, with a top-bar PREVIEW override (spec
  // §2.1 "[ka|en]") — ephemeral view state, never persisted, reusing the existing
  // locale derivation (no new i18n machinery).
  const activeLocales = useActiveLocales()
  const [previewLocale, setPreviewLocale] = useState<Locale | null>(null)
  const locale: Locale = previewLocale ?? activeLocales[0] ?? 'ka'

  // Right-dock layout state (Wave 7): width + collapse are owned here so the shell
  // GRID column resizes/reclaims — a CSS custom property drives the column width and
  // `data-collapsed` collapses it, letting the canvas grow (no void possible).
  const [dockCollapsed, setDockCollapsed] = useState(false)
  const [dockWidth, setDockWidth] = useState(320)

  // SL-4 overflow escalation — the dock is bounded and holds FORM weight only. When
  // the nested-item editor is about to enter a WORKSPACE-weight subject (the Placement
  // Law verdict), it escalates OUT to a focus-view instead of cramming the dock.
  // StudioShell is the HOST: it holds the pending request and, while set, swaps the
  // grid for the escalated focus-view (below). The port is provided around the dock so
  // only the dock's drill boundary can escalate; a null host (isolation) → in-dock drill.
  const [escalation, setEscalation] = useState<FocusEscalationRequest | null>(null)
  const focusEscalation = useMemo(() => ({ escalate: setEscalation }), [])

  // The live skin: Strata base + the author's themeOverrides on top (overrides win).
  // Applied as custom properties on the DOCUMENT ROOT (`:root:root`) rather than
  // inline on the shell Box (ADR-021 §3): the shell + canvas still inherit (they are
  // :root descendants), AND now MUI's portalled overlays — Menu/Select/Dialog/Popover
  // and the ⌘K palette, which render at document.body OUTSIDE .studio-shell — inherit
  // Strata + live edits too, so their token-aliased MUI fills (muiTheme.ts part 2)
  // resolve to Strata instead of the brand-neutral default. Doubled pseudo (`:root:root`)
  // bumps specificity so this deterministically beats tokens.css `:root` regardless of
  // stylesheet insertion order. Still pure DATA — no theme code path (Law 2).
  const themeStyle = buildThemeVars(STRATA_PRESET, site.themeOverrides)

  // The CANVAS wears the previewed SITE's OWN brand — `site.themeOverrides` alone,
  // WITHOUT the Strata tool skin — applied on the canvas root. This is the same map
  // (and the same @statdash/styles transform) the runner applies to
  // `manifest.themeOverrides`, so the canvas paints the published brand faithfully
  // rather than the surrounding tool's identity ("the canvas never lies"). A
  // brand-less site ⇒ an empty map ⇒ the canvas shows the brand-neutral platform
  // default, exactly as the runner would.
  const canvasThemeStyle = buildThemeVars(site.themeOverrides) as CSSProperties

  const heading = SURFACE_HEADINGS[activeSurface]?.[locale] ?? ''

  // Enter / leave the Data-model destination — PURE NAVIGATION (AR-50 M5b). Entering
  // is one intentful action shared by every entry point (the always-visible rail
  // entry, the top-bar switch, the ⌘K command); it sets the `model` surface and NEVER
  // touches the role lens, so an author lands on the read-only Data Dictionary
  // (DataModelBody splits the body by lens). Leaving returns to the default compose
  // surface, loss-free, the lens untouched. Navigation and identity are independent.
  const enterDataModel = () => setSurface('model')
  // Leave ANY project workspace (Data model · Theme · Site) → back to the default
  // Compose surface (rail + canvas + inspector). One exit, loss-free (shell state
  // persists), shared by every workspace's breadcrumb-back and the top-bar toggle.
  const exitWorkspace = () => setSurface(DEFAULT_STUDIO_SURFACE)
  const openSite = () => setSurface('pages-site')

  // A project WORKSPACE surface (`model` · `style` · `pages-site`) resolves to its
  // focus-view target (SPEC S5): each is a REAL route (`/studio/<surface>`), so the
  // workspace is deep-linkable and Back/Forward moves in/out of it. When one is active
  // the shell swaps its whole grid for the full-screen focus-view; a Compose pane
  // (Add | Layers) leaves this null and renders in the left dock. Data-model's body is
  // role-split (reachable in ANY lens); Theme/Site are project-scope editors.
  const focusViewTargetId = WORKSPACE_SURFACES[activeSurface] ?? null

  // The escalated focus-view target — built from the pending request + a LIVE binding
  // to the subject's root field on the selected node (value re-read each render, writes
  // funnel back through the store via patchProp). Requires a live selection; if it
  // vanished, nothing renders (the escalation quietly drops). Takes precedence over the
  // Model route below — an active escalation is what the author navigated INTO.
  const { selected: selectedNode, patchProp } = controller
  const escalatedTarget = useMemo<FocusViewTarget | null>(() => {
    if (!escalation) return null
    if (escalation.source === 'node-field') {
      // NODE-FIELD (SL-4): bind the selected node's field live. No selection → nothing to bind.
      if (!selectedNode) return null
      const bind: FieldBinding = {
        value:    getAtPath(selectedNode.props, escalation.fieldPath),
        onChange: (next) => patchProp(escalation.fieldPath, next),
      }
      return makeEscalatedTarget(escalation, bind)
    }
    // SELF-BOUND (SL-5): a page-scoped pipeline binds its own store — no node field needed.
    return makeEscalatedTarget(escalation, null)
  }, [escalation, selectedNode, patchProp])

  return (
    <>
      {/* Strata + live edits on the document root → chrome, canvas AND body portals inherit.
          Emitted for BOTH screens (shell + focus-view) so the focus-view inherits the skin. */}
      <GlobalStyles styles={{ ':root:root': themeStyle as Record<string, string | number> }} />

      {/* ⌘K / slash palette — mounted once opened (cmdk chunk on demand). Lifted above the
          screen branch so the global ⌘K shortcut works on the focus-view screen too. */}
      {cmdk.open && (
        <Suspense fallback={<SuspenseFallback label="Loading command palette" fill={false} />}>
          <CommandPalette open={cmdk.open} onOpenChange={cmdk.setOpen} />
        </Suspense>
      )}

      {escalatedTarget ? (
        // ── ESCALATED FOCUS-VIEW — a workspace subject the dock overflowed OUT (SL-4).
        //  Same separate-screen container as Model; Back returns to the dock loss-free
        //  (the selection + drill path are untouched). One breadcrumb spine continues.
        <FocusView target={escalatedTarget} locale={locale} onBack={() => setEscalation(null)} />
      ) : focusViewTargetId ? (
        // ── FOCUS-VIEW screen — a SEPARATE route the workspace subject navigated to.
        //  The rail + docks + canvas grid are gone (not the primary chrome here — §3.4 /
        //  FF-FOCUSVIEW-SEPARATE-ROUTE); a breadcrumb-back returns to the editing shell.
        <FocusView targetId={focusViewTargetId} locale={locale} onBack={exitWorkspace} />
      ) : (
      <Box className="studio-shell">
      <StudioTopBar
        locale={locale}
        locales={PLATFORM_LOCALES}
        dataModelActive={activeSurface === 'model'}
        onOpenDataModel={enterDataModel}
        onExitDataModel={exitWorkspace}
        onLocaleChange={setPreviewLocale}
        onOpenCommand={() => cmdk.setOpen(true)}
        onOpenStyle={() => setSurface('style')}
        onOpenSite={openSite}
      />

      <ActivityRail active={activeSurface} onSelect={setSurface} locale={locale} />

      {/* ── Left dock — the summoned surface ─────────────────────────────── */}
      <Box component="aside" aria-label={heading} className="studio-left-dock">
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>{heading}</Typography>
        {renderSurface(activeSurface, controller, locale)}
      </Box>

      {/* ── Canvas — ALWAYS mounted, ALWAYS live (the home) ──────────────── */}
      <Box component="main" aria-label={locale === 'en' ? 'Canvas' : 'ტილო'} className="studio-canvas">
        {controller.nodeConfig
          ? (
            <Suspense fallback={<SuspenseFallback label="Loading canvas" />}>
              <CanvasView
                page={controller.nodeConfig}
                selectedNodeId={controller.selectedId ?? undefined}
                selectedItemPath={controller.selectedItemPath ?? undefined}
                dragging={controller.dragging}
                previewPerspectiveId={controller.previewPerspectiveId}
                onSelectNode={controller.selectNode}
                onSelectItem={controller.selectItem}
                onDropNode={controller.handleDrop}
                onBindMetric={controller.bindMetric}
                nav={controller.canvasSite.nav}
                chrome={controller.canvasSite.chrome}
                chromeConfig={controller.canvasSite.chromeConfig}
                locale={locale}
                themeVars={canvasThemeStyle}
              />
            </Suspense>
          )
          : (
            // Reached only when the effective active page is null — i.e. NO pages exist
            // (a null/stale selection with pages present now resolves to the first page,
            // FF-ALWAYS-A-HOME). So the canvas home is the no-pages state, CTA → Pages.
            <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <StudioEmptyState kind="no-pages" locale={locale} onAction={() => setSurface('pages-site')} />
            </Box>
          )}
      </Box>

      {/* ── Right dock — selection-contextual Inspector ──────────────────── */}
      <Box
        component="aside"
        aria-label={locale === 'en' ? 'Inspector' : 'ინსპექტორი'}
        className="studio-right-dock"
        data-collapsed={dockCollapsed || undefined}
        style={{ '--studio-dock-w': `${dockWidth}px` } as CSSProperties}
      >
        {/* The escalation host is provided AROUND the dock only — so a workspace-weight
            drill boundary in the Inspector can hand its subject OUT to a focus-view. */}
        <FocusEscalationContext.Provider value={focusEscalation}>
          <RightDock
            controller={controller}
            locale={locale}
            collapsed={dockCollapsed}
            onToggleCollapsed={() => setDockCollapsed((c) => !c)}
            width={dockWidth}
            onResize={setDockWidth}
          />
        </FocusEscalationContext.Provider>
      </Box>

      {/* ── Bottom strip — page tabs + status ────────────────────────────── */}
      <Box component="footer" className="studio-bottom">
        <Box role="tablist" aria-label={locale === 'en' ? 'Pages' : 'გვერდები'} sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {pages.map((p) => (
            <Chip
              key={p.id}
              size="small"
              role="tab"
              aria-selected={p.id === activePageId}
              label={p.title[locale] || p.title.ka || p.id}
              color={p.id === activePageId ? 'primary' : 'default'}
              variant={p.id === activePageId ? 'filled' : 'outlined'}
              onClick={() => setActivePage(p.id)}
            />
          ))}
        </Box>
        <Box sx={{ flex: 1 }} />
        <span>{pages.length} {locale === 'en' ? 'pages' : 'გვერდი'}</span>
      </Box>
      </Box>
      )}
    </>
  )
}

// Left-dock surface dispatch (SPEC S5). The RAIL lists only the two Navigator panes
// (Add | Layers); the project-scope Theme (`style`) + Site (`pages-site`) surfaces are
// DEMOTED off the rail but still render HERE, in the left dock, summoned from the top
// bar (so the live canvas + inspector stay visible while editing project settings).
// `model` is never reached here — it re-homes onto the full-screen <FocusView>
// (WORKSPACE_SURFACES). Data binding is no longer a pane — it is a contextual section
// of the right Inspector (reached by selecting a data-bound element).
function renderSurface(surface: StudioSurface, controller: ReturnType<typeof useCanvasController>, locale: Locale) {
  switch (surface) {
    case 'insert':     return <InsertSurface controller={controller} locale={locale} />
    case 'layers':     return <LayersSurface locale={locale} />
    case 'style':      return <StyleSurface locale={locale} />
    case 'pages-site': return <PagesSiteSurface controller={controller} locale={locale} />
    default:           return null
  }
}

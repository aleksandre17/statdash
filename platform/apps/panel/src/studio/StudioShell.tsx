import { lazy, Suspense, useState } from 'react'
import { Box, Typography, Chip } from '@mui/material'
// Token SSOT — the shell chrome reads @statdash/styles DTCG custom properties
// (studio.css). Importing it here (not in main.tsx) keeps the token layer in the
// Studio's own lazy chunk, so the default wizard path never loads it (Strangler:
// the shell is purely additive behind the flag).
import '@statdash/styles/css/index.css'
import './studio.css'
import { ActivityRail } from './ActivityRail'
import { StudioTopBar } from './StudioTopBar'
import { RightDock } from './RightDock'
import { SURFACE_HEADINGS } from './rail'
import { useCanvasController } from './useCanvasController'
import { InsertSurface } from './surfaces/InsertSurface'
import { DataSurface } from './surfaces/DataSurface'
import { LayersSurface } from './surfaces/LayersSurface'
import { PagesSiteSurface } from './surfaces/PagesSiteSurface'
import { StyleSurface } from './surfaces/StyleSurface'
import { useConstructorStore, useActiveSurface, usePages, useActivePageId, useSite } from '../store/constructor.store'
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
  const activeSurface = useActiveSurface()
  const setSurface = useConstructorStore((s) => s.setSurface)
  const pages = usePages()
  const activePageId = useActivePageId()
  const setActivePage = useConstructorStore((s) => s.setActivePage)
  const site = useSite()
  const cmdk = useCommandPalette()

  // Locale: the site's first active locale, with a top-bar PREVIEW override (spec
  // §2.1 "[ka|en]") — ephemeral view state, never persisted, reusing the existing
  // locale derivation (no new i18n machinery).
  const activeLocales = useActiveLocales()
  const [previewLocale, setPreviewLocale] = useState<Locale | null>(null)
  const locale: Locale = previewLocale ?? activeLocales[0] ?? 'ka'

  // The live skin: Strata base + the author's themeOverrides on top (overrides
  // win). Applied as inline custom properties on the shell root — chrome AND the
  // canvas descend from it, so an edit repaints both on the next render. This is
  // the whole "rebrand = data" mechanism (Law 2 — data only, no theme code path).
  const themeStyle = buildThemeVars(STRATA_PRESET, site.themeOverrides)

  const heading = SURFACE_HEADINGS[activeSurface]?.[locale] ?? ''

  return (
    <Box className="studio-shell" style={themeStyle}>
      <StudioTopBar
        locale={locale}
        locales={PLATFORM_LOCALES}
        onLocaleChange={setPreviewLocale}
        onOpenCommand={() => cmdk.setOpen(true)}
        onOpenStyle={() => setSurface('style')}
      />

      {/* ⌘K / slash palette — mounted only once opened (cmdk chunk on demand). */}
      {cmdk.open && (
        <Suspense fallback={<SuspenseFallback label="Loading command palette" fill={false} />}>
          <CommandPalette open={cmdk.open} onOpenChange={cmdk.setOpen} />
        </Suspense>
      )}

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
                dragging={controller.dragging}
                previewPerspectiveId={controller.previewPerspectiveId}
                onSelectNode={controller.selectNode}
                onDropNode={controller.handleDrop}
                onBindMetric={controller.bindMetric}
              />
            </Suspense>
          )
          : (
            <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled' }}>
              <Typography variant="body2">{locale === 'en' ? 'No page selected' : 'გვერდი არ არის არჩეული'}</Typography>
            </Box>
          )}
      </Box>

      {/* ── Right dock — selection-contextual Inspector ──────────────────── */}
      <Box component="aside" aria-label={locale === 'en' ? 'Inspector' : 'ინსპექტორი'} className="studio-right-dock">
        <RightDock controller={controller} />
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
  )
}

// Left-dock surface dispatch (OCP — one case per rail entry; Model is locked so it
// never reaches here, but the default keeps the render total).
function renderSurface(surface: StudioSurface, controller: ReturnType<typeof useCanvasController>, locale: Locale) {
  switch (surface) {
    case 'insert':     return <InsertSurface controller={controller} />
    case 'data':       return <DataSurface controller={controller} locale={locale} />
    case 'layers':     return <LayersSurface />
    case 'pages-site': return <PagesSiteSurface />
    case 'style':      return <StyleSurface locale={locale} />
    case 'model':      return null // locked (M2) — unreachable via the rail
    default:           return null
  }
}

import { lazy, Suspense, useState } from 'react'
import { Box, Divider } from '@mui/material'
import { SiteIdentityEditor, NavEditor } from '../../features/site'
import { ChromeCompositionPanel } from '../../features/chrome/ChromeCompositionPanel'
import { SuspenseFallback } from '../../shared/SuspenseFallback'
import type { CanvasController } from '../useCanvasController'
import type { Locale } from '../../types/constructor'

// The real page-create dialog (browse/open/create + templates). Lazy so its
// TemplateGallery weight loads only when an author opens "+ add page" — it never
// sits in the eager StudioShell chunk.
const PageBrowser = lazy(() =>
  import('../../features/page-workflow').then((m) => ({ default: m.PageBrowser })),
)

// ── Pages & Site surface — identity + navigation + real page create (AR-49 M1.3) ─
//
//  The site's authoring home: Identity + Navigation + Chrome. Mounts the SAME
//  shared editors (SiteIdentityEditor / NavEditor — no fork, Law 6/7), writing the
//  real site slice via the SAME store actions (updateSite / reorderNav /
//  updateNavItem / removeNavItem) — byte-identical. Unlike the wizard's
//  `notify('coming soon')` stub, "+ add page" here is WIRED to the real page-create
//  flow (PageBrowser → createPage / createFromTemplate).
//
//  Chrome (header / left-bar sidebar / footer) is SITE furniture with TWO canonical ways
//  in (the Webflow/Figma model — canvas OR panel):
//    1. Canvas-select — S6 makes each rendered region CLICKABLE on the canvas; selecting
//       it (the ONE `PartAddress`) opens its schema-driven editor in the RightDock via the
//       generic `element.schema` + chrome facet, the SAME path a node/part takes.
//    2. This panel — the ChromeCompositionPanel: the WHOLE chrome SET, incl. regions that
//       are currently switched OFF (so not clickable on canvas). Enable/disable (swap to
//       the `hidden` variant), swap variant, or "Open" a region for deep per-region edit.
//  The retired `ChromePalette`/`ChromeInspectorPanel` fork is NOT reintroduced — the
//  composition panel reuses the SAME store actions + controller (no fork, Law 6/7). This
//  surface is summoned from the labeled top-bar "Site & chrome" entry, so the composition
//  is reachable directly — not only via select-a-region-then-Back.
export function PagesSiteSurface(
  { controller, locale }: { controller: CanvasController; locale: Locale },
) {
  const [browserOpen, setBrowserOpen] = useState(false)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <SiteIdentityEditor />
      <NavEditor onAddPage={() => setBrowserOpen(true)} />

      <Divider flexItem />
      {/* The site-frame's whole-chrome composition — the direct, labeled-entry home for
          the chrome set (twin of clicking a chrome region on the canvas). */}
      <ChromeCompositionPanel locale={locale} controller={controller} />

      {browserOpen && (
        <Suspense fallback={<SuspenseFallback label="Loading pages" fill={false} />}>
          <PageBrowser open={browserOpen} onClose={() => setBrowserOpen(false)} />
        </Suspense>
      )}
    </Box>
  )
}

import { lazy, Suspense, useState } from 'react'
import { Box } from '@mui/material'
import { SiteIdentityEditor, NavEditor } from '../../features/site'
import { SuspenseFallback } from '../../shared/SuspenseFallback'

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
//  Chrome (header / left-bar sidebar / footer) is SITE furniture, but it is no longer
//  authored from a LIST here: S6 makes chrome CANVAS-SELECTABLE — clicking a header /
//  sidebar / footer region on the live canvas selects it (the ONE `PartAddress`) and its
//  schema-driven editor opens in the RightDock via the generic `element.schema` section,
//  the SAME path a node/part takes. The `ChromePalette` + `ChromeInspectorPanel` fork is
//  retired; this surface stays focused on identity + navigation + page creation.
export function PagesSiteSurface() {
  const [browserOpen, setBrowserOpen] = useState(false)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <SiteIdentityEditor />
      <NavEditor onAddPage={() => setBrowserOpen(true)} />

      {browserOpen && (
        <Suspense fallback={<SuspenseFallback label="Loading pages" fill={false} />}>
          <PageBrowser open={browserOpen} onClose={() => setBrowserOpen(false)} />
        </Suspense>
      )}
    </Box>
  )
}

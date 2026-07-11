import { lazy, Suspense, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { SiteIdentityEditor, NavEditor } from '../../features/site'
import { ChromePalette } from '../../inspector'
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
//  Chrome (header / left-bar sidebar / footer) is SITE furniture — it belongs here,
//  next to identity + nav, NOT in the page-content Insert palette. Selecting a chrome
//  element (ChromePalette → store.selectChrome) opens its schema-driven editor in the
//  RightDock (ChromeInspectorPanel), the SAME generic Inspector nodes use. This is the
//  reachability fix: chrome authoring is now a first-class part of the site surface.
export function PagesSiteSurface() {
  const [browserOpen, setBrowserOpen] = useState(false)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <SiteIdentityEditor />
      <NavEditor onAddPage={() => setBrowserOpen(true)} />

      <Box>
        <Typography variant="overline" color="text.secondary">ჩარჩო</Typography>
        <ChromePalette />
      </Box>

      {browserOpen && (
        <Suspense fallback={<SuspenseFallback label="Loading pages" fill={false} />}>
          <PageBrowser open={browserOpen} onClose={() => setBrowserOpen(false)} />
        </Suspense>
      )}
    </Box>
  )
}

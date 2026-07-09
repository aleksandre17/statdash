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
//  Relocates SiteStep's Identity + Navigation into the Studio left dock by mounting
//  the SAME shared editors the wizard uses (SiteIdentityEditor / NavEditor — no
//  fork, Law 6/7). Writes the real site slice via the SAME store actions
//  (updateSite / reorderNav / removeNavItem) — byte-identical. Unlike the wizard's
//  `notify('coming soon')` stub, "+ add page" here is WIRED to the real page-create
//  flow (PageBrowser → createPage / createFromTemplate) — spec §3 stub→real, done
//  by reusing the existing dialog (trivial: no new create path invented).
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

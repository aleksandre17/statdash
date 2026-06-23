// ── PageLoader — page renderer ────────────────────────────────────────
//
//  Reads pageId from URL params → resolves the page from the ACTIVE MANIFEST
//  (SiteContext, via usePageById) → renders PageRenderer.
//
//  The bootstrapped manifest is the runtime SSOT for pages (App injects
//  manifest.pages into SiteProvider). The runner carries no compiled-in pages:
//  pages come from /api/bootstrap, or from the generic emptyManifest fallback
//  when the API is unavailable (ADR-0028). PageLoader is content-agnostic.
//
import { useParams }            from 'react-router-dom'
import { NodePageRenderer }     from '@statdash/react/engine'
import { usePageById }          from '@statdash/react'
import { extensionRegistry }    from '@/extensions/registry'

// ── Loading skeleton ───────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="page-skeleton" aria-busy="true" aria-label="Loading…">
      <div className="page-skeleton__header" />
      <div className="page-skeleton__filters" />
      <div className="page-skeleton__kpis">
        {[1, 2, 3, 4].map((i) => <div key={i} className="page-skeleton__kpi" />)}
      </div>
      <div className="page-skeleton__section" />
      <div className="page-skeleton__section" />
    </div>
  )
}

// ── 404 ───────────────────────────────────────────────────────────────

function PageNotFound({ pageId }: { pageId: string }) {
  return (
    <div className="page-not-found" role="main">
      <h1>Page not found</h1>
      <p>No page is registered for id <code>{pageId}</code>.</p>
    </div>
  )
}

// ── PageLoader ────────────────────────────────────────────────────────

export default function PageLoader() {
  const { pageId = '' } = useParams<{ pageId: string }>()
  const page            = usePageById(pageId)   // active-manifest lookup (SSOT)

  if (!pageId)            return <PageSkeleton />
  if (!page)              return <PageNotFound pageId={pageId} />
  if (page.id !== pageId) return <PageSkeleton />   // invariant: render only the page matching the current URL

  return <NodePageRenderer key={page.id} page={page} extensions={extensionRegistry} />
}
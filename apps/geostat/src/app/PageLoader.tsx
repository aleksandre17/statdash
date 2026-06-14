// ── PageLoader — page renderer ────────────────────────────────────────
//
//  Reads pageId from URL params → loadPage(id) → renders PageRenderer.
//  All pages are now PageConfig — migration complete, legacy branch removed.
//
//  Phase 2 drop-in: replace loadPage() body with API fetch — no other changes.
//
import { useState, useEffect }  from 'react'
import { useParams }            from 'react-router-dom'
import { NodePageRenderer }     from '@geostat/react/engine'
import type { NodePageConfig }  from '@geostat/react/engine'
import { loadPage }             from '@/data/pages/registry'

// ── Loading skeleton ───────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="page-skeleton" aria-busy="true" aria-label="იტვირთება...">
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
      <h1>გვერდი ვერ მოიძებნა</h1>
      <p><code>{pageId}</code> — ამ id-ით გვერდი რეგისტრირებული არ არის.</p>
    </div>
  )
}

// ── PageLoader ────────────────────────────────────────────────────────

export default function PageLoader() {
  const { pageId = '' }     = useParams<{ pageId: string }>()
  const [page,   setPage]   = useState<NodePageConfig | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound'>('loading')

  useEffect(() => {
    if (!pageId) { setStatus('notfound'); return }
    setStatus('loading')
    setPage(null)

    loadPage(pageId).then((p) => {
      if (p) { setPage(p); setStatus('ready') }
      else   { setStatus('notfound') }
    })
  }, [pageId])

  if (status === 'loading')  return <PageSkeleton />
  if (status === 'notfound') return <PageNotFound pageId={pageId} />
  if (page?.id !== pageId)   return <PageSkeleton />   // invariant: render only the page matching the current URL

  return <NodePageRenderer key={page!.id} page={page!} />
}
// ── SuspenseFallback — accessible loading state for lazy boundaries ───────────
//
//  The heavy renderer surface (the @statdash/react engine + ApexCharts + Leaflet,
//  reached only once a page renders) is code-split behind a route-level
//  React.lazy boundary. While its chunk is in flight, React renders the nearest
//  <Suspense fallback>. A blank fallback is a WCAG failure (no programmatic
//  announcement, no perceivable status) — and this is the PUBLIC renderer, where
//  accessibility is Law 9 — so the boundary uses this labelled, ARIA-live status
//  region instead.
//
//  role="status" + aria-live="polite" announces the loading state to assistive
//  tech without stealing focus; aria-busy marks the region busy; aria-label gives
//  the region an accessible name (WCAG 2.1 AA — 4.1.2 Name/Role/Value, 1.3.1 Info
//  & Relationships) — the same labelling the eager AppSkeleton uses. The visual
//  content reuses the existing app-skeleton structure so the fallback is layout-
//  stable (no CLS) and brand-neutral (Law 1 — no tenant content in the shell).
//
//  `label` is an app-tier en baseline string (the runner ships the en UI-chrome
//  baseline; tenant locales arrive via the manifest i18n catalog at boot, which
//  is not yet resolved at this pre-render moment — so a bare en string is correct
//  here, mirroring the AppSkeleton it replaces).
//
export interface SuspenseFallbackProps {
  /** Accessible label announced while the chunk loads. */
  label: string
}

export function SuspenseFallback({ label }: SuspenseFallbackProps) {
  return (
    <div
      className="app-skeleton"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="app-skeleton__nav" />
      <div className="app-skeleton__page">
        <div className="app-skeleton__header" />
        <div className="app-skeleton__content" />
      </div>
    </div>
  )
}

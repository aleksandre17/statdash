import { useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  DEFAULT_STUDIO_SURFACE,
  STUDIO_SURFACES,
  type StudioSurface,
} from '../types/constructor'

// ── useStudioRoute — the URL is the ONE source of truth for the Studio surface ──
//
//  The owner's "activate, not shadow": the activity-rail surface (and the selected
//  page) live in the ADDRESS BAR, not a shadow store flag. Clicking a surface pushes
//  a real history entry (browser Back/Forward work), and a pasted `/studio/<surface>`
//  URL opens that surface (permalink). The store no longer holds `activeSurface` — a
//  single source, no dual-state drift (the D-SL-2a "route, never a step" deferral is
//  now the real route it always described).
//
//  Scheme (one path segment per surface, the id doubles as the segment):
//    /studio/:surface   — surface ∈ STUDIO_SURFACES (insert·data·layers·pages-site·style·model)
//    ?page=<pageId>     — the selected canvas page, a query refinement that rides
//                         across surface changes (bound to the store in StudioShell).
//  Node/band/chrome selection stays EPHEMERAL (transient editing state) — not routed.

export const STUDIO_BASE = '/studio'

/** The canonical path for a surface — the single place the scheme is spelled. */
export const studioSurfacePath = (surface: StudioSurface) => `${STUDIO_BASE}/${surface}`

/** Narrow a raw route param to a known surface (an unknown segment is not one). */
export function isStudioSurface(value: string | undefined): value is StudioSurface {
  return value != null && (STUDIO_SURFACES as readonly string[]).includes(value)
}

/**
 * The active surface, DERIVED from the `:surface` route param. An unknown/absent
 * segment resolves to the default (defensive — the redirect route normally prevents
 * this, but a hook must never return an invalid surface).
 */
export function useActiveSurface(): StudioSurface {
  const { surface } = useParams()
  return isStudioSurface(surface) ? surface : DEFAULT_STUDIO_SURFACE
}

/**
 * The surface setter — a real navigation (`setSurface → navigate`). The current
 * query string (notably `?page=`) is PRESERVED so switching surfaces keeps the
 * selected page. Pushes a history entry, so Back returns to the prior surface.
 */
export function useSetSurface(): (surface: StudioSurface) => void {
  const navigate = useNavigate()
  const [search] = useSearchParams()
  return useCallback(
    (surface: StudioSurface) => {
      const qs = search.toString()
      navigate({ pathname: studioSurfacePath(surface), search: qs ? `?${qs}` : '' })
    },
    [navigate, search],
  )
}

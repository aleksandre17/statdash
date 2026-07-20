import { Navigate, Route, Routes } from 'react-router-dom'
import { DEFAULT_STUDIO_SURFACE } from '../types/constructor'
import { STUDIO_BASE, studioSurfacePath, studioDataPath } from './useStudioRoute'
import { StudioShell } from './StudioShell'

// ── StudioRoutes — the Studio's route table (AR-49 M0 real routing) ────────────
//
//  ONE StudioShell, parameterised by the `:surface` segment: the shell reads the
//  surface from the route (useActiveSurface) and the rail navigates to it, so the
//  URL is the single source of truth. Any non-surface path (bare `/`, `/studio`, an
//  unknown segment) redirects to the default surface — a pasted or stale URL always
//  lands somewhere valid. Shared by the App (production) AND the unit tests (via a
//  MemoryRouter), so tests exercise the exact production route wiring.
//
//  ── ADR-051 DU1 — the ONE Data workspace redirects ────────────────────────────
//  The two former peer doors fold into `/studio/data`. Their old routes 301-redirect
//  (the SPA equivalent — `<Navigate replace>` is a permanent, history-non-additive
//  redirect) so bookmarks + the still-live cross-gesture courier keep landing somewhere
//  valid: `/studio/sources` → the Sources floor (step 0); `/studio/model` → the Model
//  floor (`?dataFloor=model`, so browse-in-workbench still opens the modeler). These
//  static routes take precedence over the dynamic `:surface` route. Strangler-safe +
//  reversible — the redirects are kept, not deletions; DU2/DU3 retire them.
export function StudioRoutes() {
  return (
    <Routes>
      <Route path={`${STUDIO_BASE}/sources`} element={<Navigate to={studioDataPath()} replace />} />
      <Route path={`${STUDIO_BASE}/model`}   element={<Navigate to={studioDataPath('model')} replace />} />
      <Route path={`${STUDIO_BASE}/:surface`} element={<StudioShell />} />
      <Route path="*" element={<Navigate to={studioSurfacePath(DEFAULT_STUDIO_SURFACE)} replace />} />
    </Routes>
  )
}

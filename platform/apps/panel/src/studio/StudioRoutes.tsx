import { Navigate, Route, Routes } from 'react-router-dom'
import { DEFAULT_STUDIO_SURFACE } from '../types/constructor'
import { STUDIO_BASE, studioSurfacePath } from './useStudioRoute'
import { StudioShell } from './StudioShell'

// ── StudioRoutes — the Studio's route table (AR-49 M0 real routing) ────────────
//
//  ONE StudioShell, parameterised by the `:surface` segment: the shell reads the
//  surface from the route (useActiveSurface) and the rail navigates to it, so the
//  URL is the single source of truth. Any non-surface path (bare `/`, `/studio`, an
//  unknown segment) redirects to the default surface — a pasted or stale URL always
//  lands somewhere valid. Shared by the App (production) AND the unit tests (via a
//  MemoryRouter), so tests exercise the exact production route wiring.
export function StudioRoutes() {
  return (
    <Routes>
      <Route path={`${STUDIO_BASE}/:surface`} element={<StudioShell />} />
      <Route path="*" element={<Navigate to={studioSurfacePath(DEFAULT_STUDIO_SURFACE)} replace />} />
    </Routes>
  )
}

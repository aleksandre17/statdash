import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render } from '@testing-library/react'
import { StudioRoutes } from '../studio/StudioRoutes'
import { studioSurfacePath } from '../studio/useStudioRoute'
import type { StudioSurface } from '../types/constructor'

// ── Test support — render the Studio through its REAL route table ──────────────
//
//  The surface is URL state now (`/studio/:surface`), so unit tests drive it via the
//  route, exercising the SAME StudioRoutes wiring production uses (a MemoryRouter at the
//  target path). This is not a test-only fork of the shell — it is the production route
//  table, seeded at an initial entry.

/** Render the Studio at a given surface (optionally deep-linked to a `?page=<id>`). */
export function renderStudio(surface: StudioSurface = 'insert', opts: { page?: string } = {}) {
  const path = studioSurfacePath(surface) + (opts.page ? `?page=${opts.page}` : '')
  return render(
    <MemoryRouter initialEntries={[path]}>
      <StudioRoutes />
    </MemoryRouter>,
  )
}

/** Render any element inside a MemoryRouter — for components that use routing hooks. */
export function renderRouted(ui: ReactElement, initialEntries: string[] = ['/studio/insert']) {
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>)
}

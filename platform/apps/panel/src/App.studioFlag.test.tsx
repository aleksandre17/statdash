import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Boot is stubbed to resolve immediately WITHOUT the network + WITHOUT seeding mock
// data (initFromApi → true means App skips the mock fallback), so the store has no
// page and the Studio's always-mounted canvas shows its no-page state instead of
// lazy-loading the heavy real renderer — keeping the routing assertion deterministic.
vi.mock('./store/api-actions', async (orig) => ({
  ...(await orig<typeof import('./store/api-actions')>()),
  initFromApi: vi.fn(async () => true),
}))
vi.mock('./store/bootstrapCatalog', () => ({ bootstrapCatalog: vi.fn(async () => true) }))

import { App } from './App'
import { setupCanvasRegistry } from './canvas/setupCanvasRegistry'
import { setToken, logout } from './lib/auth'
import { STUDIO_SHELL_FLAG } from './config/flags'

beforeEach(() => {
  setupCanvasRegistry()      // palettes populate; shell/wizard mounts stay crash-free
  setToken('test-token')     // isAuthenticated() → true, so App boots past LoginForm
})
afterEach(() => {
  logout()
  localStorage.removeItem(STUDIO_SHELL_FLAG)
})

describe('App — STUDIO_SHELL flag routing (Strangler: additive, reversible)', () => {
  it('flag OFF (default) → the 3-step wizard, no Studio chrome', async () => {
    render(<App />)
    // WizardStepper renders the step labels (default locale ka) once boot is ready.
    expect(await screen.findByText('მონაცემები')).toBeInTheDocument()
    // No Studio banner/rail on the wizard path (App defaults to ka locale).
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'სტუდიოს ზედაპირები' })).not.toBeInTheDocument()
  })

  it('flag ON → the StudioShell mounts, no wizard stepper', async () => {
    localStorage.setItem(STUDIO_SHELL_FLAG, 'on')
    render(<App />)
    // The shell top bar (banner) appears once its lazy chunk + boot resolve.
    // Generous timeout — the lazy StudioShell chunk transforms its whole subsystem
    // graph on first import under vitest.
    expect(await screen.findByRole('banner', {}, { timeout: 20000 })).toBeInTheDocument()
    // Rail nav (App defaults to ka locale, so its name is Georgian).
    expect(screen.getByRole('navigation', { name: 'სტუდიოს ზედაპირები' })).toBeInTheDocument()
    // The wizard stepper's visible step label is not on the Studio path.
    expect(screen.queryByText('მონაცემები')).not.toBeInTheDocument()
  })
})

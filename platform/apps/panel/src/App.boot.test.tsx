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

beforeEach(() => {
  setupCanvasRegistry()      // palettes populate; shell mounts stay crash-free
  setToken('test-token')     // isAuthenticated() → true, so App boots past LoginForm
})
afterEach(() => logout())

describe('App — boots straight into the Studio (AR-49 M1.3b: wizard retired)', () => {
  it('mounts the StudioShell unconditionally — no flag, no wizard', async () => {
    render(<App />)
    // The shell top bar (banner) appears once its lazy chunk + boot resolve.
    // Generous timeout — the lazy StudioShell chunk transforms its whole subsystem
    // graph on first import under vitest.
    expect(await screen.findByRole('banner', {}, { timeout: 20000 })).toBeInTheDocument()
    // Rail nav (App defaults to ka locale, so its name is Georgian).
    expect(screen.getByRole('navigation', { name: 'სტუდიოს ზედაპირები' })).toBeInTheDocument()
    // The retired wizard stepper's step label is never on the Studio path.
    expect(screen.queryByText('მონაცემები')).not.toBeInTheDocument()
  })
})

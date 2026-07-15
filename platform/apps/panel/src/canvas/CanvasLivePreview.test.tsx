// ── CanvasLivePreview.test — live-default preview + fail-soft (W1 · Canon C2) ──
//
//  Three guarantees:
//    (a) LIVE is the DEFAULT (C2 — the canvas never lies): the canvas opens in live
//        mode with no structural "preview off" veil. With no cube-bound source it
//        fails soft to the honest badge (never a silent structural zero paraded as
//        real).
//    (b) live builds the store map from a cube-bound descriptor through the shared
//        builder; the renderer receives the LIVE (non-empty) store.
//    (c) fail-soft: a cube-bound source whose profile errors (or whose build
//        throws) falls back to the static store + shows the non-blocking badge,
//        never throwing.
//
//  buildStoreManifest + cubeApi are mocked (no real network) — the same boundary
//  the existing discovery tests stub. The constructor store is the real singleton,
//  driven through its public actions.
//
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import type { CubeProfile } from '../lib/cubeApi'
import type { NodePageConfig } from '@statdash/react/engine'

// ── Mocks ─────────────────────────────────────────────────────────────────────

// vi.mock factories are hoisted above imports — the spies they close over must be
// created in vi.hoisted so they exist when the factory runs.
const { buildStoreManifest, profile } = vi.hoisted(() => ({
  buildStoreManifest: vi.fn(),
  profile:            vi.fn(),
}))

// Override ONLY buildStoreManifest; keep the rest of the engine adapter real so
// the renderer (NodePageRenderer, registries) works end to end.
vi.mock('@statdash/react/engine', async (orig) => {
  const actual = await orig<typeof import('@statdash/react/engine')>()
  return { ...actual, buildStoreManifest }
})

// Profile discovery is the live-reachability gate. Stub cubeApi.profile so we
// control whether the active cube resolves 'ready' (cube reachable) or 'error'.
vi.mock('../lib/cubeApi', () => ({ cubeApi: { profile, classify: vi.fn() } }))

import { CanvasView } from './CanvasView'
import { setupCanvasRegistry } from './setupCanvasRegistry'
import { useConstructorStore } from '../store/constructor.store'
import { useCubeProfileStore } from '../discovery/cubeProfile.store'
import type { DataSourceDef } from '../types/constructor'

const page = {
  type: 'inner-page', id: 'page-1', path: 'gdp',
  children: [{ type: 'section', id: 'sec-1', title: 'GDP', children: [] }],
} as unknown as NodePageConfig

const READY_PROFILE: CubeProfile = {
  datasetCode: 'GDP', dimensions: [], measures: [],
  actualRegion: { available: false, combinations: null },
}

const cubeSource: DataSourceDef = {
  id: 'ds-cube', name: 'Stats', type: 'sdmx-json', url: 'http://api',
  config: { datasetCode: 'GDP', nonTimeDims: ['measure'] }, status: 'connected',
}

// Registration is now an explicit boot step (App.startApp), not a CanvasView
// module-eval side effect — run it once so the isolated canvas has its node shells.
beforeAll(() => { setupCanvasRegistry() })

// Reset the shared singletons + mocks between tests (the store/profile cache are
// module-global; a dirty state would leak across cases).
beforeEach(() => {
  buildStoreManifest.mockReset()
  profile.mockReset()
  act(() => {
    useConstructorStore.setState({ dataSources: [] })
    useCubeProfileStore.setState({ byCode: {} })
  })
})

const renderCanvas = () =>
  render(<CanvasView page={page} onSelectNode={vi.fn()} onDropNode={vi.fn()} />)

describe('CanvasView — G3.1 live preview', () => {
  it('(a) LIVE is the default — no structural veil; no source ⇒ honest badge, no silent fake', async () => {
    renderCanvas()
    expect(screen.getByTestId('canvas-toolbar')).toBeInTheDocument()
    // Live is the active mode → the "preview off" veil is ABSENT (the canvas is not
    // declaring structural fakes; it is trying to show truth).
    expect(screen.getByRole('radio', { name: 'ცოცხალი მონაცემები' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByTestId('canvas-structural-veil')).not.toBeInTheDocument()
    // No cube-bound source (dataSources: []) → deriveLiveDescriptors [] → the builder
    // is never invoked AND live degrades to the honest 'unavailable' badge (fail-soft),
    // rather than silently painting structural zeros as if they were real.
    expect(buildStoreManifest).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(screen.getByTestId('canvas-live-unavailable')).toBeInTheDocument(),
    )
  })

  it('(b) live builds the store map from a cube-bound descriptor', async () => {
    const liveStore = { kind: 'live-store' }
    buildStoreManifest.mockResolvedValue({ default: liveStore })
    profile.mockResolvedValue(READY_PROFILE)
    act(() => { useConstructorStore.setState({ dataSources: [cubeSource] }) })

    renderCanvas()

    // Flip to live — the profile resolves 'ready', then the manifest builds.
    fireEvent.click(screen.getByRole('radio', { name: 'ცოცხალი მონაცემები' }))

    await waitFor(() => expect(buildStoreManifest).toHaveBeenCalledTimes(1))
    // Built from the first-cube-bound descriptor (kind 'stats', keyed default).
    expect(buildStoreManifest).toHaveBeenCalledWith([
      { id: 'default', kind: 'stats', url: 'http://api', params: { datasetCode: 'GDP', nonTimeDims: ['measure'] } },
    ])
    // Live mounted → NOT showing the unavailable badge.
    await waitFor(() =>
      expect(screen.queryByTestId('canvas-live-unavailable')).not.toBeInTheDocument(),
    )
  })

  it('(c) fail-soft: profile error → static store + badge, no throw', async () => {
    profile.mockRejectedValue(new Error('cube 404'))
    act(() => { useConstructorStore.setState({ dataSources: [cubeSource] }) })

    renderCanvas()
    fireEvent.click(screen.getByRole('radio', { name: 'ცოცხალი მონაცემები' }))

    // Profile gate fails → never builds, falls back to structural + badge.
    await waitFor(() =>
      expect(screen.getByTestId('canvas-live-unavailable')).toBeInTheDocument(),
    )
    expect(buildStoreManifest).not.toHaveBeenCalled()
    // The canvas still rendered (no crash).
    expect(screen.getByTestId('canvas-root')).toBeInTheDocument()
  })

  it('(c2) fail-soft: no cube-bound source → badge on live, no build', async () => {
    // sources stay [] → deriveLiveDescriptors returns [] → unavailable.
    renderCanvas()
    fireEvent.click(screen.getByRole('radio', { name: 'ცოცხალი მონაცემები' }))
    await waitFor(() =>
      expect(screen.getByTestId('canvas-live-unavailable')).toBeInTheDocument(),
    )
    expect(buildStoreManifest).not.toHaveBeenCalled()
  })

  it('(d) G3.2: rapid page (DataSpec) edits in live mode do NOT rebuild the store map', async () => {
    // The live-store map keys off the cube binding (descriptors), NOT the page.
    // Editing a node's DataSpec changes the page but not the descriptors, so the
    // expensive buildStoreManifest must run ONCE across an edit burst — the map is
    // stable and the debounced page feeds the renderer without cache-busting it.
    const liveStore = { kind: 'live-store' }
    buildStoreManifest.mockResolvedValue({ default: liveStore })
    profile.mockResolvedValue(READY_PROFILE)
    act(() => { useConstructorStore.setState({ dataSources: [cubeSource] }) })

    const editedPage = (n: number) =>
      ({ ...(page as object), _edit: n }) as unknown as NodePageConfig

    const { rerender } = render(
      <CanvasView page={editedPage(0)} onSelectNode={vi.fn()} onDropNode={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('radio', { name: 'ცოცხალი მონაცემები' }))
    await waitFor(() => expect(buildStoreManifest).toHaveBeenCalledTimes(1))

    // A burst of rapid DataSpec edits (new page identity each time).
    for (let n = 1; n <= 8; n++) {
      rerender(<CanvasView page={editedPage(n)} onSelectNode={vi.fn()} onDropNode={vi.fn()} />)
    }

    // The store map is built off the (unchanged) cube binding — still ONE build,
    // no per-edit rebuild that would discard the cache (root-cause: descriptors,
    // not page, drive the build).
    expect(buildStoreManifest).toHaveBeenCalledTimes(1)
  })

  it('(c3) fail-soft: buildStoreManifest throws → badge, no crash', async () => {
    buildStoreManifest.mockRejectedValue(new Error('API down'))
    profile.mockResolvedValue(READY_PROFILE)
    act(() => { useConstructorStore.setState({ dataSources: [cubeSource] }) })

    renderCanvas()
    fireEvent.click(screen.getByRole('radio', { name: 'ცოცხალი მონაცემები' }))

    await waitFor(() => expect(buildStoreManifest).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.getByTestId('canvas-live-unavailable')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('canvas-root')).toBeInTheDocument()
  })
})

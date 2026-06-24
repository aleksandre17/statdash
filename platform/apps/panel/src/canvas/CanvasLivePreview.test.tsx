// ── CanvasLivePreview.test — G3.1 structural | live preview + fail-soft ──────
//
//  Three guarantees:
//    (a) structural (default) renders via the empty staticStore exactly as before
//        — no buildStoreManifest call, no badge (byte-identical preview path).
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
import { describe, it, expect, vi, beforeEach } from 'vitest'
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
  it('(a) structural is the default — no manifest build, no badge', () => {
    renderCanvas()
    expect(screen.getByTestId('canvas-toolbar')).toBeInTheDocument()
    // Default mode = structural → the live builder is never invoked.
    expect(buildStoreManifest).not.toHaveBeenCalled()
    expect(screen.queryByTestId('canvas-live-unavailable')).not.toBeInTheDocument()
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

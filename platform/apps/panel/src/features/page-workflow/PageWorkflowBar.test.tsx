// ── PageWorkflowBar.test — the save→guard→publish UX (block / 403 / reflect) ──
//
//  Drives the workflow toolbar end-to-end against a mock fetch boundary, asserting
//  the user-facing gate UX:
//    - a guard-blocked save renders the inline SaveIssueList (which node/field)
//    - a successful save clears the issues + reflects the status badge
//    - a publish 403 renders the "needs publisher/admin" alert (server FSM)
//    - the status badge reflects the SERVER lifecycle, not client guesses
//
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { setupCanvasRegistry } from '../../canvas/setupCanvasRegistry'
import { nodeRegistry } from '@statdash/react/engine'
import { useConstructorStore } from '../../store/constructor.store'
import { PageWorkflowBar } from './PageWorkflowBar'
import type { CanvasNode, CanvasPage } from '../../types/constructor'

beforeAll(() => { setupCanvasRegistry() })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

type Responder = (method: string, url: string) => { status: number; data?: unknown; error?: string }
let responder: Responder

function installFetch() {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const r = responder(method, String(url))
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => (r.error ? { error: r.error } : { data: r.data }),
    } as Response
  }))
}

const store = () => useConstructorStore.getState()

function seed(page: CanvasPage, status: 'draft' | 'published' = 'draft') {
  useConstructorStore.setState({
    pages: [page], activePageId: page.id,
    selectedNodeId: null, chromeSelection: null,
    lifecycle: { [page.id]: { status, versionNumber: 1, latestPublished: status === 'published', dirty: false } },
    saveStatus: {}, publishStatus: {},
    undoStack: [], redoStack: [], canUndo: false, canRedo: false,
    site: { ...store().site, defaultLocale: 'ka' },
  })
}

function cleanPage(): CanvasPage {
  const sec: CanvasNode = { id: 'sec-1', type: 'section', props: { title: 'GDP' }, childIds: [] }
  return { id: 'p1', title: { ka: 'მთ', en: 'H' }, slug: 'home', nodeIds: ['sec-1'], nodes: { 'sec-1': sec } }
}

function badPage(): CanvasPage {
  const hero: CanvasNode = {
    id: 'hero-1', type: 'hero',
    props: { ...(nodeRegistry.getDefaults('hero') ?? {}), title: { en: 'GDP only' }, subtitle: { ka: 'ა', en: 'b' },
             cards: [{ id: 'c', title: { ka: 'ბ', en: 'b' }, color: '#000', img: '', pageBg: '' }] },
    childIds: [],
  }
  return { id: 'p1', title: { ka: 'მთ', en: 'H' }, slug: 'home', nodeIds: ['hero-1'], nodes: { 'hero-1': hero } }
}

beforeEach(() => { responder = () => ({ status: 200, data: {} }); installFetch() })

describe('PageWorkflowBar — save guard UX', () => {
  it('blocks save on a guard violation and renders the inline issue list', async () => {
    seed(badPage())
    render(<PageWorkflowBar />)

    fireEvent.click(screen.getByTestId('save-page'))

    await waitFor(() => expect(screen.getByTestId('save-issues')).toBeInTheDocument())
    // The blocking issue names the offending node/field (deep-linkable).
    expect(screen.getAllByTestId('save-issue').length).toBeGreaterThan(0)
    expect(store().saveStatus['p1']?.issues.length).toBeGreaterThan(0)
  })

  it('a clean save shows no issue list and records saved state', async () => {
    seed(cleanPage())
    responder = (m) => m === 'PUT' ? { status: 200, data: { id: 'p1', version_number: 2 } } : { status: 200, data: {} }
    render(<PageWorkflowBar />)

    fireEvent.click(screen.getByTestId('save-page'))

    await waitFor(() => expect(store().saveStatus['p1']?.saved).toBe(true))
    expect(screen.queryByTestId('save-issues')).not.toBeInTheDocument()
  })
})

describe('PageWorkflowBar — publish UX', () => {
  it('shows the needs-publisher/admin alert on a 403', async () => {
    seed(cleanPage())
    responder = (m, url) => m === 'POST' && url.endsWith('/publish')
      ? { status: 403, error: 'admin role required to publish' }
      : { status: 200, data: {} }
    render(<PageWorkflowBar />)

    fireEvent.click(screen.getByTestId('publish-page'))

    await waitFor(() => expect(screen.getByTestId('publish-forbidden')).toBeInTheDocument())
    expect(store().lifecycle['p1']?.status).not.toBe('published')
  })

  it('reflects the published status badge on a successful publish', async () => {
    seed(cleanPage())
    responder = (m, url) => m === 'POST' && url.endsWith('/publish')
      ? { status: 200, data: { id: 'p1', published_version_id: 'v1' } }
      : { status: 200, data: {} }
    render(<PageWorkflowBar />)

    fireEvent.click(screen.getByTestId('publish-page'))

    await waitFor(() => expect(store().lifecycle['p1']?.status).toBe('published'))
    expect(screen.getByTestId('page-status-chip')).toHaveTextContent('Published')
  })
})

describe('PageWorkflowBar — status badge reflects the server FSM', () => {
  it('shows Draft for a draft page and disables publish while dirty', () => {
    seed(cleanPage())
    store().markPageDirty('p1')
    render(<PageWorkflowBar />)
    expect(screen.getByTestId('page-status-chip')).toHaveTextContent('Draft')
    expect(screen.getByTestId('page-dirty')).toBeInTheDocument()
    // A dirty page cannot publish — the latest VERSION publishes, not the buffer.
    expect(screen.getByTestId('publish-page')).toBeDisabled()
  })
})

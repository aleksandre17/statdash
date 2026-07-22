// ── AuthoringLifecycleBand.test — the C3 lifecycle chrome behavior ─────────────────
//
//  The band is the honest face of the Authoring Lifecycle: the amber draft chip, the
//  explicit Publish/Discard, the revision History door with admin-gated restore, and the
//  422 `violations[]` rendered AT-field. Store wiring is covered in dataSpecPersist.test;
//  here we prove the CHROME: what the author sees + does, with fetch/stores stubbed.
//
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { AuthoringLifecycleBand } from './AuthoringLifecycleBand'
import { useConstructorStore } from '../../../store/constructor.store'
import { useDataSpecDraftStore } from '../../../store/dataSpecDraft.store'
import { useDataSpecPublishStore } from '../../../store/dataSpecPublish.store'
import type { DataSpec } from '@statdash/engine'
import type { NamedDataSpec } from '../../../types/constructor'

const BASE: DataSpec = { type: 'row-list', rows: [] } as unknown as DataSpec
const EDITED: DataSpec = { type: 'row-list', rows: [{ a: 1 }] } as unknown as DataSpec
const SPEC: NamedDataSpec = { id: 's1', name: 'rows', spec: EDITED }

function okJson(data: unknown): Response {
  return { ok: true, status: 200, json: async () => ({ data }) } as Response
}
/** A signed-looking JWT whose payload declares the given roles (getRoles decodes it). */
function tokenWithRoles(roles: string[]): string {
  return `h.${btoa(JSON.stringify({ roles }))}.s`
}
function seedDraft(changeCount = 2) {
  useDataSpecDraftStore.setState({
    drafts: { s1: { base: BASE, current: EDITED, changeCount, updatedAt: 1 } },
  })
}

beforeEach(() => {
  useConstructorStore.setState({ dataSpecs: [structuredClone(SPEC)] })
  useDataSpecDraftStore.setState({ drafts: {} })
  useDataSpecPublishStore.setState({ status: {} })
  sessionStorage.clear()
})
afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear() })

describe('AuthoringLifecycleBand — the honest draft chip + Publish/Discard', () => {
  it('shows the amber «n ცვლილება» draft chip and an enabled Publish when dirty', () => {
    seedDraft(2)
    render(<AuthoringLifecycleBand docId="s1" locale="ka" />)
    expect(screen.getByTestId('lifecycle-draft-chip')).toHaveTextContent('2 ცვლილება')
    expect(screen.getByTestId('lifecycle-publish')).toBeEnabled()
    expect(screen.getByTestId('lifecycle-discard')).toBeInTheDocument()
  })

  it('disables Publish and hides Discard when clean (no unpublished changes)', () => {
    render(<AuthoringLifecycleBand docId="s1" locale="en" />)
    expect(screen.queryByTestId('lifecycle-draft-chip')).toBeNull()
    expect(screen.getByTestId('lifecycle-publish')).toBeDisabled()
    expect(screen.queryByTestId('lifecycle-discard')).toBeNull()
  })

  it('Publish fires the validated PUT and clears the draft (explicit-publish)', async () => {
    seedDraft(1)
    const fetchSpy = vi.fn(async (..._a: unknown[]) => okJson({ id: 's1' }))
    vi.stubGlobal('fetch', fetchSpy)
    render(<AuthoringLifecycleBand docId="s1" locale="en" />)

    fireEvent.click(screen.getByTestId('lifecycle-publish'))
    await vi.waitFor(() => expect(useDataSpecPublishStore.getState().status.s1?.phase).toBe('published'))

    const puts = fetchSpy.mock.calls.filter((c) => (c[1] as RequestInit)?.method === 'PUT')
    expect(puts).toHaveLength(1)
    expect(useDataSpecDraftStore.getState().drafts.s1).toBeUndefined()
  })

  it('Discard restores the published base and drops the draft', () => {
    seedDraft(3)
    render(<AuthoringLifecycleBand docId="s1" locale="en" />)
    fireEvent.click(screen.getByTestId('lifecycle-discard'))
    const stored = useConstructorStore.getState().dataSpecs.find((s) => s.id === 's1')!.spec
    expect((stored as { rows: unknown[] }).rows).toHaveLength(0)
    expect(useDataSpecDraftStore.getState().drafts.s1).toBeUndefined()
  })
})

describe('AuthoringLifecycleBand — a 422 renders violations AT-field (never swallowed)', () => {
  it('renders each violation with its check + detail from the publish store', () => {
    useDataSpecPublishStore.setState({
      status: {
        s1: {
          phase: 'error',
          violations: [
            { check: 'dataset-exists', path: '/config/datasetCode', ref: 'GDP', detail: 'unknown dataset GDP' },
            { check: 'metric-resolves', path: '/pipe/0', detail: 'metric m.x does not resolve' },
          ],
        },
      },
    })
    render(<AuthoringLifecycleBand docId="s1" locale="ka" />)
    const box = screen.getByTestId('lifecycle-violations')
    expect(within(box).getAllByTestId('lifecycle-violation')).toHaveLength(2)
    expect(box).toHaveTextContent('unknown dataset GDP')
    expect(box).toHaveTextContent('/config/datasetCode')
  })
})

describe('AuthoringLifecycleBand — the History door + admin-gated restore', () => {
  it('opens history, lists revisions, and gates restore to admin (non-admin: disabled + hint)', async () => {
    const revs = [
      { id: 'r2', docKind: 'data_spec', docId: 's1', revisionNumber: 2, actor: 'u1', note: null, restoredFrom: null, createdAt: '2026-07-22T10:00:00Z' },
      { id: 'r1', docKind: 'data_spec', docId: 's1', revisionNumber: 1, actor: null, note: null, restoredFrom: null, createdAt: '2026-07-20T10:00:00Z' },
    ]
    vi.stubGlobal('fetch', vi.fn(async () => okJson(revs)))
    render(<AuthoringLifecycleBand docId="s1" locale="en" />)

    fireEvent.click(screen.getByTestId('lifecycle-history-toggle'))
    const list = await screen.findByTestId('lifecycle-history')
    expect(within(list).getByTestId('lifecycle-revision-2')).toBeInTheDocument()
    expect(within(list).getByTestId('lifecycle-revision-1')).toBeInTheDocument()
    // Non-admin session → restore is disabled + the honest hint shows.
    expect(within(list).getByTestId('lifecycle-restore-2')).toBeDisabled()
    expect(within(list).getByTestId('lifecycle-restore-hint')).toBeInTheDocument()
  })

  it('an admin session enables restore and firing it POSTs the restore', async () => {
    sessionStorage.setItem('geostat_panel_token', tokenWithRoles(['admin']))
    const revs = [
      { id: 'r1', docKind: 'data_spec', docId: 's1', revisionNumber: 1, actor: 'u1', note: null, restoredFrom: null, createdAt: '2026-07-20T10:00:00Z' },
    ]
    const fetchSpy = vi.fn(async (..._a: unknown[]) => okJson(revs))
    vi.stubGlobal('fetch', fetchSpy)
    render(<AuthoringLifecycleBand docId="s1" locale="en" />)

    fireEvent.click(screen.getByTestId('lifecycle-history-toggle'))
    const restore = await screen.findByTestId('lifecycle-restore-1')
    expect(restore).toBeEnabled()
    fireEvent.click(restore)
    await vi.waitFor(() => {
      const posts = fetchSpy.mock.calls.filter((c) => (c[1] as RequestInit)?.method === 'POST')
      expect(posts.some((c) => String(c[0]).includes('/revisions/r1/restore'))).toBe(true)
    })
  })
})

// ── dataSpecPersist.test — the edit-persistence contract (data-loss fix) ──────────
//
//  Root-cause proof: EDITING a DataSpec must durably PUT (create already POSTed; edit
//  was store-only → lost on reload). updateDataSpec now writes the optimistic patch
//  IMMEDIATELY (snappy) and PUTs on a debounced, coalesced flush; flushDataSpecSaves()
//  forces the PUT out (unmount / navigation). On failure it surfaces an honest error
//  and NEVER drops the optimistic edit (Law 11).
//
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useConstructorStore } from './constructor.store'
import { useDataSpecSaveStore } from './dataSpecSave.store'
import { updateDataSpec, flushDataSpecSaves } from './api-actions'
import type { DataSpec } from '@statdash/engine'
import type { NamedDataSpec } from '../types/constructor'

const SPEC: NamedDataSpec = {
  id: 's1', name: 'rows', spec: { type: 'row-list', rows: [] } as unknown as DataSpec,
}
const EDITED: DataSpec = { type: 'row-list', rows: [{ a: 1 }] } as unknown as DataSpec

function okJson(data: unknown): Response {
  return { ok: true, status: 200, json: async () => ({ data }) } as Response
}

/** Parse the PUT calls a fetch spy recorded (url + method + parsed body). */
function putCalls(fetchSpy: ReturnType<typeof vi.fn>) {
  return fetchSpy.mock.calls
    .filter((c) => (c[1] as RequestInit)?.method === 'PUT')
    .map((c) => ({ url: String(c[0]), body: JSON.parse(String((c[1] as RequestInit).body)) }))
}

beforeEach(() => {
  useConstructorStore.setState({ dataSpecs: [SPEC] })
  useDataSpecSaveStore.setState({ status: {} })
})
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('updateDataSpec — durable edit persistence', () => {
  it('writes the optimistic edit to the store IMMEDIATELY (before any PUT)', () => {
    const fetchSpy = vi.fn(async () => okJson({ id: 's1' }))
    vi.stubGlobal('fetch', fetchSpy)

    updateDataSpec('s1', { spec: EDITED })

    // Snappy: the store reflects the edit synchronously, no await, no PUT yet.
    const stored = useConstructorStore.getState().dataSpecs.find((s) => s.id === 's1')!.spec
    expect((stored as Extract<DataSpec, { type: 'row-list' }>).rows).toHaveLength(1)
    expect(putCalls(fetchSpy)).toHaveLength(0)
  })

  it('flushDataSpecSaves() issues the durable PUT with the edited spec + marks it saved', async () => {
    const fetchSpy = vi.fn(async () => okJson({ id: 's1' }))
    vi.stubGlobal('fetch', fetchSpy)

    updateDataSpec('s1', { spec: EDITED })
    await flushDataSpecSaves()

    const puts = putCalls(fetchSpy)
    expect(puts).toHaveLength(1)
    expect(puts[0].url).toContain('/data-specs/s1')
    expect(puts[0].body.spec).toEqual(EDITED)
    expect(useDataSpecSaveStore.getState().status.s1).toEqual({ phase: 'saved' })
  })

  it('coalesces a burst of edits into ONE PUT carrying the latest spec', async () => {
    const fetchSpy = vi.fn(async () => okJson({ id: 's1' }))
    vi.stubGlobal('fetch', fetchSpy)

    updateDataSpec('s1', { spec: { type: 'row-list', rows: [{ a: 1 }] } as unknown as DataSpec })
    updateDataSpec('s1', { spec: { type: 'row-list', rows: [{ a: 2 }] } as unknown as DataSpec })
    await flushDataSpecSaves()

    const puts = putCalls(fetchSpy)
    expect(puts).toHaveLength(1)                       // one durable write, not two
    expect(puts[0].body.spec.rows).toEqual([{ a: 2 }]) // the latest edit wins
  })

  it('the debounce timer fires the PUT without an explicit flush (reliable durability)', async () => {
    vi.useFakeTimers()
    const fetchSpy = vi.fn(async () => okJson({ id: 's1' }))
    vi.stubGlobal('fetch', fetchSpy)

    updateDataSpec('s1', { spec: EDITED })
    expect(putCalls(fetchSpy)).toHaveLength(0)         // still debounced
    await vi.runAllTimersAsync()
    expect(putCalls(fetchSpy)).toHaveLength(1)         // fired on its own
  })

  it('on a PUT failure: surfaces an HONEST error and NEVER drops the optimistic edit (Law 11)', async () => {
    const fetchSpy = vi.fn(async () => { throw new Error('network down') })
    vi.stubGlobal('fetch', fetchSpy)

    updateDataSpec('s1', { spec: EDITED })
    await flushDataSpecSaves()

    // Honest state — error, not fake-saved.
    const status = useDataSpecSaveStore.getState().status.s1
    expect(status?.phase).toBe('error')
    expect(status?.error).toBeTruthy()
    // The edit is still in the store (optimistic, not silently reverted) — retryable.
    const stored = useConstructorStore.getState().dataSpecs.find((s) => s.id === 's1')!.spec
    expect((stored as Extract<DataSpec, { type: 'row-list' }>).rows).toHaveLength(1)
  })
})

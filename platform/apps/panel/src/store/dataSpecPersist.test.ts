// ── dataSpecPersist.test — the Authoring Lifecycle contract (C3 · FF-DRAFT-EXPLICIT-PUBLISH) ──
//
//  The auto-save era is OVER. This suite is the executable proof of DESIGN-0104 §2·C3:
//    • FF-DRAFT-EXPLICIT-PUBLISH — an edit is a client-side DRAFT; NO PUT fires without an
//      explicit publish gesture; a draft survives reload; discard restores the published base.
//    • FF-PUT-VALIDATED         — a 422 `config-invalid` renders its `violations[]`, keeps
//      the edit as a draft (never a fake success, never a silent swallow — Law 11).
//  It SUPERSEDES the debounced-autosave + authoring-hold suites (both deleted with the hold).
//
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useConstructorStore } from './constructor.store'
import { useDataSpecDraftStore } from './dataSpecDraft.store'
import { useDataSpecPublishStore } from './dataSpecPublish.store'
import {
  updateDataSpec, publishDataSpec, discardDataSpec, rehydrateDataSpecDrafts,
  restoreDataSpecRevision,
} from './api-actions'
import type { DataSpec } from '@statdash/engine'
import type { NamedDataSpec } from '../types/constructor'

const SPEC: NamedDataSpec = {
  id: 's1', name: 'rows', spec: { type: 'row-list', rows: [] } as unknown as DataSpec,
}
const EDITED: DataSpec = { type: 'row-list', rows: [{ a: 1 }] } as unknown as DataSpec

function okJson(data: unknown): Response {
  return { ok: true, status: 200, json: async () => ({ data }) } as Response
}
/** A 422 `config-invalid` RFC 9457 problem body (the validated-PUT rejection). */
function configInvalid422(violations: unknown[]): Response {
  return {
    ok: false, status: 422,
    json: async () => ({
      type: 'urn:statdash:problem:config-invalid', title: 'Config document failed validation',
      status: 422, code: 'CONFIG_INVALID', violations,
    }),
  } as Response
}
function putCalls(fetchSpy: ReturnType<typeof vi.fn>) {
  return fetchSpy.mock.calls
    .filter((c) => (c[1] as RequestInit)?.method === 'PUT')
    .map((c) => ({ url: String(c[0]), body: JSON.parse(String((c[1] as RequestInit).body)) }))
}

beforeEach(() => {
  useConstructorStore.setState({ dataSpecs: [structuredClone(SPEC)] })
  useDataSpecDraftStore.setState({ drafts: {} })
  useDataSpecPublishStore.setState({ status: {} })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('FF-DRAFT-EXPLICIT-PUBLISH — an edit is a draft; only Publish writes', () => {
  it('an edit writes the store optimistically AND records a draft — but fires NO PUT', async () => {
    const fetchSpy = vi.fn(async () => okJson({ id: 's1' }))
    vi.stubGlobal('fetch', fetchSpy)

    updateDataSpec('s1', { spec: EDITED })

    // Optimistic: the store reflects the edit synchronously (snappy, in-session).
    const stored = useConstructorStore.getState().dataSpecs.find((s) => s.id === 's1')!.spec
    expect((stored as Extract<DataSpec, { type: 'row-list' }>).rows).toHaveLength(1)
    // A draft is recorded (the amber chip's «n ცვლილება»)…
    const draft = useDataSpecDraftStore.getState().drafts.s1
    expect(draft?.changeCount).toBe(1)
    // …and the auto-save era is OVER — NO durable write happened.
    expect(putCalls(fetchSpy)).toHaveLength(0)
  })

  it('a burst of edits accumulates in ONE draft (base pinned to the FIRST published value)', () => {
    vi.stubGlobal('fetch', vi.fn(async () => okJson({ id: 's1' })))
    updateDataSpec('s1', { spec: { type: 'row-list', rows: [{ a: 1 }] } as unknown as DataSpec })
    updateDataSpec('s1', { spec: { type: 'row-list', rows: [{ a: 2 }] } as unknown as DataSpec })
    const draft = useDataSpecDraftStore.getState().drafts.s1!
    expect(draft.changeCount).toBe(2)
    // base = the published value BEFORE any edit (discard target), current = the latest edit.
    expect((draft.base as Extract<DataSpec, { type: 'row-list' }>).rows).toHaveLength(0)
    expect((draft.current as Extract<DataSpec, { type: 'row-list' }>).rows).toEqual([{ a: 2 }])
  })

  it('Publish fires the validated PUT with the current draft + clears the draft + marks published', async () => {
    const fetchSpy = vi.fn(async () => okJson({ id: 's1' }))
    vi.stubGlobal('fetch', fetchSpy)

    updateDataSpec('s1', { spec: EDITED })
    const res = await publishDataSpec('s1')

    expect(res.ok).toBe(true)
    const puts = putCalls(fetchSpy)
    expect(puts).toHaveLength(1)
    expect(puts[0].url).toContain('/data-specs/s1')
    expect(puts[0].body.spec).toEqual(EDITED)
    // The draft is gone (clean) and the honest phase is `published`.
    expect(useDataSpecDraftStore.getState().drafts.s1).toBeUndefined()
    expect(useDataSpecPublishStore.getState().status.s1?.phase).toBe('published')
  })

  it('Discard drops the draft and restores the published base into the store', () => {
    vi.stubGlobal('fetch', vi.fn(async () => okJson({ id: 's1' })))
    updateDataSpec('s1', { spec: EDITED })
    discardDataSpec('s1')

    const stored = useConstructorStore.getState().dataSpecs.find((s) => s.id === 's1')!.spec
    expect((stored as Extract<DataSpec, { type: 'row-list' }>).rows).toHaveLength(0) // back to base
    expect(useDataSpecDraftStore.getState().drafts.s1).toBeUndefined()
  })

  it('a draft SURVIVES reload — rehydrate re-applies it over the loaded published spec', () => {
    // Simulate a crash-persisted draft (base == the just-loaded published value).
    useDataSpecDraftStore.setState({
      drafts: { s1: { base: structuredClone(SPEC.spec), current: EDITED, changeCount: 3, updatedAt: 1 } },
    })
    // initFromApi has REPLACED the store with the published spec; rehydrate re-applies the draft.
    rehydrateDataSpecDrafts()
    const stored = useConstructorStore.getState().dataSpecs.find((s) => s.id === 's1')!.spec
    expect((stored as Extract<DataSpec, { type: 'row-list' }>).rows).toHaveLength(1) // the edit survived
    expect(useDataSpecDraftStore.getState().drafts.s1?.changeCount).toBe(3)
  })

  it('a STALE draft (published advanced underneath) is dropped on rehydrate — published wins', () => {
    // The published spec now differs from the draft's base → the doc was published elsewhere.
    useConstructorStore.setState({
      dataSpecs: [{ ...SPEC, spec: { type: 'row-list', rows: [{ server: true }] } as unknown as DataSpec }],
    })
    useDataSpecDraftStore.setState({
      drafts: { s1: { base: structuredClone(SPEC.spec), current: EDITED, changeCount: 1, updatedAt: 1 } },
    })
    rehydrateDataSpecDrafts()
    // The draft is dropped; the freshly-published server value is kept (never resurrected).
    expect(useDataSpecDraftStore.getState().drafts.s1).toBeUndefined()
    const stored = useConstructorStore.getState().dataSpecs.find((s) => s.id === 's1')!.spec
    expect((stored as { rows: unknown[] }).rows).toEqual([{ server: true }])
  })
})

describe('FF-PUT-VALIDATED — a 422 renders violations and keeps the edit as a draft (Law 11)', () => {
  it('a rejected Publish surfaces the violations[] and does NOT clear the draft', async () => {
    const violations = [{ check: 'dataset-exists', path: '/config/datasetCode', ref: 'GDP', detail: 'unknown dataset' }]
    vi.stubGlobal('fetch', vi.fn(async () => configInvalid422(violations)))

    updateDataSpec('s1', { spec: EDITED })
    const res = await publishDataSpec('s1')

    expect(res.ok).toBe(false)
    expect(res.violations).toBe(true)
    const status = useDataSpecPublishStore.getState().status.s1
    expect(status?.phase).toBe('error')
    expect(status?.violations).toEqual(violations)
    // The edit is still a live draft — retryable, never fake-saved, never dropped.
    expect(useDataSpecDraftStore.getState().drafts.s1?.changeCount).toBe(1)
  })

  it('a transport failure surfaces an honest error (no violations), keeping the draft', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
    updateDataSpec('s1', { spec: EDITED })
    const res = await publishDataSpec('s1')

    expect(res.ok).toBe(false)
    const status = useDataSpecPublishStore.getState().status.s1
    expect(status?.phase).toBe('error')
    expect(status?.error).toBeTruthy()
    expect(status?.violations).toBeUndefined()
    expect(useDataSpecDraftStore.getState().drafts.s1?.changeCount).toBe(1)
  })
})

describe('restore — admin governance act, honest 403 (FF-REVISION-ON-PUT lineage)', () => {
  it('a 403 restore surfaces `forbidden` honestly (needs admin), never reimplemented client-side', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 403,
      json: async () => ({ type: 'urn:statdash:problem:forbidden', title: 'Forbidden', status: 403, message: 'admin role required' }),
    } as Response)))

    const res = await restoreDataSpecRevision('s1', 'rev-9')
    expect(res.forbidden).toBe(true)
    expect(useDataSpecPublishStore.getState().status.s1?.phase).toBe('forbidden')
  })
})

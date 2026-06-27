// @vitest-environment node
//
// ── renderPageToJSON characterization tests ──────────────────────────────────
//
//  Pins the behaviour of renderPageToJSON: node-tree walk, DataSpec resolution
//  via interpretSpec, error isolation, and PageDataSnapshot shape.
//
//  staticStore returns [] for every query, so storeVal resolves to 0.
//  For row-list specs, the engine reads the value from the store (not from the
//  RowSpec object), meaning frame.rows[0].value === 0 when using staticStore.
//

import { describe, it, expect }          from 'vitest'
import { renderPageToJSON }              from './api'
import type { StaticRenderContext }      from './html'
import { staticStore }                   from '@statdash/engine'
import type { NodePageConfig }           from '../types'

// ── Minimal StaticRenderContext ───────────────────────────────────────────────
//
//  Only the fields that renderPageToJSON / walkNode consume:
//    - sectionCtx  (passed through to the snapshot + to interpretSpec)
//    - stores      (resolveStore reads this)
//    - filterParams / vars / locale / fallbackLocale / perspectiveKey / perspective / effects
//      are carried by StaticRenderContext but not read by renderPageToJSON itself;
//      they are included to satisfy the type.
//

const staticCtx: StaticRenderContext = {
  sectionCtx: {
    dims:     { time: 2024 },
  },
  stores:         { main: staticStore },
  filterParams:   {},
  vars:           {},
  locale:         'en',
  fallbackLocale: 'en',
  perspectiveKey: 'mode',
  perspective: {
    current:   'year',
    available: [],
    set:       () => {},
  },
  effects: [],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Cast a plain object to NodePageConfig for structural mocking. */
function asPage(obj: object): NodePageConfig {
  return obj as unknown as NodePageConfig
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('renderPageToJSON', () => {

  it('empty page — no data nodes — produces a top-level entry with no frame and empty children', () => {
    const page = asPage({ type: 'inner-page', children: [] })
    const snapshot = renderPageToJSON(page, staticCtx)

    expect(snapshot.nodes).toHaveLength(1)
    const pageEntry = snapshot.nodes[0]
    expect(pageEntry.type).toBe('inner-page')
    expect(pageEntry.status).toBe('ok')
    expect(pageEntry.frame).toBeUndefined()
    expect(pageEntry.children).toHaveLength(0)
  })

  it('page with one data section — row-list spec — section entry has status ok and one resolved row in frame', () => {
    // staticStore returns [] for every query → storeVal falls back to 0.
    // The row-list resolver maps spec.rows → EngineRow[], reading the value
    // from the store (not from the RowSpec), so frame.rows[0].value === 0.
    const page = asPage({
      type:     'inner-page',
      children: [
        {
          type: 'section',
          data: {
            type: 'row-list',
            rows: [{ code: 'GDP' }],
          },
        },
      ],
    })
    const snapshot = renderPageToJSON(page, staticCtx)

    const pageEntry    = snapshot.nodes[0]
    const sectionEntry = pageEntry.children[0]

    expect(sectionEntry.type).toBe('section')
    expect(sectionEntry.status).toBe('ok')
    expect(sectionEntry.frame).toBeDefined()
    expect(sectionEntry.frame!.rows).toHaveLength(1)
    // value is read from staticStore → storeVal returns 0 (store returns [])
    expect(sectionEntry.frame!.rows[0]['value']).toBe(0)
  })

  it('nested children — section with a child chart node — both appear in the tree; chart has no frame', () => {
    const page = asPage({
      type:     'inner-page',
      children: [
        {
          type:     'section',
          children: [
            {
              type: 'chart',
              // no data field — chart inherits rows at render time, not in the snapshot
            },
          ],
        },
      ],
    })
    const snapshot = renderPageToJSON(page, staticCtx)

    const pageEntry    = snapshot.nodes[0]
    const sectionEntry = pageEntry.children[0]
    const chartEntry   = sectionEntry.children[0]

    expect(sectionEntry.type).toBe('section')
    expect(sectionEntry.status).toBe('ok')
    expect(sectionEntry.frame).toBeUndefined()

    expect(chartEntry.type).toBe('chart')
    expect(chartEntry.status).toBe('ok')
    expect(chartEntry.frame).toBeUndefined()
  })

  it('data error isolation — a node whose resolver throws sets status=error with a notice; sibling nodes are unaffected', () => {
    // Force a resolver throw: row-list calls spec.rows.map(...) — passing null
    // for rows causes TypeError at runtime, which walkNode's catch captures.
    const page = asPage({
      type:     'inner-page',
      children: [
        {
          type: 'broken-section',
          // rows: null triggers TypeError inside RowListResolver.resolve()
          data: { type: 'row-list', rows: null } as unknown,
        },
        {
          type: 'ok-section',
          // no data — should resolve cleanly with no frame
        },
      ],
    })
    const snapshot = renderPageToJSON(page, staticCtx)

    const pageEntry    = snapshot.nodes[0]
    const brokenEntry  = pageEntry.children.find(c => c.type === 'broken-section')
    const okEntry      = pageEntry.children.find(c => c.type === 'ok-section')

    // Broken node: status=error, notice present, frame absent
    expect(brokenEntry).toBeDefined()
    expect(brokenEntry!.status).toBe('error')
    expect(brokenEntry!.frame).toBeUndefined()
    expect(brokenEntry!.notices).toHaveLength(1)
    expect(brokenEntry!.notices![0].severity).toBe('error')
    expect(brokenEntry!.notices![0].specType).toBe('row-list')

    // Sibling is intact — tree walk continued after the error
    expect(okEntry).toBeDefined()
    expect(okEntry!.status).toBe('ok')
    expect(okEntry!.frame).toBeUndefined()
  })

  it('generatedAt is a valid ISO 8601 string', () => {
    const page     = asPage({ type: 'inner-page', children: [] })
    const snapshot = renderPageToJSON(page, staticCtx)

    const parsed = new Date(snapshot.generatedAt)
    expect(parsed.toString()).not.toBe('Invalid Date')
    // Confirm it is ISO format: toISOString() round-trips correctly
    expect(snapshot.generatedAt).toBe(parsed.toISOString())
  })

  it('sectionCtx in snapshot matches the staticCtx.sectionCtx reference', () => {
    const page     = asPage({ type: 'inner-page', children: [] })
    const snapshot = renderPageToJSON(page, staticCtx)

    expect(snapshot.sectionCtx).toBe(staticCtx.sectionCtx)
  })

  // ── FF-1: spec throws → error status + notice, no frame ──────────────────

  it('FF-1: unknown spec type emits no rows → status=empty, no notices', () => {
    // interpretSpec for an unregistered type emits a diagnostic warning and returns [].
    // walkNode should record status='empty' — not an error.
    const page = asPage({
      type:     'inner-page',
      children: [
        {
          type: 'test-section',
          data: { type: 'UNKNOWN_SPEC_TYPE_XYZ' },
        },
      ],
    })
    const snapshot = renderPageToJSON(page, staticCtx)
    const entry = snapshot.nodes[0].children[0]

    expect(entry.status).toBe('empty')
    expect(entry.frame).toBeUndefined()
    expect(entry.notices).toBeUndefined()
  })

  it('FF-1: resolver that throws → status=error, notices[0].severity=error, frame=undefined', () => {
    // row-list with rows: null causes TypeError in RowListResolver.resolve()
    const page = asPage({
      type:     'inner-page',
      children: [
        {
          type: 'bad-section',
          data: { type: 'row-list', rows: null } as unknown,
        },
      ],
    })
    const snapshot = renderPageToJSON(page, staticCtx)
    const entry = snapshot.nodes[0].children[0]

    expect(entry.status).toBe('error')
    expect(entry.notices![0].severity).toBe('error')
    expect(entry.frame).toBeUndefined()
  })

  // ── FF-2: query data node must NOT appear as a structural child ───────────

  it('FF-2: data field with type=query is not walked as a child node (G8 end-to-end)', () => {
    // The data field carries a DataSpec — collectChildNodes must skip it.
    // If G8 were broken, the query object { type: 'query', ... } would be
    // walked as a child node and appear in entry.children.
    const page = asPage({
      type:     'inner-page',
      children: [
        {
          type: 'panel',
          data: { type: 'query', obs: 'X', dims: {} },
        },
      ],
    })
    const snapshot = renderPageToJSON(page, staticCtx)
    const panelEntry = snapshot.nodes[0].children[0]

    // The panel entry exists
    expect(panelEntry.type).toBe('panel')
    // Its children must be empty — the query object was NOT walked as a child
    expect(panelEntry.children).toHaveLength(0)
    // No child should have type 'query'
    const allTypes = snapshot.nodes[0].children.flatMap(e => [e.type, ...e.children.map(c => c.type)])
    expect(allTypes).not.toContain('query')
  })

  // ── G5: PageDataSnapshot metadata ────────────────────────────────────────

  it('G5: snapshot carries locale, fallbackLocale, filterParams, durationMs, status', () => {
    const page     = asPage({ type: 'inner-page', children: [] })
    const snapshot = renderPageToJSON(page, staticCtx)

    expect(snapshot.locale).toBe('en')
    expect(snapshot.fallbackLocale).toBe('en')
    expect(snapshot.filterParams).toEqual({})
    expect(typeof snapshot.durationMs).toBe('number')
    expect(snapshot.durationMs).toBeGreaterThanOrEqual(0)
    expect(['ok', 'partial', 'error']).toContain(snapshot.status)
  })

  it('G5: snapshot.status is ok when no data nodes error', () => {
    const page     = asPage({ type: 'inner-page', children: [] })
    const snapshot = renderPageToJSON(page, staticCtx)

    expect(snapshot.status).toBe('ok')
  })

  it('G5: snapshot.status is partial when at least one node errors and one does not', () => {
    const page = asPage({
      type:     'inner-page',
      children: [
        { type: 'bad',  data: { type: 'row-list', rows: null } as unknown },
        { type: 'good', data: { type: 'row-list', rows: [{ code: 'GDP' }] } },
      ],
    })
    const snapshot = renderPageToJSON(page, staticCtx)

    // bad → error, good → ok (value=0 from staticStore → status ok even if value is 0)
    // Actually good resolves to rows=[{value:0,...}] so status=ok
    // bad throws → status=error
    // rollup → partial
    expect(snapshot.status).toBe('partial')
  })

  // ── G10: opts.warm ────────────────────────────────────────────────────────

  it('G10: opts.warm=true does not throw and returns a valid snapshot', () => {
    const page = asPage({
      type:     'inner-page',
      children: [
        {
          type: 'section',
          data: { type: 'row-list', rows: [{ code: 'GDP' }] },
        },
      ],
    })

    // warmPageStore with staticStore is a no-op (no warm() method) — must not throw
    expect(() => renderPageToJSON(page, staticCtx, { warm: true })).not.toThrow()

    const snapshot = renderPageToJSON(page, staticCtx, { warm: true })
    expect(snapshot.nodes).toHaveLength(1)
    expect(snapshot.generatedAt).toBeTruthy()
    expect(snapshot.durationMs).toBeGreaterThanOrEqual(0)
  })

})

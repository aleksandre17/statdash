// @vitest-environment node
//
// annotationUtils.test.ts — pure unit tests for resolveAnnotations + toApexAnnotations.
// Uses staticStore (no network) and a minimal SectionContext.
//

import { describe, it, expect } from 'vitest'
import { resolveAnnotations, toApexAnnotations } from './annotationUtils'
import type { AnnotationSpec } from './annotationUtils'
import type { SectionContext, DataStore } from '@statdash/engine'
import { staticStore } from '@statdash/engine'

// ── Minimal SectionContext ─────────────────────────────────────────────
const BASE_CTX: SectionContext = {
  timeMode: 'year',
  dims:     { time: 2024 },
}

// ── Mock DataStore for dynamic specs ──────────────────────────────────
//
//  storeVal(store, code, ctx) calls store.querySync({ type: 'val', code }, ctx)
//  and reads result[0].value.  Return a fixed numeric value to control the
//  row-list resolver output: each row gets { value: <val> }.
//
function mockStoreVal(val: number): DataStore {
  return {
    ...staticStore,
    querySync: (q: import('@statdash/engine').StoreQuery) => {
      if (q.type === 'val') return [{ value: val }]
      return []
    },
    classifiers: undefined,
    display:     undefined,
  } as unknown as DataStore
}

// ── resolveAnnotations ────────────────────────────────────────────────

describe('resolveAnnotations', () => {
  it('returns empty array for empty specs', () => {
    expect(resolveAnnotations([], BASE_CTX, staticStore)).toEqual([])
  })

  it('static annotation — uses spec.value directly', () => {
    const specs: AnnotationSpec[] = [
      { axis: 'y', value: 42, label: 'Target' },
    ]
    const result = resolveAnnotations(specs, BASE_CTX, staticStore)
    expect(result).toHaveLength(1)
    expect(result[0].value).toBe(42)
    expect(result[0].axis).toBe('y')
    expect(result[0].label).toBe('Target')
  })

  it('static annotation — string value passes through', () => {
    const specs: AnnotationSpec[] = [
      { axis: 'x', value: '2020', label: 'Baseline' },
    ]
    const result = resolveAnnotations(specs, BASE_CTX, staticStore)
    expect(result[0].value).toBe('2020')
    expect(result[0].axis).toBe('x')
  })

  it('static annotation — preserves valueTo for band', () => {
    const specs: AnnotationSpec[] = [
      { axis: 'y', value: 10, valueTo: 20, label: 'Band' },
    ]
    const result = resolveAnnotations(specs, BASE_CTX, staticStore)
    expect(result[0].value).toBe(10)
    expect(result[0].valueTo).toBe(20)
  })

  it('static annotation — color forwarded', () => {
    const specs: AnnotationSpec[] = [
      { axis: 'y', value: 5, color: '#FF0000' },
    ]
    const result = resolveAnnotations(specs, BASE_CTX, staticStore)
    expect(result[0].color).toBe('#FF0000')
  })

  it('dynamic annotation — uses first row value field (numeric)', () => {
    // row-list spec: store.val(code, ctx) → 99, so resolved row has { value: 99 }
    const store = mockStoreVal(99)
    const specs: AnnotationSpec[] = [
      {
        axis:  'y',
        data:  { type: 'row-list', rows: [{ code: 'DUMMY', label: 'x' }] },
        label: 'Dynamic',
      },
    ]
    const result = resolveAnnotations(specs, BASE_CTX, store)
    expect(result[0].value).toBe(99)
    expect(result[0].label).toBe('Dynamic')
  })

  it('dynamic annotation — multiple rows: takes first row value', () => {
    // store.val always returns 42 for every row lookup
    const store = mockStoreVal(42)
    const specs: AnnotationSpec[] = [
      {
        axis: 'y',
        data: { type: 'row-list', rows: [{ code: 'A', label: 'A' }, { code: 'B', label: 'B' }] },
      },
    ]
    const result = resolveAnnotations(specs, BASE_CTX, store)
    // First row has value=42
    expect(result[0].value).toBe(42)
  })

  it('dynamic annotation — empty rows gives undefined value', () => {
    // row-list with empty rows array: interpretSpec returns [] → no first row
    const store = mockStoreVal(0)
    const specs: AnnotationSpec[] = [
      {
        axis: 'y',
        data: { type: 'row-list', rows: [] },
      },
    ]
    const result = resolveAnnotations(specs, BASE_CTX, store)
    expect(result[0].value).toBeUndefined()
  })

  it('multiple annotations of different axes', () => {
    const specs: AnnotationSpec[] = [
      { axis: 'y', value: 100, label: 'Upper bound' },
      { axis: 'x', value: '2020',  label: 'Crisis year' },
      { axis: 'y', value: 50,  label: 'Lower bound' },
    ]
    const result = resolveAnnotations(specs, BASE_CTX, staticStore)
    expect(result).toHaveLength(3)
    expect(result[0].axis).toBe('y')
    expect(result[1].axis).toBe('x')
    expect(result[2].axis).toBe('y')
  })
})

// ── toApexAnnotations ─────────────────────────────────────────────────

describe('toApexAnnotations', () => {
  it('separates y-axis and x-axis annotations', () => {
    const resolved = resolveAnnotations(
      [
        { axis: 'y', value: 100, label: 'Max' },
        { axis: 'x', value: '2020', label: 'Year' },
      ],
      BASE_CTX,
      staticStore,
    )
    const apex = toApexAnnotations(resolved)
    expect(apex.yaxis).toHaveLength(1)
    expect(apex.xaxis).toHaveLength(1)
    expect(apex.yaxis[0].y).toBe(100)
    expect(apex.xaxis[0].x).toBe('2020')
  })

  it('applies default border color when no color set', () => {
    const resolved = resolveAnnotations(
      [{ axis: 'y', value: 50 }],
      BASE_CTX,
      staticStore,
    )
    const apex = toApexAnnotations(resolved)
    expect(apex.yaxis[0].borderColor).toBe('#999')
  })

  it('applies custom color', () => {
    const resolved = resolveAnnotations(
      [{ axis: 'y', value: 50, color: '#FF0000' }],
      BASE_CTX,
      staticStore,
    )
    const apex = toApexAnnotations(resolved)
    expect(apex.yaxis[0].borderColor).toBe('#FF0000')
  })

  it('sets label text', () => {
    const resolved = resolveAnnotations(
      [{ axis: 'y', value: 50, label: 'Threshold' }],
      BASE_CTX,
      staticStore,
    )
    const apex = toApexAnnotations(resolved)
    expect(apex.yaxis[0].label.text).toBe('Threshold')
  })

  it('defaults label text to empty string when no label', () => {
    const resolved = resolveAnnotations(
      [{ axis: 'x', value: '2021' }],
      BASE_CTX,
      staticStore,
    )
    const apex = toApexAnnotations(resolved)
    expect(apex.xaxis[0].label.text).toBe('')
  })

  it('includes y2 for band annotations', () => {
    const resolved = resolveAnnotations(
      [{ axis: 'y', value: 10, valueTo: 20 }],
      BASE_CTX,
      staticStore,
    )
    const apex = toApexAnnotations(resolved)
    expect(apex.yaxis[0].y2).toBe(20)
  })

  it('returns empty arrays for empty input', () => {
    const apex = toApexAnnotations([])
    expect(apex.yaxis).toEqual([])
    expect(apex.xaxis).toEqual([])
  })
})

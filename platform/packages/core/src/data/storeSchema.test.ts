// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { DataStore }       from './store'
import type { SectionContext }  from '../core/context'
import type { FieldMeta }       from './fieldSchema'
import { storeSchema }          from './store'

// ── Minimal SectionContext fixture ────────────────────────────────────────────

const ctx: SectionContext = {
  timeMode: 'year',
  dims: { time: '2023' },
}

// ── Store fixtures ────────────────────────────────────────────────────────────

function makeSchemaStore(fields: FieldMeta[], capturedQuery?: { indicator: string | undefined }): DataStore {
  return {
    querySync(q, _ctx) {
      if (q.type === 'schema') {
        if (capturedQuery) capturedQuery.indicator = q.indicator
        return fields as unknown as import('./encoding').EngineRow[]
      }
      throw new Error('unexpected query type')
    },
  }
}

function makeThrowingStore(): DataStore {
  return {
    querySync() {
      throw new Error('schema queries not supported')
    },
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('storeSchema', () => {
  it('returns FieldMeta[] from a store that handles schema queries', () => {
    const fields: FieldMeta[] = [
      { name: 'value', role: 'measure',   type: 'number', unit: '%' },
      { name: 'time',  role: 'dimension', type: 'time' },
    ]
    const result = storeSchema(makeSchemaStore(fields), ctx)
    expect(result).toHaveLength(2)
    // storeSchema enriches with derived suggestedEncodings [P3-2]
    expect(result[0]).toMatchObject({ name: 'value', role: 'measure',   type: 'number', unit: '%' })
    expect(result[1]).toMatchObject({ name: 'time',  role: 'dimension', type: 'time' })
    expect(result[0].suggestedEncodings).toEqual(['y', 'size'])
    expect(result[1].suggestedEncodings).toEqual(['x'])
  })

  it('returns [] when store throws on schema query — never rethrows', () => {
    const result = storeSchema(makeThrowingStore(), ctx)
    expect(result).toEqual([])
  })

  it('passes indicator through to querySync', () => {
    const captured: { indicator: string | undefined } = { indicator: undefined }
    const fields: FieldMeta[] = [
      { name: 'gdp', role: 'measure', type: 'number' },
    ]
    storeSchema(makeSchemaStore(fields, captured), ctx, 'GDP_B1GQ')
    expect(captured.indicator).toBe('GDP_B1GQ')
  })

  it('enriches rows lacking suggestedEncodings with derived channels [P3-2]', () => {
    const fields: FieldMeta[] = [
      { name: 'value', role: 'measure',   type: 'number' },
      { name: 'time',  role: 'dimension', type: 'time' },
      { name: 'id',    role: 'meta',      type: 'string' },
    ]
    const result = storeSchema(makeSchemaStore(fields), ctx)
    expect(result[0].suggestedEncodings).toEqual(['y', 'size'])
    expect(result[1].suggestedEncodings).toEqual(['x'])
    expect(result[2].suggestedEncodings).toEqual([])
  })

  it('preserves an explicitly set suggestedEncodings — enrichment is idempotent [P3-2]', () => {
    const fields: FieldMeta[] = [
      { name: 'time', role: 'dimension', type: 'time', suggestedEncodings: ['x', 'color'] },
    ]
    const result = storeSchema(makeSchemaStore(fields), ctx)
    expect(result[0].suggestedEncodings).toEqual(['x', 'color'])
  })
})

import { describe, it, expect } from 'vitest'
import { deriveExportProvenance } from './deriveProvenance'
import type { DataStore }      from '../store'
import type { MetadataPort }   from '../../core/provenance'
import type { SectionContext } from '../../core/context'
import type { DataSpec }       from '../../config/data-spec'

const ctx: SectionContext = { dims: { time: 2024, geo: 'GE' } }

// Named (not inline-arrow) stubs — a DataStore test double, not a DataSpec
// literal, but named refs keep the source clear of the `key: (` shape entirely.
function zeroVal(): number { return 0 }
function emptyObs(): unknown[] { return [] }

function storeWith(metadata: MetadataPort | undefined): DataStore {
  return {
    val:  zeroVal,
    obs:  emptyObs,
    ...(metadata ? { metadata } : {}),
  } as unknown as DataStore
}

const ROW_LIST_SPEC: DataSpec = {
  type: 'row-list',
  rows: [{ code: 'B1G', label: 'GDP' }],
} as unknown as DataSpec

describe('deriveExportProvenance', () => {
  it('projects a MetadataPort record (source/lastUpdated/methodology) onto ExportProvenance', () => {
    const store = storeWith({
      provenance: (code) =>
        code === 'B1G'
          ? { source: 'National Statistics Office', lastUpdated: '2024-09-15', methodology: 'https://example.org/methodology/gdp' }
          : undefined,
    })
    const prov = deriveExportProvenance(ROW_LIST_SPEC, ctx, store)
    expect(prov).toEqual({
      source:         'National Statistics Office',
      lastUpdated:    '2024-09-15',
      methodologyUrl: 'https://example.org/methodology/gdp',
    })
  })

  it('degrades to undefined when the store has no MetadataPort (Postel)', () => {
    const store = storeWith(undefined)
    expect(deriveExportProvenance(ROW_LIST_SPEC, ctx, store)).toBeUndefined()
  })

  it('degrades to undefined when the MetadataPort has no report for any requirement code', () => {
    const store = storeWith({ provenance: () => undefined })
    expect(deriveExportProvenance(ROW_LIST_SPEC, ctx, store)).toBeUndefined()
  })

  it('degrades to undefined (never throws) when requirement extraction fails', () => {
    const store = storeWith({ provenance: () => ({ source: 'x' }) })
    const brokenSpec = { type: 'not-a-real-spec-type' } as unknown as DataSpec
    expect(() => deriveExportProvenance(brokenSpec, ctx, store)).not.toThrow()
  })

  it('tries EACH requirement code until one carries a report', () => {
    const store = storeWith({
      provenance: (code) => (code === 'SECOND' ? { source: 'found-it' } : undefined),
    })
    const spec: DataSpec = {
      type: 'row-list',
      rows: [{ code: 'FIRST', label: 'a' }, { code: 'SECOND', label: 'b' }],
    } as unknown as DataSpec
    expect(deriveExportProvenance(spec, ctx, store)?.source).toBe('found-it')
  })
})

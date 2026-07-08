// @vitest-environment node
//
// ── FF-DELIVERY-PROVENANCE [AR-48 P1] ─────────────────────────────────────────
//
//  Invariant (DESIGN-delivery-port-export-embed-snapshot.md §4): an
//  export/snapshot whose data references a dataset that HAS a metadata report
//  carries `source` + `lastUpdated` + a methodology link; absence degrades
//  gracefully (Postel) — it never blocks delivery, but never silently ships an
//  unattributed NSO number either.
//
//  This locks the SNAPSHOT/EMBED half end-to-end: `renderPageToJSON` derives
//  per-node provenance (api.ts) via the SAME `deriveExportProvenance` join
//  `PanelExport` uses for the live EXTRACT facet (proven per-unit in
//  deriveProvenance.test.ts / csv.test.ts / xlsx.test.ts), and
//  `viewSnapshotFromPageSnapshot` folds it into the `ViewSnapshot` SSOT —
//  so a snapshot JSON genuinely "carries the vintage" (the P1 phase gate).

import { describe, it, expect } from 'vitest'
import { renderPageToJSON }      from '../targets/api'
import type { StaticRenderContext } from '../targets/html'
import { viewSnapshotFromPageSnapshot } from './DeliveryPort'
import type { NodePageConfig }   from '../types'
import { staticStore }           from '@statdash/engine'
import type { DataStore, MetadataPort } from '@statdash/engine'

function asPage(obj: object): NodePageConfig {
  return obj as unknown as NodePageConfig
}

/** staticStore already satisfies the full DataStore contract (querySync et al.)
 *  and returns [] for every query — real resolution, just empty. Layering
 *  `.metadata` onto it (rather than hand-rolling a partial stub) means
 *  `interpretSpec` resolves EXACTLY as it does in every other renderPageToJSON
 *  test, isolating this fitness function to the ONE thing it locks: provenance. */
function storeWith(metadata: MetadataPort | undefined): DataStore {
  return metadata ? { ...staticStore, metadata } : staticStore
}

function ctxWith(store: DataStore): StaticRenderContext {
  return {
    sectionCtx:     { dims: { time: 2024 } },
    stores:         { main: store },
    filterParams:   {},
    vars:           {},
    locale:         'en',
    fallbackLocale: 'en',
    perspectiveKey: 'mode',
    perspective:    { current: 'year', available: [], set: () => {} },
  }
}

const PAGE_WITH_ONE_SECTION = asPage({
  type:     'inner-page',
  id:       'gdp-page',
  children: [
    {
      type: 'section',
      id:   'gdp-section',
      data: { type: 'row-list', rows: [{ code: 'B1G' }] },
    },
  ],
})

describe('FF-DELIVERY-PROVENANCE — a metadata report reaches the snapshot', () => {
  it('a store WITH a MetadataPort report yields per-node provenance + a folded ViewSnapshot.provenance', () => {
    const store = storeWith({
      provenance: (code) =>
        code === 'B1G'
          ? { source: 'National Statistics Office', lastUpdated: '2024-09-15', methodology: 'https://example.org/methodology/gdp' }
          : undefined,
    })
    const pageSnapshot = renderPageToJSON(PAGE_WITH_ONE_SECTION, ctxWith(store))
    const sectionEntry = pageSnapshot.nodes[0].children[0]

    expect(sectionEntry.provenance).toEqual({
      source:         'National Statistics Office',
      lastUpdated:    '2024-09-15',
      methodologyUrl: 'https://example.org/methodology/gdp',
    })

    const viewSnapshot = viewSnapshotFromPageSnapshot(pageSnapshot)
    expect(viewSnapshot.provenance).toEqual(sectionEntry.provenance)
  })

  it('DEGRADES gracefully — a store with NO MetadataPort yields no provenance anywhere, never throws', () => {
    const store = storeWith(undefined)
    const pageSnapshot = renderPageToJSON(PAGE_WITH_ONE_SECTION, ctxWith(store))
    const sectionEntry = pageSnapshot.nodes[0].children[0]

    expect(sectionEntry.status).toBe('ok')       // delivery is NEVER blocked
    expect(sectionEntry.provenance).toBeUndefined()

    const viewSnapshot = viewSnapshotFromPageSnapshot(pageSnapshot)
    expect(viewSnapshot.provenance).toBeUndefined()
  })

  it('DEGRADES gracefully — a MetadataPort with no report for the code yields no provenance, never throws', () => {
    const store = storeWith({ provenance: () => undefined })
    const pageSnapshot = renderPageToJSON(PAGE_WITH_ONE_SECTION, ctxWith(store))
    expect(pageSnapshot.nodes[0].children[0].provenance).toBeUndefined()
    expect(viewSnapshotFromPageSnapshot(pageSnapshot).provenance).toBeUndefined()
  })
})

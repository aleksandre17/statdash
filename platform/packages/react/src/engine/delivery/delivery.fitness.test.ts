// @vitest-environment jsdom
//
// ── FF-DELIVERY-ONE-SSOT [AR-48 P0] ───────────────────────────────────────────
//
//  DESIGN-delivery-port-export-embed-snapshot.md finding #3: the live EXTRACT
//  path (`ctx.rows`, already resolved by a section/panel) and the SNAPSHOT/EMBED
//  path (`renderPageToJSON`'s own resolution walk) each independently answered
//  "what is on screen?" — agreeing by construction but never PROVEN to be one
//  thing. This fitness function locks the fix:
//
//    1. Both facets' constructors (`viewSnapshotFromRows`,
//       `viewSnapshotFromPageSnapshot`) produce the SAME `ViewSnapshot` shape
//       (configRef · viewState · data · generatedAt) — one substrate, not two.
//    2. Neither constructor calls `interpretSpec` — a grep-guard proves the
//       delivery facade performs NO new data resolution, only wraps an
//       ALREADY-resolved read.
//    3. `downloadExport` (the extract facet's public seam) routes THROUGH
//       `viewSnapshotFromRows` + `extractFromSnapshot`, and the payload that
//       reaches the format's `serialize()` is EXACTLY `snapshot.data` — never a
//       second, independently-derived rows array.
//

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { viewSnapshotFromRows, viewSnapshotFromPageSnapshot, extractFromSnapshot } from './DeliveryPort'
import type { PageDataSnapshot } from '../targets/api'
import type { DataRow } from '@statdash/engine'
import { registerExport } from '@statdash/engine'

const here = dirname(fileURLToPath(import.meta.url))

const ROWS: DataRow[] = [
  { id: '2024', label: 'Tbilisi', value: 12.3 },
  { id: '2025', label: 'Kutaisi', value: 14.5 },
]

// ── 1 — one substrate: both constructors produce a ViewSnapshot ──────────────

describe('FF-DELIVERY-ONE-SSOT — one ViewSnapshot substrate', () => {
  it('viewSnapshotFromRows (EXTRACT) produces the ViewSnapshot shape', () => {
    const snapshot = viewSnapshotFromRows(ROWS, { title: 'GDP', filename: 'gdp' })
    expect(snapshot).toMatchObject({
      configRef: { pageId: 'gdp' },
      viewState: {},
      data:      ROWS,
    })
    expect(typeof snapshot.generatedAt).toBe('string')
  })

  it('viewSnapshotFromPageSnapshot (SNAPSHOT/EMBED) produces the SAME field set', () => {
    const pageSnapshot: PageDataSnapshot = {
      pageId:         'gdp-page',
      schemaVersion:  1,
      locale:         'en',
      fallbackLocale: 'en',
      filterParams:   { time: '2024' },
      sectionCtx:     { dims: { time: 2024 } },
      status:         'ok',
      nodes:          [{ type: 'inner-page', status: 'ok', children: [] }],
      generatedAt:    '2026-07-08T00:00:00.000Z',
      durationMs:     1,
    }
    const snapshotEmbed  = viewSnapshotFromPageSnapshot(pageSnapshot)
    const snapshotExtract = viewSnapshotFromRows(ROWS, {})

    expect(snapshotEmbed).toMatchObject({
      configRef:   { pageId: 'gdp-page', schemaVersion: 1 },
      viewState:   { filterParams: { time: '2024' }, locale: 'en', fallbackLocale: 'en' },
      generatedAt: '2026-07-08T00:00:00.000Z',
    })
    // Both constructors' outputs satisfy the SAME field set — one substrate,
    // not two independently-shaped "what is on screen?" answers.
    expect(Object.keys(snapshotEmbed).sort()).toEqual(Object.keys(snapshotExtract).sort())
  })
})

// ── 2 — extractFromSnapshot reads EXCLUSIVELY from snapshot.data ─────────────

describe('FF-DELIVERY-ONE-SSOT — extract reads only from the ViewSnapshot', () => {
  let lastBlob: Blob | null

  beforeEach(() => {
    lastBlob = null
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn((b: Blob) => { lastBlob = b; return 'blob:mock' }),
      revokeObjectURL: vi.fn(),
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('serialize() receives EXACTLY snapshot.data, never a second rows source', () => {
    const serialize = vi.fn(() => 'probe-payload')
    registerExport('ff-delivery-probe', { mime: 'text/plain', ext: 'txt', label: 'Probe', serialize })

    const snapshot = viewSnapshotFromRows(ROWS, {})
    const ok = extractFromSnapshot(snapshot, 'ff-delivery-probe', {}, () => 'file.txt')

    expect(ok).toBe(true)
    expect(serialize).toHaveBeenCalledTimes(1)
    expect(serialize).toHaveBeenCalledWith(ROWS, {})
    expect(lastBlob).not.toBeNull()
  })
})

// ── 3 — grep-guard: the delivery facade never re-resolves data ───────────────

describe('FF-DELIVERY-ONE-SSOT — no second data read', () => {
  it('DeliveryPort.ts calls interpretSpec NOWHERE (wraps an already-resolved read only)', () => {
    const src = readFileSync(resolve(here, 'DeliveryPort.ts'), 'utf8')
    expect(src).not.toMatch(/interpretSpec\s*\(/)
  })

  it('downloadExport.ts calls interpretSpec NOWHERE (extract never re-resolves)', () => {
    const src = readFileSync(resolve(here, '../downloadExport.ts'), 'utf8')
    expect(src).not.toMatch(/interpretSpec\s*\(/)
  })

  it('the embed API routes call interpretSpec NOWHERE (embed persists/serves opaquely)', () => {
    const apiRoot = resolve(here, '../../../../../apps/api/src')
    const targets = [
      resolve(apiRoot, 'routes/embed/index.ts'),
      resolve(apiRoot, 'lib/snapshot-store.ts'),
    ]
    for (const file of targets) {
      const src = readFileSync(file, 'utf8')
      expect(src, file).not.toMatch(/interpretSpec\s*\(/)
    }
  })

  it('downloadExport.ts imports viewSnapshotFromRows + extractFromSnapshot from DeliveryPort', () => {
    const src = readFileSync(resolve(here, '../downloadExport.ts'), 'utf8')
    expect(src).toMatch(/from ['"]\.\/delivery\/DeliveryPort['"]/)
    expect(src).toMatch(/viewSnapshotFromRows/)
    expect(src).toMatch(/extractFromSnapshot/)
  })
})

// @vitest-environment jsdom
//
// ── FF-REGIONAL-CROSSFILTER-STATE-B — the composition re-purposes on selection ──
//
//  Owner spec (SPEC-regional-crossfilter-behavior.md, State B / img_5): selecting a
//  region MUST re-purpose the composition panel from "GDP by region" to the sectoral
//  structure of the selected region (x = sectors). This asserts it on the RENDERED
//  DOM through the REAL provisioning config and the REAL async render pipeline
//  (caps.sync === false — the live ApiStore path), which is where the bug lived.
//
//  Root that this locks (AR-36): useNodeRows' module-level promise cache was keyed on
//  a data-dependency fingerprint that was NOT node-unique — the geo-map and the
//  sector-pivot section issue the same covering fetch, collided in the shared cache,
//  and the map's by-region rows were served to the pivot. On the ASYNC path a cold
//  State-B render reproduces it (geo-map populates the shared entry first; the pivot
//  reads the same key). Sector labels therefore appear ONLY when the recipe-aware
//  cache key keeps the two nodes apart.
//
import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom'
import type { DataStore, EngineRow, QueryResult, StoreQuery, SectionContext } from '@statdash/engine'
import { SiteProvider } from '@statdash/react'
import { LocaleGuard } from '../app/LocaleGuard'
import { setupParityEnv, buildManifest, buildStores } from './parity-harness'

// A known SECTOR label from the regional fixture — surfaces ONLY via the sector
// pivot (State B), never in the by-region State-A composition.
const SECTOR_LABEL_KA = 'სოფლის მეურნეობა' // Agriculture

// Wrap each sync store as ASYNC (caps.sync === false), mirroring CachedStore(ApiStore):
// queryAsync warms, querySync reads — the exact two-phase path useNodeRows drives live.
function asAsync(sync: DataStore): DataStore {
  return {
    ...sync,
    caps: { queryTypes: ['obs', 'val'], batching: false, streaming: false, sync: false },
    async queryAsync(q: StoreQuery, ctx: SectionContext): Promise<QueryResult> {
      return { state: 'done', data: (sync.querySync?.(q, ctx) ?? []) as EngineRow[] }
    },
    querySync(q: StoreQuery, ctx: SectionContext): EngineRow[] {
      return (sync.querySync?.(q, ctx) ?? []) as EngineRow[]
    },
  } as DataStore
}
function buildAsyncStores(): Record<string, DataStore> {
  return Object.fromEntries(Object.entries(buildStores()).map(([k, v]) => [k, asAsync(v)]))
}

function renderRegional(query: string) {
  const manifest = buildManifest()
  return render(
    <MemoryRouter initialEntries={[`/en/regional${query}`]}>
      <SiteProvider
        stores={buildAsyncStores()}
        pages={manifest.pages}
        nav={manifest.nav}
        chrome={manifest.chrome}
        chromeConfig={manifest.chromeConfig}
        i18n={manifest.i18n}
      >
        <Routes>
          <Route path="/:locale/*" element={<LocaleGuard manifest={manifest} />} />
          <Route path="*" element={<Navigate to={`/${manifest.i18n.defaultLocale}`} replace />} />
        </Routes>
      </SiteProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  setupParityEnv()
  const proto = (globalThis as unknown as { SVGElement?: { prototype: Record<string, unknown> } }).SVGElement?.prototype
  if (proto && !proto.getScreenCTM) {
    proto.getScreenCTM = () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, inverse: () => ({}), multiply: () => ({}) })
    proto.createSVGMatrix = () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, inverse: () => ({}), multiply: () => ({}), translate: () => ({}) })
  }
})
afterEach(() => cleanup())

describe('FF-REGIONAL-CROSSFILTER-STATE-B (async render path)', () => {
  // Count how many times a sector label surfaces as a COMPOSITION AXIS/ROW label
  // (a rendered table cell), not merely as a residual field. In State A the pivot
  // is by-region → sector labels are not the row labels; in State B → they are.
  function sectorCellCount(container: HTMLElement): number {
    let n = 0
    container.querySelectorAll('table td, table th').forEach(c => {
      if ((c.textContent ?? '').includes(SECTOR_LABEL_KA)) n += 1
    })
    return n
  }

  it('State A (no selection) — sector is NOT a composition row label', async () => {
    let r!: ReturnType<typeof render>
    await act(async () => { r = renderRegional('') })
    await act(async () => { await new Promise(res => setTimeout(res, 60)) })
    expect(sectorCellCount(r.container)).toBe(0)
  })

  it('State B (?region=R2) — composition re-purposes to sectoral structure', async () => {
    let r!: ReturnType<typeof render>
    await act(async () => { r = renderRegional('?region=R2') })
    await act(async () => { await new Promise(res => setTimeout(res, 60)) })
    // The sector pivot rendered its sector ROWS (a table cell) — NOT the map's
    // by-region rows. Pre-fix (shared-cache collision) this cell never appeared.
    expect(sectorCellCount(r.container)).toBeGreaterThan(0)
  })
})

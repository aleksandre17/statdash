// @vitest-environment node
//
// ── NodeRegistry capability integration tests ─────────────────────────────────
//
//  Integration layer: pins getByCapability() against the REAL plugin META
//  declarations wired all the way through:
//    slice-meta.ts (NodeCap / CAPS) → plugin meta.ts files → registerSlice
//    → nodeRegistry.getByCapability()
//
//  Counterpart unit tests (registry mechanics, defensive copy, variant fallback)
//  live in engine/react/src/engine/NodeRegistry.caps.test.ts.
//
//  This file lives in engine/plugins/ — the correct layer to import plugin META,
//  per the dependency arrow: engine/core ← engine/react ← engine/plugins.
//

import { describe, it, expect, beforeAll } from 'vitest'
// Import directly from NodeRegistry source — avoids the @statdash/react/engine barrel
// which pulls in registerSlice → i18next (optional peer dep, unresolvable in test env).
import { NodeRegistry, CAPS }              from '@statdash/react/engine/NodeRegistry'
import type { NodeBase, RenderContext, ChildrenArg } from '@statdash/react/engine/types'
import type { NodeSliceExport }            from '@statdash/react/engine/registerSlice'

// ── Stub Shell — satisfies NodeSliceExport.Shell with no DOM dependency ───────
const stubShell = (_def: NodeBase, _ctx: RenderContext, _children: ChildrenArg) => null

// ── Import META-only — pure TS, no Shell/apexcharts/leaflet transitive deps ──
// Paths are relative to nodes/__tests__/ (two levels up to plugins root)
import { META as chartMeta }      from '../../panels/chart/default/meta'
import { META as tableMeta }      from '../../panels/table/default/meta'
import { META as mapMeta }        from '../../panels/map/default/meta'
import { META as kpiStripMeta }   from '../../panels/kpi-strip/default/meta'
import { META as gaugeMeta }      from '../../panels/gauge/default/meta'
import { META as sectionMeta }    from '../section/default/meta'
import { META as georgraphMeta }  from '../georgraph/default/meta'
import { META as repeatMeta }     from '../repeat/default/meta'
import { META as pageHeaderMeta } from '../page-header/default/meta'
import { META as filterBarMeta }  from '../filter-bar/default/meta'
import { META as rowMeta }        from '../layout/row/default/meta'
import { META as wrapMeta }       from '../layout/wrap/default/meta'

// ── Registry fixture ──────────────────────────────────────────────────────────
//
//  Builds a fresh NodeRegistry with only the META listed above.
//  We do NOT use the singleton nodeRegistry — tests must be hermetic.
//  Shell is stubbed to prevent any DOM/React/apexcharts import.

function makeRegistry(): NodeRegistry {
  const reg = new NodeRegistry()

  const allMetas = [
    chartMeta, tableMeta, mapMeta, kpiStripMeta, gaugeMeta,
    sectionMeta, georgraphMeta, repeatMeta,
    pageHeaderMeta, filterBarMeta, rowMeta, wrapMeta,
  ]

  for (const m of allMetas) {
    if ((['node', 'page', 'panel'] as const).includes(m.sliceType as 'node' | 'page' | 'panel')) {
      const slice: NodeSliceExport = { Shell: stubShell, META: m }
      reg.register(m.type, m.variant ?? 'default', stubShell, {
        caps:  'caps' in m ? m.caps : undefined,
        label: m.label,
      })
      void slice // prevent unused-var lint
    }
  }

  return reg
}

let reg: NodeRegistry

beforeAll(() => { reg = makeRegistry() })

// ── CAPS constant vocabulary ──────────────────────────────────────────────────

describe('CAPS constant', () => {
  it('exports all standard vocabulary tokens', () => {
    expect(CAPS.EXPORT).toBe('export')
    expect(CAPS.COLLAPSIBLE).toBe('collapsible')
    expect(CAPS.FILTERABLE).toBe('filterable')
    expect(CAPS.VIEW_TOGGLE).toBe('view-toggle')
    expect(CAPS.METHODOLOGY).toBe('methodology')
    expect(CAPS.DRILL).toBe('drill')
    expect(CAPS.REPEAT).toBe('repeat')
    expect(CAPS.DATA).toBe('data')
    expect(CAPS.CHILDREN).toBe('children')
    expect(CAPS.CHART).toBe('chart')
    expect(CAPS.KPI).toBe('kpi')
  })
})

// ── export cap ────────────────────────────────────────────────────────────────

describe('getByCapability("export")', () => {
  it('returns chart and table', () => {
    const types = reg.getByCapability('export').map(e => e.type)
    expect(types).toContain('chart')
    expect(types).toContain('table')
  })

  it('does not return map (map has no export cap)', () => {
    const types = reg.getByCapability('export').map(e => e.type)
    expect(types).not.toContain('map')
  })
})

// ── collapsible cap ───────────────────────────────────────────────────────────

describe('getByCapability("collapsible")', () => {
  it('returns section', () => {
    const types = reg.getByCapability('collapsible').map(e => e.type)
    expect(types).toContain('section')
  })

  it('returns chart (chart supports collapse)', () => {
    const types = reg.getByCapability('collapsible').map(e => e.type)
    expect(types).toContain('chart')
  })

  it('does not return row or wrap (structural layout only)', () => {
    const types = reg.getByCapability('collapsible').map(e => e.type)
    expect(types).not.toContain('row')
    expect(types).not.toContain('wrap')
  })
})

// ── filterable cap ────────────────────────────────────────────────────────────

describe('getByCapability("filterable")', () => {
  it('returns chart, table, kpi-strip, gauge, map, georgraph, repeat', () => {
    const types = reg.getByCapability('filterable').map(e => e.type)
    expect(types).toContain('chart')
    expect(types).toContain('table')
    expect(types).toContain('kpi-strip')
    expect(types).toContain('gauge')
    expect(types).toContain('map')
    expect(types).toContain('georgraph')
    expect(types).toContain('repeat')
  })

  it('does not return structural nodes (page-header, filter-bar, row)', () => {
    const types = reg.getByCapability('filterable').map(e => e.type)
    expect(types).not.toContain('page-header')
    expect(types).not.toContain('filter-bar')
    expect(types).not.toContain('row')
  })
})

// ── view-toggle cap ───────────────────────────────────────────────────────────

describe('getByCapability("view-toggle")', () => {
  it('returns chart, map, and georgraph', () => {
    const types = reg.getByCapability('view-toggle').map(e => e.type)
    expect(types).toContain('chart')
    expect(types).toContain('map')
    expect(types).toContain('georgraph')
  })

  it('does not return table (table is a toggle target, not a toggler)', () => {
    const types = reg.getByCapability('view-toggle').map(e => e.type)
    expect(types).not.toContain('table')
  })
})

// ── methodology cap ───────────────────────────────────────────────────────────

describe('getByCapability("methodology")', () => {
  it('returns section', () => {
    const types = reg.getByCapability('methodology').map(e => e.type)
    expect(types).toContain('section')
  })
})

// ── repeat cap ────────────────────────────────────────────────────────────────

describe('getByCapability("repeat")', () => {
  it('returns repeat only', () => {
    const types = reg.getByCapability('repeat').map(e => e.type)
    expect(types).toContain('repeat')
  })

  it('does not return row or section', () => {
    const types = reg.getByCapability('repeat').map(e => e.type)
    expect(types).not.toContain('row')
    expect(types).not.toContain('section')
  })
})

// ── unknown / undeclared caps ─────────────────────────────────────────────────

describe('getByCapability — unknown cap', () => {
  it('returns [] for a cap no entry declares', () => {
    expect(reg.getByCapability('nonexistent-cap')).toHaveLength(0)
  })

  it('returns [] for "drill" (not yet declared by any registered slice)', () => {
    expect(reg.getByCapability('drill')).toHaveLength(0)
  })
})

// ── structural nodes — caps: [] ───────────────────────────────────────────────

describe('Structural nodes declare empty caps', () => {
  it('page-header has no caps', () => {
    expect(reg.getCaps('page-header')).toEqual([])
  })

  it('filter-bar has no caps', () => {
    expect(reg.getCaps('filter-bar')).toEqual([])
  })

  it('wrap has no caps', () => {
    expect(reg.getCaps('wrap')).toEqual([])
  })
})

// ── nav capabilities — No-Privileged-Node ADR ─────────────────────────────────

describe('nav capabilities are declared in META, not hardcoded in navUtils', () => {
  it('row is a nav-transparent container (descend-for-nav, distinct from render transparent)', () => {
    expect(reg.getCaps('row')).toEqual(['nav-transparent'])
  })

  it('section + georgraph are nav contributors', () => {
    expect(reg.getCaps('section')).toContain('nav-contributor')
    expect(reg.getCaps('georgraph')).toContain('nav-contributor')
  })
})

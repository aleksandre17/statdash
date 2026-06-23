import { describe, it, expect } from 'vitest'
import { toNodePageConfig, fromNodePageConfig } from './canvasPageAdapter'
import type { CanvasPage }  from '../types/constructor'
import type { NodePageConfig } from '@statdash/react/engine'

const page: CanvasPage = {
  id:    'page-2',
  title: { ka: 'მშპ', en: 'GDP' },
  slug:  'gdp',
  nodeIds: ['n1', 'n2'],
  nodes: {
    n1: { id: 'n1', type: 'filter-bar', props: { position: 'sticky' }, childIds: [] },
    n2: { id: 'n2', type: 'section', variant: 'card', props: { title: 'Dyn' }, childIds: ['c1'] },
    c1: { id: 'c1', type: 'kpi-strip', props: {}, childIds: [] },
  },
}

describe('toNodePageConfig', () => {
  it('projects the flat store model into an inner-page tree', () => {
    const cfg = toNodePageConfig(page) as unknown as {
      type: string; id: string; path: string
      children: Array<{ type: string; id: string; position?: string; title?: string; children?: unknown[] }>
    }
    expect(cfg.type).toBe('inner-page')
    expect(cfg.id).toBe('page-2')
    expect(cfg.path).toBe('gdp')
    expect(cfg.children.map((c) => c.type)).toEqual(['filter-bar', 'section'])
  })

  it('spreads props into the node body and resolves child references', () => {
    const cfg = toNodePageConfig(page) as unknown as {
      children: Array<{ type: string; position?: string; variant?: string; children?: Array<{ type: string }> }>
    }
    const [filterBar, section] = cfg.children
    expect(filterBar.position).toBe('sticky')             // props spread onto node
    expect(section.variant).toBe('card')                  // variant stamped
    expect(section.children?.[0].type).toBe('kpi-strip')  // child id → resolved node
  })

  it('omits an empty children array (leaves stay leaves)', () => {
    const cfg = toNodePageConfig(page) as unknown as {
      children: Array<{ type: string; children?: unknown }>
    }
    const filterBar = cfg.children.find((c) => c.type === 'filter-bar')!
    expect('children' in filterBar).toBe(false)
  })
})

describe('fromNodePageConfig', () => {
  it('hydrates a flat CanvasPage from an engine tree', () => {
    const restored = fromNodePageConfig(toNodePageConfig(page), page.title)
    expect(restored.id).toBe('page-2')
    expect(restored.slug).toBe('gdp')
    expect(restored.nodeIds).toEqual(['n1', 'n2'])
    expect(restored.nodes.n1.type).toBe('filter-bar')
    expect(restored.nodes.n2.childIds).toEqual(['c1'])
  })

  it('separates structural keys from the free-form props body', () => {
    const restored = fromNodePageConfig(toNodePageConfig(page), page.title)
    const n2 = restored.nodes.n2
    expect(n2.props).toEqual({ title: 'Dyn' })   // no type/variant/id/children leak
    expect(n2.variant).toBe('card')
  })

  it('synthesizes stable ids for nodes authored without one', () => {
    const cfg = {
      type: 'inner-page', id: 'p', path: 'p',
      children: [{ type: 'hero', title: 'x' }],
    } as unknown as NodePageConfig
    const restored = fromNodePageConfig(cfg)
    expect(restored.nodeIds).toEqual(['p-0'])
    expect(restored.nodes['p-0'].type).toBe('hero')
  })
})

describe('round-trip fitness (ADR): fromNodePageConfig ∘ toNodePageConfig = identity', () => {
  it('preserves type, variant, props, childIds and order', () => {
    const restored = fromNodePageConfig(toNodePageConfig(page), page.title)
    // Compare the whole page (title supplied identically on the load side).
    expect(restored).toEqual(page)
  })

  it('is stable under repeated round-trips (idempotent)', () => {
    const once  = fromNodePageConfig(toNodePageConfig(page), page.title)
    const twice = fromNodePageConfig(toNodePageConfig(once), page.title)
    expect(twice).toEqual(once)
  })
})

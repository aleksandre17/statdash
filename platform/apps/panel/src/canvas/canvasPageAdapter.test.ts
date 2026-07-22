import { describe, it, expect } from 'vitest'
import { toNodePageConfig, fromNodePageConfig, DEFAULT_PAGE_TYPE } from './canvasPageAdapter'
import type { CanvasPage, PageMeta }  from '../types/constructor'
import type { NodePageConfig, PageConfigBase } from '@statdash/react/engine'

const page: CanvasPage = {
  id:    'page-2',
  type:  'inner-page',
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

  it('preserves NESTED props (object + array) through the round-trip', () => {
    // A node whose props carry nested structure — the shape a dotted-path schema
    // field (e.g. "view.width", "series.0.color") authors via setAtPath.
    const nestedPage: CanvasPage = {
      id: 'page-n', type: 'inner-page', title: { ka: 'n', en: 'n' }, slug: 'n',
      nodeIds: ['x1'],
      nodes: {
        x1: {
          id: 'x1', type: 'chart', props: {
            view:   { width: 'full', height: 240 },
            series: [{ color: 'red' }, { color: 'blue' }],
          }, childIds: [],
        },
      },
    }
    const restored = fromNodePageConfig(toNodePageConfig(nestedPage), nestedPage.title)
    expect(restored).toEqual(nestedPage)
  })
})

// ── FF-NO-PRIVILEGED-PAGE-TYPE — the page KIND round-trips losslessly ─────────
//
//  Law 1 (no privileged type) for the PAGE ROOT. The adapter must NOT stamp a
//  hardcoded page-type literal: each page carries its OWN `type` and it survives
//  fromNodePageConfig∘toNodePageConfig verbatim. Proven with a NON-inner-page
//  fixture — if the adapter hardcodes `'inner-page'` (the old defect), the
//  serialized type diverges from the page's declared kind and these fail. This
//  locks the regression so the privileged hardcode cannot silently return.
//
describe('FF-NO-PRIVILEGED-PAGE-TYPE — the page kind is per-page, not hardcoded', () => {
  // A page whose kind is NOT the historical privileged default — the adapter is
  // kind-agnostic (pure string pass-through), so an arbitrary declared kind proves
  // there is no baked-in literal.
  const landingPage: CanvasPage = {
    id: 'lp', type: 'landing', title: { ka: 'ლენდინგი', en: 'Landing' }, slug: 'lp',
    nodeIds: ['h1'],
    nodes: { h1: { id: 'h1', type: 'hero', props: { title: { ka: 'გ', en: 'H' } }, childIds: [] } },
  }

  it('toNodePageConfig stamps the page OWN type (not a privileged literal)', () => {
    const cfg = toNodePageConfig(landingPage) as unknown as { type: string }
    expect(cfg.type).toBe('landing')          // the page's own kind, verbatim
    expect(cfg.type).not.toBe(DEFAULT_PAGE_TYPE)
  })

  it('the declared kind round-trips losslessly (no data-loss on load)', () => {
    const restored = fromNodePageConfig(toNodePageConfig(landingPage), landingPage.title)
    expect(restored.type).toBe('landing')     // was silently DROPPED before the fix
    expect(restored).toEqual(landingPage)      // whole page, kind included
  })

  it('a tab-page kind is preserved distinctly (each kind keeps its own)', () => {
    const tab: CanvasPage = { ...landingPage, id: 't', slug: 't', type: 'tab-page' }
    const restored = fromNodePageConfig(toNodePageConfig(tab), tab.title)
    expect(restored.type).toBe('tab-page')
  })

  it('a kind-less inbound config backstops to DEFAULT_PAGE_TYPE (symmetric fallback)', () => {
    // Only a legacy/hand-authored config with no `type` uses the default — never a
    // silent privilege over a declared kind.
    const cfg = { id: 'k', path: 'k', children: [] } as unknown as NodePageConfig
    expect(fromNodePageConfig(cfg).type).toBe(DEFAULT_PAGE_TYPE)
  })
})

// ── PAGE-LEVEL round-trip fitness (P-3): every PageConfigBase field survives ──
//
//  The subtree-only round-trip above is a FALSE-GREEN for page-level config:
//  toNodePageConfig used to hardcode { type,id,path,children } and DROP frame /
//  chrome / color / presentation / filterSchema / vars / perspectives / schemaVersion.
//  This block populates EVERY non-identity PageConfigBase field and asserts a
//  complete round-trip, so dropping ANY of them fails the test.
//
//  COVERAGE GUARD: `META_FIELD_COVERAGE` is a `Record<keyof PageMeta, true>` — it
//  will not type-check unless it lists every field PageMeta has (= PageConfigBase
//  minus the id/path identity columns). We then assert at runtime that the fixture's
//  `meta` carries each guarded key, so the test can't rot as PageConfigBase grows:
//  a new field forces a compile error here AND a new fixture value.

// id/path are CanvasPage identity columns (id/slug), not part of `meta`.
const META_FIELD_COVERAGE: Record<keyof PageMeta, true> = {
  schemaVersion: true,
  frame:         true,
  chrome:        true,
  presentation:  true,
  filterSchema:  true,
  vars:          true,
  perspectives:  true,
  storeKey:      true,
}

// A fully-populated PageMeta — one concrete value per guarded field.
const fullMeta: PageMeta = {
  schemaVersion: 2,
  frame:         'landing',
  chrome:        { header: 'minimal', sidebar: { variant: 'compact', config: { collapsed: true } } },
  // schemaVersion ≥ 2: page color lives ONLY under presentation.color (the flat
  // PageConfigBase.color field was retired). PageMeta = Omit<PageConfigBase,'id'|'path'>
  // therefore no longer carries a flat `color`.
  presentation:  { color: '#1f77b4', label: 'overview' },
  filterSchema: {
    bars: {
      main: {
        position: 'sticky',
        filters: {
          time: { type: 'year-select', label: { ka: 'წელი', en: 'Year' }, default: 2023 },
        },
      },
    },
    context: { dims: { time: 'time' } },
  },
  vars:      { yearLabel: { op: 'lookup', key: 'time', map: { '2023': 'Y2023' } } },
  // VISION #3 — the declared perspective axes (keyed by URL param). Carried
  // generically through the same meta spread; round-trips byte-identically.
  perspectives: {
    perspective: {
      perspectives: [
        { id: 'year',  label: { ka: 'წელი',  en: 'Year'  } },
        { id: 'range', label: { ka: 'პერიოდი', en: 'Range' } },
      ],
    },
  },
  // The page's declared store home (0112 R1 recheck) — round-trips generically
  // through meta exactly like every other PageConfigBase field.
  storeKey: 'gdp',
}

// A COMPLETE page: identity columns + every page-level field + a nested subtree.
const fullPage: CanvasPage = {
  id:      'page-full',
  type:    'inner-page',
  title:   { ka: 'სრული', en: 'Full' },
  slug:    'full',
  nodeIds: ['n1', 'n2'],
  nodes: {
    n1: { id: 'n1', type: 'filter-bar', props: { position: 'sticky' }, childIds: [] },
    n2: { id: 'n2', type: 'section', variant: 'card', props: { title: 'Sec' }, childIds: ['c1'] },
    c1: { id: 'c1', type: 'kpi-strip', props: { items: [{ id: 'k' }] }, childIds: [] },
  },
  meta: fullMeta,
}

describe('page-level round-trip fitness (P-3): every PageConfigBase field survives', () => {
  it('coverage guard — fixture exercises every PageMeta field (cannot rot as type grows)', () => {
    // The Record<keyof PageMeta, true> above is the compile-time half; this is the
    // runtime half — the fixture's meta must actually carry each guarded key.
    for (const key of Object.keys(META_FIELD_COVERAGE) as Array<keyof PageMeta>) {
      expect(fullMeta[key], `fixture meta is missing PageConfigBase field "${key}"`).toBeDefined()
    }
  })

  it('toNodePageConfig spreads every meta field onto the page root', () => {
    const cfg = toNodePageConfig(fullPage) as unknown as Record<string, unknown>
    expect(cfg.frame).toBe('landing')
    expect(cfg.chrome).toEqual(fullMeta.chrome)
    expect(cfg.presentation).toEqual(fullMeta.presentation)
    expect(cfg.filterSchema).toEqual(fullMeta.filterSchema)
    expect(cfg.vars).toEqual(fullMeta.vars)
    expect(cfg.perspectives).toEqual(fullMeta.perspectives)
    expect(cfg.schemaVersion).toBe(2)
    expect(cfg.storeKey).toBe('gdp')
    // identity columns still come from the CanvasPage, not meta
    expect(cfg.id).toBe('page-full')
    expect(cfg.path).toBe('full')
    expect(cfg.type).toBe('inner-page')
  })

  it('fromNodePageConfig(toNodePageConfig(p)) ≡ p — COMPLETE page is lossless', () => {
    const restored = fromNodePageConfig(toNodePageConfig(fullPage), fullPage.title)
    expect(restored).toEqual(fullPage)
  })

  it('is idempotent under repeated round-trips with full meta', () => {
    const once  = fromNodePageConfig(toNodePageConfig(fullPage), fullPage.title)
    const twice = fromNodePageConfig(toNodePageConfig(once), fullPage.title)
    expect(twice).toEqual(once)
  })

  it('a meta-less page round-trips WITHOUT a spurious empty meta object', () => {
    // `page` (top of file) has no page-level fields → restored must have no `meta`.
    const restored = fromNodePageConfig(toNodePageConfig(page), page.title)
    expect('meta' in restored).toBe(false)
  })

  it('carries a NEW (unmodelled) page-root field generically — structural pass-through', () => {
    // Proves the adapter is pass-through, not a hand-listed allowlist: a field the
    // adapter has never heard of still survives, so a future PageConfigBase field
    // round-trips with zero adapter edit.
    const cfg = {
      type: 'inner-page', id: 'p', path: 'p',
      futureField: { some: 'value' },
      children: [],
    } as unknown as NodePageConfig
    const restored = fromNodePageConfig(cfg)
    expect((restored.meta as Record<string, unknown>).futureField).toEqual({ some: 'value' })
    const reprojected = toNodePageConfig(restored) as unknown as Record<string, unknown>
    expect(reprojected.futureField).toEqual({ some: 'value' })
  })
})

// Type-level sanity: PageMeta is exactly PageConfigBase minus id/path. If a future
// PageConfigBase field is added, META_FIELD_COVERAGE above stops type-checking.
type _AssertMetaMatchesContract =
  keyof PageMeta extends Exclude<keyof PageConfigBase, 'id' | 'path'> ? true : never
const _metaContractHolds: _AssertMetaMatchesContract = true
void _metaContractHolds

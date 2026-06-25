// ── loadTemplate.test — the pure projection helpers (V7) ─────────────────────
//
//  hydrateTemplate + slugify are pure (no store/network), so they are pinned in
//  isolation: a chosen config is stamped with the new page's identity and
//  hydrated to the flat store model, the descendant node ids surviving intact.
//
import { describe, it, expect } from 'vitest'
import { hydrateTemplate, slugify } from './loadTemplate'
import { STARTER_TEMPLATES } from './starterTemplates'

describe('slugify', () => {
  it('lowercases + hyphenates + strips edges', () => {
    expect(slugify('  GDP Overview!! ')).toBe('gdp-overview')
  })
  it('collapses runs of non-alphanumerics', () => {
    expect(slugify('A___B   C')).toBe('a-b-c')
  })
})

describe('hydrateTemplate', () => {
  const tpl = STARTER_TEMPLATES.find((t) => t.id === 'chart-table')!

  it('stamps the page identity from the slug (placeholder id/path replaced)', () => {
    const page = hydrateTemplate(tpl.config, { ka: 'მშპ', en: 'GDP' }, 'gdp')
    expect(page.id).toBe('gdp')
    expect(page.slug).toBe('gdp')
    expect(page.title).toEqual({ ka: 'მშპ', en: 'GDP' })
  })

  it('hydrates the flat node model with the template node ids intact', () => {
    const page = hydrateTemplate(tpl.config, { ka: 'მშპ', en: 'GDP' }, 'gdp')
    // header + section at top level; the chart + table nested under the section.
    expect(page.nodeIds).toEqual(['hdr', 'sec'])
    expect(page.nodes.sec.childIds).toEqual(['sec-chart', 'sec-table'])
    expect(page.nodes['sec-chart'].type).toBe('chart')
    expect(page.nodes['sec-chart'].props).toMatchObject({ chartType: 'bar' })
  })

  it('does not mutate the committed template config (pure)', () => {
    const before = JSON.stringify(tpl.config)
    hydrateTemplate(tpl.config, { ka: 'x', en: 'x' }, 'x')
    expect(JSON.stringify(tpl.config)).toBe(before)
  })
})

// ── loadTemplate.test — the pure projection helpers (V7) ─────────────────────
//
//  hydrateTemplate + slugify are pure (no store/network), so they are pinned in
//  isolation: a chosen config is stamped with the new page's identity and
//  hydrated to the flat store model, the descendant node ids surviving intact.
//
import { describe, it, expect } from 'vitest'
import { hydrateTemplate, slugify } from './loadTemplate'
import { PAGE_STARTERS, seedToPageConfig } from './pageStarters'

describe('slugify', () => {
  it('lowercases + hyphenates + strips edges', () => {
    expect(slugify('  GDP Overview!! ')).toBe('gdp-overview')
  })
  it('collapses runs of non-alphanumerics', () => {
    expect(slugify('A___B   C')).toBe('a-b-c')
  })
})

describe('hydrateTemplate', () => {
  // The chart-table starter expanded from its registered page-root seed (ADR-050 R3).
  // Deterministic pre-order ids: root 'starter' → 'starter-0' (header), 'starter-1'
  // (section) → 'starter-1-0' (chart), 'starter-1-1' (table).
  const config = () => seedToPageConfig(PAGE_STARTERS.find((p) => p.id === 'chart-table')!.seed)

  it('stamps the page identity from the slug (placeholder id/path replaced)', () => {
    const page = hydrateTemplate(config(), { ka: 'მშპ', en: 'GDP' }, 'gdp')
    expect(page.id).toBe('gdp')
    expect(page.slug).toBe('gdp')
    expect(page.title).toEqual({ ka: 'მშპ', en: 'GDP' })
  })

  it('hydrates the flat node model with the seed-derived node ids intact', () => {
    const page = hydrateTemplate(config(), { ka: 'მშპ', en: 'GDP' }, 'gdp')
    // header + section at top level; the chart + table nested under the section.
    expect(page.nodeIds).toEqual(['starter-0', 'starter-1'])
    expect(page.nodes['starter-1'].childIds).toEqual(['starter-1-0', 'starter-1-1'])
    expect(page.nodes['starter-1-0'].type).toBe('chart')
    expect(page.nodes['starter-1-0'].props).toMatchObject({ chartType: 'bar' })
  })

  it('does not mutate the source config (pure)', () => {
    const cfg = config()
    const before = JSON.stringify(cfg)
    hydrateTemplate(cfg, { ka: 'x', en: 'x' }, 'x')
    expect(JSON.stringify(cfg)).toBe(before)
  })
})

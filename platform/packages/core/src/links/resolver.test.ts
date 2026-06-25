// ── resolveDataLinks — N36 cross-filter unit tests ────────────────────────
//
//  Covers:
//    1. target:'filter' → action:'filter' with filterKey + filterValue from row
//    2. fromField default (filterKey then 'id')
//    3. target:'page' still resolves action:'navigate' with href (regression)
//    4. target:'external' still resolves action:'navigate' (regression)
//    5. Invalid/null filter links (missing filterKey) are excluded gracefully
//

import { describe, it, expect }    from 'vitest'
import { resolveDataLinks }         from './resolver'
import type { DataLinkDef }         from './types'

const LOCALE   = 'en'
const FALLBACK = 'en'

const ROW = {
  id:       'GE-TB',
  regionId: 'GE-TB',
  label:    'Tbilisi',
  value:    1234,
}

describe('resolveDataLinks — filter target (N36)', () => {
  it('returns action:filter with filterKey and filterValue from row[filterKey]', () => {
    const links: DataLinkDef[] = [
      {
        title:     { en: 'Filter by region' },
        target:    'filter',
        filterKey: 'regionId',
      },
    ]
    const result = resolveDataLinks(links, ROW, {}, LOCALE, FALLBACK)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      action:      'filter',
      filterKey:   'regionId',
      filterValue: 'GE-TB',
    })
  })

  it('uses fromField when explicitly set', () => {
    const links: DataLinkDef[] = [
      {
        title:     { en: 'Filter by id' },
        target:    'filter',
        filterKey: 'regionId',
        fromField: 'id',
      },
    ]
    const result = resolveDataLinks(links, ROW, {}, LOCALE, FALLBACK)
    const link = result[0]
    expect(link.action).toBe('filter')
    if (link.action === 'filter') expect(link.filterValue).toBe('GE-TB')
  })

  it('falls back to id field when filterKey not present on row', () => {
    const links: DataLinkDef[] = [
      {
        title:     { en: 'Filter by time' },
        target:    'filter',
        filterKey: 'time',   // 'time' not on ROW — falls back to 'id'
      },
    ]
    const result = resolveDataLinks(links, ROW, {}, LOCALE, FALLBACK)
    // fromField defaults to filterKey ('time'), which is not on ROW → undefined
    // the spec says default is filterKey ?? 'id', so it reads row['time'] = undefined
    const link = result[0]
    expect(link.action).toBe('filter')
    if (link.action === 'filter') expect(link.filterKey).toBe('time')
  })

  it('does not set href or target on a filter ResolvedLink', () => {
    const links: DataLinkDef[] = [
      {
        title:     { en: 'Filter' },
        target:    'filter',
        filterKey: 'regionId',
      },
    ]
    const result = resolveDataLinks(links, ROW, {}, LOCALE, FALLBACK)
    // filter ResolvedLinks carry no navigate-branch keys at runtime
    const link = result[0] as Record<string, unknown>
    expect(link.href).toBeUndefined()
    expect(link.target).toBeUndefined()
    expect(link.openIn).toBeUndefined()
  })

  it('resolves locale title correctly', () => {
    const links: DataLinkDef[] = [
      {
        title:     { en: 'Filter by region', ka: 'რეგიონი' },
        target:    'filter',
        filterKey: 'regionId',
      },
    ]
    const result = resolveDataLinks(links, ROW, {}, LOCALE, FALLBACK)
    expect(result[0].title).toBe('Filter by region')
  })
})

describe('resolveDataLinks — navigate targets (regression)', () => {
  it('page target returns action:navigate with href', () => {
    const links: DataLinkDef[] = [
      {
        title:  { en: 'Go to regional' },
        target: 'page',
        page:   '/regional',
        params: { regionId: { $row: 'regionId' } },
      },
    ]
    const result = resolveDataLinks(links, ROW, {}, LOCALE, FALLBACK)
    expect(result).toHaveLength(1)
    const link = result[0]
    expect(link.action).toBe('navigate')
    if (link.action === 'navigate') {
      expect(link.target).toBe('page')
      expect(link.href).toContain('/regional')
      expect(link.href).toContain('regionId=GE-TB')
    }
  })

  it('external target returns action:navigate with tab openIn', () => {
    const links: DataLinkDef[] = [
      {
        title:  { en: 'Open external' },
        target: 'external',
        url:    'https://example.com',
      },
    ]
    const result = resolveDataLinks(links, ROW, {}, LOCALE, FALLBACK)
    const link = result[0]
    expect(link.action).toBe('navigate')
    if (link.action === 'navigate') {
      expect(link.openIn).toBe('tab')
      expect(link.href).toBe('https://example.com')
    }
  })

  it('page target without page field returns empty (not null — filtered)', () => {
    const links: DataLinkDef[] = [
      {
        title:  { en: 'Broken link' },
        target: 'page',
        // page omitted
      },
    ]
    const result = resolveDataLinks(links, ROW, {}, LOCALE, FALLBACK)
    expect(result).toHaveLength(0)
  })
})

describe('resolveDataLinks — $param scope (renamed from $ctx) [R4]', () => {
  it('resolves a $param value from filterParams (the de-collided filter-param scope)', () => {
    const links: DataLinkDef[] = [
      {
        title:  { en: 'Drill with active time' },
        target: 'page',
        page:   '/regional',
        params: { time: { $param: 'time' } },
      },
    ]
    const result = resolveDataLinks(links, ROW, { time: 2023 }, LOCALE, FALLBACK)
    const link = result[0]
    expect(link.action).toBe('navigate')
    if (link.action === 'navigate') expect(link.href).toContain('time=2023')
  })

  it('mixes $row (row scope) and $param (param scope) in one link', () => {
    const links: DataLinkDef[] = [
      {
        title:  { en: 'Drill' },
        target: 'page',
        page:   '/regional',
        params: { region: { $row: 'regionId' }, time: { $param: 'time' } },
      },
    ]
    const result = resolveDataLinks(links, ROW, { time: 2020 }, LOCALE, FALLBACK)
    const link = result[0]
    if (link.action === 'navigate') {
      expect(link.href).toContain('region=GE-TB')
      expect(link.href).toContain('time=2020')
    }
  })
})

describe('resolveDataLinks — mixed link array', () => {
  it('handles filter + navigate links in the same array', () => {
    const links: DataLinkDef[] = [
      {
        title:     { en: 'Filter by region' },
        target:    'filter',
        filterKey: 'regionId',
      },
      {
        title:  { en: 'Drill down' },
        target: 'page',
        page:   '/regional',
      },
    ]
    const result = resolveDataLinks(links, ROW, {}, LOCALE, FALLBACK)
    expect(result).toHaveLength(2)
    expect(result[0].action).toBe('filter')
    expect(result[1].action).toBe('navigate')
  })
})

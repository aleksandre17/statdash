// ── P3-1: Constructor round-trip — page-shaped configs (3 variants) ──────────
//
//  Covers: inner-page + kpi-strip · inner-page + chart section ·
//          inner-page + table section.
//
//  WHY: The full NodePageConfig (page root + children tree) is what the
//  Constructor serializes and the renderer deserializes.  Testing the primitives
//  in isolation is necessary but not sufficient — the composition must also be
//  lossless so the renderer receives exactly what the Constructor authored.
//
//  NOTE: NodePageConfig is defined in @statdash/react (one layer above engine/core).
//  These fixtures are typed as plain objects to avoid a cross-layer import, while
//  fully exercising the JSON contract for every node and data field the
//  Constructor would produce.
//
// @vitest-environment node

import { describe, it, expect }    from 'vitest'
import type { DataSpec, VisibilityExpr, TableConfig } from './section'
import type { KpiSpec }            from '../data/kpi'

function roundTrip<T>(v: T): T { return JSON.parse(JSON.stringify(v)) as T }

function expectRoundTrip<T>(v: T): void { expect(roundTrip(v)).toEqual(v) }

// ── Variant 1: inner-page with kpi-strip ─────────────────────────────────────

describe('Page round-trip — inner-page + kpi-strip', () => {

  it('full page survives with visibleToRoles, preliminary, methodologyUrl', () => {
    const page = {
      id:            'gdp-overview',
      schemaVersion: 1,
      type:          'inner-page',
      path:          '/gdp',
      color:         '#1f77b4',
      modeOrder:     ['year', 'range'],
      filterSchema: {
        bars: {
          main: {
            position: 'sticky',
            filters: {
              time: { type: 'year-select', param: 'time', label: { ka: 'წელი', en: 'Year' } },
              geo:  {
                type:   'select',
                param:  'geo',
                label:  { ka: 'რეგიონი', en: 'Region' },
                source: { type: 'static', options: [{ value: 'GE', label: 'Georgia' }] },
              },
            },
          },
        },
      },
      children: [
        {
          type:           'kpi-strip',
          id:             'kpis-1',
          visibleToRoles: ['analyst', 'admin'],
          items: [
            {
              id:    'gdp',
              label: { ka: 'მშპ', en: 'GDP' },
              unit:  'მლნ ₾',
              color: '#1f77b4',
              mode:  'year',
              value: { type: 'point', measure: 'B1G', format: 'mln_gel' },
              trend: { type: 'yoy', measure: 'B1G' },
            },
            {
              id:             'wage-share',
              label:          { ka: 'ხელფასის წილი', en: 'Wage Share' },
              unit:           '%',
              color:          '#2ca02c',
              mode:           'year',
              preliminary:    true,
              methodologyUrl: 'https://geostat.ge/methodology',
              value:          { type: 'share', num: { measure: 'D1' }, denom: { measure: 'B1G' } },
            },
          ] satisfies KpiSpec[],
        },
      ],
    }

    expect(() => JSON.stringify(page)).not.toThrow()
    expectRoundTrip(page)

    const r = roundTrip(page)
    expect(r.id).toBe('gdp-overview')
    expect(r.schemaVersion).toBe(1)
    expect(r.type).toBe('inner-page')

    const strip = r.children[0]
    expect(strip.type).toBe('kpi-strip')
    expect(strip.items).toHaveLength(2)
    expect(strip.items[0].label).toEqual({ ka: 'მშპ', en: 'GDP' })
    expect(strip.visibleToRoles).toEqual(['analyst', 'admin'])
    expect(strip.items[1].preliminary).toBe(true)
    expect(strip.items[1].methodologyUrl).toBe('https://geostat.ge/methodology')
  })

})

// ── Variant 2: inner-page with chart section ──────────────────────────────────

describe('Page round-trip — inner-page + chart section', () => {

  it('$ctx refs, VisibilityExpr, cross-filter events all preserved', () => {
    const chartData: DataSpec = {
      type:     'query',
      query:    { measure: ['B1G', 'D1'], filter: { geo: { $ctx: 'geo' } } },
      encoding: { label: 'time', value: 'value', series: 'measure' },
      rowLimit: 20,
    }

    const visWhen: VisibilityExpr = { op: 'isset', param: 'geo' }

    const page = {
      id:            'gdp-chart-page',
      schemaVersion: 1,
      type:          'inner-page',
      path:          '/gdp/chart',
      children: [
        {
          type:     'section',
          id:       'gdp-section',
          title:    { ka: 'მშპ დინამიკა', en: 'GDP Dynamics' },
          anchor:   'gdp-dynamics',
          color:    '#aec7e8',
          data:     chartData,
          view:     { width: 'full', visibleWhen: visWhen, defaultOpen: true },
          methodology: {
            note:        'Source: GeoStat, National Accounts.',
            source:      'GeoStat / National Accounts',
            lastUpdated: '2024-03',
          },
          children: [
            {
              type:           'chart',
              id:             'gdp-line',
              chartType:      'line',
              data:           chartData,
              view:           { toggle: true, legend: 'bottom', tooltip: 'multi' },
              visibleToRoles: [],
              on: [
                { event: 'row:click', action: { type: 'set-param', param: 'geo', from: 'label' } },
              ],
            },
          ],
        },
      ],
    }

    expect(() => JSON.stringify(page)).not.toThrow()
    expectRoundTrip(page)

    const r     = roundTrip(page)
    const sec   = r.children[0]
    const chart = sec.children[0]

    // Section fields
    expect(sec.title).toEqual({ ka: 'მშპ დინამიკა', en: 'GDP Dynamics' })
    expect(sec.methodology.source).toBe('GeoStat / National Accounts')
    expect(sec.view.visibleWhen).toEqual({ op: 'isset', param: 'geo' })

    // $ctx ref survived in DataSpec
    expect(sec.data.query.filter?.geo).toEqual({ $ctx: 'geo' })

    // rowLimit survived
    expect(sec.data.rowLimit).toBe(20)

    // Chart: empty visibleToRoles preserved (not dropped), event handler preserved
    expect(chart.visibleToRoles).toEqual([])
    expect(chart.on[0]).toEqual({
      event:  'row:click',
      action: { type: 'set-param', param: 'geo', from: 'label' },
    })
  })

})

// ── Variant 3: inner-page with table section ──────────────────────────────────

describe('Page round-trip — inner-page + table section', () => {

  it('TableConfig fields, row-list DataSpec, vars all preserved', () => {
    const tableData: DataSpec = {
      type: 'row-list',
      rows: [
        { code: 'B1G',   label: { ka: 'მშპ',    en: 'GDP'    }, isTotal: true },
        { code: 'D1',    label: { ka: 'ხელფასი', en: 'Wages'  }, pctOf: 'B1G' },
        { code: 'B2A3G', label: { ka: 'მოგება',  en: 'Profit' }, pctOf: 'B1G', negate: false },
      ],
    }

    const tableCfg: TableConfig = {
      columns:     [
        { key: 'value', label: { ka: 'მნიშვნელობა', en: 'Value' }, format: 'mln_gel', align: 'r' },
        { key: 'pct',   label: { ka: 'წილი',         en: 'Share' }, format: 'pct',    align: 'r', bar: true },
      ],
      indent:      true,
      statusFlags: true,
      footer:      { value: 'sum' },
      footerLabel: 'Total',
      caption:     'Source: GeoStat National Accounts 2024',
    }

    const page = {
      id:            'gdp-table-page',
      schemaVersion: 1,
      type:          'inner-page',
      path:          '/gdp/table',
      vars:          { currentYear: 2023 },
      children: [
        {
          type:     'section',
          id:       'table-section',
          title:    { ka: 'ეროვნული ანგარიშები', en: 'National Accounts' },
          data:     tableData,
          children: [
            {
              ...tableCfg,
              type:           'table',
              id:             'na-table',
              data:           tableData,
              view:           { default: 'table', toggle: true, exportable: true },
              visibleToRoles: ['public', 'analyst'],
            },
          ],
        },
      ],
    }

    expect(() => JSON.stringify(page)).not.toThrow()
    expectRoundTrip(page)

    const r     = roundTrip(page)
    const sec   = r.children[0]
    const table = sec.children[0]

    // vars preserved at page level
    expect(r.vars).toEqual({ currentYear: 2023 })

    expect(sec.title).toEqual({ ka: 'ეროვნული ანგარიშები', en: 'National Accounts' })

    // TableConfig fields
    expect(table.type).toBe('table')
    expect(table.indent).toBe(true)
    expect(table.statusFlags).toBe(true)
    expect(table.footer).toEqual({ value: 'sum' })
    expect(table.footerLabel).toBe('Total')
    expect(table.columns).toHaveLength(2)
    expect(table.columns![1].bar).toBe(true)

    // row-list DataSpec
    expect(sec.data.type).toBe('row-list')
    expect(sec.data.rows).toHaveLength(3)
    expect(sec.data.rows[0].isTotal).toBe(true)
    expect(sec.data.rows[1].pctOf).toBe('B1G')

    // RBAC array preserved
    expect(table.visibleToRoles).toEqual(['public', 'analyst'])
  })

})

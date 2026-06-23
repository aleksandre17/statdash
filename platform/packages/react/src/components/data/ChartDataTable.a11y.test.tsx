// @vitest-environment jsdom
//
// ── ChartDataTable a11y gate [N15] ────────────────────────────────────
//
//  Verifies that the accessible data table rendered behind every chart
//  has zero axe-core violations. This is the CI a11y gate for the
//  chart → table fallback pattern (ONS / WCAG 2.1 AA).
//
//  axe-core runs against the JSDOM tree rendered by @testing-library/react.
//  No browser or ApexCharts dependency — tests the semantic HTML only.
//

import { describe, it, expect } from 'vitest'
import { render }               from '@testing-library/react'
import axe                      from 'axe-core'
import { ChartDataTable }       from './ChartDataTable'
import type { ChartOutput }     from '@statdash/charts'

// ── Fixture helpers ───────────────────────────────────────────────────

function makeOutput(overrides: Partial<ChartOutput> = {}): ChartOutput {
  return {
    type:       'bar',
    categories: ['2021', '2022', '2023'],
    series: [
      {
        name:  'GDP',
        color: '#0080BE',
        data:  [
          { value: 12.3, formatted: '12.3' },
          { value: 14.5, formatted: '14.5' },
          { value: 16.0, formatted: '16.0' },
        ],
      },
    ],
    stacked:    false,
    horizontal: false,
    legend:     { show: true, position: 'bottom' },
    tooltip:    { mode: 'multi' },
    axes:       { x: {}, y: {} },
    annotations: [],
    ...overrides,
  } as ChartOutput
}

// ── axe helper ────────────────────────────────────────────────────────

async function runAxe(container: HTMLElement) {
  return new Promise<axe.AxeResults>((resolve, reject) => {
    axe.run(container, {}, (err, results) => {
      if (err) reject(err)
      else     resolve(results)
    })
  })
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('ChartDataTable — a11y gate', () => {
  it('single-series chart: no axe violations', async () => {
    const { container } = render(
      <ChartDataTable output={makeOutput()} label="Gross Domestic Product" />,
    )
    const results = await runAxe(container)
    expect(results.violations).toHaveLength(0)
  })

  it('multi-series chart: no axe violations', async () => {
    const multiSeries: ChartOutput = makeOutput({
      series: [
        { name: 'GDP',  color: '#0080BE', data: [
            { value: 12.3, formatted: '12.3' },
            { value: 14.5, formatted: '14.5' },
          ] },
        { name: 'GNP',  color: '#E85D26', data: [
            { value: 10.1, formatted: '10.1' },
            { value: 11.8, formatted: '11.8' },
          ] },
      ],
      categories: ['2022', '2023'],
    })
    const { container } = render(
      <ChartDataTable output={multiSeries} label="GDP vs GNP" />,
    )
    const results = await runAxe(container)
    expect(results.violations).toHaveLength(0)
  })

  it('empty output: renders nothing, no violations', async () => {
    const empty = makeOutput({ categories: [], series: [] })
    const { container } = render(<ChartDataTable output={empty} />)
    expect(container.querySelector('table')).toBeNull()
    const results = await runAxe(container)
    expect(results.violations).toHaveLength(0)
  })

  it('table has correct semantic structure', () => {
    const { container } = render(
      <ChartDataTable output={makeOutput()} label="GDP" />,
    )
    const table = container.querySelector('table')
    expect(table).not.toBeNull()
    expect(table?.getAttribute('aria-label')).toBe('GDP — data table')
    // Column headers (series only — corner cell is <td aria-hidden>)
    expect(container.querySelectorAll('thead th[scope="col"]')).toHaveLength(1) // GDP only
    // Row headers (one per category)
    expect(container.querySelectorAll('tbody th[scope="row"]')).toHaveLength(3)
    // Data cells (3 rows × 1 series)
    expect(container.querySelectorAll('tbody td')).toHaveLength(3)
  })
})

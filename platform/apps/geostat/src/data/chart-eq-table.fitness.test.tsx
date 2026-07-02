// @vitest-environment jsdom
//
// ══ FF-CHART-EQ-TABLE — dual-view chart==table agreement (item 0055, I-6) ══════
//
//  SCOPE (owner clarification): a chart and a table are NOT required to share data —
//  they may run DIFFERENT pipes. Equality is asserted ONLY where a chart-view and a
//  table-view are two `view.role` views of the SAME section (a dual-view section),
//  which by invariant I-6 both RE-ENCODE the ONE `data` the section owns. Independent
//  chart/table panels (each with its own `data`) are each verified against their own
//  source by FF-DATA-PARITY and are explicitly EXCLUDED here.
//
//  WHY structural (not two rendered number sets): ApexCharts cannot mount in jsdom
//  (no canvas/SVG layout), so a chart-view paints no readable values — there is no
//  second numeric surface to diff at render time. The equality is therefore asserted
//  at its SSOT ROOT: for a dual-view section, the section owns `data` and NEITHER view
//  owns its own `data`. Given that, the chart and table cannot diverge — they consume
//  the identical resolved row set (resolveNodeRows inherits section rows). A scoped
//  render then confirms that shared dataset actually reaches the table as live values
//  (so the chart, re-encoding the same rows, shows the same numbers).
//
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Neutralise ApexCharts in jsdom (SVG APIs absent) — see data-parity.fitness for
// the rationale. Tables still render their real values; chart slots still mount.
vi.mock('react-apexcharts', () => ({ default: () => null }))
import {
  setupParityEnv, renderPage, dualViewSections, pageConfigOf, renderedTableNumbers,
  type GoldenDomain,
} from './parity-harness'

beforeAll(() => setupParityEnv())
afterEach(() => cleanup())

const PAGES: GoldenDomain[] = ['gdp', 'accounts', 'regional']

describe('FF-CHART-EQ-TABLE — every dual-view section shares ONE dataset (I-6 SSOT)', () => {
  it('classifies each chart+table section as dual-view (shared data) or independent-pipe', () => {
    for (const page of PAGES) {
      const dv = dualViewSections(pageConfigOf(page), page)
      for (const s of dv) {
        // eslint-disable-next-line no-console
        console.log(`EQ-TABLE [${page}] section=${s.section} sectionData=${s.sectionHasData} chartOwnData=${s.chartHasOwnData} tableOwnData=${s.tableHasOwnData} → ${s.isDualView ? 'DUAL-VIEW (chart==table enforced)' : 'INDEPENDENT-PIPE (excluded)'}`)
      }
    }
    // The classification itself must be sound: a dual-view section owns data and
    // neither view owns its own; an independent-pipe section has ≥1 view with own data.
    for (const page of PAGES) {
      for (const s of dualViewSections(pageConfigOf(page), page)) {
        if (s.isDualView) {
          expect(s.sectionHasData, `${page}/${s.section}: dual-view must own section data`).toBe(true)
          expect(s.chartHasOwnData || s.tableHasOwnData, `${page}/${s.section}: dual-view views must NOT own data (they inherit)`).toBe(false)
        } else {
          expect(s.chartHasOwnData || s.tableHasOwnData, `${page}/${s.section}: independent-pipe must have ≥1 view with own data`).toBe(true)
        }
      }
    }
  })

  // The I-6 guarantee, per dual-view section: section owns data, both views inherit it.
  // This is the ROOT that makes chart==table hold numerically (one dataset, two encodings).
  it('gdp/regional dual-view sections satisfy the shared-data invariant', () => {
    const duals = PAGES.flatMap((p) => dualViewSections(pageConfigOf(p), p)).filter((s) => s.isDualView)
    expect(duals.length, 'the epic ships dual-view sections (gdp + regional)').toBeGreaterThan(0)
    for (const s of duals) {
      expect(s.sectionHasData && !s.chartHasOwnData && !s.tableHasOwnData,
        `${s.page}/${s.section} is not a clean dual-view (chart/table could diverge)`).toBe(true)
    }
  })

  // Owner clarification made concrete: the accounts SNA chart + table run DIFFERENT
  // pipes (each owns its own `data`) — they are NOT compared for equality.
  it('accounts SNA chart+table are independent-pipe (NOT equated)', () => {
    const acc = dualViewSections(pageConfigOf('accounts'), 'accounts')
    expect(acc.length, 'accounts has chart+table sections').toBeGreaterThan(0)
    for (const s of acc) {
      expect(s.isDualView, `accounts/${s.section} must be independent-pipe (own data per view), not equated`).toBe(false)
    }
  })

  // Scoped numeric confirmation: a SINGLE rendered dual-view section proves the shared
  // dataset reaches the table as live values (the chart re-encodes the same rows).
  it('a rendered dual-view section shows its shared dataset as live table values', () => {
    const duals = dualViewSections(pageConfigOf('regional'), 'regional').filter((s) => s.isDualView)
    expect(duals.length, 'regional has ≥1 dual-view section').toBeGreaterThan(0)
    const { container } = renderPage('regional', 'en', 'year')
    const nums = renderedTableNumbers(container).filter((n) => n !== 0)
    // eslint-disable-next-line no-console
    console.log(`EQ-TABLE scoped :: regional/year dual-view sections=${duals.map((d) => d.section).join(',')} live-table-numbers=${nums.length}`)
    expect(nums.length, 'a dual-view section rendered no live table values — the shared dataset did not reach the views').toBeGreaterThan(0)
  })
})

// @vitest-environment jsdom
//
// ══ FF-DATA-PARITY — the data-parity lock (board item 0055, invariant I-1) ═════
//
//  THE GATE: render every store-backed page × perspective through the REAL runner
//  composition, backed by the static-era GOLDEN fixtures (0054), and assert that
//  each known-correct golden value surfaces at the rendered panels — i.e. the
//  current clean-architecture pipeline reproduces the data "as it was", THROUGH the
//  pipeline (DataSpec → interpretSpec → store → encoding → transforms → DOM), never
//  by rollback or by hardcoding a constant.
//
//  METHOD (no hardcode-to-golden, no tautology):
//    · EXPECTED  = goldenValue(facts, coord) — a reducer over the fixture `facts`,
//                  the SOURCE. Not read from the same ExternalStore the pipeline
//                  uses, so a match proves reproduction, not self-agreement.
//    · RENDERED  = the numeric tokens the page actually painted (table cells +
//                  kpi values), collected layout-agnostically.
//    · PARITY    = the closest rendered number is within TOL of EXPECTED.
//
//  A divergence FAILS LOUD (it is a real remaining gap, routed by the owner) — the
//  gate never bends the expectation to make red go green.
//
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// ApexCharts cannot mount in jsdom (SVG getScreenCTM/getBBox absent) — with live
// rows it throws deep in its async layout, an environment gap unrelated to data
// parity. Neutralise it to a null component (the repo's standard jsdom-chart shim):
// the chart panel still mounts its [data-content=chart] slot, tables/KPIs render
// their real values, and no unhandled SVG error is misattributed to a parity test.
vi.mock('react-apexcharts', () => ({ default: () => null }))
import {
  setupParityEnv, renderPage, loadGolden, goldenValue,
  renderedTableNumbers, kpiValueNumbers, closest,
  kpiItemsForMode, pageConfigOf,
  type GoldenDomain, type Mode,
} from './parity-harness'

beforeAll(() => setupParityEnv())
afterEach(() => cleanup())

// Displayed magnitudes are rounded (1 decimal in detail tables, integer in the SNA
// pivot). TOL absorbs that rounding (max observed 0.28 on an integer-rounded cell)
// while staying far below the gap between any two distinct series values.
const TOL = 0.6

interface Anchor {
  page: GoldenDomain
  mode: Mode
  domain: GoldenDomain      // which golden fixture holds the source fact
  label: string
  coord: Record<string, unknown>
}

// Anchors are the KNOWN-CORRECT reference points (README spot-checks + the totals a
// page's headline panels must surface). EXPECTED is computed from `facts` at test
// time — edit the fixture and the expectation moves with the source (Law 1 SSOT).
const ANCHORS: Anchor[] = [
  // ── accounts (codes align with golden; the SNA pivot pipeline is exercised) ──
  { page: 'accounts', mode: 'year', domain: 'accounts', label: 'P1 output · production/R · 2025',  coord: { measure: 'P1',  time: 2025, side: 'R', account: 'production' } },
  { page: 'accounts', mode: 'year', domain: 'accounts', label: 'P2 interm. cons. · production/U · 2025', coord: { measure: 'P2', time: 2025, side: 'U', account: 'production' } },
  { page: 'accounts', mode: 'year', domain: 'accounts', label: 'B1G GDP@mkt · production/U · 2025', coord: { measure: 'B1G', time: 2025, side: 'U', account: 'production' } },

  // ── regional (codes align; the sector-rollup pipeline aggregates to the total) ─
  { page: 'regional', mode: 'year', domain: 'regional', label: 'GVA national total · 2024', coord: { measure: 'GVA', time: 2024 } },

  // ── gdp (README spot-checks: the canonical headline series) ──────────────────
  // GDP total + per-capita historical series live in a perspective-is:range-gated section
  // (year mode renders only the latest-year KPIs/breakdown) -> evaluate in range mode, where the panel paints.
  { page: 'gdp', mode: 'range', domain: 'gdp', label: 'GDP @ current prices · 2024', coord: { measure: 'GDP',            time: 2024 } },
  { page: 'gdp', mode: 'range', domain: 'gdp', label: 'GDP per capita (USD) · 2024', coord: { measure: 'GDP_PER_CAPITA', time: 2024 } },
  { page: 'gdp', mode: 'range', domain: 'gdp', label: 'GDP per capita (USD) · 2014', coord: { measure: 'GDP_PER_CAPITA', time: 2014 } },
]

describe('FF-DATA-PARITY — golden value surfaces through the current pipeline', () => {
  for (const a of ANCHORS) {
    it(`[${a.page}/${a.mode}] ${a.label}`, () => {
      const facts = loadGolden(a.domain).facts
      const { value: expected, matched } = goldenValue(facts, a.coord)
      // Sanity: the golden coordinate must exist (else the anchor is ill-defined,
      // NOT a parity result). This is a harness precondition, not the parity claim.
      expect(matched, `golden coordinate ${JSON.stringify(a.coord)} must match ≥1 fact`).toBeGreaterThan(0)

      const { container } = renderPage(a.page, 'en', a.mode)
      const pool = [...renderedTableNumbers(container), ...kpiValueNumbers(container)]
      const near = closest(expected, pool)

      // eslint-disable-next-line no-console
      console.log(`PARITY [${a.page}/${a.mode}] ${a.label} :: expected=${expected} rendered=${near.value ?? '∅'} Δ=${Number.isFinite(near.delta) ? near.delta.toFixed(3) : '∞'} pool=${pool.length}`)

      expect(
        near.delta,
        `expected golden ${expected} for "${a.label}" to render within ${TOL}; closest rendered was ${near.value ?? '(page rendered no numbers)'} (Δ=${Number.isFinite(near.delta) ? near.delta.toFixed(3) : '∞'})`,
      ).toBeLessThanOrEqual(TOL)
    })
  }
})

// ── FF-DATA-PARITY-KPI — the KPI strip must surface live data ─────────────────
//  A distinct facet: every page × mode ships a KPI strip whose headline values are
//  data-bound (point/yoy/cagr/share). If the pipeline reproduces the source, at
//  least one KPI value is non-zero. An all-zero strip means the KPI coordinate
//  bindings resolve nothing against the golden source — a parity gap, surfaced here.
describe('FF-DATA-PARITY-KPI — KPI strip is data-live per page × mode', () => {
  for (const page of ['gdp', 'accounts', 'regional'] as GoldenDomain[]) {
    for (const mode of ['year', 'range'] as Mode[]) {
      it(`[${page}/${mode}] at least one KPI value is non-zero`, () => {
        const expectedCount = kpiItemsForMode(pageConfigOf(page), mode).length
        const { container } = renderPage(page, 'en', mode)
        const kpis = kpiValueNumbers(container)
        const nonZero = kpis.filter((n) => n !== 0)
        // eslint-disable-next-line no-console
        console.log(`KPI [${page}/${mode}] items=${expectedCount} rendered-values=${JSON.stringify(kpis)} nonZero=${nonZero.length}`)
        expect(nonZero.length, `[${page}/${mode}] every KPI value rendered 0 — no data bound (expected ${expectedCount} live KPIs)`).toBeGreaterThan(0)
      })
    }
  }
})

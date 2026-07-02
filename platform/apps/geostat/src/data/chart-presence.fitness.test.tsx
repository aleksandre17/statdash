// @vitest-environment jsdom
//
// ══ FF-CHART-PRESENCE — every expected panel present, right type (item 0055) ═══
//
//  Two complementary halves:
//
//   (A) SLOT INVENTORY (the spec, config-derived): the set of chart slots per page —
//       {section → chartType} — must match the pinned inventory. A dropped section or
//       a donut↔bar (etc.) slot-type swap changes this list and FAILS. This is the
//       per-slot chart-type gate; it is config-level because ApexCharts cannot mount
//       in jsdom, so the rendered chart type is not observable — but a swap/drop is a
//       CONFIG regression, which this catches deterministically.
//
//   (B) DOM PRESENCE (per page × mode): the page mounts without a whole-page crash,
//       the KPI strip is present with the perspective's expected KPI count, and at
//       least as many panel slots render as there are visible sections for that state
//       (a dropped/blanked section reduces the count). "Present" counts a chart slot
//       whether it painted data (`[data-content=chart|geo]`) or an EmptyState — what
//       matters is the panel MOUNTED; emptiness is FF-DATA-PARITY's concern, not this.
//
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Neutralise ApexCharts in jsdom (SVG APIs absent) — see data-parity.fitness for
// the rationale. The [data-content=chart] slot still mounts, so presence still holds.
vi.mock('react-apexcharts', () => ({ default: () => null }))
import {
  setupParityEnv, renderPage, chartSlots, sectionSlots, kpiItemsForMode, pageConfigOf,
  type GoldenDomain, type Mode,
} from './parity-harness'

beforeAll(() => setupParityEnv())
afterEach(() => cleanup())

const PAGES: GoldenDomain[] = ['gdp', 'accounts', 'regional']

// ── (A) the pinned slot inventory — the SPEC ──────────────────────────────────
//  Sorted `section:chartType` per page. Any drop or type-swap diverges from this and
//  fails loud. (Derived from the provisioning tree at the time of writing; it IS the
//  spec the render must honour.)
const EXPECTED_SLOTS: Record<GoldenDomain, string[]> = {
  gdp: [
    'production:donut', 'expenditure:contribution', 'gdp-dynamics:combo',
    'per-capita-dynamics:line', 'income:treemap', 'growth-dynamics:bar',
  ],
  accounts: ['sna-hero:hbar-diverging', 'sna-hero-range:bar'],
  regional: [
    'sectors:donut', 'sectors-multi:bar', 'regions-bar:hbar',
    'sectors-range:bar', 'sector-history:area',
  ],
}

describe('FF-CHART-PRESENCE (A) — slot inventory matches the spec', () => {
  for (const page of PAGES) {
    it(`[${page}] chart slots + types match the pinned inventory (no drop / no swap)`, () => {
      const actual = chartSlots(pageConfigOf(page), page)
        .map((s) => `${s.section}:${s.chartType}`)
        .sort()
      const expected = [...EXPECTED_SLOTS[page]].sort()
      // eslint-disable-next-line no-console
      console.log(`PRESENCE-A [${page}] slots=${JSON.stringify(actual)}`)
      expect(actual, `[${page}] chart slot inventory diverged (dropped panel or chart-type swap)`).toEqual(expected)
    })
  }
})

// ── (B) per-mode DOM presence ─────────────────────────────────────────────────
//  Visible sections for a mode = sections whose enclosing container is gated to that
//  perspective (or ungated), MINUS param-gated variants not active by default (the
//  regional _regionSel 'some' twin — default, with no region selected, is 'none'). This
//  yields the count of panels that must mount for the state.
function visibleSectionCount(page: GoldenDomain, mode: Mode): number {
  return sectionSlots(pageConfigOf(page), page).filter((s) => {
    if (s.perspective !== 'all' && s.perspective !== mode) return false
    // default param state (no region selected): _regionSel=none ⇒ the 'some' twin
    // (the sectoral-structure comparison) is not shown.
    if (s.sectionGate && /=some$/.test(s.sectionGate)) return false
    return true
  }).length
}

// a panel slot in the DOM: a chart/geo body, an EmptyState, or a rendered table.
function panelSlotCount(container: HTMLElement): number {
  return container.querySelectorAll('[data-content="chart"], [data-content="geo"], .empty-state, table').length
}

describe('FF-CHART-PRESENCE (B) — panels present per page × mode', () => {
  for (const page of PAGES) {
    for (const mode of ['year', 'range'] as Mode[]) {
      it(`[${page}/${mode}] mounts, KPI strip + expected sections present`, () => {
        const kpiCount = kpiItemsForMode(pageConfigOf(page), mode).length
        const secCount = visibleSectionCount(page, mode)
        const { container } = renderPage(page, 'en', mode)

        const kpiStrip = container.querySelector('.kpi-strip')
        const kpiCards = container.querySelectorAll('.kpi-strip .kpi-card').length
        const slots = panelSlotCount(container)
        // eslint-disable-next-line no-console
        console.log(`PRESENCE-B [${page}/${mode}] kpiCards=${kpiCards}/${kpiCount} panelSlots=${slots} visibleSections=${secCount}`)

        // no whole-page blanking: the KPI strip mounted.
        expect(kpiStrip, `[${page}/${mode}] KPI strip absent — page failed to mount`).not.toBeNull()
        // the perspective's KPIs are all present.
        expect(kpiCards, `[${page}/${mode}] expected ${kpiCount} KPI cards, found ${kpiCards}`).toBe(kpiCount)
        // every visible section mounts at least one panel slot (dropped section fails).
        expect(slots, `[${page}/${mode}] only ${slots} panel slots for ${secCount} visible sections — a panel is silently missing`).toBeGreaterThanOrEqual(secCount)
      })
    }
  }
})

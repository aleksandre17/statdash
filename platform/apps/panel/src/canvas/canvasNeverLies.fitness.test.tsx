// ── FF-CANVAS-NEVER-LIES — the WYSIWYG-covenant gate (AR-52 W1 · Canon C2) ─────
//
//  The Studio canvas holds ONE covenant: it never lies. This gate bites the two
//  falsehoods W1 kills at the render seam:
//
//    (1) NO fabricated `0` from an UNBOUND element. A KPI whose measure was never
//        chosen used to lower to storeVal(store,'',ctx)=0 and paint "0 მლნ ₾" / "0%"
//        — a data-integrity breach inside our own tool (study G2). It must now render
//        a DECLARED honest state (data-kpi-state="unbound") that names the missing
//        binding and invites the author to choose a metric (the door to J4).
//
//    (2) NO raw plumbing `{token}` braces in canvas output. An unresolved template
//        var (e.g. a `{spanFrom}` whose data-extent default never resolved in the
//        empty structural preview store) must never reach the author as literal
//        `{spanFrom}` (study G3). The core `resolveTemplate` primitive now renders the
//        platform MISSING-VALUE glyph ('—') for any unresolvable `{key}`, so the
//        invariant holds in EVERY store state — structural preview, the live-loading
//        window, a fail-soft unavailable cube — not only when the extent happens to be
//        present. (On the live/published path a var that carries a value resolves as
//        before; the placeholder fires only where the old code leaked braces.)
//
//    (3) NO silent-blank chart/table. A freshly-dropped, UNBOUND chart (no chartType /
//        data yet) used to THROW inside useChartOutput (resolveChartType reads `.$ctx`
//        off an undefined chartType) → the node error boundary painted an empty box:
//        a Canon-C2 silent-blank lie. It must now render a DECLARED no-data state
//        (`.empty-state`), the same honest affordance a bound-but-no-observation panel
//        shows — never a blank box, never a fake number.
//
//  It BITES: revert the KpiStripShell partition (interpret unbound specs) and the
//  unbound tiles become KpiCards showing "0" — assertion (1) goes red. Revert the
//  resolveTemplate placeholder and `{spanFrom}` leaks — assertion (3-token) goes red.
//  Revert the useChartOutput no-rows short-circuit and the unbound chart throws to a
//  blank box — assertion (4) goes red. The honest states are store-independent (static
//  spec shape), so they hold in every mode; the canvas mounts the REAL renderer, so
//  this is the true published behaviour too.
//
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CanvasView } from './CanvasView'
import { setupCanvasRegistry } from './setupCanvasRegistry'
import type { NodePageConfig } from '@statdash/react/engine'

beforeAll(() => { setupCanvasRegistry() })

// A page carrying a kpi-strip with UNBOUND cards — the exact G2 shape: a point/yoy
// KPI whose `value.measure` was never chosen ("—"). Labels are plain (no dim tokens)
// so the brace-guard asserts the honest render, not an unrelated leak.
const unboundStripPage = {
  type: 'container-page',
  id:   'page-nl',
  path: 'nl',
  children: [
    {
      type: 'kpi-strip', id: 'strip-1',
      items: [
        { id: 'k1', label: { ka: 'მთლიანი ღირებულება', en: 'Total value' }, color: '',
          value: { type: 'point', measure: '', format: 'mln_gel' } },
        { id: 'k2', label: { ka: 'წლიური ზრდა', en: 'YoY growth' }, color: '',
          value: { type: 'yoy', measure: '' } },
      ],
    },
  ],
} as unknown as NodePageConfig

// A page whose SECTION title carries data-extent tokens `{spanFrom}`/`{spanTo}` — the
// exact G3 leak: the empty structural preview store never resolves the span defaults,
// so these dims are absent from ctx. resolveTemplate must render the honest '—' glyph,
// NEVER the raw `{spanFrom}` plumbing braces.
const tokenTitlePage = {
  type: 'container-page',
  id:   'page-tok',
  path: 'tok',
  children: [
    {
      type: 'section', id: 'sec-1',
      title: { ka: 'ზრდა {spanFrom}–{spanTo}', en: 'Growth {spanFrom}–{spanTo}' },
      children: [],
    },
  ],
} as unknown as NodePageConfig

// A page with an UNBOUND chart and an UNBOUND table — a freshly-dropped block with no
// chartType / data spec chosen yet. The chart used to throw in useChartOutput → an empty
// error-boundary box (the silent-blank lie); it must render a declared no-data state.
const unboundPanelsPage = {
  type: 'container-page',
  id:   'page-blank',
  path: 'blank',
  children: [
    { type: 'chart', id: 'c1', label: { ka: 'ჩარტი', en: 'Chart' } },
    { type: 'table', id: 't1', label: { ka: 'ცხრილი', en: 'Table' } },
  ],
} as unknown as NodePageConfig

describe('FF-CANVAS-NEVER-LIES', () => {
  it('(1) an UNBOUND KPI renders a declared honest state, never a fabricated 0', () => {
    render(<CanvasView page={unboundStripPage} onSelectNode={vi.fn()} onDropNode={vi.fn()} />)

    // Both unbound cards render the honest affordance…
    const honest = document.querySelectorAll('[data-kpi-state="unbound"]')
    expect(honest.length).toBe(2)

    // …carrying the "pick a metric" affordance (icon + TEXT — Law 9, accessible).
    expect(screen.getAllByText('აუბმელი მაჩვენებელი').length).toBe(2)
    expect(screen.getAllByText('აირჩიე მეტრიკა').length).toBe(2)

    // …and NO fabricated numeric value anywhere in the strip: a "0" / "0%" here is the
    // exact lie this gate forbids (pre-fix the unbound specs lowered to 0).
    const strip = document.querySelector('.kpi-strip')!
    expect(strip.textContent ?? '').not.toMatch(/\d/)
  })

  it('(2) the honest-state canvas output leaks NO raw {token} braces', () => {
    render(<CanvasView page={unboundStripPage} onSelectNode={vi.fn()} onDropNode={vi.fn()} />)
    const canvas = screen.getByTestId('canvas-root')
    // No `{word}` plumbing token survives to the author in the honest render.
    expect(canvas.textContent ?? '').not.toMatch(/\{[a-zA-Z][\w-]*\}/)
  })

  it('(3) an unresolved data-extent token renders the honest "—" glyph, never raw {spanFrom}', () => {
    render(<CanvasView page={tokenTitlePage} onSelectNode={vi.fn()} onDropNode={vi.fn()} />)
    const canvas = screen.getByTestId('canvas-root')
    const text = canvas.textContent ?? ''
    // The section title reaches the DOM via resolveTemplate; the empty preview store
    // never resolves the span defaults, so the tokens MUST NOT leak as raw braces…
    expect(text).not.toMatch(/\{[a-zA-Z][\w-]*\}/)
    // …and the honest missing-value glyph stands in for each unresolved var.
    expect(text).toContain('ზრდა —–—')
  })

  it('(4) an UNBOUND chart/table renders a declared no-data state, never a silent-blank box', () => {
    render(<CanvasView page={unboundPanelsPage} onSelectNode={vi.fn()} onDropNode={vi.fn()} />)
    const canvas = screen.getByTestId('canvas-root')
    // Both panels fall through to the DECLARED empty state — not a thrown/blank box.
    // Pre-fix the chart threw in useChartOutput and painted an empty error-boundary box.
    expect(canvas.querySelectorAll('.empty-state').length).toBe(2)
  })
})

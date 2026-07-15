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
//        var must never reach the author as literal `{spanFrom}` (study G3). The
//        honest-state output is asserted brace-free here; the full-page filter-default
//        resolution (a core resolveTemplate seam) is tracked separately by the lead.
//
//  It BITES: revert the KpiStripShell partition (interpret unbound specs) and the
//  unbound tiles become KpiCards showing "0" — assertion (1) goes red. The honest
//  state is store-independent (static spec shape), so this holds in every mode; the
//  canvas mounts the REAL renderer, so this is the true published behaviour too.
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
})

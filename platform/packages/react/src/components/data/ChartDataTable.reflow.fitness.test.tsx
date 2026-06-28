// @vitest-environment jsdom
//
// ── Reflow fitness function — no phantom horizontal scroll [WCAG 1.4.10] ─────
//
//  THE permanent guard for the R1 systemic root (audit: platform/work/AUDIT-
//  responsive.md). The accessible data-table mirror behind every chart must NOT
//  be able to leak documentElement.scrollWidth and create a phantom horizontal
//  scroll on every dashboard (a WCAG 1.4.10 Reflow + 1.4.4 failure).
//
//  Why a STRUCTURAL assertion, not a live scrollWidth measurement:
//    jsdom has no layout engine — scrollWidth/clientWidth are always 0, so a
//    `scrollWidth <= clientWidth` check would pass vacuously (it would also
//    "pass" WITH the bug — worse than no test). The real invariant is a CSS
//    truth that needs no layout to verify: a table at its full min-content width
//    nested inside a `.sr-only` box (width:1px + overflow:hidden) is CLIPPED by
//    that box and therefore cannot contribute to any ancestor's scrollable
//    overflow. We assert that containment contract two ways — the component
//    structure and the utility CSS — both of which the bug must violate.
//    (Empirical real-browser proof lives in platform/work/audit-shots/reflow-
//    {before,after}.json — Chromium scrollWidth 1835px → 0 at 360px.)
//

import { describe, it, expect }    from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve }                  from 'node:path'
import { render }                   from '@testing-library/react'
import { ChartDataTable }           from './ChartDataTable'
import type { ChartOutput }         from '@statdash/charts'

// Read the ACTUAL utility CSS the build ships. Resolved from cwd against both
// vitest invocation modes (filtered → cwd=packages/react; root → cwd=platform);
// import.meta.url is not a file URL under vitest and ?raw is stripped by css:false.
function readA11yCss(): string {
  const rel = 'src/styles/a11y.css'
  for (const base of ['', 'packages/react']) {
    const p = resolve(process.cwd(), base, rel)
    if (existsSync(p)) return readFileSync(p, 'utf8')
  }
  throw new Error('a11y.css not found from cwd ' + process.cwd())
}

function makeOutput(): ChartOutput {
  return {
    type: 'bar',
    categories: ['2021', '2022', '2023'],
    series: [
      { name: 'Region with a very long label that forces wide min-content', color: '#0080BE',
        data: [
          { value: 1, formatted: '1 234 567.89' },
          { value: 2, formatted: '2 345 678.90' },
          { value: 3, formatted: '3 456 789.01' },
        ] },
    ],
    stacked: false, horizontal: false,
    legend: { show: true, position: 'bottom' }, tooltip: { show: true, mode: 'multi' },
    axes: { x: {}, y: {} }, annotations: [],
  } as unknown as ChartOutput
}

describe('ChartDataTable — reflow containment (R1 guard)', () => {
  it('wraps the <table> in a .sr-only block — the table itself is NOT the hidden box', () => {
    const { container } = render(<ChartDataTable output={makeOutput()} label="GDP" />)
    const table = container.querySelector('table')
    expect(table).not.toBeNull()

    // Regression vector: `<table className="sr-only">` — a table's width:1px is
    // only a minimum, so the table box stays full-width and leaks scrollWidth.
    expect(table!.classList.contains('sr-only')).toBe(false)

    // The visually-hidden boundary must be a BLOCK wrapper around the table.
    const box = table!.closest('.sr-only')
    expect(box, '<table> must live inside a .sr-only wrapper').not.toBeNull()
    expect(box!.tagName.toLowerCase()).not.toBe('table')
    expect(box!.tagName.toLowerCase()).toBe('div')

    // aria semantics survive the wrapping (AT still reads the full table).
    expect(table!.getAttribute('aria-label')).toBe('GDP — data table')
  })

  it('.sr-only utility keeps the scroll-containment contract (1px + overflow:hidden + clip-path)', () => {
    // Isolate the `.sr-only { … }` rule body.
    const m = readA11yCss().match(/\.sr-only\s*\{([^}]*)\}/)
    expect(m, '.sr-only rule must exist in a11y.css').not.toBeNull()
    const body = m![1]

    // The containment box: a 1px element that hides its overflow. Remove either
    // and a wide descendant escapes back into scrollWidth.
    expect(body).toMatch(/width:\s*1px/)
    expect(body).toMatch(/height:\s*1px/)
    expect(body).toMatch(/overflow:\s*hidden/)
    // Modern, non-deprecated clip. Reject the bare paint-only `clip: rect(...)`.
    expect(body).toMatch(/clip-path:\s*inset\(/)
    expect(body).not.toMatch(/(^|[^-])clip:\s*rect/)
  })
})

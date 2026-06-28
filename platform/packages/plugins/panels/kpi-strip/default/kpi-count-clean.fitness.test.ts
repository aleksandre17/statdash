// ── FF-KPI-COUNT-CLEAN — the no-orphan KPI strip gate ─────────────────────────
//
//  Asserts the KPI strip stays COUNT-AWARE, not auto-fit. `auto-fit` packs as many
//  cards as fit and strands an orphan whenever the KPI count doesn't divide the
//  fitted column-count (the live "3 + 1 dead-space" miss at laptop widths). The
//  honest pattern declares the count (data-kpi-count) and a @container ladder that
//  always resolves to a count-DIVIDING column count. This gate makes a regression
//  back to auto-fit, or loss of the container ladder, a red test.  (DESIGN §3.)
//

import { describe, it, expect } from 'vitest'
import { readFileSync }         from 'node:fs'
import { fileURLToPath }        from 'node:url'
import { dirname, join }        from 'node:path'

// Strip /* … */ comments — these gates assert on actual rules, not the prose that
// (correctly) names the banned `auto-fit` while explaining why it's the wrong tool.
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '')

const here = dirname(fileURLToPath(import.meta.url))
const css  = stripComments(readFileSync(join(here, 'components', 'kpi.css'), 'utf8'))

describe('FF-KPI-COUNT-CLEAN — no orphan at any width', () => {
  it('the strip is a query container and the grid is count-aware', () => {
    expect(css).toMatch(/\.kpi-strip\s*\{[^}]*container-type:\s*inline-size/)
    expect(css).toMatch(/\.kpi-strip__grid\[data-kpi-count="4"\]/)
    expect(css).toMatch(/\.kpi-strip__grid\[data-kpi-count="3"\]/)
  })

  it('the column count is resolved via a @container ladder (responds to the strip)', () => {
    expect(css).toMatch(/@container\s+kpi\s*\(max-width:/)
  })

  it('does NOT use auto-fit/auto-fill on the strip grid — the orphan-prone pattern', () => {
    expect(css).not.toMatch(/repeat\(\s*auto-fit/)
    expect(css).not.toMatch(/repeat\(\s*auto-fill/)
  })

  it('4-KPI skips 3 (→2×2) and 3-KPI skips 2 — the divisor-clean steps', () => {
    // 4 KPIs must step to 2 columns (never 3, which strands the 4th).
    expect(css).toMatch(/\[data-kpi-count="4"\]\s*\{\s*--kpi-cols:\s*2/)
    // 3 KPIs must step straight to 1 (never 2, which strands the 3rd).
    expect(css).toMatch(/\[data-kpi-count="3"\]\s*\{\s*--kpi-cols:\s*1/)
  })
})

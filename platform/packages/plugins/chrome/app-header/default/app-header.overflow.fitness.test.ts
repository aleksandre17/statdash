// @vitest-environment node
//
// ── FF-HEADER-NO-OVERFLOW — the flex-overflow containment contract [RSP-R2] ───
//
//  THE permanent guard for the R2 systemic root (CLOSE-BOARD RSP-R2): the header
//  is a `justify-content: space-between` flex row of brand | nav | actions. Without
//  a shrink guard the brand keeps its logo's intrinsic width, `space-between`
//  cannot resolve, and the atomic actions (locale switcher) are pushed past the
//  right edge — clipping on every page in the ~960–1100 band and at 360
//  (documentElement.scrollWidth leak, WCAG 1.4.10 Reflow).
//
//  Why a STRUCTURAL assertion, not a live scrollWidth measurement:
//    jsdom has no layout engine (scrollWidth/clientWidth are always 0 — a live
//    check would pass vacuously, WITH or WITHOUT the bug). The invariant is a CSS
//    truth verifiable without layout: the FLEXIBLE items (brand, nav) may shrink
//    below min-content (`min-width:0`) and the brand is shrink-enabled, while the
//    ATOMIC actions never give (`flex-shrink:0`). That is the canonical
//    flex-overflow guard; remove any leg and the actions overflow again.
//    (Real-browser proof: platform/work/audit-shots/_metrics.json captured the
//    pre-fix app-header__actions overflow at 360; the min-width:0 guards clear it.)
//

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const css  = readFileSync(resolve(here, 'app-header.css'), 'utf8')

/** Isolate a single rule body `<selector> { … }` (no nesting in this sheet). */
function ruleBody(selector: string): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = css.match(new RegExp(`${esc}\\s*\\{([^}]*)\\}`))
  expect(m, `${selector} rule must exist in app-header.css`).not.toBeNull()
  return m![1]
}

describe('FF-HEADER-NO-OVERFLOW — brand/nav shrink, actions stay atomic (R2 guard)', () => {
  it('the flexible BRAND may shrink below its logo width (min-width:0 + shrink-enabled)', () => {
    const brand = ruleBody('.app-header__brand')
    // The overflow guard: without min-width:0 a flex item never drops below its
    // min-content (the logo), so space-between cannot resolve.
    expect(brand).toMatch(/min-width:\s*0/)
    // Shrink must be enabled — either `flex: <grow> 1 …` (shrink factor 1) or an
    // explicit non-zero flex-shrink. `flex: 0 1 auto` is the canonical value.
    const flexShrinkEnabled =
      /flex:\s*\d+\s+[1-9]/.test(brand) || /flex-shrink:\s*[1-9]/.test(brand)
    expect(flexShrinkEnabled, '.app-header__brand must be shrink-enabled').toBe(true)
  })

  it('the flexible NAV may compress before the actions give (min-width:0)', () => {
    expect(ruleBody('.app-header__nav')).toMatch(/min-width:\s*0/)
  })

  it('the ATOMIC actions never shrink (flex-shrink:0) — the brand gives, not them', () => {
    expect(ruleBody('.app-header__actions')).toMatch(/flex-shrink:\s*0/)
  })

  it('the header inner consumes the shared --page-measure (agrees with the content column, R3)', () => {
    expect(ruleBody('.app-header__inner')).toMatch(/max-width:\s*var\(--page-measure/)
  })
})

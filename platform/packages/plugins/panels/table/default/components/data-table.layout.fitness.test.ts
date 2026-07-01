// @vitest-environment node
//
// ── FF-TABLE-HEADER-WRAP — the header-wrap + content-driven sizing contract ───
//
//  THE permanent guard for the owner-reported squeeze: long column HEADERS did
//  NOT wrap (`white-space:nowrap` on every `.data-table th`), so under
//  `table-layout:auto` one long title pinned its column at full single-line
//  min-content and STOLE the space — the other columns collapsed to their floor.
//
//  Root cause → standard → fix:
//    · root cause  : headers were `nowrap`, forcing a min-content-wide column.
//    · standard    : header/label cells must WRAP (WCAG reflow + least-astonishment);
//                    numeric cells stay `nowrap` (legible, tabular-aligned).
//    · fix         : `.data-table th { white-space:normal; overflow-wrap:anywhere;
//                    max-width:… }` + `.t-num { white-space:nowrap }`, composing
//                    with the 57fc5dd `.data-table__wrap { overflow:auto }` scroll.
//
//  Why a STRUCTURAL (CSS-text) assertion, not a live width measurement:
//    jsdom has no layout engine (offsetWidth/scrollWidth are always 0 — a live
//    "does a header hog the row?" check would pass vacuously with OR without the
//    bug). The invariant is a CSS truth verifiable without layout: headers are
//    wrappable + breakable + width-capped; figures are not; the wrap scrolls.
//    Remove any leg and the squeeze (or a number wrapping mid-digit) returns.
//    Real-browser proof is deferred to the owner's next redeploy probe.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const css  = readFileSync(resolve(here, 'data-table.css'), 'utf8')

/** Isolate a single rule body `<selector> { … }` (first match; flat sheet). */
function ruleBody(selector: string): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = css.match(new RegExp(`${esc}\\s*\\{([^}]*)\\}`))
  expect(m, `${selector} rule must exist in data-table.css`).not.toBeNull()
  return m![1]
}

describe('FF-TABLE-HEADER-WRAP — headers wrap, figures stay, table scrolls', () => {
  const th = () => ruleBody('.data-table th')

  it('header cells are WRAPPABLE — never white-space:nowrap (the squeeze root cause)', () => {
    expect(th()).not.toMatch(/white-space:\s*nowrap/)
    expect(th()).toMatch(/white-space:\s*normal/)
  })

  it('an unbroken token can break so a header cannot balloon its column (overflow-wrap:anywhere)', () => {
    // `anywhere` (not merely `break-word`) is required: only it lowers the cell
    // MIN-CONTENT so `table-layout:auto` can actually shrink the header column.
    expect(th()).toMatch(/overflow-wrap:\s*anywhere/)
  })

  it('a long header is width-capped so no single column hogs the row (max-width)', () => {
    // Token-driven cap (var with fallback) — a very long title wraps early and
    // every other column keeps its room, even when the table has slack.
    expect(th()).toMatch(/max-width:\s*var\(--data-table-th-max/)
  })

  it('numeric DATA cells stay on one line — figures never wrap mid-digit (.t-num nowrap)', () => {
    expect(ruleBody('.t-num')).toMatch(/white-space:\s*nowrap/)
  })

  it('sizing is content-driven (table-layout:auto), NOT fixed — number columns keep their width', () => {
    expect(ruleBody('.data-table')).toMatch(/table-layout:\s*auto/)
  })

  it('composes with 57fc5dd — the wrap still SCROLLS when genuinely too wide (overflow:auto)', () => {
    // Guard the scroll fix is not regressed: wrap-then-SCROLL is the degrade path.
    expect(ruleBody('.data-table__wrap')).toMatch(/overflow:\s*auto/)
  })
})

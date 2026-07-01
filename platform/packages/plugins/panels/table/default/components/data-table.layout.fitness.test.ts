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

// ── FF-TABLE-HEADER-STICKY — the header FREEZES on scroll, from the TABLE's ──
//   OWN sheet, not from a layout-container attribute.
//
//   Root cause → standard → fix:
//     · root cause : the ONLY `position:sticky` header rule lived in
//                    node-styles.css gated behind [data-height]/[data-aspect]/
//                    [data-view=visible]; a table panel without those attributes
//                    had a header that scrolled away (owner: "header doesn't
//                    freeze" AND "header misaligned" — same cause, since the
//                    header is on the SAME table/column tracks as the body).
//     · standard   : stickiness is intrinsic to a table whose own wrap scrolls
//                    (SSOT + SoC) — the table component owns it, unconditionally.
//     · fix        : `.data-table thead th { position:sticky; top:0 }` in
//                    data-table.css. Set on the `th` CELLS (works under
//                    border-collapse; identical to the committed node-styles
//                    mechanism, so idempotent in the band case + its <768px
//                    `position:static` reset still wins).
//
//   Structural (CSS-text) assertion, not a live scroll measurement: jsdom has no
//   layout/scroll engine, so a "does it freeze?" check would pass vacuously. The
//   invariant is a CSS truth: the header cells are sticky-to-top with an opaque
//   themed background + a divider so body rows can't show through. Real-browser
//   freeze-on-scroll proof is deferred to the owner's redeploy probe.
describe('FF-TABLE-HEADER-STICKY — header freezes on scroll, owned by the table', () => {
  const th = () => ruleBody('.data-table thead th')

  it('header cells are position:sticky (the freeze) — not dependent on node-styles', () => {
    expect(th()).toMatch(/position:\s*sticky/)
  })

  it('header cells stick to the top of the scroll container (top:0)', () => {
    expect(th()).toMatch(/top:\s*0/)
  })

  it('frozen header paints ABOVE scrolling body rows (z-index)', () => {
    expect(th()).toMatch(/z-index:\s*[1-9]/)
  })

  it('has an OPAQUE themed background so body rows do not show through (token, no hex)', () => {
    // Set on the base `.data-table th` rule (shared by every header cell).
    const base = ruleBody('.data-table th')
    expect(base).toMatch(/background:\s*var\(--color-surface/)
    expect(base).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })

  it('has a divider that scrolls WITH the cell (box-shadow, token-driven, no hex)', () => {
    // Inset shadow (not only the collapsed border-bottom) so the divider stays
    // attached to the sticky cell during scroll. Colour from a frame token.
    expect(th()).toMatch(/box-shadow:[^;]*var\(--color-/)
    expect(th()).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })

  it('pivot two-row header: sub-row is offset below the group row so they do not overlap', () => {
    // Row 2 (sub-columns) freezes beneath row 1 (series groups) via a token seam.
    const sub = ruleBody('.data-table thead tr:nth-child(2) th')
    expect(sub).toMatch(/top:\s*var\(--data-table-head-row-h/)
  })
})

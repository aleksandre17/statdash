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

// ── FF-TABLE-BOUNDED-SCROLL — the wrap is a BOUNDED scroll viewport so sticky ──
//   actually freezes even when the table is UNBOUNDED (no AR-8 band).
//
//   Root cause → standard → fix:
//     · root cause : the sticky header only FREEZES if its scroll container has a
//                    bounded height. A full-page-height table with no [data-height]
//                    band around it (the live /ka/accounts SNA pivot) had a wrap
//                    that grew to content height, so the PAGE scrolled and the
//                    header scrolled away — "does not freeze" (owner).
//     · standard   : boundedness is intrinsic to a scrolling table (SSOT), owned by
//                    the table — not gated on a layout-container attribute.
//     · fix        : `.data-table__wrap { max-height: var(--data-table-max-h, 70vh) }`
//                    (token seam), composing with `overflow:auto`; a mobile @media
//                    unsets it (inline reading) + releases the freeze (static),
//                    placed after the sticky rule so it wins by source order.
describe('FF-TABLE-BOUNDED-SCROLL — a tall table scrolls INSIDE the panel, header frozen', () => {
  const wrap = () => ruleBody('.data-table__wrap')

  it('the wrap has a BOUNDED max-height (token seam, no hardcoded literal-only cap)', () => {
    // Token-driven cap with a viewport-relative fallback — Protected Variations.
    expect(wrap()).toMatch(/max-height:\s*var\(--data-table-max-h/)
  })

  it('max-height COMPOSES with the scroll: overflow:auto stays so it actually scrolls', () => {
    expect(wrap()).toMatch(/overflow:\s*auto/)
  })

  it('mobile (≤768px) unbounds the wrap AND releases the freeze (inline reading)', () => {
    // The @media block must reset BOTH: max-height:none (page scrolls) and
    // thead th position:static — matching the node-styles band reflow.
    const media = css.match(/@media\s*\(max-width:\s*768px\)\s*\{([\s\S]*?)\n\}/)
    expect(media, 'a max-width:768px @media block must exist').not.toBeNull()
    expect(media![1]).toMatch(/\.data-table__wrap\s*\{[^}]*max-height:\s*none/)
    expect(media![1]).toMatch(/\.data-table thead th\s*\{[^}]*position:\s*static/)
  })

  it('the mobile reset is placed AFTER the base sticky rule (source order wins)', () => {
    // Equal specificity → the later rule wins; the reset must come after the
    // `.data-table thead th { position: sticky }` declaration or it is dead CSS.
    const stickyIdx = css.indexOf('position: sticky')
    const mediaIdx  = css.indexOf('@media (max-width: 768px)')
    expect(stickyIdx).toBeGreaterThan(-1)
    expect(mediaIdx).toBeGreaterThan(stickyIdx)
  })
})

// ── FF-TABLE-BAND-FILL-CHAIN — a BANDED table scrolls; the band reaches the wrap ──
//   The other half of the bounded-scroll story, for the panel that IS in a band.
//
//   Root cause → standard → fix (verified live on /ka/regional, 1440px):
//     · root cause : node-styles gives the band box a definite height and flags this
//                    wrap `flex:1`, but the shell renders ONE intermediate block —
//                    `<div {…bodyAttrs}>` (badges + table + export bar) — between the
//                    band box and the wrap. A plain block, it neither passes the band
//                    height down (the wrap's `flex:1` is inert against a non-flex
//                    parent) nor stays within the band (it grows to full table height
//                    and the band's overflow:hidden CLIPS the bottom rows). LIVE: the
//                    "GDP — by region" composition table rendered a 603px table inside
//                    a 362px band → bottom rows unreachable, wrap NOT scrollable.
//                    (The chart shell avoids this by spreading bodyAttrs ONTO
//                    .chart-wrap, so ITS content box is the band box's direct child —
//                    the table needs a wrapper for its sibling badges/export bar.)
//     · standard   : the wrap must be the panel's bounded scroll viewport in a band
//                    too (SSOT); the shell body between must be a fill-flex LINK.
//     · fix        : target exactly the wrap's direct parent via
//                    `:has(> .data-table__wrap)` under the band's own
//                    [data-view]/[data-height]/[data-aspect] contract, and make it
//                    `display:flex; flex-direction:column; flex:1; min-height:0`.
//
//   Structural (CSS-text) assertion, not a live scroll measurement: jsdom has no
//   layout engine (clientHeight/scrollHeight are 0), so a "does the banded wrap
//   scroll?" check passes vacuously. The invariant is a CSS truth: the wrap's parent
//   is a fill-flex link under a band. Real-browser before/after proof (scrollable
//   false→true, header frozen, band height honoured) captured via the Playwright probe.
describe('FF-TABLE-BAND-FILL-CHAIN — the band reaches the scroll viewport through the shell body', () => {
  /** The band-fill-chain rule group: selector list up to the opening brace + body. */
  const rule = () => {
    const m = css.match(/((?:\[data-[^\]]+\][^{]*:has\(> \.data-table__wrap\)[^{]*,?\s*)+)\{([^}]*)\}/)
    expect(m, 'the band-fill-chain rule (…:has(> .data-table__wrap) { … }) must exist').not.toBeNull()
    return { selectors: m![1], body: m![2] }
  }

  it('scopes to EXACTLY the wrap\'s direct parent (SSOT) — :has(> .data-table__wrap), no global reach', () => {
    // Must select the element that directly parents the wrap, never a broad layout box.
    expect(rule().selectors).toMatch(/:has\(>\s*\.data-table__wrap\)/)
  })

  it('reads the band CONTRACT (does not redefine it): keys off [data-view] + [data-height]/[data-aspect]', () => {
    const sel = rule().selectors
    expect(sel).toMatch(/\[data-view="visible"\]/)
    expect(sel).toMatch(/\[data-height\]/)
    expect(sel).toMatch(/\[data-aspect\]/)
  })

  it('covers BOTH band-delivery shapes: band on an ANCESTOR slot AND band on the shell body itself', () => {
    const sel = rule().selectors
    // ancestor-slot shape: [data-height|aspect] <descendant> [data-view=visible] > <wrap-parent>
    expect(sel).toMatch(/\[data-(?:height|aspect)\]\s+\[data-view="visible"\]\s*>\s*:has\(>\s*\.data-table__wrap\)/)
    // on-body shape: [data-view=visible] > [data-aspect|height]:has(> wrap)
    expect(sel).toMatch(/\[data-view="visible"\]\s*>\s*\[data-(?:aspect|height)\]:has\(>\s*\.data-table__wrap\)/)
  })

  it('makes the shell body a FILL-FLEX column so the band height reaches the wrap', () => {
    const body = rule().body
    expect(body).toMatch(/display:\s*flex/)
    expect(body).toMatch(/flex-direction:\s*column/)
    expect(body).toMatch(/flex:\s*1\b/)     // fills the definite-height band box
    expect(body).toMatch(/min-height:\s*0/) // lets the flex child (wrap) shrink + scroll
  })
})

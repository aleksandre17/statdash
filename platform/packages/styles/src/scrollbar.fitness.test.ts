// ── FF-SCROLLBAR — beautiful, agnostic, themed scrollbar fitness function ─────
//
//  Two owner requirements encoded as a red-on-regression gate:
//
//    1. Tables SCROLL, never clip — the table plugin's scroll container
//       (`.data-table__wrap`) must carry `overflow: auto` so a table wider/
//       taller than its card is reachable (was: clipped, inaccessible).
//    2. Scrollbars are BEAUTIFUL, REUSABLE and THEMED — a shared `.scroll-fancy`
//       utility covers BOTH engines (WebKit `::-webkit-scrollbar*` + Firefox
//       `scrollbar-width`/`scrollbar-color`) and is TOKEN-DRIVEN: every colour
//       derives from a semantic token, never a raw hex (Law 1/4 agnostic, so it
//       re-themes under dark mode / tenant with no code change).
//
//  A missing scroll container or a hardcoded hue is invisible on the happy path
//  and only bites a real user on a wide table or in dark mode — this makes both
//  absences a failing test.
//

import { describe, it, expect } from 'vitest'
import { readFileSync }         from 'node:fs'
import { fileURLToPath }        from 'node:url'
import { dirname, join, resolve } from 'node:path'

const here          = dirname(fileURLToPath(import.meta.url))
const scrollbarCss  = readFileSync(join(here, 'css', 'scrollbar.css'), 'utf8')
const indexCss      = readFileSync(join(here, 'css', 'index.css'), 'utf8')
const dataTableCss  = readFileSync(
  resolve(here, '../../plugins/panels/table/default/components/data-table.css'),
  'utf8',
)

// Raw hex is banned in this file — colours must come from tokens. Allow #fff/#000
// nowhere; the util is fully token-derived.
const HEX = /#[0-9a-fA-F]{3,8}\b/

describe('FF-SCROLLBAR — table overflow is scrollable', () => {
  it('the table scroll container declares overflow:auto (no clip)', () => {
    const block = dataTableCss.slice(dataTableCss.indexOf('.data-table__wrap'))
    expect(block).toMatch(/overflow:\s*auto/)
  })

  it('min-width:0 is present so a wide table shrinks-to-scroll inside the flex band', () => {
    const block = dataTableCss.slice(dataTableCss.indexOf('.data-table__wrap'))
    expect(block).toMatch(/min-width:\s*0/)
  })
})

describe('FF-SCROLLBAR — reusable themed .scroll-fancy utility', () => {
  it('scrollbar.css is imported into the styles entry', () => {
    expect(indexCss).toMatch(/@import\s+['"]\.\/scrollbar\.css['"]/)
  })

  it('exposes the reusable .scroll-fancy class', () => {
    expect(scrollbarCss).toContain('.scroll-fancy')
  })

  it('covers WebKit — ::-webkit-scrollbar thumb + hover', () => {
    expect(scrollbarCss).toMatch(/\.scroll-fancy::-webkit-scrollbar-thumb\b/)
    expect(scrollbarCss).toMatch(/::-webkit-scrollbar-thumb:hover/)
  })

  it('covers Firefox — scrollbar-width:thin + scrollbar-color', () => {
    expect(scrollbarCss).toMatch(/scrollbar-width:\s*thin/)
    expect(scrollbarCss).toMatch(/scrollbar-color:/)
  })

  it('is TOKEN-DRIVEN — every colour derives from a semantic token, no raw hex', () => {
    expect(scrollbarCss).not.toMatch(HEX)
    // thumb + track must reference --color-* border/surface tokens
    expect(scrollbarCss).toMatch(/var\(--color-border/)
  })

  it('thumb is always visible (not hover-only) — WCAG discoverability', () => {
    // the base thumb rule sets a background BEFORE any :hover selector
    const base = scrollbarCss.slice(
      scrollbarCss.indexOf('.scroll-fancy::-webkit-scrollbar-thumb {'),
    )
    expect(base).toMatch(/background:\s*var\(--scrollbar-thumb\)/)
  })
})

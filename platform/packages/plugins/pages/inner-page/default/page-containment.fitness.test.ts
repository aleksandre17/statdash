// ── FF-PAGE-FRAME-CONTAINMENT — the page card contains its content (0102 R1 · Part 3) ──
//
//  The owner reported a dropped GRID overflowing its page and BLEEDING over the rest
//  ("content going from one page to another"). A page is a containment boundary content
//  must not escape (ADR-041 / Law 10 · the page-as-boundary). The measure-bounded page
//  CARD (`.page-content`) must therefore clamp horizontal escape: an oversized child is
//  clipped, not allowed to force the card wider or bleed past it. This gate pins the
//  CSS contract so a future edit that drops the clamp is a red test.
//
//  `overflow-x: clip` (not `hidden`) is deliberate: it adds no scroll box and leaves the
//  vertical axis visible (sticky headers / tooltips unaffected). Paired with the existing
//  `min-width: 0`, a grid/flex child shrinks to the card instead of forcing it wider.
//
//  CSS read via node:fs (this suite runs in node, not jsdom) — the sibling grid.fitness
//  pattern; agnostic over any page content (no fixture node type).
//
import { describe, it, expect } from 'vitest'
import { readFileSync }         from 'node:fs'
import { fileURLToPath }        from 'node:url'
import { dirname, join }        from 'node:path'

const here    = dirname(fileURLToPath(import.meta.url))
const css     = readFileSync(join(here, 'page-layout.css'), 'utf8')

// Isolate the `.page-content { … }` block (the page card) so the assertions read its OWN
// declarations, never a neighbouring rule's.
function ruleBody(selector: string): string {
  // Anchor to line-start so `.page-content {` matches the BASE rule, never a descendant
  // rule like `.inner-page[data-layout="full-width"] > .page-content {`.
  const start = css.indexOf('\n' + selector + ' {')
  if (start < 0) throw new Error(`missing rule: ${selector}`)
  const open  = css.indexOf('{', start)
  const close = css.indexOf('}', open)
  return css.slice(open + 1, close)
}

describe('FF-PAGE-FRAME-CONTAINMENT — the page card clamps horizontal escape', () => {
  const pageCard = ruleBody('.page-content')

  it('the page card is the measure-bounded boundary (max-width + min-width:0)', () => {
    expect(pageCard).toMatch(/max-width:\s*var\(--page-measure/)
    expect(pageCard).toMatch(/min-width:\s*0/)
  })

  it('an oversized child is clipped horizontally (overflow-x: clip), never bled past the card', () => {
    expect(pageCard).toMatch(/overflow-x:\s*clip/)
  })

  it('the clamp is horizontal-only — the card never sets overflow-y:hidden (sticky/tooltip stay visible)', () => {
    expect(pageCard).not.toMatch(/overflow-y:\s*hidden/)
    expect(pageCard).not.toMatch(/overflow:\s*hidden/)
  })
})

// @vitest-environment node
//
// ── FF-NO-BESPOKE-SECTION-DIV — the page body composes via a layout node ──────
//
//  DESIGN-responsive-composition.md §3.3 / P5: the page BODY must not be a
//  hand-rolled flex `<div>` that dumps sections as direct children with its own
//  compositional gap. It composes through the `stack` layout-node primitive (the
//  same container StackShell emits) — one handwriting at page, section, and panel.
//
//  This locks the retirement of the bespoke `.page-content` composition:
//    (a) InnerPageShell wraps its rendered children in the `.layout-stack` node;
//    (b) `.page-content` is the viewport CHROME box only — it no longer declares
//        the compositional `gap` (that concern moved to the stack primitive);
//    (c) the arrangement gap lives on the `.page-content__stack` / `.layout-stack`
//        primitive, not the bespoke content div.
//
import { describe, it, expect } from 'vitest'
import { readFileSync }         from 'node:fs'
import { fileURLToPath }        from 'node:url'
import { dirname, resolve }     from 'node:path'

const HERE      = dirname(fileURLToPath(import.meta.url))
const shellSrc  = readFileSync(resolve(HERE, 'InnerPageShell.tsx'), 'utf8')
const cssSrc    = readFileSync(resolve(HERE, 'page-layout.css'), 'utf8')

describe('FF-NO-BESPOKE-SECTION-DIV — page body is a layout node', () => {

  it('(a) InnerPageShell composes children inside the `layout-stack` primitive', () => {
    expect(shellSrc).toMatch(/className="layout-stack[^"]*"/)
    // the rendered children flow INTO the stack, not into a bare <main>.
    expect(shellSrc).toMatch(/layout-stack[\s\S]*\{children\.rendered\}/)
  })

  it('(b) `.page-content` no longer owns a compositional gap (moved to the stack)', () => {
    // Isolate the `.page-content { … }` rule block and assert it declares no gap.
    const block = cssSrc.match(/\.page-content\s*\{([^}]*)\}/)
    expect(block, '.page-content rule must exist').not.toBeNull()
    expect(block![1]).not.toMatch(/\bgap\s*:/)
  })

  it('(c) the arrangement gap lives on the stack primitive', () => {
    // The page-body stack carries the fill chain; the gap itself comes from the
    // shared .layout-stack default (--layout-gap) — assert the stack rule exists.
    expect(cssSrc).toMatch(/\.page-content__stack\s*\{/)
  })

})

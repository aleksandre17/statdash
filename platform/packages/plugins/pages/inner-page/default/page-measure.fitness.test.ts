// @vitest-environment node
//
// ── FF-PAGE-MEASURE-SSOT — one shared content measure [RSP-R3] ────────────────
//
//  THE permanent guard for the R3 systemic root (CLOSE-BOARD RSP-R3): the page
//  had a THREE-way split — an 800px `centered` cap, an uncapped body, and a
//  full-width `max-width:none`. The 800px cap stranded data dashboards as a narrow
//  ribbon on ultrawide; the uncapped/none paths over-stretched. The fix is a SINGLE
//  fluid measure — `--page-measure: clamp(--size-container-wide, 90vw,
//  --size-container-ultra)` — that the header inner, content column, and footer all
//  consume, so every band of the page agrees on its width (I4 no-static-at-ultrawide).
//
//  Static CSS-contract assertions (jsdom has no layout — a live width check would
//  pass vacuously). Two legs must both hold or the split can silently return:
//    (a) the SSOT token is a fluid clamp of the container scale (tokens.css);
//    (b) the content column consumes it and the retired literal 800px cap is gone
//        (page-layout.css).
//

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const pageLayoutCss = readFileSync(resolve(here, 'page-layout.css'), 'utf8')

/** tokens.css lives in @statdash/styles — resolve across filtered + root cwd. */
function readTokensCss(): string {
  const candidates = [
    resolve(here, '../../../../styles/src/css/tokens.css'),            // from this file
    resolve(process.cwd(), 'packages/styles/src/css/tokens.css'),      // root cwd
    resolve(process.cwd(), '../styles/src/css/tokens.css'),            // filtered plugins cwd
  ]
  for (const p of candidates) if (existsSync(p)) return readFileSync(p, 'utf8')
  throw new Error('tokens.css not found from cwd ' + process.cwd())
}

describe('FF-PAGE-MEASURE-SSOT — one fluid measure, no cap split (R3 guard)', () => {
  it('--page-measure is a FLUID clamp of the container scale (tokens.css SSOT)', () => {
    const tokens = readTokensCss()
    const m = tokens.match(/--page-measure:\s*clamp\(([^;]*)\)/)
    expect(m, '--page-measure must be defined as a clamp(...) in tokens.css').not.toBeNull()
    const body = m![1]
    // Floor = the wide container token, ceil = the ultra token — never a raw px cap.
    expect(body).toMatch(/--size-container-wide/)
    expect(body).toMatch(/--size-container-ultra/)
    // The scale tokens themselves exist (the SSOT the measure derives from).
    expect(tokens).toMatch(/--size-container-wide:/)
    expect(tokens).toMatch(/--size-container-ultra:/)
  })

  it('the content column CONSUMES --page-measure (no per-variant hardcoded cap)', () => {
    // Anchor to the STANDALONE `.page-content { … }` rule (selector at line start),
    // never a `… > .page-content` variant rule (padding-only overrides).
    const m = pageLayoutCss.match(/(?:^|\n)\.page-content\s*\{([^}]*)\}/)
    expect(m, 'standalone .page-content rule must exist').not.toBeNull()
    expect(m![1]).toMatch(/max-width:\s*var\(--page-measure/)
  })

  it('the retired 800px ribbon cap is GONE (the R3 regression vector)', () => {
    // The old `centered` split pinned the column at 800px. Any reintroduction of an
    // 800px max-width in the page layout re-strands data dashboards on ultrawide.
    expect(pageLayoutCss).not.toMatch(/max-width:\s*800px/)
  })
})

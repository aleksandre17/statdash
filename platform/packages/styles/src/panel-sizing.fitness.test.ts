// ── FF-PANEL-SIZING — the honest single-constraint panel-height gate ──────────
//
//  Asserts the panel-sizing model stays HONEST: a data panel is sized by ONE
//  fluid height band (--size-panel-height), never by aspect-ratio. The historical
//  bug was `aspect-ratio` + `max-height` coexisting — two contradictory
//  constraints, so past a crossover width the declared ratio was silently
//  violated. This gate makes any reintroduction of aspect-ratio into the engine,
//  or loss of the band token, a red test.  (DESIGN §3a.)
//

import { describe, it, expect } from 'vitest'
import { readFileSync }         from 'node:fs'
import { fileURLToPath }        from 'node:url'
import { dirname, join }        from 'node:path'
import { applyNodeStyles }      from './resolvers/node'

// Strip /* … */ comments — these gates assert on actual rules, not prose that
// (correctly) mentions the banned constructs while explaining why they're banned.
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '')

const here     = dirname(fileURLToPath(import.meta.url))
const nodeCss  = stripComments(readFileSync(join(here, 'css', 'node-styles.css'), 'utf8'))
const tokens   = readFileSync(join(here, 'css', 'tokens.css'), 'utf8')

describe('FF-PANEL-SIZING — one honest constraint', () => {
  it('the height band token exists with a clamp(floor, fluid, cap) spine', () => {
    expect(tokens).toMatch(/--size-panel-height:\s*clamp\(/)
    expect(tokens).toMatch(/--size-panel-h-floor:/)
    expect(tokens).toMatch(/--size-panel-h-cap:/)
  })

  it('the fluid stop is CONTAINER-proportional (cqi), not viewport-coupled', () => {
    // The canonical model: the band tracks the panel's OWN inline-size (cqi), so
    // equal-width siblings resolve an identical height and a wide panel earns more
    // height than a narrow one. A `vh` fluid stop (viewport coupling) is the prior
    // interim model and a regression — this gate forbids its return.
    expect(tokens).toMatch(/--size-panel-h-fluid:\s*[\d.]+cqi/)
    expect(tokens).not.toMatch(/--size-panel-h-fluid:\s*[\d.]+vh/)
  })

  it('the engine applies NO aspect-ratio — the contradiction class is eliminated', () => {
    // The whole point: panels fill width + take the band height. Any `aspect-ratio`
    // in the engine reopens the aspect-vs-max-height contradiction.
    expect(nodeCss).not.toContain('aspect-ratio')
  })

  it('the dead --ar-* responsive cascade is gone', () => {
    expect(nodeCss).not.toMatch(/var\(--ar-/)
  })

  it('[data-aspect] and the ratio [data-height] tokens resolve to the band', () => {
    expect(nodeCss).toMatch(/\[data-aspect\]\s*\{[^}]*--size-panel-height/)
    expect(nodeCss).toMatch(/\[data-height="16:9"\][\s\S]{0,160}--size-panel-height/)
  })

  // The RESOLVER counterpart of the CSS-absence gate above: responsive aspectRatio
  // still emits the data-aspect band-alias FLAG, but the inert per-breakpoint --ar-*
  // custom properties are retired at the source (no CSS reads them — AUDIT-BRIEF §4).
  it('applyNodeStyles emits the data-aspect flag but NO inert --ar-* vars', () => {
    const out = applyNodeStyles({ aspectRatio: { default: '16:9', sm: '4:3' } }) as
      Record<string, unknown> & { style?: Record<string, unknown> }
    expect(out['data-aspect']).toBe('')
    const arKeys = Object.keys(out.style ?? {}).filter(k => k.startsWith('--ar-'))
    expect(arKeys, `resolver re-emitted inert vars: ${arKeys.join(', ')}`).toEqual([])
  })
})

// ── FILL-vbar (CSS half) — the band LEAF grows past its band in a stretched card ─
//
//  Companion to FILL-vbar in the chart plugin (chart-fill.test.ts locks the Apex
//  `chart.height:'100%'` config). This locks the CSS half: the unbroken flex chain
//  that gives the Apex mount div a DEFINITE, growable height.
//
//  The ka-gdp expenditure vbar carries its band on the LEAF (`.chart-wrap`) — a
//  `wrap` node hands `aspectRatio` down via WrapStyleContext, so `data-aspect`
//  lands on `.chart-wrap`, NOT on a `.section__body` container (that inverted case
//  is the panel-layout.css container model). node-styles' base rule pins
//  `[data-aspect] { height: var(--size-panel-height) }` — a FROZEN height. In an
//  equal-height row a taller sibling stretches the card, but the frozen leaf can't
//  grow into it → white gap + a frozen ApexCharts plot (the defect).
//
//  The fix mirrors the container growable-band model: the visible view slot becomes
//  a fill-flex column and the band becomes a flex-BASIS the leaf grows past
//  (`flex: 1 1 var(--size-panel-height); height: auto`). This gate turns a revert
//  (re-freezing the leaf) red.
describe('FILL-vbar (CSS) — a band-carrying chart leaf grows to fill a stretched card', () => {
  it('the visible view slot wrapping a band-leaf chart-wrap is a fill-flex column', () => {
    // `[data-view="visible"]:has(> .chart-wrap[data-aspect]), … { display:flex;
    //  flex-direction:column; flex:1 }` — a comma-group, so jump lazily to the
    //  group's declaration block (the first `{ … }` after the selector).
    const m = nodeCss.match(
      /\[data-view="visible"\]:has\(>\s*\.chart-wrap\[data-aspect\]\)[\s\S]*?\{([^}]*)\}/,
    )
    expect(m, 'view-slot fill-flex rule for a band-leaf chart-wrap missing').not.toBeNull()
    const block = m![1]
    expect(block).toMatch(/flex-direction:\s*column/)
    expect(block).toMatch(/flex:\s*1\b/)
  })

  it('the band leaf grows PAST the band (flex-basis + height:auto), not frozen at it', () => {
    // The load-bearing rule: `[data-view="visible"] > .chart-wrap[data-aspect]`
    // (first of a comma-group) must resolve to a growable basis and DEFEAT the
    // base frozen `height: var(--size-panel-height)`.
    const m = nodeCss.match(
      /\[data-view="visible"\]\s*>\s*\.chart-wrap\[data-aspect\][\s\S]*?\{([^}]*)\}/,
    )
    expect(m, 'leaf growable-band rule missing — the frozen-176 guard').not.toBeNull()
    const block = m![1]
    expect(block).toMatch(/flex:\s*1\s+1\s+var\(--size-panel-height\)/)
    expect(block).toMatch(/height:\s*auto/)
  })

  it('the ratio data-height leaves (16:9 …) are covered alongside data-aspect', () => {
    // The ratio tokens alias the band too, so the leaf-fill rule must cover them
    // (a `wrap`/chart authored with "height":"16:9" gets the same growable leaf).
    expect(nodeCss).toMatch(/\[data-view="visible"\]\s*>\s*\.chart-wrap\[data-height="16:9"\]/)
  })
})

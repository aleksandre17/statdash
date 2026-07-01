// ── AR-8 — Contextual Aspect Band (context-proportional panel height) ─────────
//
//  The panel-sizing model stays HONEST (one monotonic height band, never CSS
//  aspect-ratio + max-height) AND is now context-PROPORTIONAL: the band's middle
//  term is `--panel-ratio × 100cqi`, where --panel-ratio composes three orthogonal
//  inputs — role (plugin data-content) × context (@container) with an authored
//  (config aspectRatio) override. A SOLO panel is TALLER than a PAIRED one by
//  construction (height = ratio × own-width). These gates lock that model:
//  re-freezing the coefficient, re-introducing aspect-ratio, dropping the context
//  axis, smuggling a magic length / tenant / node-type into a ratio, collapsing the
//  map's definite height, or re-freezing the flex-basis all turn a gate RED.
//  (DESIGN-proportional-sizing.md §5.)
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
const read     = (...p: string[]) => stripComments(readFileSync(join(here, ...p), 'utf8'))
const nodeCss  = read('css', 'node-styles.css')
const tokens   = read('css', 'tokens.css')
// Cross-cutting sizing invariants live in the layout node + the panel-layout
// consumer + the two role plugins. A fitness function legitimately reads across
// module folders — the dependency ARROW governs runtime imports (eslint
// no-restricted-imports), not a test-time readFileSync of a sibling CSS file.
const layoutCss      = read('..', '..', 'plugins', 'nodes', 'layout', 'layout.css')
const panelLayoutCss = read('..', '..', 'react', 'src', 'styles', 'panel-layout.css')
const chartRoleCss   = read('..', '..', 'plugins', 'panels', 'chart', 'default', 'chart.css')
const geoRoleCss     = read('..', '..', 'plugins', 'nodes', 'geograph', 'default', 'geograph.css')

describe('AR-8 — Contextual Aspect Band', () => {
  it('FF-RATIO-DRIVEN-BAND — the band middle term is calc(var(--panel-ratio) * 100cqi), not a frozen Ncqi', () => {
    const m = tokens.match(/--size-panel-height:\s*clamp\(([^;]+)\);/)
    expect(m, '--size-panel-height clamp spine missing').not.toBeNull()
    // proportion is a TOKEN times the panel's own width
    expect(m![1]).toMatch(/calc\(\s*var\(--panel-ratio\)\s*\*\s*100cqi\s*\)/)
    // guard against re-freezing the coefficient as a bare `<num>cqi` middle term
    expect(tokens).not.toMatch(/--size-panel-height:\s*clamp\([^,]*,\s*[\d.]+cqi\s*,/)
    // --panel-ratio composes: authored ?? role, all × context scale
    expect(tokens).toMatch(
      /--panel-ratio:\s*calc\(\s*var\(--panel-ratio-authored,\s*var\(--panel-ratio-role\)\)\s*\*\s*var\(--panel-ratio-scale\)\s*\)/,
    )
  })

  it('FF-BAND-MONOTONIC — height is a single clamp(); no aspect-ratio + max-height contradiction', () => {
    expect(nodeCss).not.toContain('aspect-ratio')          // the honored fence
    expect(nodeCss).not.toMatch(/var\(--ar-/)              // the dead --ar-* cascade stays gone
    expect(tokens).toMatch(/--size-panel-height:\s*clamp\(/)
    // no companion max-height re-caps a data panel's band body (the contradiction)
    expect(nodeCss).not.toMatch(/\[data-aspect\][^{]*\{[^}]*max-height/)
  })

  it('FF-RATIO-CONTEXT-AWARE — >=1 @container(min-width) rule shrinks the ratio, so solo != paired', () => {
    // context axis: a wider OWN width lands a shorter ratio (taller absolute).
    expect(nodeCss).toMatch(/@container\s*\(min-width:\s*680px\)[\s\S]{0,300}--panel-ratio-scale:/)
    expect(nodeCss).toMatch(/@container\s*\(min-width:\s*1040px\)[\s\S]{0,300}--panel-ratio-scale:/)
  })

  it('FF-RATIO-AGNOSTIC — every ratio value is unitless; keyed on data-content, no tenant / node-type / magic px', () => {
    const all   = [tokens, nodeCss, chartRoleCss, geoRoleCss].join('\n')
    const decls = all.match(/--panel-ratio(?:-role|-scale)?:\s*([^;]+);/g) ?? []
    expect(decls.length, 'no --panel-ratio* declarations found').toBeGreaterThan(0)
    for (const d of decls) {
      const val = d.split(':')[1]
      expect(val, `a ratio carries a length unit: ${d.trim()}`).not.toMatch(/\d\s*(px|rem|em|vh|vw)\b/)
    }
    // role ratios are keyed on the content-role token, never a hardcoded node type
    expect(geoRoleCss).toMatch(/\[data-content="geo"\]/)
    expect(chartRoleCss).toMatch(/\[data-content="chart"\]/)
    // no tenant / dimension name leaks into a proportion rule (Law 1/4). The banned
    // words are assembled from fragments so this test file itself carries no tenant
    // literal (the packages/{react,styles} no-tenant-content scan, kept allowlist-empty).
    const tenantWord = new RegExp(['geo' + 'stat', 'geo' + 'rgia', 'tenant'].join('|'), 'i')
    expect((chartRoleCss + geoRoleCss).toLowerCase()).not.toMatch(tenantWord)
  })

  it('FF-MAP-DEFINITE-HEIGHT — band is a clamp of definite lengths + a min-height floor; map keeps near-square', () => {
    expect(tokens).toMatch(/--size-panel-h-floor:\s*\d+px/)
    expect(tokens).toMatch(/--size-panel-h-cap:\s*\d+px/)
    expect(tokens).toMatch(/--size-panel-min-height:\s*[\d.]+rem/)   // the height:100% renderer floor
    // the map body opts into the near-square role via the content token
    expect(geoRoleCss).toMatch(/\.panel__body\[data-content="geo"\]\s*\{\s*--panel-ratio-role:\s*0?\.72/)
  })

  it('FF-EQUAL-HEIGHT-SIBLINGS — layout columns keep align-items:stretch (the row equal-height contract)', () => {
    expect(layoutCss).toMatch(/\.layout-columns\s*\{[^}]*align-items:\s*stretch/)
  })

  it('FF-BAND-IS-FLEX-BASIS — the body consumes the band as a growable flex-basis, never a frozen height', () => {
    expect(panelLayoutCss).toMatch(/flex:\s*1\s+1\s+var\(--size-panel-height\)/)   // container form
    expect(nodeCss).toMatch(/flex:\s*1\s+1\s+var\(--size-panel-height\)/)          // leaf form
  })
})

describe('AR-8 resolver — authorable proportion (aspectRatio → --panel-ratio-<bp>)', () => {
  it('emits data-aspect + per-breakpoint --panel-ratio vars (CSS W/H inverted), never inert --ar-*', () => {
    const out = applyNodeStyles({ aspectRatio: { default: '16 / 9', sm: '4 / 3' } }) as
      Record<string, unknown> & { style?: Record<string, unknown> }
    expect(out['data-aspect']).toBe('')
    const style = out.style ?? {}
    expect(Object.keys(style).filter(k => k.startsWith('--ar-'))).toEqual([])
    // aspect-ratio is width÷height; the band coefficient is height÷width → inverted
    expect(style['--panel-ratio-default']).toBe('0.5625')   // 9/16
    expect(style['--panel-ratio-sm']).toBe('0.75')          // 3/4
  })

  it('a numeric / colon aspectRatio also inverts to the band coefficient', () => {
    const num = applyNodeStyles({ aspectRatio: '2' }) as Record<string, unknown> & { style?: Record<string, unknown> }
    expect(num.style?.['--panel-ratio-default']).toBe('0.5')      // a 2:1 wide box → 0.5 tall-of-wide
    const colon = applyNodeStyles({ aspectRatio: '16:9' }) as Record<string, unknown> & { style?: Record<string, unknown> }
    expect(colon.style?.['--panel-ratio-default']).toBe('0.5625')
  })

  it('no aspectRatio → no data-aspect flag, no --panel-ratio vars (band falls back to role)', () => {
    const out = applyNodeStyles({ height: '16:9' }) as Record<string, unknown> & { style?: Record<string, unknown> }
    expect(out['data-aspect']).toBeUndefined()
    const style = out.style ?? {}
    expect(Object.keys(style).filter(k => k.startsWith('--panel-ratio'))).toEqual([])
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

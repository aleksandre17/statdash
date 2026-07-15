// ── FF-GRID-MAXIMAL — the JSON grammar of layout exposes FULL CSS Grid ────────
//
//  AR-5: the `grid` node is the maximal CSS-Grid grammar. This gate locks the
//  three planes that make it maximal so a future thinning is a red test:
//   (1) CAPABILITY / palette — the schema DECLARES the full grid vocabulary, so
//       the Constructor can browse it (§12 "ship capabilities, not one-offs").
//   (2) INTERPRETER — resolveGrid lowers each prop to CSS with the correct dual
//       route: flat → inline (intrinsic auto-fit reflow), responsive → per-bp
//       vars + a data-*-responsive flag (container-query cascade).
//   (3) CSS WIRING — layout.css carries the @container cascade that reads those
//       vars, so a responsive template genuinely reflows per breakpoint.

import { describe, it, expect } from 'vitest'
import { readFileSync }         from 'node:fs'
import { fileURLToPath }        from 'node:url'
import { dirname, join }        from 'node:path'
import { resolveGrid }          from '@statdash/styles'
import type { PropField }       from '@statdash/react/engine'
import { GridSchema }           from './GridNode'

const here      = dirname(fileURLToPath(import.meta.url))
const layoutCss = readFileSync(join(here, '..', '..', 'layout.css'), 'utf8')
// Introspect the schema as the generic PropField vocabulary it is (defineSchema
// narrows to literals for coverage-asserts; this test reads .field/.plane/.concern
// across the union, which needs the widened PropField view).
const schema: readonly PropField[] = GridSchema
const fields    = new Set(schema.map(f => f.field))

describe('FF-GRID-MAXIMAL — capability surface (schema-introspectable palette)', () => {
  it('the schema declares the full CSS-Grid vocabulary', () => {
    for (const f of ['templateColumns', 'templateRows', 'templateAreas', 'columns',
                     'autoFlow', 'autoColumns', 'autoRows', 'gap', 'align', 'justify']) {
      expect(fields, `grid schema must declare "${f}" so the Constructor can author it`).toContain(f)
    }
  })
})

describe('FF-GRID-AUTHOR-PLANE — raw track syntax is steward-only (AR-52 Law 11)', () => {
  const byField = new Map(schema.map(f => [f.field, f]))

  it('the friendly abstraction (columns/gap/align/justify) stays on the author plane', () => {
    for (const f of ['columns', 'gap', 'align', 'justify']) {
      // author plane = plane absent or 'author' (both project to the non-programmer).
      expect(byField.get(f)?.plane ?? 'author').toBe('author')
    }
  })

  it('the raw CSS-Grid track syntax is projected to the STEWARD lens, off the author plane', () => {
    for (const f of ['templateColumns', 'templateRows', 'templateAreas',
                     'autoFlow', 'autoColumns', 'autoRows']) {
      expect(byField.get(f)?.plane, `${f} is raw CSS plumbing — must be behind steward, never the author compose surface`).toBe('steward')
    }
  })

  it('every grid field declares the LAYOUT concern (REFINE grouping)', () => {
    for (const f of schema) expect(f.concern).toBe('layout')
  })
})

describe('FF-GRID-MAXIMAL — interpreter (resolveGrid lowers spec → CSS)', () => {
  it('a FLAT template goes inline (the intrinsic auto-fit reflow form) with no flag', () => {
    const tc = 'repeat(auto-fit, minmax(min(100%, 24rem), 1fr))'
    const { style, data } = resolveGrid({ templateColumns: tc })
    expect(style?.gridTemplateColumns).toBe(tc)
    expect(data['data-grid-cols-responsive']).toBeUndefined()
  })

  it('a RESPONSIVE template routes to per-breakpoint vars + the flag (never inline)', () => {
    const { style, data } = resolveGrid({
      templateColumns: { default: 'repeat(2, minmax(0, 1fr))', md: '1fr' },
    })
    // No inline grid-template-columns (inline would shadow the @container cascade).
    expect(style?.gridTemplateColumns).toBeUndefined()
    expect(style?.['--grid-cols-default']).toBe('repeat(2, minmax(0, 1fr))')
    expect(style?.['--grid-cols-md']).toBe('1fr')
    expect(data['data-grid-cols-responsive']).toBe('')
  })

  it('the numeric `columns` shorthand lowers to a real minmax track list', () => {
    const { style } = resolveGrid({ columns: 4 })
    expect(style?.gridTemplateColumns).toBe('repeat(4, minmax(0, 1fr))')
  })

  it('an explicit templateColumns overrides the columns shorthand', () => {
    const { style } = resolveGrid({ columns: 4, templateColumns: '2fr 1fr' })
    expect(style?.gridTemplateColumns).toBe('2fr 1fr')
  })

  it('flow + implicit-track props lower to inline CSS', () => {
    const { style } = resolveGrid({ autoFlow: 'dense', autoRows: 'minmax(8rem, auto)' })
    expect(style?.gridAutoFlow).toBe('dense')
    expect(style?.gridAutoRows).toBe('minmax(8rem, auto)')
  })

  it('gap rides the shared --layout-gap container-var contract', () => {
    const { style } = resolveGrid({ gap: 'var(--spacing-lg)' })
    expect(style?.['--layout-gap']).toBe('var(--spacing-lg)')
  })
})

describe('FF-GRID-MAXIMAL — CSS wiring (container-query reflow, not viewport-coupled)', () => {
  it('the responsive template reads per-breakpoint vars via @container grid', () => {
    expect(layoutCss).toMatch(/\.layout-grid\[data-grid-cols-responsive\]\s*\{\s*grid-template-columns:\s*var\(--grid-cols-default\)/)
    expect(layoutCss).toMatch(/@container grid \(max-width: 768px\)/)
    expect(layoutCss).toMatch(/var\(--grid-cols-md,\s*var\(--grid-cols-lg/)
  })

  it('rows + areas axes are wired too (full template plane, not just columns)', () => {
    expect(layoutCss).toMatch(/\[data-grid-rows-responsive\]/)
    expect(layoutCss).toMatch(/\[data-grid-areas-responsive\]/)
  })

  it('the container-driven default guards overflow with minmax(0, …)', () => {
    expect(layoutCss).toMatch(/\.layout-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(12,\s*minmax\(0,\s*1fr\)\)/)
  })
})

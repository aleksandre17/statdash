// @vitest-environment node
//
// ── variant.fitness.test.ts — the variant-style spine can't regress ───────────
//
//  The shell-variant-style spine (ADR adr_shell_variant_style_spine) reshaped the
//  section's emphasis UP: a shell writes ZERO inline variant→class logic and ZERO
//  bare BEM-modifier strings; variants are DECLARED in meta, resolved generically
//  (resolveVariants → data-attrs), and Constructor-authorable. These fitness
//  functions make that load-bearing and un-regressable (mirrors
//  presentation.fitness.test.ts):
//
//    FF-NO-VARIANT-CLASS    — SectionShell.tsx contains NO BEM-modifier string
//      literal and NO `[...].filter(Boolean).join(' ')` variant-class idiom.
//      Variants arrive ONLY as {...variantAttrs}. (Scoped to section now; the
//      gate generalizes to every *Shell.tsx in later ADR phases.)
//    FF-VARIANT-DECLARED    — every `data-*` attribute section.css selects on maps
//      to a VariantDef.attr in section META (CSS ↔ meta closure: no orphan attrs,
//      no undeclared variants).
//    FF-VARIANT-SCHEMA-ROUNDTRIP — section's declared variant fields round-trip
//      through generatePageConfigSchema (declare → author → validate closure).
//

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  nodeRegistry,
  describeApp,
  generatePageConfigSchema,
  variantPropSchema,
  nodeSchemaWithVariants,
} from '@statdash/react/engine'
import { registerNodeType } from '@statdash/engine'
import { META } from './meta'

const here        = dirname(fileURLToPath(import.meta.url))   // …/section/default
const sectionShell = resolve(here, 'SectionShell.tsx')
const sectionCss   = resolve(here, 'section.css')

// ── FF-NO-VARIANT-CLASS — the shell hand-codes no variant class ───────────────

describe('FF-NO-VARIANT-CLASS — SectionShell.tsx writes zero variant→class logic', () => {
  const src = readFileSync(sectionShell, 'utf8')

  it('contains NO BEM-modifier string literal (`--<modifier>` in a quoted string)', () => {
    // A modifier class literal is the smell: 'section--hero', 'section--compact'.
    // Match a `--word` sequence inside a single/double-quoted string.
    const modifierInString = /['"][^'"]*--[a-z][^'"]*['"]/
    const offenders = src
      .split('\n')
      .map((line, i) => ({ line: line.trim(), n: i + 1 }))
      .filter(({ line }) => modifierInString.test(line))
      .map(({ line, n }) => `SectionShell.tsx:${n}: ${line}`)
    expect(offenders, `BEM-modifier string literals: ${offenders.join(' | ')}`).toEqual([])
  })

  it('contains NO `[...].filter(Boolean).join(\' \')` inline variant-class idiom', () => {
    expect(src).not.toMatch(/\.filter\(Boolean\)\.join\(/)
  })

  it('spreads the resolved variant attrs (the only legal variant channel)', () => {
    // Positive: variants flow through variantAttrs, not a computed class.
    expect(src).toContain('{...variantAttrs}')
  })
})

// ── FF-VARIANT-DECLARED — CSS data-attrs ↔ META variant defs (closure) ────────

describe('FF-VARIANT-DECLARED — every section.css data-attr is a declared VariantDef.attr', () => {
  // Strip `/* … */` comments first so prose mentioning `[data-tenant]` etc. is
  // never mistaken for a real selector (the closure is over SELECTORS only).
  const css = readFileSync(sectionCss, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

  /** Every `data-*` attribute the stylesheet SELECTS on (e.g. `data-emphasis`). */
  function cssDataAttrs(): Set<string> {
    const out = new Set<string>()
    // Match `[data-foo=` or `[data-foo]` selectors.
    for (const m of css.matchAll(/\[(data-[a-z-]+)(?:[~|^$*]?=|\])/g)) out.add(m[1])
    return out
  }

  /** Every attr a declared VariantDef projects to (from META.variants). */
  function declaredAttrs(): Set<string> {
    return new Set(Object.values(META.variants ?? {}).map(d => d.attr))
  }

  it('section.css selects on at least one data-emphasis attribute (sanity)', () => {
    expect(cssDataAttrs().has('data-emphasis')).toBe(true)
  })

  it('every data-* attr the CSS selects on is a declared VariantDef.attr (no orphans)', () => {
    const declared = declaredAttrs()
    // Allowlist: the cross-cutting state/style attrs owned by @statdash/styles
    // resolvers (resolveViewState → data-view, applyNodeStyles → data-height/…),
    // NOT section variants. The closure is over VARIANT attrs only.
    const STYLE_SPINE_ATTRS = new Set([
      'data-view', 'data-height', 'data-aspect', 'data-hover', 'data-focus',
      'data-active', 'data-print-hide',
    ])
    const orphans = [...cssDataAttrs()]
      .filter(a => !declared.has(a) && !STYLE_SPINE_ATTRS.has(a))
    expect(orphans, `section.css data-attrs with no VariantDef: ${orphans.join(', ')}`).toEqual([])
  })

  it('every declared VariantDef.attr is actually selected on in section.css (no dead decls)', () => {
    const cssAttrs = cssDataAttrs()
    const dead = [...declaredAttrs()].filter(a => !cssAttrs.has(a))
    expect(dead, `declared variant attrs absent from section.css: ${dead.join(', ')}`).toEqual([])
  })
})

// ── FF-VARIANT-SCHEMA-ROUNDTRIP — declared variants reach the wire schema ─────

describe('FF-VARIANT-SCHEMA-ROUNDTRIP — section variant fields round-trip through generatePageConfigSchema', () => {
  beforeAll(() => {
    // Register section (schema folds in variantPropSchema via registerSlice's merge;
    // here we register directly with the merged schema, mirroring registerSlice).
    nodeRegistry.register(META.type, META.variant ?? 'default', () => null, {
      label:    META.label,
      category: META.category,
      schema:   nodeSchemaWithVariants(META.schema, META.variants),
      version:  META.version,
    })
    registerNodeType(META.type)
  })

  it('variantPropSchema(section) yields the emphasis PropField as a select', () => {
    const fields = variantPropSchema(META.variants)
    const emphasis = fields.find(f => f.field === 'variants.emphasis')
    expect(emphasis).toBeDefined()
    expect(emphasis!.type).toBe('string')
    expect(emphasis!.options?.map(o => o.value)).toEqual(['hero', 'compact'])
  })

  it('the section $def in generatePageConfigSchema carries the variants.emphasis field', () => {
    const schema = generatePageConfigSchema(describeApp())
    const sectionDef = schema.$defs['node_section__default'] as {
      properties: Record<string, unknown>
    }
    // The PropSchema→JSON-Schema bridge FLATTENS dot-path fields as top-level
    // property KEYS (key = 'variants.emphasis'), so the wire-contract face for the
    // variant is a property named exactly that — the declare→author→validate closure.
    const field = sectionDef.properties['variants.emphasis'] as
      | { enum?: unknown[] }
      | undefined
    expect(field, 'section $def is missing the variants.emphasis field').toBeDefined()
    // The enum values surface as the JSON-Schema enum (Constructor select source).
    expect(field!.enum).toEqual(['hero', 'compact'])
  })
})

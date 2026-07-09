// ── FF-CATALOG-DISCOVERY-PURE — the discovery resolver leaf is genuinely pure ──
//
//  AR-49 M0 (SPEC-authoring-reconception-M0.md §2.2, item 11 panel seam). The
//  governed-catalog resolver leaf `semanticCatalogOptions.ts` is the semantic peer
//  of `cubeEnumOptions.ts`: it maps a catalog to `<select>` options and NOTHING
//  else. Its purity is load-bearing — the EnumRefField semantic branch AND the
//  Metric Palette both call it inside a `useMemo`, so any hidden import of React /
//  the store / the network would either break render determinism or drag a side
//  effect into a pure render path. This fitness locks purity two ways:
//
//    STRUCTURALLY (import scan of the source) — the module imports NOTHING at
//      runtime: every import is `import type` and no specifier names React, the
//      catalog store/hook, or a network/side-effecting module. A type-only module
//      erases to nothing when compiled, so it CANNOT carry a side effect. This is
//      the strongest structural proof of "no imports of React, the store, network,
//      or side-effecting modules" (spec) — a new value import forces re-justifying
//      the leaf's purity here (that is the intended fitness friction).
//
//    BEHAVIOURALLY — the resolvers are deterministic (same input ⇒ deep-equal
//      output) and non-mutating (a deep-frozen catalog resolves without throwing).
//
//  This is the FITNESS complement to semanticCatalogOptions.test.ts (which pins the
//  option SHAPE); here we pin the architectural PURITY invariant, not the values.
//
import { describe, it, expect } from 'vitest'
import {
  metricOptions, dimensionOptions, readCatalogLabel,
  type CatalogDimension,
} from './semanticCatalogOptions'
import type { MetricDef } from '@statdash/engine'
// The resolver leaf's SOURCE as raw text — imported via Vite's `?raw` so the scan
// is CWD-independent (no import.meta.url / __dirname workspace pitfalls).
import SRC from './semanticCatalogOptions.ts?raw'

/** Every `import … from '<spec>'` statement, paired with whether it is type-only. */
function importStatements(src: string): { spec: string; typeOnly: boolean }[] {
  const out: { spec: string; typeOnly: boolean }[] = []
  const re = /^\s*import\s+(type\s+)?[^;'"]*?from\s+['"]([^'"]+)['"]/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) out.push({ spec: m[2], typeOnly: Boolean(m[1]) })
  return out
}

/** Bare side-effect imports (`import './x'`) — a runtime dependency with no binding. */
function sideEffectImports(src: string): string[] {
  const out: string[] = []
  const re = /^\s*import\s+['"]([^'"]+)['"]\s*;?\s*$/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) out.push(m[1])
  return out
}

// Specifiers a PURE catalog→options leaf must never reach for.
const FORBIDDEN = [
  /^react$/, /^react-dom/, /^react\//,          // React
  /store/i, /useMetricCatalog/, /useActiveProfile/, // the catalog store / hooks
  /^zustand/,                                    // any store runtime
  /fetch/i, /axios/, /cubeApi/, /\/lib\//,       // network / IO
]

describe('FF-CATALOG-DISCOVERY-PURE — structural (import scan)', () => {
  const imports = importStatements(SRC)

  it('the resolver leaf declares at least one import (guards the scan is live)', () => {
    expect(imports.length).toBeGreaterThan(0)
  })

  it('every import is type-only — the module erases to nothing at runtime (no side effect possible)', () => {
    const valueImports = imports.filter((i) => !i.typeOnly)
    expect(valueImports).toEqual([])
  })

  it('imports NO React / store / hook / network / side-effecting specifier', () => {
    for (const { spec } of imports) {
      for (const bad of FORBIDDEN) {
        expect(bad.test(spec), `forbidden import "${spec}" (matched ${bad})`).toBe(false)
      }
    }
  })

  it('has no bare side-effect import (import \'./x\')', () => {
    expect(sideEffectImports(SRC)).toEqual([])
  })
})

// ── Behavioural purity — deterministic + non-mutating ────────────────────────
const metrics: Record<string, MetricDef> = {
  'gdp.level':      { code: 'B1GQ',    label: { en: 'GDP', ka: 'მშპ' }, unit: { en: 'mln GEL', ka: 'მლნ ₾' } },
  'gdp.realGrowth': { code: 'B1GQ_GR', label: { en: 'GDP · growth', ka: 'მშპ · ზრდა' } },
}
const dimensions: Record<string, CatalogDimension> = {
  region: { code: 'REGION', label: { en: 'Region', ka: 'რეგიონი' }, conceptRole: 'geo' },
}

/** Deep-freeze so any attempted mutation of the input throws in the resolver. */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

describe('FF-CATALOG-DISCOVERY-PURE — behavioural (deterministic + non-mutating)', () => {
  it('metricOptions/dimensionOptions are deterministic — same input ⇒ deep-equal output', () => {
    expect(metricOptions(metrics, 'en')).toEqual(metricOptions(metrics, 'en'))
    expect(dimensionOptions(dimensions, 'ka')).toEqual(dimensionOptions(dimensions, 'ka'))
    expect(readCatalogLabel({ ka: 'x' }, 'en', 'F')).toBe(readCatalogLabel({ ka: 'x' }, 'en', 'F'))
  })

  it('does not mutate its input catalog (resolves a deep-frozen catalog without throwing)', () => {
    const frozenMetrics = deepFreeze(structuredClone(metrics))
    const frozenDims    = deepFreeze(structuredClone(dimensions))
    expect(() => metricOptions(frozenMetrics, 'en')).not.toThrow()
    expect(() => dimensionOptions(frozenDims, 'en')).not.toThrow()
    // The frozen input is unchanged (deep-equal to a fresh clone).
    expect(frozenMetrics).toEqual(metrics)
    expect(frozenDims).toEqual(dimensions)
  })

  it('depends on NO ambient/global state — output is a pure function of (catalog, locale)', () => {
    // Two independent clones of identical data resolve identically (no shared cache,
    // no module-level mutable state feeding the result).
    const a = metricOptions(structuredClone(metrics), 'en')
    const b = metricOptions(structuredClone(metrics), 'en')
    expect(a).toEqual(b)
  })
})

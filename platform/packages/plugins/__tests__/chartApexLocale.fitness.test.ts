// @vitest-environment jsdom
//
// ── toApexOptions LocaleString guard — the ApexCharts blind-spot gate ──────────
//
//  THE INVARIANT: no raw `{ ka, en }` LocaleString bag — and no `"[object Object]"`
//  string baked from one — may survive into a chart's neutral ChartOutput OR its
//  toApexOptions output, for ANY chart node on ANY page in ANY shipped locale.
//
//  WHY this gate exists where the jsdom render-guard cannot reach:
//    1. The page render-guard (geostat localeString-render-guard) renders real pages,
//       but with an EMPTY store every ChartShell short-circuits to <EmptyState/> — the
//       chart body (interpretChart → toApexOptions) is NEVER built, so a config leak
//       in the chart path is invisible to it.
//    2. ApexCharts draws to SVG via imperative JS that jsdom does not execute, so even
//       a built chart never renders its axis-unit / tooltip / data-label / legend /
//       series-name text in jsdom. A bilingual `fieldConfig.unit` that bakes
//       "123 [object Object]" into every tooltip is therefore unobservable via DOM.
//
//  This gate closes both blind spots WITHOUT a browser: it drives the SAME boundary
//  the shell uses (resolveChartDefLocale → interpretChart → toApexOptions) over every
//  real chart def + synthetic rows + every locale, and deep-scans the two output trees
//  for any locale bag / flattened object. The RED-capability companion test feeds the
//  UNRESOLVED def through the identical pipeline and asserts the scanner DOES find the
//  leak — proving the scanner detects a real regression (a gate that cannot fail is no
//  gate). Together with the type-honesty on ChartNode (LocaleString fields force the
//  resolve at compile time), this eliminates the bug CLASS, not one instance.
//
import { describe, it, expect } from 'vitest'
import { readFileSync }         from 'node:fs'
import { fileURLToPath }        from 'node:url'
import { dirname, resolve as resolvePath } from 'node:path'
import { resolveLocaleString }  from '@statdash/engine'
import type { DataRow, LocaleString, SectionContext } from '@statdash/engine'
import { interpretChart }       from '@statdash/charts'
import type { ChartOutput }     from '@statdash/charts'
import { toApexOptions }        from '../panels/chart/default/utils/toApexOptions'
import { resolveChartDefLocale } from '../panels/chart/default/utils/localeChartDef'
import type { ChartNode }       from '../panels/chart/default/ChartNode'

// ── Provisioning SSOT (the real chart defs) ────────────────────────────────────
const here     = dirname(fileURLToPath(import.meta.url))
const provPath = resolvePath(here, '../../../apps/api/provisioning/geostat.provisioning.json')
/* eslint-disable @typescript-eslint/no-explicit-any */
const prov: any = JSON.parse(readFileSync(provPath, 'utf8'))
const sc: any   = Object.fromEntries(prov.siteConfig.map((r: any) => [r.key, r.value]))

// Shipped locales — DERIVED from the manifest (Law 1, never hardcoded ka/en).
const LOCALES: string[]   = sc.i18n?.locales ?? ['en']
const FALLBACK: string    = sc.i18n?.defaultLocale ?? LOCALES[0]

// ── Chart-node discovery, with the cascaded fieldConfig the engine would pass ──
//
//  A chart inherits its nearest ancestor's `fieldConfig` (section / columns set it,
//  the engine threads it down as ctx.fieldConfig). The bilingual `unit` very often
//  lives on that ancestor, not on the chart, so the gate MUST thread it to exercise
//  the cascade-resolve path. `inheritedFc` is the raw (possibly bilingual) ancestor
//  config — exactly what resolveChartDefLocale receives at runtime as ctxFieldConfig.
//
interface FoundChart { page: string; id: string; def: ChartNode; inheritedFc: any }
function collectCharts(): FoundChart[] {
  const found: FoundChart[] = []
  const walk = (node: any, page: string, inheritedFc: any): void => {
    if (Array.isArray(node)) { for (const v of node) walk(v, page, inheritedFc); return }
    if (!node || typeof node !== 'object') return
    const fc = node.fieldConfig ?? inheritedFc
    if (node.type === 'chart' && typeof node.chartType === 'string') {
      found.push({ page, id: node.id ?? node.chartType, def: node as ChartNode, inheritedFc })
    }
    for (const k of Object.keys(node)) {
      if (k === 'fieldConfig') continue
      walk(node[k], page, fc)
    }
  }
  for (const p of prov.pages) walk(p.config, p.slug, undefined)
  return found
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const CHARTS = collectCharts()

// ── Synthetic rows — enough shape to drive every interpreter's text surfaces ───
//  Multi-series (legend / series name), a separator (hbar-diverging groups), a
//  negative (contribution sign prefix) and a total (waterfall / donut centre).
const ROWS: DataRow[] = [
  { id: 'r1',  label: 'Alpha', value: 100 },
  { id: 'r2',  label: 'Beta',  value: 250, series: 'Series B' },
  { id: 'sep', label: 'Group', value: 0,   isSeparator: true },
  { id: 'r3',  label: 'Gamma', value: -40 },
  { id: 'tot', label: 'Total', value: 310, isTotal: true },
]
const SECTION_CTX = { dims: {}, timeMode: 'year' } as unknown as SectionContext

// ── The scanner — locale bag / object-flatten detector ─────────────────────────
const LOCALE_CODES = new Set(['ka', 'en', 'ru', 'de', 'fr', 'es'])

/** True for a PLAIN object whose every key is a locale code with a string value —
 *  the structural signature of a raw, unresolved LocaleString bag. */
function isLocaleBag(v: unknown): boolean {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false
  const keys = Object.keys(v as object)
  return keys.length > 0
    && keys.every((k) => LOCALE_CODES.has(k))
    && keys.some((k) => typeof (v as Record<string, unknown>)[k] === 'string')
}

/** Deep-scan an output tree for leaks: raw locale bags + "[object Object]" strings.
 *  Functions (Apex formatter closures) are skipped — the axis-unit closure is why we
 *  also scan ChartOutput, where `axes.*.unit` is a DIRECT, scannable field. */
function scanLeaks(node: unknown, path: string, hits: string[]): void {
  if (node == null) return
  if (typeof node === 'string') {
    if (node.includes('[object Object]')) hits.push(`${path} = ${JSON.stringify(node)}`)
    return
  }
  if (typeof node === 'function') return
  if (typeof node !== 'object') return
  if (isLocaleBag(node)) {
    hits.push(`${path} = raw LocaleString ${JSON.stringify(node)}`)
    return
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => scanLeaks(v, `${path}[${i}]`, hits))
    return
  }
  for (const k of Object.keys(node as object)) {
    scanLeaks((node as Record<string, unknown>)[k], `${path}.${k}`, hits)
  }
}

/** Run the FULL shell boundary (resolve → interpret → toApex) and collect leaks
 *  across BOTH the neutral ChartOutput and the ApexOptions tree. */
function leaksFor(def: ChartNode, inheritedFc: unknown, locale: string): string[] {
  const resolve = (s: LocaleString) => resolveLocaleString(s, locale, FALLBACK)
  const resolved = resolveChartDefLocale(def, inheritedFc as never, resolve)
  const output: ChartOutput = interpretChart(resolved, ROWS, SECTION_CTX)
  const apex = toApexOptions(output)
  const hits: string[] = []
  scanLeaks(output, 'ChartOutput', hits)
  scanLeaks(apex,   'ApexOptions', hits)
  return hits
}

// ── Sanity: the gate actually has charts to defend ─────────────────────────────
describe('chartApexLocale fitness — discovery', () => {
  it('finds chart nodes across the provisioning pages', () => {
    expect(CHARTS.length).toBeGreaterThan(5)
    expect(LOCALES.length).toBeGreaterThanOrEqual(2)
  })
})

// ── The invariant: every chart × locale → zero raw LocaleString / object-flatten ─
describe('chartApexLocale fitness — no raw LocaleString reaches ChartOutput / ApexOptions', () => {
  for (const { page, id, def, inheritedFc } of CHARTS) {
    for (const locale of LOCALES) {
      it(`${page}/${id} (${def.chartType}) @ ${locale} resolves every bilingual field`, () => {
        const hits = leaksFor(def, inheritedFc, locale)
        expect(
          hits,
          `raw LocaleString / "[object Object]" leaked into ${page}/${id} @ ${locale}:\n  ${hits.join('\n  ')}`,
        ).toEqual([])
      })
    }
  }
})

// ── RED capability: the scanner DETECTS a real regression ───────────────────────
//
//  Feed the UNRESOLVED def (bilingual values intact) through the identical
//  interpret → toApex pipeline and assert the scanner finds ≥1 leak. This proves the
//  gate above can FAIL — i.e. that GREEN means "resolved", not "scanner is blind".
//  It is itself locale-agnostic: it only fires for charts whose config is actually
//  bilingual (object-valued), so it cannot pass vacuously on a single-locale catalog.
//
describe('chartApexLocale fitness — RED capability (scanner detects an unresolved leak)', () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  function rawLeaks(def: ChartNode, inheritedFc: any): string[] {
    // Build the engine ChartDef WITHOUT resolving — merge cascade, keep bilingual bags.
    const mergedFc = (inheritedFc || def.fieldConfig)
      ? { ...inheritedFc, ...def.fieldConfig } : undefined
    const rawDef: any = { ...def, type: def.chartType, ...(mergedFc ? { fieldConfig: mergedFc } : {}) }
    const output = interpretChart(rawDef, ROWS, SECTION_CTX)
    const apex = toApexOptions(output)
    const hits: string[] = []
    scanLeaks(output, 'ChartOutput', hits)
    scanLeaks(apex,   'ApexOptions', hits)
    return hits
  }
  const bilingualCharts = CHARTS.filter(({ def, inheritedFc }) => {
    // identity-resolve = no-op; if resolved output still differs structurally from raw,
    // the def carries at least one bilingual (object-valued) field.
    const fc: any = def.fieldConfig ?? inheritedFc
    const objVal = (v: unknown) => v != null && typeof v === 'object' && !Array.isArray(v)
    return objVal(def.label) || objVal(def.centerLabel) || objVal(fc?.unit) || objVal(fc?.noValue)
  })
  /* eslint-enable @typescript-eslint/no-explicit-any */

  it('at least one shipped chart carries a bilingual field (else this gate is vacuous)', () => {
    expect(bilingualCharts.length).toBeGreaterThan(0)
  })

  it('the scanner flags the unresolved bilingual defs (the leak it must catch)', () => {
    for (const { page, id, def, inheritedFc } of bilingualCharts) {
      const hits = rawLeaks(def, inheritedFc)
      expect(hits.length, `scanner missed the unresolved leak in ${page}/${id}`).toBeGreaterThan(0)
    }
  })
})

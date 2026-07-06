// ── Chart label template interpolation — the {token} leak gate (B1/B2) ─────────
//
//  THE INVARIANT: no display-text `{token}` placeholder — a chart LABEL / centerLabel
//  that carries a `{fromYear}`/`{toYear}`/`{time}` template — may survive UN-EXPANDED
//  into a chart's neutral ChartOutput (series name / category / centre label). It must
//  read as the real, locale-resolved value on the series-name + tooltip path, exactly
//  like the section subtitle / KPI trendSub the SAME resolveTemplate primitive drives.
//
//  WHY this gate exists (admin B1/B2, image7): the GDP-dynamics bar shipped a label
//  "…დინამიკა, {fromYear}–{toYear}"; the shell resolved it locale-ONLY (useResolveLocale),
//  so the raw `{fromYear}–{toYear}` (Latin) leaked into the tooltip series name instead of
//  "2010–2024". The fix routes resolveChartDefLocale's text resolve through the canonical
//  resolveTemplate seam (useChartOutput → resolveNodeTemplate), which BOTH collapses the
//  i18n/perspective carrier AND expands `{key}` against ctx. This gate drives the SAME
//  boundary over every shipped chart whose label carries a token and asserts none survive.
//
//  The RED-capability companion feeds the SAME defs through a locale-ONLY resolver (the
//  old behavior) and asserts the tokens DO leak — proving the gate catches the regression
//  (a gate that cannot fail is no gate).
//
import { describe, it, expect } from 'vitest'
import { readFileSync }         from 'node:fs'
import { fileURLToPath }        from 'node:url'
import { dirname, resolve as resolvePath } from 'node:path'
import { resolveTemplate, resolveLocaleString } from '@statdash/engine'
import type { DataRow, LocaleString, SectionContext } from '@statdash/engine'
import { interpretChart }        from '@statdash/charts'
import type { ChartOutput }      from '@statdash/charts'
import { resolveChartDefLocale } from '../panels/chart/default/utils/localeChartDef'
import type { ChartNode }        from '../panels/chart/default/ChartNode'

// ── Provisioning SSOT ──────────────────────────────────────────────────────────
const here     = dirname(fileURLToPath(import.meta.url))
const provPath = resolvePath(here, '../../../apps/api/provisioning/geostat.provisioning.json')
/* eslint-disable @typescript-eslint/no-explicit-any */
const prov: any = JSON.parse(readFileSync(provPath, 'utf8'))
const sc: any   = Object.fromEntries(prov.siteConfig.map((r: any) => [r.key, r.value]))
const LOCALES: string[] = sc.i18n?.locales ?? ['en']
const FALLBACK: string  = sc.i18n?.defaultLocale ?? LOCALES[0]

// ── Chart discovery (same walk as chartApexLocale.fitness) ─────────────────────
interface FoundChart { page: string; id: string; def: ChartNode }
function collectCharts(): FoundChart[] {
  const found: FoundChart[] = []
  const walk = (node: any, page: string): void => {
    if (Array.isArray(node)) { for (const v of node) walk(v, page); return }
    if (!node || typeof node !== 'object') return
    if (node.type === 'chart' && typeof node.chartType === 'string') {
      found.push({ page, id: node.id ?? node.chartType, def: node as ChartNode })
    }
    for (const k of Object.keys(node)) walk(node[k], page)
  }
  for (const p of prov.pages) walk(p.config, p.slug)
  return found
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// A chart whose label/centerLabel carries at least one `{token}` in ANY locale arm.
function tokensOf(v: unknown): string[] {
  if (v == null) return []
  const scan = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!)
  if (typeof v === 'string') return scan(v)
  if (typeof v === 'object' && !Array.isArray(v)) {
    return Object.values(v as Record<string, unknown>).flatMap((arm) =>
      typeof arm === 'string' ? scan(arm) : [])
  }
  return []
}

const TOKEN_CHARTS = collectCharts()
  .map((c) => ({ ...c, tokens: [...new Set([...tokensOf(c.def.label), ...tokensOf((c.def as { centerLabel?: unknown }).centerLabel)])] }))
  .filter((c) => c.tokens.length > 0)

// Synthetic rows — enough to build a series name + categories for every mark.
const ROWS: DataRow[] = [
  { id: 'r1', label: 'ალფა', value: 100 },
  { id: 'r2', label: 'ბეტა', value: 250 },
  { id: 'tot', label: 'ჯამი', value: 350, isTotal: true },
]

// Build a SectionContext whose dims resolve every discovered token to a concrete value.
function ctxFor(tokens: string[], locale: string): SectionContext {
  const dims: Record<string, unknown> = {}
  for (const t of tokens) dims[t] = `⟨${t}⟩`   // a distinctive resolved marker per token
  return { dims, timeMode: 'range', locale, fallbackLocale: FALLBACK } as unknown as SectionContext
}

// Deep-scan an output tree for any surviving `{token}` in a STRING leaf.
function tokenLeaks(node: unknown, path: string, hits: string[]): void {
  if (typeof node === 'string') {
    if (/\{\w+\}/.test(node)) hits.push(`${path} = ${JSON.stringify(node)}`)
    return
  }
  if (node == null || typeof node !== 'object') return
  if (Array.isArray(node)) { node.forEach((v, i) => tokenLeaks(v, `${path}[${i}]`, hits)); return }
  for (const k of Object.keys(node as object)) tokenLeaks((node as Record<string, unknown>)[k], `${path}.${k}`, hits)
}

// ── Sanity: the gate has real templated charts to defend ───────────────────────
describe('chartTemplateInterp fitness — discovery', () => {
  it('finds ≥1 shipped chart whose label carries a {token} template', () => {
    expect(TOKEN_CHARTS.length).toBeGreaterThan(0)
  })
})

// ── The invariant: template-aware resolve expands every {token} (per locale) ───
describe('chartTemplateInterp fitness — resolveTemplate expands chart-label tokens', () => {
  for (const { page, id, def, tokens } of TOKEN_CHARTS) {
    for (const locale of LOCALES) {
      it(`${page}/${id} (${def.chartType}) @ ${locale} → no {token} in ChartOutput`, () => {
        const ctx = ctxFor(tokens, locale)
        // The PRODUCTION resolver: collapse carrier + expand {key} against ctx (extras first,
        // then ctx.dims) — exactly what useChartOutput binds via resolveNodeTemplate.
        const resolve = (s: LocaleString) => resolveTemplate(s, ctx)
        const resolved = resolveChartDefLocale(def, undefined, resolve)
        const output: ChartOutput = interpretChart(resolved, ROWS, ctx)
        const hits: string[] = []
        tokenLeaks(output, 'ChartOutput', hits)
        expect(hits, `un-expanded {token} leaked into ${page}/${id} @ ${locale}:\n  ${hits.join('\n  ')}`).toEqual([])
      })
    }
  }
})

// ── RED capability: a locale-ONLY resolve (the old bug) leaks the token ────────
describe('chartTemplateInterp fitness — RED capability (locale-only resolve leaks {token})', () => {
  it('the gate would catch the un-interpolated series name (proves it can fail)', () => {
    let sawLeak = false
    for (const { def, tokens } of TOKEN_CHARTS) {
      const ctx = ctxFor(tokens, LOCALES[0]!)
      // Old behavior: collapse locale, DO NOT expand {key} — the leak the fix removed.
      const localeOnly = (s: LocaleString) => resolveLocaleString(s, LOCALES[0]!, FALLBACK)
      const resolved = resolveChartDefLocale(def, undefined, localeOnly)
      const output = interpretChart(resolved, ROWS, ctx)
      const hits: string[] = []
      tokenLeaks(output, 'ChartOutput', hits)
      if (hits.length > 0) sawLeak = true
    }
    expect(sawLeak, 'locale-only resolve must leak ≥1 {token} — else the gate is vacuous').toBe(true)
  })
})

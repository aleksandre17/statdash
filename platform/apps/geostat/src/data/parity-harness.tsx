// ── DATA-PARITY harness — shared render + golden-fixture backing (item 0055) ───
//
//  The ONE seam the three parity gates (FF-DATA-PARITY, FF-CHART-EQ-TABLE,
//  FF-CHART-PRESENCE) share. It renders the REAL Geostat pages exactly as the
//  live runner does — SiteProvider → MemoryRouter → LocaleGuard → NodePageRenderer,
//  reading the ACTUAL provisioning manifest — but backs each page's store with the
//  static-era GOLDEN fixtures (tests/fixtures/golden, item 0054) instead of a live
//  API. The golden `facts` are the tidy observation layer today's pipeline emits, so
//  an ExternalStore over them answers the config's DataSpec queries THROUGH the clean
//  pipeline (DataSpec → interpretSpec → store → encoding → transforms → render) — no
//  hardcode-to-golden, no rollback. If the current config reproduces the known-correct
//  numbers, they surface at the panels; if not, the divergence is observable.
//
//  This is NOT a *.test file — it is test-support (co-located harness, mirrors
//  apps/api/.../canonical-ingest.e2e-harness.ts). Vitest's include is
//  `src/**/*.test.{ts,tsx}`, so this never runs as a suite; it is imported by the
//  three parity fitness tests. It is not imported by main.tsx, so it never ships.
//
import { render } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom'
import i18next from 'i18next'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { SiteProvider } from '@statdash/react'
import { ExternalStore } from '@statdash/engine'
import type { DataStore } from '@statdash/engine'
import { LocaleGuard } from '../app/LocaleGuard'
import { setupRegistrations } from '../setupRegistrations'
import { registerFormatters } from '../i18n/formatters'
import { registerManifestMetrics } from './site-manifest'
import type { SiteManifest } from './site-manifest'
import { adaptGolden } from './golden-canonical-alias'

/* eslint-disable @typescript-eslint/no-explicit-any */

const here = dirname(fileURLToPath(import.meta.url))
const PROV_PATH = resolve(here, '../../../api/provisioning/geostat.provisioning.json')
const GOLDEN_DIR = resolve(here, '../../../../tests/fixtures/golden')

export const prov: any = JSON.parse(readFileSync(PROV_PATH, 'utf8'))
export const siteConfig: any = Object.fromEntries(prov.siteConfig.map((r: any) => [r.key, r.value]))

// The store keys the pages declare (config.storeKey) === the golden domains. Derived,
// never hand-listed: a store-backed page whose fixture we forgot would surface as an
// empty render, not a silent skip.
export const STORE_DOMAINS = ['gdp', 'accounts', 'regional'] as const
export type GoldenDomain = (typeof STORE_DOMAINS)[number]

export interface GoldenFixture {
  facts: Array<Record<string, any>>
  classifiers: Record<string, any>
  display: Record<string, any>
}

export function loadGolden(domain: GoldenDomain): GoldenFixture {
  return JSON.parse(readFileSync(resolve(GOLDEN_DIR, `${domain}.static-191bc0e.json`), 'utf8'))
}

// ── goldenValue — the SOURCE truth, computed INDEPENDENTLY of the engine ──────
//  A tiny reducer over the golden `facts` (sum of matched `value` at a coordinate).
//  This is the "== source" side of parity: the expected number is derived from the
//  fixture directly, NOT from the same ExternalStore the pipeline reads — so a match
//  proves the pipeline reproduced the source, it is not a tautology against itself.
export function goldenValue(facts: GoldenFixture['facts'], coord: Record<string, unknown>): { value: number; matched: number } {
  let sum = 0
  let matched = 0
  for (const f of facts) {
    if (Object.entries(coord).every(([k, v]) => String(f[k]) === String(v))) {
      sum += Number(f.value)
      matched += 1
    }
  }
  return { value: Math.round(sum * 10000) / 10000, matched }
}

// ── the store manifest — one ExternalStore per golden domain ──────────────────
//  ExternalStore(facts, {classifiers, display}) is the exact sync DataStore the
//  boot path builds from a live source's tidy rows; here the tidy rows come from
//  the golden fixture — RE-KEYED into the canonical scheme by adaptGolden (the ACL)
//  so the canonical-code config queries resolve. caps.sync === true ⇒ the renderer
//  resolves rows on first paint (no async warm), so a full page mounts with values
//  in one render.
export function buildStores(): Record<string, DataStore> {
  const out: Record<string, DataStore> = {}
  for (const d of STORE_DOMAINS) {
    const g = adaptGolden(d, loadGolden(d))
    out[d] = new ExternalStore(g.facts, { classifiers: g.classifiers, display: g.display })
  }
  return out
}

export function buildManifest(): SiteManifest {
  return {
    pages: Object.fromEntries(prov.pages.map((p: any) => [p.slug, p.config])),
    indexPageId: siteConfig.index_page_id,
    nav: siteConfig.nav,
    chrome: siteConfig.chrome,
    chromeConfig: siteConfig.chrome_config,
    i18n: siteConfig.i18n,
    datasources: [],
  } as unknown as SiteManifest
}

// Boot the app-tier machinery ONCE (registrations, metric catalog, formatters) —
// the same eager+manifest boot the live runner performs before first render.
let booted = false
export function setupParityEnv(): void {
  if (booted) return
  // jsdom lacks Web Workers; the geograph choropleth (Leaflet) constructs one in a
  // useEffect and throws `Worker is not defined`. That is an ENVIRONMENT gap, not a
  // parity defect — a no-op Worker shim (same class as vitest.setup.ts's Observer
  // shims) lets the geo panel mount fail-soft instead of throwing an unhandled error
  // that vitest would misattribute to whichever parity test is in flight.
  if (typeof (globalThis as { Worker?: unknown }).Worker === 'undefined') {
    class NoopWorker {
      onmessage: unknown = null
      onerror: unknown = null
      postMessage(): void {}
      terminate(): void {}
      addEventListener(): void {}
      removeEventListener(): void {}
      dispatchEvent(): boolean { return false }
    }
    ;(globalThis as { Worker?: unknown }).Worker = NoopWorker
  }
  i18next.init({ lng: 'ka', fallbackLng: 'ka', resources: {}, interpolation: { escapeValue: false } })
  setupRegistrations()
  registerManifestMetrics(siteConfig.metrics)
  registerFormatters(buildManifest().i18n.locales)
  booted = true
}

export type Mode = 'year' | 'range'

export function renderPage(slug: string, locale: string, mode?: Mode) {
  const manifest = buildManifest()
  const url = `/${locale}/${slug}${mode ? `?mode=${mode}` : ''}`
  return render(
    <MemoryRouter initialEntries={[url]}>
      <SiteProvider
        stores={buildStores()}
        pages={manifest.pages}
        nav={manifest.nav}
        chrome={manifest.chrome}
        chromeConfig={manifest.chromeConfig}
        i18n={manifest.i18n}
      >
        <Routes>
          <Route path="/:locale/*" element={<LocaleGuard manifest={manifest} />} />
          <Route path="*" element={<Navigate to={`/${manifest.i18n.defaultLocale}`} replace />} />
        </Routes>
      </SiteProvider>
    </MemoryRouter>,
  )
}

// ── DOM value extraction ──────────────────────────────────────────────────────
//  Parse every rendered numeric token from the tables + kpi values. Number format
//  is space-grouped thousands with a dot decimal (e.g. "178 837.3 GEL mn"); a token
//  is the first number-like run in a cell, spaces stripped. Non-numeric cells
//  ("Total", "—", labels) yield nothing. This is layout-agnostic: it collects the
//  POOL of values the page rendered, so an anchor is matched wherever it surfaces.
const NUM_RE = /-?\d{1,3}(?:[  ]\d{3})*(?:\.\d+)?|-?\d+(?:\.\d+)?/

function parseCellNumber(text: string): number | null {
  const m = NUM_RE.exec(text.trim())
  if (!m) return null
  const n = Number(m[0].replace(/[  ]/g, ''))
  return Number.isFinite(n) ? n : null
}

export function renderedTableNumbers(container: HTMLElement): number[] {
  const out: number[] = []
  container.querySelectorAll('table td, table th').forEach((c) => {
    const n = parseCellNumber(c.textContent ?? '')
    if (n !== null) out.push(n)
  })
  return out
}

export function kpiValueNumbers(container: HTMLElement): number[] {
  const out: number[] = []
  container.querySelectorAll('.kpi-strip .kpi-value').forEach((c) => {
    const n = parseCellNumber(c.textContent ?? '')
    if (n !== null) out.push(n)
  })
  return out
}

// closest rendered number to a target + its absolute delta (for the scorecard).
export function closest(target: number, pool: number[]): { value: number | null; delta: number } {
  let best: number | null = null
  let bestDelta = Infinity
  for (const v of pool) {
    const d = Math.abs(v - target)
    if (d < bestDelta) { bestDelta = d; best = v }
  }
  return { value: best, delta: bestDelta }
}

// ── config walkers (the render inventory, DERIVED from the provisioning tree) ──

export interface ChartSlot { page: string; section: string; chartType: string }
export interface SectionSlot { page: string; section: string; perspective: Mode | 'all'; sectionGate?: string }

function deepChartType(node: any): string | undefined {
  if (node && typeof node === 'object') {
    if (typeof node.chartType === 'string') return node.chartType
    for (const v of Object.values(node)) {
      const r = deepChartType(v)
      if (r) return r
    }
  }
  return undefined
}

// Every chart slot in a page: its owning section + declared chartType. This is the
// slot inventory the presence gate pins as "the spec" (donut↔bar swaps + dropped
// panels change this list).
export function chartSlots(pageConfig: any, pageId: string): ChartSlot[] {
  const out: ChartSlot[] = []
  const walk = (n: any, sec: string | undefined) => {
    if (n?.type === 'section') sec = n.id
    if (n?.type === 'chart') out.push({ page: pageId, section: sec ?? '(none)', chartType: deepChartType(n) ?? '(unknown)' })
    for (const ch of n?.children ?? []) walk(ch, sec)
  }
  walk(pageConfig, undefined)
  return out
}

// Sections visible in a given perspective, DERIVED from the enclosing grid's
// view.visibleWhen (op:perspective-is) — the actual mechanism the renderer uses to
// gate a grid by perspective. A section with its own view.visibleWhen param gate
// (e.g. regional _geoMode single/multi) carries that gate for the caller to resolve.
export function sectionSlots(pageConfig: any, pageId: string): SectionSlot[] {
  const out: SectionSlot[] = []
  const walk = (n: any, persp: Mode | 'all') => {
    // Perspective gating lives on the enclosing LAYOUT container (grid OR columns) —
    // the runner hides the whole container by op:perspective-is.
    if (n?.type === 'grid' || n?.type === 'columns') {
      const vw = n.view?.visibleWhen
      if (vw?.op === 'perspective-is' && (vw.perspective === 'year' || vw.perspective === 'range')) persp = vw.perspective
    }
    if (n?.type === 'section') {
      const svw = n.view?.visibleWhen
      const gate = svw?.param ? `${svw.param}=${svw.is}` : undefined
      out.push({ page: pageId, section: n.id ?? '(none)', perspective: persp, sectionGate: gate })
    }
    for (const ch of n?.children ?? []) walk(ch, persp)
  }
  walk(pageConfig, 'all')
  return out
}

// A dual-view section (I-6): the SECTION node carries `data`, and its chart-view and
// table-view children carry NO own `data` — so both re-encode the ONE section dataset.
// Returns per section: whether it is a true dual-view (the SSOT that makes chart==table).
export interface DualViewInfo { page: string; section: string; sectionHasData: boolean; chartHasOwnData: boolean; tableHasOwnData: boolean; isDualView: boolean }
export function dualViewSections(pageConfig: any, pageId: string): DualViewInfo[] {
  const out: DualViewInfo[] = []
  const walk = (n: any) => {
    if (n?.type === 'section') {
      let chartOwn = false
      let tableOwn = false
      const scan = (m: any) => {
        const role = m?.view?.role
        if (m?.type === 'chart' || role === 'chart') chartOwn = chartOwn || !!m?.data
        if (m?.type === 'table' || role === 'table') tableOwn = tableOwn || !!m?.data
        for (const ch of m?.children ?? []) scan(ch)
      }
      for (const ch of n?.children ?? []) scan(ch)
      const hasData = !!n.data
      // dual-view = section owns data AND neither view owns its own data (they inherit).
      const isDual = hasData && !chartOwn && !tableOwn
      // count only sections that actually carry BOTH a chart and a table view
      let hasChart = false, hasTable = false
      const roles = (m: any) => {
        if (m?.type === 'chart' || m?.view?.role === 'chart') hasChart = true
        if (m?.type === 'table' || m?.view?.role === 'table') hasTable = true
        for (const ch of m?.children ?? []) roles(ch)
      }
      for (const ch of n?.children ?? []) roles(ch)
      if (hasChart && hasTable) {
        out.push({ page: pageId, section: n.id ?? '(none)', sectionHasData: hasData, chartHasOwnData: chartOwn, tableHasOwnData: tableOwn, isDualView: isDual })
      }
    }
    for (const ch of n?.children ?? []) walk(ch)
  }
  walk(pageConfig)
  return out
}

export function pageConfigOf(slug: string): any {
  return prov.pages.find((p: any) => p.slug === slug).config
}

// KPI items visible in a perspective (kpi.item.when.perspective), for the presence gate.
export function kpiItemsForMode(pageConfig: any, mode: Mode): any[] {
  const strip = (() => {
    let found: any
    const walk = (n: any) => { if (n?.type === 'kpi-strip') found = n; for (const ch of n?.children ?? []) walk(ch) }
    walk(pageConfig)
    return found
  })()
  const items: any[] = strip?.items ?? []
  return items.filter((it) => {
    const w = it.when
    if (!w || w.op !== 'perspective-is') return true
    return w.perspective === mode
  })
}
/* eslint-enable @typescript-eslint/no-explicit-any */

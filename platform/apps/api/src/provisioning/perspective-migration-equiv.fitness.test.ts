// ── FF-SNAPSHOT-VIEW-EQUIV (P5) — the geostat two-bar → perspective collapse is BYTE-IDENTICAL ──
//
//  The law of P5: migrating the 3 geostat pages (accounts/gdp/regional) from the
//  legacy TWO-BAR weave (year-bar `showWhen:{mode≠range}` + range-bar
//  `showWhen:{mode:range}` + mode-clearing `effects` + `context.timeMode`) onto the
//  P4.5 perspective seam (ONE collapsed bar + `page.perspectives` with
//  `scope.timeBinding` pin/window + the perspective-ownership default gate) must NOT
//  move a single rendered row.
//
//  WHAT IS PROVEN (and why it IS row-identity):
//    Downstream rendering is a pure function f(sectionCtx, nodeSpec, store). The node
//    DataSpecs are textually unchanged by the migration; the only node edit is
//    `{op:eq,param:mode}` → `{op:perspective-is}` (P2 proved param-less perspective-is
//    ≡ eq-on-mode, same boolean); the kpi-strip + KpiSpec.mode partition is untouched
//    (System A, P6 territory) and still filters on ctx.timeMode. THEREFORE the render
//    is row-identical IFF the derived `sectionCtx` (ctx.dims + ctx.timeMode) and the
//    perspective-visibility verdict are identical between the legacy and migrated
//    configs, per page × perspective × locale. This fitness derives BOTH sectionCtxs
//    through the EXACT live pipeline (the same pure core functions
//    `useFilterState` + `SiteRenderer` call: the default-resolution gate,
//    `resolveDefaults`, `context.dims` projection, then `scopeCtxByPerspective`) and
//    asserts deep equality.
//
//  THE PARITY BEHAVIOURS (explicitly asserted, both perspectives, both locales):
//    • year  perspective → ctx.dims.time = the latest year (pick:last); fromYear/toYear
//                          UNSET (owned by the inactive range perspective ⇒ suppressed).
//    • range perspective → ctx.dims.time UNSET ⇒ the dynamics timeseries renders the
//                          FULL SPAN (the parity fix, now produced by perspective
//                          ownership, not a hidden bar); fromYear/toYear SET = the
//                          window bounds the CAGR/share KPIs read.
//    • account/sector/measure/region defaults preserved.
//
//  NON-VACUOUS: a guard asserts the two perspectives genuinely DIFFER (year pins time,
//  range leaves it unset) so an accidental no-op gate would fail.
//
//  Legacy side = the FROZEN pre-P5 two-bar schemas (__fixtures__/legacy-filter-schemas).
//  Migrated side = the LIVE committed artifact (so a future regression in the JSON is
//  caught here). Both run through ONE harness — the only difference is the input config.

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  parsePerspectiveAxes,
  perspectiveOwnedParamKeys,
  scopeCtxByPerspective,
  resolveDefaults,
  resolveYears,
  resolveOptions,
  evalWhen,
  autoParse,
  evalVisibility,
  type SectionContext,
  type DataStore,
  type DimVal,
} from '@statdash/engine'
import { LEGACY_FILTER_SCHEMAS } from './__fixtures__/legacy-filter-schemas.js'

const here = dirname(fileURLToPath(import.meta.url))
const ARTIFACT_PATH = resolve(here, '../../provisioning/geostat.provisioning.json')

// ── Minimal, data-agnostic fixture store ──────────────────────────────────────
//
//  Byte-identity is a RELATIVE property between the two configs — it holds for ANY
//  store, because both sides resolve their defaults through the SAME store via the
//  SAME resolveDefaults/resolveYears/resolveOptions. The store only needs the three
//  codelists the geostat selectors read: `time` (years), `account`, `sector`. Bilingual
//  display proves the resolved CODE values are locale-invariant (labels differ, codes
//  do not).
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025]
const ACCOUNTS = ['production-account', 'capital-account', 'income-formation']
const SECTORS = ['_T', 'S11', 'S13']

function clEntries(codes: (string | number)[], labelKa: string, labelEn: string) {
  return codes.map((code, i) => ({
    code,
    order: i,
    label: { ka: `${labelKa}-${code}`, en: `${labelEn}-${code}` },
  }))
}

const FIXTURE_STORE: DataStore = {
  querySync: () => [],
  classifiers: {
    time:    clEntries(YEARS, 'წელი', 'year'),
    account: clEntries(ACCOUNTS, 'ანგ', 'acct'),
    sector:  clEntries(SECTORS, 'სექ', 'sector'),
  },
  // display keyed by code (array-form classifier ⇒ code IS id) — bilingual labels.
  display: {
    time:    Object.fromEntries(YEARS.map((y) => [String(y), { label: { ka: String(y), en: String(y) } }])),
    account: Object.fromEntries(ACCOUNTS.map((c) => [c, { label: { ka: `ანგ-${c}`, en: `acct-${c}` } }])),
    sector:  Object.fromEntries(SECTORS.map((c) => [c, { label: { ka: `სექ-${c}`, en: `sector-${c}` } }])),
  },
}

// ── The harness: replicate the live useFilterState + SiteRenderer ctx derivation ──
//
//  PURE: every step below is the exact core function the React hook calls — the only
//  thing the React layer adds is wiring (useMemo, FilterContext). We feed the URL
//  state as `{ mode: activeMode }` (the perspective param), exactly as a clean
//  permalink for that perspective would.

type FilterSchema = {
  bars: Record<string, { filters: Record<string, ParamDef>; showWhen?: Record<string, unknown> }>
  context?: { dims?: Record<string, string>; timeMode?: string }
}
type ParamDef = Record<string, unknown> & { type: string }
type Perspectives = Record<string, { perspectives: Array<Record<string, unknown>> }> | undefined

const STUB_CTX: SectionContext = { timeMode: 'year', dims: {} }

/** isAlwaysResolve — mirrors useFilterState's bar-independent default predicate. */
const isAlwaysResolve = (def: ParamDef): boolean =>
  def.type === 'hidden' && def.alwaysResolve === true

/** getOptions — the exact Tier-3 options getter useFilterState builds, over the fixture store. */
function makeGetOptions(flat: Array<{ key: string; def: ParamDef }>) {
  return (key: string): { code: DimVal }[] | null => {
    const found = flat.find((p) => p.key === key)
    if (!found) return null
    const { def } = found
    if (def.type === 'year-select') {
      const years = resolveYears(def.years as never, FIXTURE_STORE, STUB_CTX)
      return years.map((y) => ({ code: String(y) }))
    }
    if (def.type === 'select' || def.type === 'multi-select') {
      const opts = resolveOptions(def.options as never, FIXTURE_STORE, STUB_CTX)
      return opts.map((o) => ({ code: o.value }))
    }
    if (def.type === 'hidden' && def.options) {
      const opts = resolveOptions(def.options as never, FIXTURE_STORE, STUB_CTX)
      return opts.map((o) => ({ code: o.value }))
    }
    return null
  }
}

/**
 * Derive the SectionContext a page renders with, for one active perspective.
 * Identical control-flow to useFilterState (the gate + resolveDefaults + context.dims
 * projection) followed by SiteRenderer's scopeCtxByPerspective fold.
 */
function deriveCtx(
  schema:       FilterSchema,
  perspectives: Perspectives,
  modeOrder:    readonly string[],
  activeMode:   string,
): SectionContext {
  // URL state for a clean permalink of this perspective: only the param is set.
  const state: Record<string, string> = { mode: activeMode }

  const flatEntries = Object.values(schema.bars).flatMap((bar) =>
    Object.entries(bar.filters).map(([key, def]) => ({ key, def, barShowWhen: bar.showWhen })),
  )
  const flat = flatEntries.map(({ key, def }) => ({ key, def }))

  // The perspective axes + ownership (P4.5). For the legacy two-bar config
  // `perspectives` is undefined ⇒ axes are the modeOrder desugar (no scope) ⇒ ownership
  // is EMPTY ⇒ the gate reduces to the legacy barShowWhen branch exactly.
  const axes = parsePerspectiveAxes({ perspectives: perspectives as never, modeOrder, timeModeParam: 'mode' })
  const perspectiveState = { mode: activeMode }
  const ownership = perspectiveOwnedParamKeys(axes, perspectiveState)
  const ownsActive = ownership.active
  const ownsAny    = ownership.all

  // The default-resolution gate (useFilterState.ts).
  const defaultParams = flatEntries
    .filter(({ key, def, barShowWhen }) =>
      isAlwaysResolve(def) ||
      ownsActive.has(key) ||
      (!ownsAny.has(key) && (!barShowWhen || evalWhen(barShowWhen as never, state))),
    )
    .map(({ key, def }) => ({ key, def }))

  const getOptions = makeGetOptions(flat)
  const { dims: raw } = resolveDefaults(defaultParams as never, state, getOptions as never)

  // context.dims projection — autoParse + drop empties (the hook's regularDims).
  const regularDims: Record<string, DimVal> = {}
  for (const [dk, pk] of Object.entries(schema.context?.dims ?? {})) {
    const def = flat.find((p) => p.key === pk)?.def
    const parsed = def ? autoParse(def as never, raw[pk] ?? '') : raw[pk]
    if (parsed !== '' && parsed !== undefined) regularDims[dk] = parsed as DimVal
  }

  // ctx.timeMode = useModeContext(mode, modeOrder).current = state.mode || modeOrder[0].
  const ctxTimeMode = (state.mode && modeOrder.includes(state.mode) ? state.mode : modeOrder[0]) as never

  const base: SectionContext = { timeMode: ctxTimeMode, dims: regularDims, perspectiveState }

  // SiteRenderer's fold: scope ctx.dims by the active perspective's timeBinding.
  return scopeCtxByPerspective(base, axes, perspectiveState)
}

// ── Load the live migrated artifact ───────────────────────────────────────────

interface PageEntry { slug: string; config: { filterSchema?: FilterSchema; modeOrder?: string[]; perspectives?: Perspectives; children?: unknown[] } }
interface Artifact { pages: PageEntry[] }

const PAGES = ['accounts', 'gdp', 'regional'] as const
const PERSPECTIVES = ['year', 'range'] as const
const LOCALES = ['ka', 'en'] as const   // codes are locale-invariant; both asserted

describe('FF-SNAPSHOT-VIEW-EQUIV (P5) — geostat perspective migration is byte-identical', () => {
  let migrated: Record<string, PageEntry['config']>

  beforeAll(() => {
    const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, 'utf8')) as Artifact
    migrated = {}
    for (const p of artifact.pages) {
      if (p.config?.filterSchema) migrated[p.slug] = p.config
    }
  })

  it('the migrated artifact has collapsed each page to ONE bar + declared perspectives + dropped effects/timeMode', () => {
    for (const slug of PAGES) {
      const cfg = migrated[slug]
      expect(Object.keys(cfg.filterSchema!.bars)).toEqual(['bar'])         // ONE bar
      expect(cfg.perspectives).toBeDefined()                              // perspectives declared
      expect(Object.keys(cfg.perspectives as object)).toEqual(['mode'])   // keyed by the existing URL param
      expect((cfg as { effects?: unknown }).effects).toBeUndefined()      // effects removed
      expect(cfg.filterSchema!.context?.timeMode).toBeUndefined()         // timeMode binding removed
      // the single bar carries no showWhen (the collapse removed bar-visibility gating)
      expect(cfg.filterSchema!.bars.bar.showWhen).toBeUndefined()
    }
  })

  // ── THE BYTE-IDENTICAL PROOF ────────────────────────────────────────────────

  for (const slug of PAGES) {
    for (const perspective of PERSPECTIVES) {
      for (const locale of LOCALES) {
        it(`${slug} · ${perspective} · ${locale} — migrated sectionCtx === legacy sectionCtx (row-identical)`, () => {
          const legacy = LEGACY_FILTER_SCHEMAS[slug]
          const mig    = migrated[slug]

          const legacyCtx = deriveCtx(
            legacy.filterSchema as FilterSchema,
            undefined,                       // legacy: no perspectives ⇒ modeOrder desugar, empty ownership
            legacy.modeOrder as readonly string[],
            perspective,
          )
          const migCtx = deriveCtx(
            mig.filterSchema as FilterSchema,
            mig.perspectives,
            mig.modeOrder as readonly string[],
            perspective,
          )

          // ctx.dims byte-identical (the OLAP coordinate every resolver reads).
          expect(migCtx.dims).toEqual(legacyCtx.dims)
          // ctx.timeMode byte-identical (the kpi-strip + KpiSpec.mode partition reads it).
          expect(migCtx.timeMode).toEqual(legacyCtx.timeMode)
        })
      }
    }
  }

  // ── Parity behaviours — the migrated config alone, asserted explicitly ───────

  it('year perspective pins ctx.dims.time to the latest year; fromYear/toYear UNSET', () => {
    for (const slug of PAGES) {
      const cfg = migrated[slug]
      const ctx = deriveCtx(cfg.filterSchema as FilterSchema, cfg.perspectives, cfg.modeOrder as readonly string[], 'year')
      expect(ctx.dims.time).toBe(2025)          // pick:last over [2020..2025]
      expect(ctx.dims.fromYear).toBeUndefined() // owned by the inactive range perspective ⇒ suppressed
      expect(ctx.dims.toYear).toBeUndefined()
    }
  })

  it('range perspective leaves ctx.dims.time UNSET (FULL SPAN); fromYear/toYear SET = the CAGR window', () => {
    for (const slug of PAGES) {
      const cfg = migrated[slug]
      const ctx = deriveCtx(cfg.filterSchema as FilterSchema, cfg.perspectives, cfg.modeOrder as readonly string[], 'range')
      // time unset ⇒ the dynamics timeseries renders every year (the parity fix).
      expect(ctx.dims.time).toBeUndefined()
      // the window bounds the CAGR/share KPIs read via {$ctx:fromYear}/{$ctx:toYear}.
      // String '2020' (not number) — byte-identical to the legacy range-bar select
      // value (the representation-preserving echo write, see writeBound).
      expect(ctx.dims.fromYear).toBe('2020')    // pick:first
      expect(ctx.dims.toYear).toBeDefined()
    }
  })

  it('regional preserves the sector "_T" default + the always-resolved span window in BOTH perspectives', () => {
    const cfg = migrated['regional']
    for (const perspective of PERSPECTIVES) {
      const ctx = deriveCtx(cfg.filterSchema as FilterSchema, cfg.perspectives, cfg.modeOrder as readonly string[], perspective)
      expect(ctx.dims.sector).toBe('_T')        // sector default, both perspectives
      expect(ctx.dims.spanFrom).toBeDefined()   // alwaysResolve span — page-level, both perspectives
      expect(ctx.dims.spanTo).toBeDefined()
    }
  })

  // ── NON-VACUOUS — the two perspectives genuinely differ ──────────────────────

  it('NON-VACUOUS — year and range produce DIFFERENT ctx (an accidental no-op gate would fail here)', () => {
    for (const slug of PAGES) {
      const cfg = migrated[slug]
      const year  = deriveCtx(cfg.filterSchema as FilterSchema, cfg.perspectives, cfg.modeOrder as readonly string[], 'year')
      const range = deriveCtx(cfg.filterSchema as FilterSchema, cfg.perspectives, cfg.modeOrder as readonly string[], 'range')
      expect(year.dims.time).toBeDefined()
      expect(range.dims.time).toBeUndefined()
      expect(year.dims).not.toEqual(range.dims)
      expect(year.timeMode).toBe('year')
      expect(range.timeMode).toBe('range')
    }
  })

  // ── The perspective-is gate verdict matches the legacy eq-on-mode verdict ────

  it('the perspective-is node gates produce the SAME visibility verdict as the legacy eq-on-mode gates', () => {
    // P2 proved param-less perspective-is ≡ eq-on-mode; here we re-confirm on the live
    // migrated gates that each one is visible in exactly its own perspective.
    const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, 'utf8')) as Artifact
    const gates: { perspective: string }[] = []
    const collect = (n: unknown): void => {
      if (Array.isArray(n)) return void n.forEach(collect)
      if (!n || typeof n !== 'object') return
      const o = n as Record<string, unknown>
      const vw = (o.view as Record<string, unknown> | undefined)?.visibleWhen as Record<string, unknown> | undefined
      if (vw && vw.op === 'perspective-is') gates.push({ perspective: vw.perspective as string })
      for (const v of Object.values(o)) collect(v)
    }
    for (const p of artifact.pages) collect(p.config?.children)
    expect(gates.length).toBe(11)   // 3 accounts + 4 gdp + 4 regional

    for (const g of gates) {
      const expr = { op: 'perspective-is', perspective: g.perspective } as never
      expect(evalVisibility(expr, {}, { mode: g.perspective })).toBe(true)
      const other = g.perspective === 'year' ? 'range' : 'year'
      expect(evalVisibility(expr, {}, { mode: other })).toBe(false)
    }
  })
})

// ══ static→canonical reconciliation ACL (item 0055, FF-DATA-PARITY) ════════════
//
//  The golden fixtures (0054) were captured from the STATIC era, whose codelists
//  pre-date the canonical DSD migration. The live provisioning config now queries
//  the POST-migration CANONICAL codes (authority: DATA/canonical/*.xlsx codelist
//  sheets, vintage 2026-06-26). So a fact the config asks for by canonical code is
//  not found in the golden store keyed by the old static code — gdp panels + every
//  KPI render 0 even though the *values* are correct ("data as it was").
//
//  adaptGolden() is the Anti-Corruption Layer between the frozen static fixture and
//  the canonical DSD: it RE-KEYS golden rows into the canonical scheme and
//  synthesizes the aggregate members (`_T`, multi-approach GDP total) the real store
//  carries explicitly — copying every VALUE verbatim, mutating nothing. The parity
//  harness applies it ONLY in buildStores() (the store the pipeline reads);
//  loadGolden()/goldenValue() keep reading the RAW fixture by static coords, so the
//  parity EXPECTED is the untouched source and a match proves reproduction, never
//  self-agreement.
//
//  Every alias is authorised by the canonical workbook codelist sheet
//  (CL_APPROACH / CL_MEASURE / CL_ACCOUNT / CL_GEO / CL_SECTOR), matched to the
//  golden classifier by economic identity (English name / region / sector).
//
import type { GoldenDomain, GoldenFixture } from './parity-harness'

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── GDP: static measure → { canonical measure, approach, contributionRole } ────
//  In the static era `approach` was an attribute of the measure classifier; the
//  canonical DSD promotes it to a real 4th fact dim (PROD/EXP/INC/_Z) and adds
//  contribution_role (add/subtract/total). geo was implicit (national) → stamp 'GE'.
interface GdpAlias { measure: string; approach: string; role?: string }
const GDP_MEASURE_ALIAS: Record<string, GdpAlias> = {
  // production approach (CL_MEASURE order 1–5)
  GDP_AGRI:     { measure: 'agriculture-forestry-and-fishing', approach: 'PROD', role: 'add' },
  GDP_IND:      { measure: 'manufacturing',                    approach: 'PROD', role: 'add' },
  GDP_CON:      { measure: 'construction',                     approach: 'PROD', role: 'add' },
  GDP_SVC:      { measure: 'services',                         approach: 'PROD', role: 'add' },
  GDP_NET_TAX:  { measure: 'net-taxes',                        approach: 'PROD', role: 'add' },
  // expenditure approach (order 6–9)
  C:            { measure: 'final-consumption-expenditure',    approach: 'EXP',  role: 'add' },
  I_GFCF:       { measure: 'gross-capital-formation',          approach: 'EXP',  role: 'add' },
  X:            { measure: 'exports-of-goods-and-services',    approach: 'EXP',  role: 'add' },
  M:            { measure: 'imports-of-goods-and-services',    approach: 'EXP',  role: 'subtract' },
  // income approach (order 11–14)
  D1:           { measure: 'compensation-of-emploees',         approach: 'INC',  role: 'add' },
  NET_TAX_PROD: { measure: 'net-taxes_2',                      approach: 'INC',  role: 'add' },
  OS_GROSS:     { measure: 'gross-operating-surplus',          approach: 'INC',  role: 'add' },
  MIXED_INC:    { measure: 'gross-mixed-income',               approach: 'INC',  role: 'add' },
  // not-applicable approach (headline series)
  GDP_PER_CAPITA: { measure: 'gdp-per-capita-usd',             approach: '_Z' },
  GDP_GROWTH:     { measure: 'real-gdp-growth-rates',          approach: '_Z' },
  // NB: GDP (total) is handled specially — the canonical DSD replicates the grand
  //     total under _Z (role ''), EXP (role total) AND INC (role total).
  // NB: GDP_DEFLATOR / NOE_SHARE / GFCF_* have NO home in the canonical GDP DSD
  //     (no investment/noe/deflator measures) and the config never queries them —
  //     they are not projected into the canonical store.
}
const GDP_TOTAL_CANON = 'gross-domestic-product-at-current-prices'

// ── accounts: static account → canonical account (CL_ACCOUNT) ──────────────────
//  Measures (P1/P2/B1G/B5G/B6G/B8G/B9/…) and side (R/U) already align; only the
//  ACCOUNT dim changed identity in migration.
const ACCOUNT_ALIAS: Record<string, string> = {
  production:     'production-account',
  income_gen:     'generation-of-income-account',
  primary_dist:   'allocation-of-primary-income-account',
  secondary_dist: 'secondary-distribution-of-income-account',
  use_of_income:  'use-of-disposable-income-account',
  capital:        'capital-account',
}

// ── regional: static int geo/sector → canonical code, matched by identity ──────
//  golden geo 1..11 (tbilisi..shida_kartli) → canonical R2..R12 (CL_GEO; R = int+1,
//  slot 1 is the _T national total). golden sector 1..9 → canonical sector codes
//  (CL_SECTOR, matched by activity name — canonical keeps sparse NACE-style codes).
const GEO_ALIAS: Record<string, string> = {
  '1': 'R2', '2': 'R3', '3': 'R4', '4': 'R5', '5': 'R6', '6': 'R7',
  '7': 'R8', '8': 'R9', '9': 'R10', '10': 'R11', '11': 'R12',
}
const SECTOR_ALIAS: Record<string, string> = {
  '1': '1', '2': '3', '3': '6', '4': '7', '5': '8', '6': '12', '7': '15', '8': '16', '9': 'OTH',
}

// Re-key a display/classifier map ({ oldKey: entry }) by an alias, keeping entries.
function rekeyMap(m: Record<string, any> | undefined, alias: Record<string, string>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(m ?? {})) {
    const nk = alias[k]
    if (nk) out[nk] = v
  }
  return out
}

function adaptGdp(g: GoldenFixture): GoldenFixture {
  const facts: Array<Record<string, any>> = []
  for (const f of g.facts) {
    if (f.measure === 'GDP') {
      // grand total: canonical replicates it under _Z, EXP(total) and INC(total).
      const base = { time: f.time, measure: GDP_TOTAL_CANON, geo: 'GE', value: f.value, obsStatus: f.obsStatus }
      facts.push({ ...base, approach: '_Z' })
      facts.push({ ...base, approach: 'EXP', contributionRole: 'total' })
      facts.push({ ...base, approach: 'INC', contributionRole: 'total' })
      continue
    }
    const a = GDP_MEASURE_ALIAS[f.measure]
    if (!a) continue // no canonical home (deflator/noe/gfcf breakdown) — not projected
    facts.push({
      time: f.time, measure: a.measure, geo: 'GE', approach: a.approach,
      value: f.value, obsStatus: f.obsStatus,
      ...(a.role ? { contributionRole: a.role } : {}),
    })
  }
  const dispMeasure: Record<string, any> = {}
  for (const [code, entry] of Object.entries(g.display.measure ?? {})) {
    if (code === 'GDP') { dispMeasure[GDP_TOTAL_CANON] = entry; continue }
    const a = GDP_MEASURE_ALIAS[code]
    if (a) dispMeasure[a.measure] = entry
  }
  return { facts, classifiers: g.classifiers, display: { ...g.display, measure: dispMeasure } }
}

function adaptAccounts(g: GoldenFixture): GoldenFixture {
  const facts: Array<Record<string, any>> = g.facts.map((f) => ({ ...f, account: ACCOUNT_ALIAS[f.account] ?? f.account }))
  // classifiers.account carries the account code; classifiers.aggregates maps each
  // measure → its owning account. Re-key both so the SNA pivot's $cl joins hold.
  const account = (g.classifiers.account ?? []).map((r: any) => ({ ...r, code: ACCOUNT_ALIAS[r.code] ?? r.code }))
  const aggregates = (g.classifiers.aggregates ?? []).map((r: any) => ({ ...r, account: ACCOUNT_ALIAS[r.account] ?? r.account }))
  const dispAccount = rekeyMap(g.display.account, ACCOUNT_ALIAS)
  return { facts, classifiers: { ...g.classifiers, account, aggregates }, display: { ...g.display, account: dispAccount } }
}

function adaptRegional(g: GoldenFixture): GoldenFixture {
  // 1) re-key geo/sector identity on every fact
  const rekeyed: Array<Record<string, any>> = g.facts.map((f) => ({
    ...f,
    geo: GEO_ALIAS[String(f.geo)] ?? f.geo,
    sector: SECTOR_ALIAS[String(f.sector)] ?? f.sector,
  }))
  // 2) synthesize the explicit `_T` aggregates the real store carries (verified in
  //    DATA/canonical/REGIONAL_GVA: it materialises a per-geo sector-total row
  //    (geo=Rk, sector=_T) and one grand total (geo=_T, sector=_T); there is NO
  //    geo-marginal-per-specific-sector row). We SUM the golden specifics the same
  //    way, so the totals equal the true national/regional values "as it was" and the
  //    config's geo:'_T'/sector:'_T' pins resolve to real members (not a pipe rollup).
  const perGeo = new Map<string, { geo: any; time: any; value: number }>()
  const grand = new Map<string, { time: any; value: number }>()
  for (const f of rekeyed) {
    const gk = `${f.geo}|${f.time}`
    const pg = perGeo.get(gk) ?? { geo: f.geo, time: f.time, value: 0 }
    pg.value += Number(f.value); perGeo.set(gk, pg)
    const gr = grand.get(`${f.time}`) ?? { time: f.time, value: 0 }
    gr.value += Number(f.value); grand.set(`${f.time}`, gr)
  }
  const totals: Array<Record<string, any>> = []
  for (const p of perGeo.values()) totals.push({ time: p.time, geo: p.geo, sector: '_T', measure: 'GVA', value: p.value })
  for (const r of grand.values()) totals.push({ time: r.time, geo: '_T', sector: '_T', measure: 'GVA', value: r.value })
  const geoDisp = { ...rekeyMap(g.display.geo, GEO_ALIAS), _T: { label: 'Georgia', color: '#888888' } }
  const sectorDisp = { ...rekeyMap(g.display.sector, SECTOR_ALIAS), _T: { label: 'Total', fullLabel: 'All activities', color: '#888888', sectorOrder: -1 } }
  // Re-key the classifiers too, else the store's DimResolver (built from them) still
  // maps the STATIC codes: golden sector code '_T'→id 0 whose descendants are the old
  // int ids [0..9], so a `sector:'_T'` filter would expand to leaves that match none
  // of the re-keyed facts (regional KPIs render 0). Emit FLAT canonical codelists with
  // `_T` as its OWN leaf — matching the explicit `_T` rows synthesized above (the real
  // store carries `_T` as a materialised member, not a rollup parent).
  const geoCl = [...Object.values(GEO_ALIAS).map((code) => ({ code })), { code: '_T' }]
  const sectorCl = [...Object.values(SECTOR_ALIAS).map((code) => ({ code })), { code: '_T' }]
  return {
    facts: [...rekeyed, ...totals],
    classifiers: { ...g.classifiers, geo: geoCl, sector: sectorCl },
    display: { ...g.display, geo: geoDisp, sector: sectorDisp },
  }
}

// ── adaptGolden — the ACL entry point. Never mutates the input fixture. ─────────
export function adaptGolden(domain: GoldenDomain, g: GoldenFixture): GoldenFixture {
  switch (domain) {
    case 'gdp': return adaptGdp(g)
    case 'accounts': return adaptAccounts(g)
    case 'regional': return adaptRegional(g)
    default: return g
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

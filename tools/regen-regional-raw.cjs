// Regenerates src/data/regional/raw.ts from src/assets/region.xlsx.
//
// Output shape — SDMX Codelist + Kimball star schema (co-located per
// SDMX / Cube.dev / LookML / dbt standard):
//   RegionalFact                 flat {time, geo, sector, measure, value} with surrogate ids
//   REGIONAL_CLASSIFIERS.geo     id → { code, parent?, label, color }
//   REGIONAL_CLASSIFIERS.sector  id → { code, parent?, label, fullLabel, color, sectorOrder }
//   REGIONAL_CLASSIFIERS.time    id → { code }                         (SDMX CL_TIME_PERIOD)
//   REGIONAL_FACTS               RegionalFact[]
//   REGIONAL_TIME_CATALOGUE      readonly number[]  (derived literal for titles/defaults)
//
// Engine reads only `code` + `parent` from each entry; the rest is an
// open attribute bag consumed by configs via `lookup from:` and by filter
// derive ops via `source: codelist.items`.

'use strict'
const fs   = require('fs')
const path = require('path')
const XLSX = require('xlsx')

const EXCEL_PATH = path.join(__dirname, '../src/assets/region.xlsx')
const RAW_PATH   = path.join(__dirname, '../src/data/regional/raw.ts')

// ── Excel code maps ──────────────────────────────────────────────────

const GEO_XLSX_MAP = {
  2:  'tbilisi', 3:  'adjara', 4:  'guria',   5:  'imereti',
  6:  'kakheti', 7:  'mtskheta', 8:  'racha', 9:  'samegrelo',
  10: 'samtskhe', 11: 'kvemo_kartli', 12: 'shida_kartli',
}

const SECTOR_XLSX_MAP = {
  1:    'AGRI',  3:  'MANUF', 6:  'CONST', 7:  'TRADE',
  8:    'TRANS', 12: 'REAL',  15: 'GOV',   16: 'EDU',
  null: 'OTHER',
}

// ── Codelists — id → { code, parent?, …display attrs } ─────────────────
//
// Co-located (SDMX/Cube/LookML). Rollup id 0 is the virtual root — never
// appears in facts, resolves to all descendant leaves for query matching.

const GEO_IDS = {
  tbilisi: 1, adjara: 2, guria: 3, imereti: 4, kakheti: 5,
  mtskheta: 6, racha: 7, samegrelo: 8, samtskhe: 9,
  kvemo_kartli: 10, shida_kartli: 11,
}
const SECTOR_IDS = {
  AGRI: 1, MANUF: 2, CONST: 3, TRADE: 4, TRANS: 5,
  REAL: 6, GOV: 7, EDU: 8, OTHER: 9,
}
const GEO_ROLLUP_ID    = 0
const SECTOR_ROLLUP_ID = 0

// Display attrs co-located with code definitions (SDMX Code annotations /
// Cube.dev dimension meta / LookML dimension label).

const GEO_DISPLAY = {
  total:        { label: 'საქართველო სულ',              color: '#1A365D' },
  tbilisi:      { label: 'თბილისი',                       color: '#0080BE' },
  adjara:       { label: 'აჭარის ა.რ.',                    color: '#00A896' },
  guria:        { label: 'გურია',                          color: '#4ECDC4' },
  imereti:      { label: 'იმერეთი',                        color: '#7B6CF6' },
  kakheti:      { label: 'კახეთი',                         color: '#F4A261' },
  mtskheta:     { label: 'მცხეთა-მთიანეთი',               color: '#E76F51' },
  racha:        { label: 'რაჭა-ლეჩხ. და ქვ. სვანეთი',    color: '#2A9D8F' },
  samegrelo:    { label: 'სამეგრელო-ზემო სვანეთი',        color: '#6B7B8D' },
  samtskhe:     { label: 'სამცხე-ჯავახეთი',               color: '#95C4D4' },
  kvemo_kartli: { label: 'ქვემო ქართლი',                  color: '#D4845A' },
  shida_kartli: { label: 'შიდა ქართლი',                   color: '#A8D5B5' },
}

const SECTOR_DISPLAY = {
  _T:    { label: 'სულ',         fullLabel: 'სულ დამატებული ღირებულება',                         color: '#1A365D', sectorOrder: -1 },
  AGRI:  { label: 'სოფ. მეურ.',  fullLabel: 'სოფლის, სატყეო და თევზის მეურნეობა',                color: '#4CAF50', sectorOrder: 0 },
  MANUF: { label: 'მრეწველობა',   fullLabel: 'დამამუშავებელი მრეწველობა',                          color: '#FF9800', sectorOrder: 1 },
  CONST: { label: 'მშენებლობა',   fullLabel: 'მშენებლობა',                                          color: '#9E9E9E', sectorOrder: 2 },
  TRADE: { label: 'ვაჭრობა',      fullLabel: 'საბითუმო და საცალო ვაჭრობა; ავტ. და მოტ. რემ.',      color: '#2196F3', sectorOrder: 3 },
  TRANS: { label: 'ტრანსპ.',      fullLabel: 'ტრანსპორტი და დასაწყობება',                           color: '#9C27B0', sectorOrder: 4 },
  REAL:  { label: 'უძრავი ქონება', fullLabel: 'უძრავ ქონებასთან დაკავშირებული საქმ.',                color: '#F44336', sectorOrder: 5 },
  GOV:   { label: 'სახ. მმართვ.',  fullLabel: 'სახელმწიფო მმართველობა და თავდაცვა; სავ. სოც. უსაფ.', color: '#607D8B', sectorOrder: 6 },
  EDU:   { label: 'განათლება',    fullLabel: 'განათლება',                                            color: '#795548', sectorOrder: 7 },
  OTHER: { label: 'სხვა',         fullLabel: 'სხვა დანარჩენი',                                       color: '#BDBDBD', sectorOrder: 8 },
}

// ── Parse region.xlsx ─────────────────────────────────────────────────

const wb   = XLSX.readFile(EXCEL_PATH)
const ws   = wb.Sheets['მონაცემები']
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })

const headerRowIdxs = rows.map((r, i) => r[0] === 'name' ? i : -1).filter(i => i >= 0)
const years         = rows[headerRowIdxs[0]].slice(2).filter(v => typeof v === 'number')

const facts = []

for (let hi = 1; hi < headerRowIdxs.length; hi++) {
  const headerIdx = headerRowIdxs[hi]
  let geoCode = null
  for (let ri = headerIdx - 1; ri >= headerIdx - 3; ri--) {
    const r = rows[ri]
    if (r && typeof r[0] === 'number' && GEO_XLSX_MAP[r[0]]) { geoCode = GEO_XLSX_MAP[r[0]]; break }
  }
  if (!geoCode) continue

  const sectorStart = headerIdx + 1
  const sectorEnd   = hi + 1 < headerRowIdxs.length ? headerRowIdxs[hi + 1] - 1 : rows.length - 1

  for (let ri = sectorStart; ri <= sectorEnd; ri++) {
    const row = rows[ri]
    if (!row || row[0] === 'name' || typeof row[0] !== 'string') continue
    const sectorXlsxId = row[1] ?? null
    const sectorCode   = SECTOR_XLSX_MAP[sectorXlsxId]
    if (!sectorCode) continue
    years.forEach((year, yi) => {
      const value = row[2 + yi]
      if (typeof value === 'number') {
        facts.push({
          time:    year,
          geo:     GEO_IDS[geoCode],
          sector:  SECTOR_IDS[sectorCode],
          measure: 'GVA',
          value:   Math.round(value * 100) / 100,
        })
      }
    })
  }
}

// ── Emission ──────────────────────────────────────────────────────────

const j = (v) => JSON.stringify(v)

// emit STRUCTURAL classifier — code + parent only (no display attrs).
function emitClassifier(idMap, rollupId, rollupCode) {
  const entries = []
  entries.push(`    ${j(String(rollupId))}: ${j({ code: rollupCode })}`)
  for (const [code, id] of Object.entries(idMap)) {
    entries.push(`    ${j(String(id))}: ${j({ code, parent: rollupId })}`)
  }
  return `{\n${entries.join(',\n')},\n  }`
}

// emit DisplayMap — id → { label, color, … }. Empty map = `{}`.
// Same id space as classifier (id keys uniform across DataBundle).
function emitDisplayMap(idMap, rollupId, rollupCode, displayMap) {
  const entries = []
  const rollupDisplay = displayMap[rollupCode]
  if (rollupDisplay && Object.keys(rollupDisplay).length > 0) {
    entries.push(`    ${j(String(rollupId))}: ${j(rollupDisplay)}`)
  }
  for (const [code, id] of Object.entries(idMap)) {
    const disp = displayMap[code]
    if (disp && Object.keys(disp).length > 0) entries.push(`    ${j(String(id))}: ${j(disp)}`)
  }
  if (entries.length === 0) return `{}`
  return `{\n${entries.join(',\n')},\n  }`
}

const geoClassifier    = emitClassifier(GEO_IDS,    GEO_ROLLUP_ID,    'total')
const sectorClassifier = emitClassifier(SECTOR_IDS, SECTOR_ROLLUP_ID, '_T')
const geoDisplay       = emitDisplayMap(GEO_IDS,    GEO_ROLLUP_ID,    'total', GEO_DISPLAY)
const sectorDisplay    = emitDisplayMap(SECTOR_IDS, SECTOR_ROLLUP_ID, '_T',    SECTOR_DISPLAY)
const factLines        = facts.map((f) => `  ${j(f)}`).join(',\n')
const timeCatalogue    = [...new Set(facts.map((f) => f.time))].sort((a, b) => a - b)

// Time classifier — self-identifying (id === code === year). SDMX CL_TIME_PERIOD pattern.
const timeEntries      = timeCatalogue.map((y) => `    ${j(String(y))}: ${j({ code: y })}`).join(',\n')
const timeClassifier   = `{\n${timeEntries},\n  }`

const rawSrc =
`// AUTO-GENERATED — do not edit by hand.
// Source: src/assets/region.xlsx
// Generator: scripts/regen-regional-raw.cjs
//
// DataBundle pattern (universal contract for every dataset):
//   facts        — Observation[] with surrogate ids on classifier-backed dims
//   classifiers  — STRUCTURAL only: id → { code, parent? }
//                  Engine reads this for code↔id translation + rollup expansion.
//   display      — UI overlay per dim, id-keyed (uniform with classifier):
//                  id → { label, color, fullLabel, … }
//                  Engine never reads it; resolveDisplayRef joins it with
//                  the classifier (id → code) at consumer-facing { $d } refs.
//
// SDMX HierarchicalCodelist parity. Display split for i18n / theming swap.

import type { Classifier, DisplayMap } from '@geostat/engine'

export interface RegionalFact {
  time:    number
  geo:     number
  sector:  number
  measure: string
  value:   number
}

export const REGIONAL_CLASSIFIERS: Record<'geo' | 'sector' | 'time', Classifier> = {
  geo: ${geoClassifier},
  sector: ${sectorClassifier},
  time: ${timeClassifier},
}

export const REGIONAL_DISPLAY: Record<'geo' | 'sector' | 'time', DisplayMap> = {
  geo: ${geoDisplay},
  sector: ${sectorDisplay},
  time: {},
}

export const REGIONAL_FACTS: RegionalFact[] = [
${factLines},
]
`

fs.writeFileSync(RAW_PATH, rawSrc, 'utf8')

console.log(`✓ Regenerated ${path.relative(process.cwd(), RAW_PATH)}`)
console.log(`  ${facts.length} facts, ${timeCatalogue.length} years`)
console.log(`  geo classifier:    ${Object.keys(GEO_IDS).length} leaves + 1 rollup`)
console.log(`  sector classifier: ${Object.keys(SECTOR_IDS).length} leaves + 1 rollup`)
// scripts/gen-regional.cjs — Generate src/data/regional/raw.ts from Excel
'use strict';
const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

const wb   = XLSX.readFile(path.resolve(__dirname, '../src/assets/region.xlsx'));
const ws   = wb.Sheets['მონაცემები'];
const raw  = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

const YEARS = [2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024];

// Region meta: Excel numeric id → { geoId, name, color }
const REGION_META = {
  2:  { geo: 'tbilisi',      name: 'თბილისი',                    color: '#0080BE' },
  3:  { geo: 'adjara',       name: 'აჭარის ა.რ.',                color: '#00A896' },
  4:  { geo: 'guria',        name: 'გურია',                      color: '#4ECDC4' },
  5:  { geo: 'imereti',      name: 'იმერეთი',                    color: '#7B6CF6' },
  6:  { geo: 'kakheti',      name: 'კახეთი',                     color: '#F4A261' },
  7:  { geo: 'mtskheta',     name: 'მცხეთა-მთიანეთი',            color: '#E76F51' },
  8:  { geo: 'racha',        name: 'რაჭა-ლეჩხ. და ქვ. სვანეთი', color: '#2A9D8F' },
  9:  { geo: 'samegrelo',    name: 'სამეგრელო-ზემო სვანეთი',     color: '#6B7B8D' },
  10: { geo: 'samtskhe',     name: 'სამცხე-ჯავახეთი',            color: '#95C4D4' },
  11: { geo: 'kvemo_kartli', name: 'ქვემო ქართლი',               color: '#D4845A' },
  12: { geo: 'shida_kartli', name: 'შიდა ქართლი',                color: '#A8D5B5' },
};

// Sector meta: Excel sector id → { code, shortLabel, fullLabel, order, color }
const SECTOR_META = {
  1:  { code: 'AGRI',  shortLabel: 'სოფ. მეურ.',      fullLabel: 'სოფლის, სატყეო და თევზის მეურნეობა',                                          order: 0, color: '#4CAF50' },
  3:  { code: 'MANUF', shortLabel: 'მრეწველობა',       fullLabel: 'დამამუშავებელი მრეწველობა',                                                    order: 1, color: '#FF9800' },
  6:  { code: 'CONST', shortLabel: 'მშენებლობა',       fullLabel: 'მშენებლობა',                                                                   order: 2, color: '#9E9E9E' },
  7:  { code: 'TRADE', shortLabel: 'ვაჭრობა',          fullLabel: 'საბითუმო და საცალო ვაჭრობა; ავტ. და მოტ. რემ.',                               order: 3, color: '#2196F3' },
  8:  { code: 'TRANS', shortLabel: 'ტრანსპ.',          fullLabel: 'ტრანსპორტი და დასაწყობება',                                                    order: 4, color: '#9C27B0' },
  12: { code: 'REAL',  shortLabel: 'უძრავი ქონება',    fullLabel: 'უძრავ ქონებასთან დაკავშირებული საქმ.',                                         order: 5, color: '#F44336' },
  15: { code: 'GOV',   shortLabel: 'სახ. მმართვ.',     fullLabel: 'სახელმწიფო მმართველობა და თავდაცვა; სავ. სოც. უსაფ.',                         order: 6, color: '#607D8B' },
  16: { code: 'EDU',   shortLabel: 'განათლება',         fullLabel: 'განათლება',                                                                    order: 7, color: '#795548' },
  '':  { code: 'OTHER', shortLabel: 'სხვა',             fullLabel: 'სხვა დანარჩენი',                                                               order: 8, color: '#BDBDBD' },
};

// ── 1. Parse GVA totals (rows 2-12) ──────────────────────────────────
const gvaByGeoYear = {};  // { geo: { year: value } }
const gvaRows = raw.slice(2, 13);
for (const row of gvaRows) {
  const excelId = row[1];
  const meta    = REGION_META[excelId];
  if (!meta) continue;
  gvaByGeoYear[meta.geo] = {};
  YEARS.forEach((y, i) => {
    gvaByGeoYear[meta.geo][y] = Math.round(row[2 + i] * 100) / 100;
  });
}

// ── 2. Parse sector data (sections 2-12) ─────────────────────────────
const sectorByGeoYear = {};  // { geo: { sector: { year: value } } }

let currentRegionId = null;
for (let i = 0; i < raw.length; i++) {
  const row = raw[i];
  // Section marker rows: row[0] is number 2-12, row[1] is '' or same number
  if (typeof row[0] === 'number' && row[0] >= 2 && row[0] <= 12 && row[2] === '') {
    currentRegionId = row[0];
    const geo = REGION_META[currentRegionId]?.geo;
    if (geo && !sectorByGeoYear[geo]) sectorByGeoYear[geo] = {};
    continue;
  }
  // Header row
  if (row[0] === 'name') continue;
  // Sector data rows
  if (currentRegionId && row[0] !== '' && row[0] !== 1) {
    const excelSectorId = row[1];
    const sectorMeta    = SECTOR_META[excelSectorId] ?? SECTOR_META[''];
    const geo           = REGION_META[currentRegionId]?.geo;
    if (!geo) continue;
    if (!sectorByGeoYear[geo][sectorMeta.code]) sectorByGeoYear[geo][sectorMeta.code] = {};
    YEARS.forEach((y, idx) => {
      const val = row[2 + idx];
      const cur = sectorByGeoYear[geo][sectorMeta.code][y] ?? 0;
      sectorByGeoYear[geo][sectorMeta.code][y] = Math.round((cur + (typeof val === 'number' ? val : 0)) * 100) / 100;
    });
  }
}

// ── 3. Build observations ─────────────────────────────────────────────
const observations = [];

// National totals per year (for pct computation)
const nationalByYear = {};
for (const y of YEARS) {
  nationalByYear[y] = Object.values(gvaByGeoYear).reduce((s, regionYears) => s + (regionYears[y] ?? 0), 0);
}

// GVA_TOTAL observations
for (const [excelId, meta] of Object.entries(REGION_META)) {
  const geo = meta.geo;
  for (const y of YEARS) {
    const value = gvaByGeoYear[geo]?.[y] ?? 0;
    const pct   = nationalByYear[y] ? Math.round((value / nationalByYear[y]) * 1000) / 10 : 0;
    observations.push({
      time: y, geo, measure: 'GVA_TOTAL', value, pct,
      label: meta.name, color: meta.color,
    });
    // GVA_SHARE — % of national total, stored as separate measure for KpiSpec val() lookup
    observations.push({
      time: y, geo, measure: 'GVA_SHARE', value: pct,
      label: meta.name, color: meta.color,
    });
  }
}

// GVA_GROWTH observations (YoY%, from 2011)
for (const [excelId, meta] of Object.entries(REGION_META)) {
  const geo = meta.geo;
  for (let i = 1; i < YEARS.length; i++) {
    const y    = YEARS[i];
    const prev = gvaByGeoYear[geo]?.[YEARS[i-1]] ?? 0;
    const cur  = gvaByGeoYear[geo]?.[y] ?? 0;
    const growth = prev ? Math.round(((cur / prev - 1) * 100) * 10) / 10 : 0;
    observations.push({
      time: y, geo, measure: 'GVA_GROWTH', value: growth,
      label: meta.name, color: meta.color,
    });
  }
}

// GVA_SECTOR observations
for (const [excelId, regionMeta] of Object.entries(REGION_META)) {
  const geo = regionMeta.geo;
  for (const [sectorCode, sectorMeta] of Object.entries(SECTOR_META)) {
    if (sectorCode === '') continue; // handled as OTHER
    const meta = sectorMeta;
    for (const y of YEARS) {
      const value   = sectorByGeoYear[geo]?.[meta.code]?.[y] ?? 0;
      const total   = gvaByGeoYear[geo]?.[y] ?? 1;
      const pct     = total ? Math.round((value / total) * 1000) / 10 : 0;
      if (value === 0) continue; // skip zero observations
      observations.push({
        time: y, geo, measure: 'GVA_SECTOR', sector: meta.code, sectorOrder: meta.order,
        value, pct,
        label: meta.shortLabel, fullLabel: meta.fullLabel, color: meta.color,
        regionColor: regionMeta.color,
      });
    }
  }
  // OTHER sector
  const otherMeta = SECTOR_META[''];
  for (const y of YEARS) {
    const value = sectorByGeoYear[geo]?.[otherMeta.code]?.[y] ?? 0;
    const total = gvaByGeoYear[geo]?.[y] ?? 1;
    const pct   = total ? Math.round((value / total) * 1000) / 10 : 0;
    if (value === 0) continue;
    observations.push({
      time: y, geo, measure: 'GVA_SECTOR', sector: 'OTHER', sectorOrder: 8,
      value, pct,
      label: 'სხვა', fullLabel: 'სხვა დანარჩენი', color: '#BDBDBD',
      regionColor: regionMeta.color,
    });
  }
}

// ── 4. Emit TypeScript ────────────────────────────────────────────────
const lines = [
  '// AUTO-GENERATED — do not edit by hand.',
  '// Source: src/assets/region.xlsx  (Geostat regional accounts)',
  '// Generator: scripts/gen-regional.cjs',
  '//',
  '// Observation measures:',
  '//   GVA_TOTAL   — regional total GVA per year (11 regions × 15 years)',
  '//   GVA_GROWTH  — YoY growth rate per region per year (11 × 14)',
  '//   GVA_SECTOR  — sector GVA per region per year (11 × ~9 sectors × 15 years)',
  '',
  'export interface RegionalObservation {',
  '  time:         number',
  '  geo:          string   // region id',
  '  measure:      string   // GVA_TOTAL | GVA_GROWTH | GVA_SECTOR',
  '  value:        number',
  '  pct?:         number   // % of national total (GVA_TOTAL) or % of region (GVA_SECTOR)',
  '  label:        string   // region name or sector short label',
  '  fullLabel?:   string   // sector full label (GVA_SECTOR only)',
  '  color:        string   // region or sector color',
  '  regionColor?: string   // region color (GVA_SECTOR only)',
  '  sector?:      string   // sector code (GVA_SECTOR only)',
  '  sectorOrder?: number   // display order (GVA_SECTOR only)',
  '}',
  '',
  'export interface RegionalDataset {',
  '  meta: { id: string; prepared: string; sender: string }',
  '  data: { observations: RegionalObservation[] }',
  '}',
  '',
  `export const REGIONAL_RAW: RegionalDataset = {`,
  `  meta: { id: 'REGIONAL_ACCOUNTS', prepared: '2025-01-01', sender: 'Geostat' },`,
  `  data: {`,
  `    observations: [`,
];

for (const obs of observations) {
  lines.push('      ' + JSON.stringify(obs) + ',');
}

lines.push('    ],');
lines.push('  },');
lines.push('};');

const outDir = path.resolve(__dirname, '../src/data/regional');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'raw.ts'), lines.join('\n'), 'utf8');

console.log(`Generated ${observations.length} observations`);
const byMeasure = {};
for (const o of observations) byMeasure[o.measure] = (byMeasure[o.measure] ?? 0) + 1;
console.log('By measure:', byMeasure);
console.log('Output:', path.join(outDir, 'raw.ts'));
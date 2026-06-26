/* build-regional-gva.js — file "რეგიონული_მშპ_22_12_2021.xlsx" → REGIONAL_GVA.
 * WIDE + STACKED, ka-only, repeatingBlocks. series key (ORDERED): time, geo, sector, measure.
 *   Block A (region×year totals) → geo=<region>, sector=_T; trailing total row → geo=_T.
 *   per-region sub-tables (activity×year, in Block-A order) → geo=<region>, sector=<activity>.
 *   EN names from curated maps; "Other" residual → sector OTH; measure=GVA constant. */
'use strict';

const { readSheet, sheetNames } = require('./read-workbook');
const { cleanLabel, makeCodelist, isNum } = require('./primitives');
const { REGION_EN, ACTIVITY_EN } = require('./region-maps');

const SRC_NAME = 'რეგიონული_მშპ_22_12_2021.xlsx';

const isHeaderRow = (r) => {
  const a = cleanLabel(r[0]).toLowerCase();
  const b = cleanLabel(r[1]).toLowerCase();
  return (a === 'name' && b === 'id') || (a === 'დასახელება' && b === 'კოდი');
};

function buildRegionalGva(dataDir, flags) {
  const file = `${dataDir}/${SRC_NAME}`;
  const rows = readSheet(file, sheetNames(file)[0]);

  const clGeo = makeCodelist('geo');
  const clSector = makeCodelist('sector');
  const clMeasure = makeCodelist('measure');
  clMeasure.add({ code: 'GVA', name_ka: 'მთლიანი დამატებული ღირებულება', name_en: 'Gross Value Added' });
  clGeo.add({ code: '_T', name_ka: 'საქართველო', name_en: 'Georgia' });
  clSector.add({ code: '_T', name_ka: 'ყველა საქმიანობა', name_en: 'All activities (total)' });

  const headerRows = [];
  for (let i = 0; i < rows.length; i++) if (isHeaderRow(rows[i])) headerRows.push(i);
  if (headerRows.length < 2) throw new Error('REGIONAL: expected >=2 header rows');

  const head0 = rows[headerRows[0]];
  const years = [];
  for (let c = 2; c < head0.length; c++) {
    const m = String(head0[c] || '').trim().match(/^(\d{4})(\*?)/);
    if (m) years.push({ col: c, time: m[1], prelim: m[2] === '*' });
  }

  const data = [];

  // ---- Block A: region×year totals + the trailing total-GDP row ----
  const regionOrder = []; // Block-A region order → maps positionally to sub-tables
  for (let i = headerRows[0] + 1; i < headerRows[1]; i++) {
    const r = rows[i];
    const nameKa = cleanLabel(r[0]);
    const id = r[1];
    const hasNums = r.slice(2).some(isNum);
    if (!hasNums) continue; // spacer/blank

    const isTotal = (id === '' || id == null) && nameKa.startsWith('მთლიანი შიდა პროდუქტი');
    let geoCode;
    if (isTotal) {
      geoCode = '_T';
    } else {
      geoCode = `R${String(id)}`;
      const en = REGION_EN[nameKa];
      if (!en) flags.push(`[REGIONAL] no curated EN name for region id=${id} KA="${nameKa}" — EN blank (FLAG)`);
      clGeo.add({ code: geoCode, name_ka: nameKa, name_en: en || '' });
      regionOrder.push(geoCode);
    }
    for (const y of years) {
      const v = r[y.col];
      if (!isNum(v)) continue;
      data.push({ geo: geoCode, sector: '_T', measure: 'GVA', time: y.time, obs_value: v, obs_status: y.prelim ? 'P' : 'A' });
    }
  }

  // ---- sub-tables: one per region, positionally in Block-A order ----
  const subHeaders = headerRows.slice(1);
  if (subHeaders.length !== regionOrder.length) {
    flags.push(`[REGIONAL] sub-table count (${subHeaders.length}) != region count (${regionOrder.length}) — positional mapping; verify`);
  }
  for (let h = 0; h < subHeaders.length; h++) {
    const geoCode = regionOrder[h];
    if (!geoCode) { flags.push(`[REGIONAL] sub-table #${h + 1} has no matching Block-A region`); continue; }
    const start = subHeaders[h] + 1;
    const end = (h + 1 < subHeaders.length) ? subHeaders[h + 1] : rows.length;
    for (let i = start; i < end; i++) {
      const r = rows[i];
      if (isHeaderRow(r)) continue;
      const nameKa = cleanLabel(r[0]);
      const id = r[1];
      const hasNums = r.slice(2).some(isNum);
      if (!hasNums) continue; // spacer/blank between blocks

      const sectorId = (id === '' || id == null) ? 'OTH' : String(id);
      const en = ACTIVITY_EN[sectorId];
      if (en == null) flags.push(`[REGIONAL] unmapped activity id=${id} KA="${nameKa}" (region ${geoCode}) — EN blank (FLAG)`);
      clSector.add({ code: sectorId, name_ka: nameKa, name_en: en || '' });

      for (const y of years) {
        const v = r[y.col];
        if (!isNum(v)) continue;
        data.push({ geo: geoCode, sector: sectorId, measure: 'GVA', time: y.time, obs_value: v, obs_status: y.prelim ? 'P' : 'A' });
      }
    }
  }

  return {
    datasetCode: 'REGIONAL_GVA',
    name_ka: 'რეგიონული მთლიანი დამატებული ღირებულება',
    name_en: 'Regional Gross Value Added',
    dimensions: ['time', 'geo', 'sector', 'measure'],
    measureConcept: 'OBS_VALUE',
    unit_default: 'GEL_MN',
    attributes: [],
    codelists: { geo: clGeo, sector: clSector, measure: clMeasure },
    data,
  };
}

module.exports = { buildRegionalGva };

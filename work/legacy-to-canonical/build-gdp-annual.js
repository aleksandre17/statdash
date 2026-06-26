/* build-gdp-annual.js — file "2 GDP მონაცემები.xlsx" → GDP_ANNUAL canonical dataset.
 * WIDE, bilingual, wide-melt.  series key (ORDERED): time, approach, measure, geo.
 *   approach ← from `name` col (PROD/EXP/INC/_Z) · measure ← code-from-label of `item`
 *   sign marker → contribution_role attribute (NOT a value sign) · geo=GE constant
 *   melt years 2010..2025 → time+obs_value · 2025* → obs_status=P. */
'use strict';

const { readSheet } = require('./read-workbook');
const { cleanLabel, liftCode, liftSign, transliterate, slugify, makeCodelist, isNum } = require('./primitives');

const SRC_NAME = '2 GDP მონაცემები.xlsx';

function approachOf(nameEn) {
  const n = nameEn.toLowerCase();
  if (n.startsWith('gdp by production')) return { code: 'PROD', en: 'Production approach', ka: 'წარმოების მეთოდი' };
  if (n.startsWith('gdp by expenditure')) return { code: 'EXP', en: 'Expenditure approach', ka: 'დანახარჯების მეთოდი' };
  if (n.startsWith('generation of income')) return { code: 'INC', en: 'Income approach', ka: 'შემოსავლების მეთოდი' };
  return { code: '_Z', en: 'Not applicable', ka: 'არ ვრცელდება' };
}

function buildGdpAnnual(dataDir, flags) {
  const file = `${dataDir}/${SRC_NAME}`;
  const geo = readSheet(file, 'მონაცემები geo');
  const eng = readSheet(file, 'Data Eng');

  const clApproach = makeCodelist('approach');
  const clMeasure = makeCodelist('measure');
  const clGeo = makeCodelist('geo');
  clGeo.add({ code: 'GE', name_ka: 'საქართველო', name_en: 'Georgia' });

  const headG = geo[0];
  const years = [];
  for (let c = 3; c < headG.length; c++) {
    const m = String(headG[c] || '').trim().match(/^(\d{4})(\*?)/);
    if (m) years.push({ col: c, time: m[1], prelim: m[2] === '*' });
  }

  const seenMeasureSlug = new Map();
  const data = [];
  let lastEn = '', lastKa = '';

  for (let i = 1; i < geo.length; i++) {
    const g = geo[i];
    const e = eng[i] || [];
    const nameKa = cleanLabel(g[1]) || lastKa;
    const nameEn = cleanLabel(e[1]) || lastEn;
    lastKa = nameKa; lastEn = nameEn;

    if (!cleanLabel(g[2]) && !cleanLabel(e[2])) continue; // junk

    const appr = approachOf(nameEn);
    clApproach.add({ code: appr.code, name_ka: appr.ka, name_en: appr.en });

    const signKa = liftSign(g[2]);
    const signEn = liftSign(e[2]);
    const role = signEn.role || signKa.role || '';

    const liftEn = liftCode(signEn.label);
    const liftKa = liftCode(signKa.label);
    let measureCode = liftEn.code || liftKa.code;
    const lblEn = liftEn.label || signEn.label;
    const lblKa = liftKa.label || signKa.label;
    if (!measureCode) measureCode = slugify(lblEn || transliterate(lblKa), seenMeasureSlug);
    clMeasure.add({ code: measureCode, name_ka: lblKa, name_en: lblEn });

    for (const y of years) {
      const v = g[y.col];
      if (!isNum(v)) continue;
      const ev = e[y.col];
      if (isNum(ev) && Math.abs(ev - v) > 0.01) {
        flags.push(`[GDP] value mismatch GEO≠ENG item="${lblEn}" time=${y.time}: GEO=${v} ENG=${ev} (GEO used)`);
      }
      data.push({ approach: appr.code, measure: measureCode, geo: 'GE', time: y.time, obs_value: v, obs_status: y.prelim ? 'P' : 'A', contribution_role: role });
    }
  }

  return {
    datasetCode: 'GDP_ANNUAL',
    name_ka: 'მთლიანი შიდა პროდუქტი (წლიური)',
    name_en: 'Gross Domestic Product (annual)',
    dimensions: ['time', 'approach', 'measure', 'geo'],
    measureConcept: 'OBS_VALUE',
    unit_default: 'GEL_MN',
    attributes: ['contribution_role'],
    codelists: { approach: clApproach, measure: clMeasure, geo: clGeo },
    data,
  };
}

module.exports = { buildGdpAnnual };

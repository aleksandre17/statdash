/* build-accounts-sequence.js — file "1.National Accounts_Data.xlsx" → ACCOUNTS_SEQUENCE.
 * LONG, bilingual, T-account split.  series key (ORDERED): time, account, side, measure.
 *   account ← slug of account NAME (stable across years) · side U (Uses)|R (Resources)
 *   one source row → up to 2 obs · measure ← code-from-label of the side's label
 *   VALUES taken from GEO sheet (ENG balancing-value column is year-shifted → flagged)
 *   attribute seq_pos ← aggregate-number. */
'use strict';

const { readSheet } = require('./read-workbook');
const { cleanLabel, liftCode, transliterate, slugify, makeCodelist, isNum } = require('./primitives');

const SRC_NAME = '1.National Accounts_Data.xlsx';
// sheet cols: 0 year |1 acc-no |2 acc name |3 balancing(Uses label) |4 Uses value
//             5 aggregate(Resources label) |6 Resources value |7 aggregate-no
const C = { year: 0, accNo: 1, accName: 2, balItem: 3, uses: 4, aggName: 5, res: 6, aggNo: 7 };

function buildAccountsSequence(dataDir, flags) {
  const file = `${dataDir}/${SRC_NAME}`;
  const geo = readSheet(file, 'GEO');
  const eng = readSheet(file, 'ENG');

  const clAccount = makeCodelist('account');
  const clSide = makeCodelist('side');
  const clMeasure = makeCodelist('measure');
  clSide.add({ code: 'U', name_ka: 'გამოყენება', name_en: 'Uses' });
  clSide.add({ code: 'R', name_ka: 'რესურსები', name_en: 'Resources' });

  const seenAccountSlug = new Map();
  const seenMeasureSlug = new Map();
  const accountCache = new Map();

  function accountCode(nameKa, nameEn) {
    const key = nameEn || nameKa;
    if (accountCache.has(key)) return accountCache.get(key);
    const code = slugify(nameEn || transliterate(nameKa), seenAccountSlug);
    clAccount.add({ code, name_ka: cleanLabel(nameKa), name_en: cleanLabel(nameEn) });
    accountCache.set(key, code);
    return code;
  }

  // measure code from a balancing/aggregate label. A lifted SDMX code that maps to
  // two DIFFERENT labels (e.g. (D4-D1) receivable vs payable) is kept distinct.
  function measureCode(labelKa, labelEn) {
    const liftEn = liftCode(labelEn);
    const liftKa = liftCode(labelKa);
    let code = liftEn.code || liftKa.code;
    const lblEn = liftEn.label || cleanLabel(labelEn);
    const lblKa = liftKa.label || cleanLabel(labelKa);
    if (!code) {
      code = slugify(lblEn || transliterate(lblKa), seenMeasureSlug);
    } else if (clMeasure.has(code)) {
      const ex = clMeasure.get(code);
      if (ex && lblEn && ex.name_en && ex.name_en !== lblEn) {
        // Same SNA code on two distinct labels (e.g. D4-D1 / D5 receivable vs payable from
        // the rest of the world): disambiguate with a SEMANTIC directional suffix, not a slug.
        const dir = /\breceivable\b/i.test(lblEn) ? 'RECV' : (/\bpayable\b/i.test(lblEn) ? 'PAY' : null);
        code = dir ? `${code}_${dir}` : `${code}_${slugify(lblEn).replace(/-/g, '').slice(0, 12)}`;
      }
    }
    clMeasure.add({ code, name_ka: lblKa, name_en: lblEn });
    return code;
  }

  const data = [];
  let shiftFlagged = false;

  for (let i = 1; i < geo.length; i++) {
    const g = geo[i];
    const e = eng[i] || [];
    const time = String(g[C.year] || '').match(/\d{4}/)?.[0];
    if (!time) continue;

    const accCode = accountCode(g[C.accName], e[C.accName]);
    const seqPos = isNum(g[C.aggNo]) ? g[C.aggNo] : '';

    // side = U (Uses): label from balancing-item col (3), fallback aggregate (5); value col 4
    const usesVal = g[C.uses];
    if (isNum(usesVal)) {
      const labKa = cleanLabel(g[C.balItem]) || cleanLabel(g[C.aggName]);
      const labEn = cleanLabel(e[C.balItem]) || cleanLabel(e[C.aggName]);
      const ev = e[C.uses];
      if (isNum(ev) && Math.abs(ev - usesVal) > 0.01 && !shiftFlagged) {
        flags.push(`[ACCOUNTS] ENG value column is year-shifted on balancing rows (e.g. row ${i + 1}: GEO=${usesVal} ENG=${ev}). GEO used as value SSOT for ALL obs.`);
        shiftFlagged = true;
      }
      data.push({ account: accCode, side: 'U', measure: measureCode(labKa, labEn), time, obs_value: usesVal, obs_status: 'A', seq_pos: seqPos });
    }

    // side = R (Resources): label from aggregate col (5); value col 6
    const resVal = g[C.res];
    if (isNum(resVal)) {
      data.push({ account: accCode, side: 'R', measure: measureCode(cleanLabel(g[C.aggName]), cleanLabel(e[C.aggName])), time, obs_value: resVal, obs_status: 'A', seq_pos: seqPos });
    }
  }

  return {
    datasetCode: 'ACCOUNTS_SEQUENCE',
    name_ka: 'ეროვნული ანგარიშების მიმდევრობა',
    name_en: 'Sequence of National Accounts',
    dimensions: ['time', 'account', 'side', 'measure'],
    measureConcept: 'OBS_VALUE',
    unit_default: 'GEL_MN',
    attributes: ['seq_pos'],
    codelists: { account: clAccount, side: clSide, measure: clMeasure },
    data,
  };
}

module.exports = { buildAccountsSequence };

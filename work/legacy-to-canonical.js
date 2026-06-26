/* ============================================================================
 * legacy-to-canonical.js  —  GeoStat legacy Excel → canonical SDMX-shaped workbooks
 * (entrypoint; the implementation lives in ./legacy-to-canonical/*, one concern/file)
 * ----------------------------------------------------------------------------
 * Reads the 3 messy real GeoStat National-Accounts files in DATA/ (READ-ONLY) and
 * writes 3 FLAWLESS canonical workbooks to DATA/canonical/:
 *     GDP_ANNUAL.xlsx · ACCOUNTS_SEQUENCE.xlsx · REGIONAL_GVA.xlsx
 * Each workbook = STRUCTURE + CL_<DIM>… + DATA (tidy/long, codes only, 1 row=1 obs).
 *
 * Pipeline (Pipe-and-Filter): read → reshape (melt / T-split / repeatingBlocks) →
 * code-from-label → assemble CL_+DATA → validate (DQAF) → write. Deterministic codes
 * + sorted DATA → re-runs are byte-identical (idempotent). Originals untouched.
 *
 * USAGE (xlsx resolved from the pnpm store — this is a work/ tool, not app code):
 *   cd platform
 *   NODE_PATH=$(dirname $(find . -type d -name xlsx -path '*node_modules*'|head -1)) \
 *     node ../work/legacy-to-canonical.js
 * ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const { buildGdpAnnual } = require('./legacy-to-canonical/build-gdp-annual');
const { buildAccountsSequence } = require('./legacy-to-canonical/build-accounts-sequence');
const { buildRegionalGva } = require('./legacy-to-canonical/build-regional-gva');
const { writeWorkbook, sampleRows, sheetList, isNum } = require('./legacy-to-canonical/writer');
const { validate } = require('./legacy-to-canonical/validate');

const DATA_DIR = path.resolve(__dirname, '..', 'DATA');
const OUT_DIR = path.join(DATA_DIR, 'canonical');

function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const flags = [];
  const datasets = [
    buildGdpAnnual(DATA_DIR, flags),
    buildAccountsSequence(DATA_DIR, flags),
    buildRegionalGva(DATA_DIR, flags),
  ];

  const written = datasets.map((ds) => {
    const w = writeWorkbook(ds, OUT_DIR);
    if (w.fallback) flags.push(`[WRITE] "${w.lockedTarget}" is LOCKED (open in Excel?) — wrote to sidecar "${w.path}" instead. Close the file and re-run, or replace it with the .new.xlsx.`);
    return { ds, outPath: w.path, report: validate(ds) };
  });

  console.log('\n============================================================');
  console.log(' LEGACY → CANONICAL  conversion report');
  console.log('============================================================');
  for (const { ds, outPath } of written) {
    console.log(`\n● ${ds.datasetCode}  →  ${outPath}`);
    console.log(`    sheets: ${sheetList(ds).join(' | ')}`);
    console.log(`    DATA rows: ${ds.data.length}`);
    for (const dim of ds.dimensions) {
      if (dim === 'time') continue;
      console.log(`      CL_${dim.toUpperCase()}: ${ds.codelists[dim].rows().length} codes`);
    }
  }

  console.log('\n--- DQAF validation ---');
  for (const { report } of written) {
    console.log(`\n[${report.dataset}] obs=${report.obs}  distinct codes/dim=${JSON.stringify(report.dims)}`);
    for (const c of report.checks) console.log('    check: ' + c);
    if (report.anomalies.length) { console.log('    ANOMALIES:'); for (const a of report.anomalies) console.log('      ! ' + a); }
    else console.log('    anomalies: none');
  }

  console.log('\n--- FLAGS (labels/data needing human attention) ---');
  if (!flags.length) console.log('    none');
  else for (const f of flags) console.log('    • ' + f);

  console.log('\n--- DATA samples (first 6 obs rows each) ---');
  for (const { ds } of written) {
    console.log(`\n[${ds.datasetCode}]`);
    for (const r of sampleRows(ds, 6)) {
      console.log('  ' + r.map((c) => (isNum(c) ? Number(c).toFixed(2) : String(c))).join(' | '));
    }
  }
  console.log('\n============================================================');
  console.log(' done. Originals untouched. Re-run is idempotent (deterministic codes + sorted DATA).');
  console.log('============================================================\n');
}

main();

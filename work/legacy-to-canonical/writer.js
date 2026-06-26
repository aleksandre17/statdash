/* writer.js — assemble + write a canonical workbook (STRUCTURE, CL_*, DATA).
 * DATA rows are sorted by the full series key + time → byte-identical re-runs. */
'use strict';

const path = require('path');
const { XLSX } = require('./read-workbook');
const { isNum } = require('./primitives');

/** True synchronous sleep that yields the CPU (lets a Windows AV/indexer release its
 *  transient lock), via Atomics.wait on a throwaway buffer. */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

const LOCK_CODES = new Set(['EBUSY', 'EPERM', 'EACCES']);

/** Write-with-retry + graceful degradation. Transient locks (AV/indexer) clear on a
 *  short exponential backoff. A PERSISTENT lock (the user has the .xlsx open in Excel)
 *  must NOT crash and must NOT lose the conversion: fall back to a `.new.xlsx` sidecar
 *  and return { path, fallback:true } so the caller can flag it. Returns { path, fallback }. */
function writeWithRetry(wb, outPath, attempts = 5) {
  let delay = 100;
  for (let i = 0; ; i++) {
    try { XLSX.writeFile(wb, outPath); return { path: outPath, fallback: false }; }
    catch (e) {
      if (LOCK_CODES.has(e.code) && i < attempts) {
        sleepSync(delay);
        delay = Math.min(delay * 2, 1500);
        continue;
      }
      if (!LOCK_CODES.has(e.code)) throw e;
      // persistent lock → sidecar (graceful degradation, never lose the output)
      const ext = path.extname(outPath);
      const side = outPath.slice(0, -ext.length) + '.new' + ext;
      XLSX.writeFile(wb, side); // if the sidecar is ALSO locked, this throws (truly stuck)
      return { path: side, fallback: true, lockedTarget: outPath };
    }
  }
}

const SOURCE = 'GeoStat';
const VINTAGE = '2026-06-26'; // deterministic ingest constant

function structureRows(ds) {
  return [
    ['key', 'value'],
    ['dataset_code', ds.datasetCode],
    ['name_ka', ds.name_ka],
    ['name_en', ds.name_en],
    ['dimensions', ds.dimensions.join(',')],
    ['measure', ds.measureConcept],
    ['unit_default', ds.unit_default],
    ['source', SOURCE],
    ['vintage', VINTAGE],
  ];
}

function codelistRows(cl) {
  const out = [['code', 'name_ka', 'name_en', 'parent', 'order']];
  for (const r of cl.rows()) out.push([r.code, r.name_ka, r.name_en, r.parent || '', r.order]);
  return out;
}

/** Tidy/long DATA: non-time dim codes + time + obs_value + obs_status + attributes. */
function dataRows(ds) {
  const nonTime = ds.dimensions.filter((d) => d !== 'time');
  const attrs = ds.attributes || [];
  const header = [...nonTime, 'time', 'obs_value', 'obs_status', ...attrs];

  const sorted = [...ds.data].sort((a, b) => {
    for (const d of nonTime) {
      const c = String(a[d]).localeCompare(String(b[d]));
      if (c) return c;
    }
    return String(a.time).localeCompare(String(b.time));
  });

  const rows = [header];
  for (const o of sorted) {
    const row = nonTime.map((d) => o[d]);
    row.push(o.time, o.obs_value, o.obs_status);
    for (const a of attrs) row.push(o[a] === undefined ? '' : o[a]);
    rows.push(row);
  }
  return { rows, sorted };
}

function sheetList(ds) {
  return ['STRUCTURE', ...ds.dimensions.filter((d) => d !== 'time').map((d) => 'CL_' + d.toUpperCase()), 'DATA'];
}

function writeWorkbook(ds, outDir) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(structureRows(ds)), 'STRUCTURE');
  for (const dim of ds.dimensions) {
    if (dim === 'time') continue;
    const cl = ds.codelists[dim];
    if (!cl) throw new Error(`${ds.datasetCode}: no codelist for dim "${dim}"`);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(codelistRows(cl)), `CL_${dim.toUpperCase()}`);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dataRows(ds).rows), 'DATA');

  const outPath = path.join(outDir, `${ds.datasetCode}.xlsx`);
  return writeWithRetry(wb, outPath); // { path, fallback, lockedTarget? }
}

function sampleRows(ds, n = 6) {
  return dataRows(ds).rows.slice(0, n + 1);
}

module.exports = { writeWorkbook, dataRows, sampleRows, sheetList, isNum };

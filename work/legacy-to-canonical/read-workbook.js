/* read-workbook.js — the ONLY place xlsx is read (read-only ACL boundary).
 * xlsx is resolved from the pnpm store via NODE_PATH (this is a work/ tool). */
'use strict';

const XLSX = require('xlsx');

/** Read one sheet as a row-major matrix (numbers preserved). Read-only. */
function readSheet(file, sheetName) {
  const wb = XLSX.readFile(file);
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet "${sheetName}" not found in ${file}`);
  return XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });
}

/** List sheet names without reading cell data. */
function sheetNames(file) {
  return XLSX.readFile(file, { bookSheets: true }).SheetNames;
}

module.exports = { XLSX, readSheet, sheetNames };

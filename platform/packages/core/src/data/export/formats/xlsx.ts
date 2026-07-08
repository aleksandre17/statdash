// ── XLSX serializer [N16] ──────────────────────────────────────────────
//
//  Emits a genuine OOXML SpreadsheetML workbook (.xlsx) — a ZIP of XML
//  parts — NOT a CSV renamed. Numbers are written as numeric cells; all
//  other values as inline strings (no shared-strings table needed).
//
//  Returns Uint8Array (binary). The export registry's SerializeFn return is
//  string | Uint8Array; the React download layer wraps either in a Blob.
//
//  Why self-contained (no exceljs/SheetJS dep): see ./zip.ts. The engine
//  stays lean; an .xlsx is just five small static XML parts plus one
//  generated worksheet, zipped.
//
//  Reference: ECMA-376 (Office Open XML), Part 1 — SpreadsheetML.
//

import type { EngineRow } from '../../encoding'
import type { ExportMeta } from '../types'
import { zipSync, utf8, type ZipEntry } from './zip'
import { provenanceLines } from '../provenanceFooter'

/** XML-escape text content / attribute values. */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Column index (0-based) → spreadsheet column letters (A, B, …, AA). */
function colName(i: number): string {
  let n = i
  let s = ''
  do {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return s
}

/** Build one <c> cell: numeric when value is a finite number, else inline string. */
function cell(ref: string, value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}" t="n"><v>${value}</v></c>`
  }
  const text = value === null || value === undefined ? '' : String(value)
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(text)}</t></is></c>`
}

function row(rowIndex: number, values: unknown[]): string {
  const cells = values.map((v, c) => cell(`${colName(c)}${rowIndex}`, v)).join('')
  return `<row r="${rowIndex}">${cells}</row>`
}

/**
 * `[Content_Types].xml` — declares the worksheet parts present. `hasMetadata`
 * adds sheet2's Override (AR-48 P1); byte-identical to the pre-P1 single-sheet
 * declaration when false.
 */
function contentTypesXml(hasMetadata: boolean): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    (hasMetadata
      ? `<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
      : '') +
    `</Types>`
  )
}

const ROOT_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
  `</Relationships>`

/** Workbook-level relationships — one per worksheet part. */
function workbookRelsXml(hasMetadata: boolean): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
    (hasMetadata
      ? `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>`
      : '') +
    `</Relationships>`
  )
}

/**
 * Sheet list — `metadataName`, when given, appends a second tab ("Metadata" by
 * default; AR-48 P1's citation sheet). Absent ⇒ byte-identical single-sheet
 * workbook.xml (regression-safe).
 */
function workbookXml(sheetName: string, metadataName?: string): string {
  const sheets =
    `<sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/>` +
    (metadataName ? `<sheet name="${xmlEscape(metadataName)}" sheetId="2" r:id="rId2"/>` : '')
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>${sheets}</sheets>` +
    `</workbook>`
  )
}

function worksheetXml(rowsXml: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${rowsXml}</sheetData>` +
    `</worksheet>`
  )
}

/** Clamp a candidate sheet name to Excel's 31-char limit and forbidden chars. */
function sheetTabName(meta: ExportMeta): string {
  const raw = (meta.title ?? 'Sheet1').replace(/[\\/?*[\]:]/g, ' ').trim() || 'Sheet1'
  return raw.slice(0, 31)
}

/** The Metadata sheet's fixed tab name (AR-48 P1). */
const METADATA_SHEET_NAME = 'Metadata'

/**
 * Serialize rows → .xlsx bytes (OOXML SpreadsheetML).
 * Mirrors serializeCsv's meta contract: fields ordering + labels header.
 *
 * AR-48 P1: when `meta.provenance` yields ≥1 line, a second "Metadata" sheet
 * (Label | Value) is appended — the xlsx twin of csv's footer block. Absent
 * provenance ⇒ byte-identical single-sheet workbook (regression-safe, proven
 * by xlsx.test.ts's pre-existing part-structure assertions).
 */
export function serializeXlsx(rows: EngineRow[], meta: ExportMeta): Uint8Array {
  const fields = meta.fields ?? (rows.length > 0 ? Object.keys(rows[0]) : [])
  const labels = meta.labels ?? {}

  const header = fields.map(f => labels[f] ?? f)
  const rowsXml = [
    row(1, header),
    ...rows.map((r, i) => row(i + 2, fields.map(f => r[f]))),
  ].join('')

  const lines       = provenanceLines(meta.provenance)
  const hasMetadata = lines.length > 0

  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml',        data: utf8(contentTypesXml(hasMetadata)) },
    { name: '_rels/.rels',                data: utf8(ROOT_RELS) },
    { name: 'xl/workbook.xml',            data: utf8(workbookXml(sheetTabName(meta), hasMetadata ? METADATA_SHEET_NAME : undefined)) },
    { name: 'xl/_rels/workbook.xml.rels', data: utf8(workbookRelsXml(hasMetadata)) },
    { name: 'xl/worksheets/sheet1.xml',   data: utf8(worksheetXml(rowsXml)) },
  ]

  if (hasMetadata) {
    const metadataRowsXml = lines
      .map((l, i) => row(i + 1, [l.label, l.value]))
      .join('')
    entries.push({ name: 'xl/worksheets/sheet2.xml', data: utf8(worksheetXml(metadataRowsXml)) })
  }

  return zipSync(entries)
}

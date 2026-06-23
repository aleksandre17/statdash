// ── csv — a minimal, dependency-free RFC 4180 codec ───────────────────────────
//
// No xlsx/papaparse dependency is in the workspace and the task forbids adding one,
// so the curator round-trip is CSV (Excel opens/saves it natively). This is the one
// authoritative CSV codec for the API: a pure, side-effect-free parse/serialize pair
// so the format rules (quoting, embedded commas/quotes/newlines, BOM, CRLF) live in
// ONE tested place rather than being re-implemented per route.
//
// RFC 4180 conformance:
//   • fields containing , " or a newline are wrapped in double quotes
//   • a literal " inside a quoted field is escaped by doubling it ("")
//   • CRLF and LF line endings are both accepted on read; we emit CRLF on write
//     (Excel's default — maximizes spreadsheet compatibility)
//   • a leading UTF-8 BOM on read is stripped (Excel writes one); we emit one on
//     write so Excel opens UTF-8 (Georgian/Cyrillic labels) without mojibake.

/** UTF-8 byte-order mark — Excel writes it and needs it to detect UTF-8. */
const BOM = '﻿'

// ── serialize ─────────────────────────────────────────────────────────────────

function encodeField(value: string): string {
  // Quote only when required (RFC 4180 §2.6): comma, quote, CR or LF present.
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Serialize a header + rows to an RFC 4180 CSV string (CRLF lines, leading BOM).
 * Every row is padded/truncated to the header arity so the grid stays rectangular.
 */
export function toCsv(header: readonly string[], rows: readonly (readonly string[])[]): string {
  const lines: string[] = [header.map(encodeField).join(',')]
  for (const row of rows) {
    lines.push(header.map((_, i) => encodeField(row[i] ?? '')).join(','))
  }
  return BOM + lines.join('\r\n') + '\r\n'
}

// ── parse ───────────────────────────────────────────────────────────────────--

/**
 * Parse an RFC 4180 CSV string into a matrix of string cells. Handles quoted
 * fields with embedded commas, quotes ("" → "), CR/LF/CRLF newlines, a leading
 * BOM, and a trailing newline (no spurious empty final row). Fully blank lines
 * are dropped. Returns rows in source order; the caller maps the header itself.
 */
export function parseCsv(text: string): string[][] {
  // Strip a leading BOM if Excel wrote one.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  let fieldStarted = false // distinguishes an empty trailing line from real data

  const pushField = (): void => {
    row.push(field)
    field = ''
    fieldStarted = false
  }
  const pushRow = (): void => {
    pushField()
    // Drop a row that is a single empty cell (a blank line), keep genuine rows.
    if (!(row.length === 1 && row[0] === '')) rows.push(row)
    row = []
  }

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++ // consume the escaped quote
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"' && !fieldStarted) {
      inQuotes = true
      fieldStarted = true
    } else if (ch === ',') {
      pushField()
    } else if (ch === '\r') {
      // CRLF: skip the following LF.
      if (src[i + 1] === '\n') i++
      pushRow()
    } else if (ch === '\n') {
      pushRow()
    } else {
      field += ch
      fieldStarted = true
    }
  }

  // Flush the final field/row if the input did not end with a newline.
  if (field !== '' || row.length > 0) pushRow()

  return rows
}

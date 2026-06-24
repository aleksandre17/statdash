import { describe, it, expect } from 'vitest'
import { serializeXlsx } from './xlsx'

const ROWS = [
  { year: '2021', region: 'Tbilisi', value: 12.3 },
  { year: '2022', region: 'Kutaisi', value: 14.5 },
  { year: '2023', region: 'Batumi',  value: 16.0 },
]

// ── Minimal STORED-zip reader (test-only) ──────────────────────────────
// Reads back the local file headers of a STORED (method 0) zip so tests can
// assert the OOXML part structure + contents without a zip dependency.
function readZip(bytes: Uint8Array): Map<string, string> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const dec = new TextDecoder()
  const out = new Map<string, string>()
  let i = 0
  while (i + 4 <= bytes.length && dv.getUint32(i, true) === 0x04034b50) {
    const method   = dv.getUint16(i + 8, true)
    const compSize = dv.getUint32(i + 18, true)
    const nameLen  = dv.getUint16(i + 26, true)
    const extraLen = dv.getUint16(i + 28, true)
    const nameStart = i + 30
    const name = dec.decode(bytes.subarray(nameStart, nameStart + nameLen))
    const dataStart = nameStart + nameLen + extraLen
    const data = bytes.subarray(dataStart, dataStart + compSize)
    expect(method, `entry '${name}' must be STORED (method 0)`).toBe(0)
    out.set(name, dec.decode(data))
    i = dataStart + compSize
  }
  return out
}

describe('serializeXlsx', () => {
  it('returns binary bytes (Uint8Array), not a string', () => {
    const out = serializeXlsx(ROWS, {})
    expect(out).toBeInstanceOf(Uint8Array)
  })

  it('emits a ZIP container (PK local-file-header magic)', () => {
    const out = serializeXlsx(ROWS, {})
    // 0x50 0x4b 0x03 0x04 = "PK\x03\x04"
    expect(out[0]).toBe(0x50)
    expect(out[1]).toBe(0x4b)
    expect(out[2]).toBe(0x03)
    expect(out[3]).toBe(0x04)
  })

  it('ends with the End-Of-Central-Directory record', () => {
    const out = serializeXlsx(ROWS, {})
    const dv = new DataView(out.buffer, out.byteOffset, out.byteLength)
    // EOCD signature 0x06054b50 sits at the final 22-byte record (no comment).
    expect(dv.getUint32(out.length - 22, true)).toBe(0x06054b50)
  })

  it('contains the required OOXML package parts', () => {
    const parts = readZip(serializeXlsx(ROWS, {}))
    expect([...parts.keys()]).toEqual(
      expect.arrayContaining([
        '[Content_Types].xml',
        '_rels/.rels',
        'xl/workbook.xml',
        'xl/_rels/workbook.xml.rels',
        'xl/worksheets/sheet1.xml',
      ]),
    )
  })

  it('Content_Types declares the worksheet + workbook content types', () => {
    const parts = readZip(serializeXlsx(ROWS, {}))
    const ct = parts.get('[Content_Types].xml')!
    expect(ct).toContain('spreadsheetml.sheet.main+xml')
    expect(ct).toContain('spreadsheetml.worksheet+xml')
  })

  it('worksheet carries the header row from field names', () => {
    const sheet = readZip(serializeXlsx(ROWS, {})).get('xl/worksheets/sheet1.xml')!
    expect(sheet).toContain('<t xml:space="preserve">year</t>')
    expect(sheet).toContain('<t xml:space="preserve">region</t>')
    expect(sheet).toContain('<t xml:space="preserve">value</t>')
  })

  it('writes numbers as numeric cells and text as inline strings', () => {
    const sheet = readZip(serializeXlsx(ROWS, {})).get('xl/worksheets/sheet1.xml')!
    // numeric value cell
    expect(sheet).toContain('t="n"><v>12.3</v>')
    // text cell (region)
    expect(sheet).toContain('<t xml:space="preserve">Tbilisi</t>')
  })

  it('applies custom labels as the header row', () => {
    const sheet = readZip(
      serializeXlsx(ROWS, { labels: { year: 'Year', region: 'Region', value: 'GDP (GEL bn)' } }),
    ).get('xl/worksheets/sheet1.xml')!
    expect(sheet).toContain('<t xml:space="preserve">Year</t>')
    expect(sheet).toContain('<t xml:space="preserve">GDP (GEL bn)</t>')
  })

  it('respects explicit fields order and omits unlisted fields', () => {
    const sheet = readZip(
      serializeXlsx([{ a: 1, b: 2, c: 3 }], { fields: ['c', 'a'] }),
    ).get('xl/worksheets/sheet1.xml')!
    // header order: c then a
    const cIdx = sheet.indexOf('>c<')
    const aIdx = sheet.indexOf('>a<')
    expect(cIdx).toBeGreaterThan(-1)
    expect(aIdx).toBeGreaterThan(cIdx)
    expect(sheet).not.toContain('>b<')
  })

  it('XML-escapes special characters in cell text', () => {
    const sheet = readZip(
      serializeXlsx([{ name: 'A & B <C>', value: 1 }], {}),
    ).get('xl/worksheets/sheet1.xml')!
    expect(sheet).toContain('A &amp; B &lt;C&gt;')
  })

  it('uses meta.title as the sheet tab name with forbidden chars sanitized', () => {
    const wb = readZip(
      serializeXlsx(ROWS, { title: 'GDP:2021/2023' }),
    ).get('xl/workbook.xml')!
    // forbidden Excel sheet-name chars (\ / ? * [ ] :) replaced with spaces
    expect(wb).toContain('name="GDP 2021 2023"')
  })

  it('clamps the sheet tab name to Excel\'s 31-char limit', () => {
    const wb = readZip(
      serializeXlsx(ROWS, { title: 'X'.repeat(50) }),
    ).get('xl/workbook.xml')!
    expect(wb).toContain(`name="${'X'.repeat(31)}"`)
  })

  it('produces a valid (empty-but-structured) workbook for empty rows', () => {
    const parts = readZip(serializeXlsx([], {}))
    expect(parts.has('xl/worksheets/sheet1.xml')).toBe(true)
    // header row is empty, no data rows
    expect(parts.get('xl/worksheets/sheet1.xml')!).toContain('<sheetData>')
  })
})

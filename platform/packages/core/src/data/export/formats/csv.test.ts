import { describe, it, expect } from 'vitest'
import { serializeCsv } from './csv'

const ROWS = [
  { year: '2021', region: 'Tbilisi', value: 12.3 },
  { year: '2022', region: 'Kutaisi', value: 14.5 },
  { year: '2023', region: 'Batumi',  value: 16.0 },
]

describe('serializeCsv', () => {
  it('golden output — header + 3 data rows', () => {
    const out   = serializeCsv(ROWS, {})
    const lines = out.split('\r\n')
    expect(lines[0]).toBe('year,region,value')
    expect(lines[1]).toBe('2021,Tbilisi,12.3')
    expect(lines[2]).toBe('2022,Kutaisi,14.5')
    expect(lines[3]).toBe('2023,Batumi,16')
  })

  it('uses CRLF line endings (RFC 4180)', () => {
    const out = serializeCsv(ROWS, {})
    expect(out).toMatch(/\r\n/)
  })

  it('applies custom labels as column headers', () => {
    const out       = serializeCsv(ROWS, { labels: { year: 'Year', region: 'Region', value: 'GDP (GEL bn)' } })
    const firstLine = out.split('\r\n')[0]
    expect(firstLine).toBe('Year,Region,GDP (GEL bn)')
  })

  it('quotes values that contain commas', () => {
    const rows = [{ name: 'Jones, Bob', value: 1 }]
    const out  = serializeCsv(rows, {})
    expect(out).toContain('"Jones, Bob"')
  })

  it('quotes and escapes double-quotes', () => {
    const rows = [{ note: 'He said "hello"', value: 1 }]
    const out  = serializeCsv(rows, {})
    expect(out).toContain('"He said ""hello"""')
  })

  it('respects explicit fields order and omits unlisted fields', () => {
    const rows      = [{ a: 1, b: 2, c: 3 }]
    const out       = serializeCsv(rows, { fields: ['c', 'a'] })
    const firstLine = out.split('\r\n')[0]
    expect(firstLine).toBe('c,a')
    expect(out).not.toContain('b')
  })

  it('returns empty string for empty rows', () => {
    expect(serializeCsv([], {})).toBe('')
  })
})

// @vitest-environment jsdom
//
// ── downloadExport — the browser download seam [N16] ──────────────────────
//
//  Fitness: dispatching an export must serialize the EXPECTED bytes through the
//  registry format and name the file correctly. The DOM download is mocked
//  (URL.createObjectURL + <a>.click) so we assert on the Blob + download name
//  without a real navigation. This is the seam the `data:export` command handler
//  and the ExportBar click path both call, so proving it here proves both.
//

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { downloadExport, slugifyFilename, exportFilename } from './downloadExport'
import type { DataRow } from '@statdash/engine'
// Side-effect: register built-in formats (csv, xlsx, sdmx-json).
import '@statdash/engine'

const ROWS: DataRow[] = [
  { id: '2024', label: 'Tbilisi', value: 12.3 },
  { id: '2025', label: 'Kutaisi', value: 14.5 },
]

let lastBlob:     Blob | null
let lastDownload: string | null
let clickCount:   number

beforeEach(() => {
  lastBlob = null
  lastDownload = null
  clickCount = 0
  // jsdom lacks URL.createObjectURL — stub it and capture the Blob.
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn((b: Blob) => { lastBlob = b; return 'blob:mock' }),
    revokeObjectURL: vi.fn(),
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    lastDownload = this.download
    clickCount++
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** Read a captured Blob's bytes as text (jsdom Blob supports arrayBuffer()). */
async function blobText(b: Blob): Promise<string> {
  return Buffer.from(await b.arrayBuffer()).toString('utf8')
}

describe('downloadExport — CSV', () => {
  it('serializes rows to CSV, prepends a UTF-8 BOM, and names the file <slug>.csv', async () => {
    const ok = downloadExport('csv', ROWS, { filename: 'mshp', title: 'MSHP' })
    expect(ok).toBe(true)
    expect(clickCount).toBe(1)
    expect(lastDownload).toBe('mshp.csv')
    expect(lastBlob).not.toBeNull()
    expect(lastBlob!.type).toBe('text/csv')

    const text = await blobText(lastBlob!)
    // BOM (U+FEFF) must lead so Excel detects UTF-8.
    expect(text.charCodeAt(0)).toBe(0xFEFF)
    // Header + both data rows present.
    expect(text).toContain('id,label,value')
    expect(text).toContain('2024,Tbilisi,12.3')
    expect(text).toContain('2025,Kutaisi,14.5')
  })

  it('slugifies a human title when no explicit filename is given', () => {
    downloadExport('csv', ROWS, { title: 'GDP by region' })
    expect(lastDownload).toBe('gdp-by-region.csv')
  })
})

describe('downloadExport — XLSX', () => {
  it('serializes a real OOXML workbook (PK zip signature) and names it <slug>.xlsx', async () => {
    const ok = downloadExport('xlsx', ROWS, { filename: 'mshp' })
    expect(ok).toBe(true)
    expect(lastDownload).toBe('mshp.xlsx')
    expect(lastBlob!.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

    const bytes = new Uint8Array(await lastBlob!.arrayBuffer())
    // A real .xlsx is a ZIP — first two bytes are 'P','K' (0x50 0x4B).
    expect(bytes[0]).toBe(0x50)
    expect(bytes[1]).toBe(0x4b)
    // No spurious BOM on binary payloads.
    expect(bytes[0]).not.toBe(0xef)
  })
})

describe('downloadExport — guards', () => {
  it('returns false and never downloads for an unregistered format', () => {
    const ok = downloadExport('does-not-exist', ROWS, {})
    expect(ok).toBe(false)
    expect(clickCount).toBe(0)
  })

  it('handles empty rows gracefully (empty-safe serializer, still a valid file)', () => {
    const ok = downloadExport('csv', [], { filename: 'empty' })
    expect(ok).toBe(true)
    expect(lastDownload).toBe('empty.csv')
  })
})

describe('filename helpers', () => {
  it('slugifyFilename keeps ascii ids, lowercases, and collapses separators', () => {
    expect(slugifyFilename('mshp')).toBe('mshp')
    expect(slugifyFilename('GDP by region')).toBe('gdp-by-region')
    expect(slugifyFilename('  a / b  ')).toBe('a-b')
  })

  it('slugifyFilename falls back to "export" for an empty/punctuation-only stem', () => {
    expect(slugifyFilename('')).toBe('export')
    expect(slugifyFilename('///')).toBe('export')
  })

  it('exportFilename appends the format ext to the slugified stem', () => {
    expect(exportFilename({ filename: 'mshp' }, 'csv')).toBe('mshp.csv')
    expect(exportFilename({ title: 'My Panel' }, 'xlsx')).toBe('my-panel.xlsx')
    expect(exportFilename({}, 'csv')).toBe('export.csv')
  })
})

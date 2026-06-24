// ── Minimal ZIP writer [N16] ───────────────────────────────────────────
//
//  Self-contained, zero-dependency ZIP (PKZIP) writer using STORED
//  (uncompressed) entries. Sufficient for OOXML containers (.xlsx, .docx),
//  which are ZIPs of small XML parts — DEFLATE is optional, STORED is valid.
//
//  Why no dep: packages/core is the lean pure engine. A full spreadsheet
//  lib (exceljs ~1MB, SheetJS large + licensing churn) is unjustified for
//  emitting a handful of static XML parts. A STORED-entry ZIP needs only a
//  CRC-32 and the PKZIP record layout (~100 LOC), keeping the engine lean.
//
//  Reference: PKWARE APPNOTE.TXT (ZIP file format spec) §4.3.
//

/** One file to place in the archive. */
export interface ZipEntry {
  /** Path within the archive (forward slashes), e.g. 'xl/workbook.xml'. */
  name: string
  /** Raw bytes of the file content. */
  data: Uint8Array
}

// CRC-32 (IEEE 802.3) — lazily-built lookup table.
let CRC_TABLE: Uint32Array | undefined
function crcTable(): Uint32Array {
  if (CRC_TABLE) return CRC_TABLE
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    t[n] = c >>> 0
  }
  CRC_TABLE = t
  return t
}

function crc32(bytes: Uint8Array): number {
  const t = crcTable()
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    c = t[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

/** UTF-8 encode a string to bytes (Node + browser both expose TextEncoder). */
export function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

/**
 * Build a ZIP archive from entries using STORED (no compression).
 * Produces a standards-compliant .zip byte stream.
 */
export function zipSync(entries: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder()
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name)
    const crc = crc32(entry.data)
    const size = entry.data.length

    // Local file header (30 bytes + name)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true) // signature
    local.setUint16(4, 20, true)         // version needed
    local.setUint16(6, 0, true)          // flags
    local.setUint16(8, 0, true)          // method = 0 (stored)
    local.setUint16(10, 0, true)         // mod time
    local.setUint16(12, 0x21, true)      // mod date (1980-01-01)
    local.setUint32(14, crc, true)
    local.setUint32(18, size, true)      // compressed size
    local.setUint32(22, size, true)      // uncompressed size
    local.setUint16(26, nameBytes.length, true)
    local.setUint16(28, 0, true)         // extra length
    localParts.push(new Uint8Array(local.buffer), nameBytes, entry.data)

    // Central directory header (46 bytes + name)
    const central = new DataView(new ArrayBuffer(46))
    central.setUint32(0, 0x02014b50, true) // signature
    central.setUint16(4, 20, true)         // version made by
    central.setUint16(6, 20, true)         // version needed
    central.setUint16(8, 0, true)          // flags
    central.setUint16(10, 0, true)         // method
    central.setUint16(12, 0, true)         // mod time
    central.setUint16(14, 0x21, true)      // mod date
    central.setUint32(16, crc, true)
    central.setUint32(20, size, true)
    central.setUint32(24, size, true)
    central.setUint16(28, nameBytes.length, true)
    central.setUint16(30, 0, true)         // extra length
    central.setUint16(32, 0, true)         // comment length
    central.setUint16(34, 0, true)         // disk number
    central.setUint16(36, 0, true)         // internal attrs
    central.setUint32(38, 0, true)         // external attrs
    central.setUint32(42, offset, true)    // local header offset
    centralParts.push(new Uint8Array(central.buffer), nameBytes)

    offset += 30 + nameBytes.length + size
  }

  const centralSize = centralParts.reduce((n, p) => n + p.length, 0)
  const centralOffset = offset

  // End of central directory record (22 bytes)
  const eocd = new DataView(new ArrayBuffer(22))
  eocd.setUint32(0, 0x06054b50, true)              // signature
  eocd.setUint16(4, 0, true)                       // disk
  eocd.setUint16(6, 0, true)                       // disk w/ central
  eocd.setUint16(8, entries.length, true)          // entries this disk
  eocd.setUint16(10, entries.length, true)         // total entries
  eocd.setUint32(12, centralSize, true)            // central dir size
  eocd.setUint32(16, centralOffset, true)          // central dir offset
  eocd.setUint16(20, 0, true)                      // comment length

  const all = [...localParts, ...centralParts, new Uint8Array(eocd.buffer)]
  const total = all.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let pos = 0
  for (const part of all) {
    out.set(part, pos)
    pos += part.length
  }
  return out
}

// ── Canonical workbook reader — the xlsx Anti-Corruption Layer (ACL) ──────────
//
// ADR-0031 §2 / Wave 1a. This is the ONLY file in `apps/api` permitted to
// `import xlsx` (enforced by the F-3 eslint `no-restricted-imports` rule). The
// spreadsheet's idioms never leak past this boundary: `readWorkbook` turns a raw
// upload buffer into plain row-major cell matrices, and the PURE parser
// (`parse.ts`) takes it from there with no vendor dependency.
//
// Mirrors `work/legacy-to-canonical/read-workbook.js` (the SECONDARY converter's
// reader): `{ defval: null, raw: true }` so NUMBERS are preserved as numbers (not
// the formatted display strings xlsx would otherwise produce) and empty cells are
// an explicit `null` (so the parser can distinguish "absent" from "" / 0).

import * as XLSX from 'xlsx'

/** A single cell value as xlsx yields it with `raw: true` (number/string/bool/null). */
export type Cell = string | number | boolean | null

/** One workbook, as a map of sheet name → row-major cell matrix. */
export type SheetMatrices = Record<string, Cell[][]>

/**
 * Read an uploaded workbook buffer into plain sheet matrices.
 *
 * `header: 1` returns each sheet as `Cell[][]` (row-major, the first row being the
 * header). `raw: true` preserves numeric/boolean cell types; `defval: null` makes
 * every empty cell an explicit `null` (so a melted-but-blank attribute reads as
 * `null`, never a silently-dropped column). `blankrows: false` skips fully-empty
 * spacer rows — the parser's `rowIndex` therefore counts non-blank rows only,
 * matching the converter writer's output.
 */
export function readWorkbook(buffer: Buffer | Uint8Array): SheetMatrices {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const out: SheetMatrices = {}
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    out[name] = XLSX.utils.sheet_to_json<Cell[]>(ws, {
      header: 1,
      defval: null,
      raw: true,
      blankrows: false,
    })
  }
  return out
}

// ── Canonical workbook parser — the generic, PURE interpreter ─────────────────
//
// ADR-0031 §1-§3 / Wave 1b. THE heart of the primary ingest: a thin, pure,
// self-describing deserializer that reads a canonical workbook's already-read
// sheet matrices and emits the EXISTING bronze contract
// (`RawObsRow/RawClassifierRow/RawDisplayRow`, from `ingest/types.ts`).
//
// PURITY (F-1): no DB, no Fastify, no `xlsx` import here — it takes the cell
// matrices `read-workbook.ts` produced and returns plain data. It is an Interpreter
// that walks the self-describing structure; the DSD's `dimensions` row is the SSOT
// for the dim set + order (Law 1) — the parser NEVER hardcodes 'time'/'geo' and
// iterates `dimensions` building `Record<dim, …>`.
//
// GENERIC by construction:
//   - dims        → read from STRUCTURE.dimensions (F-DIM: a never-seen dim parses)
//   - languages   → `name_<lang>` columns discovered by header scan ∩ activeLocales
//                   (F-LANG: no hardcoded ['ka','en'])
//   - attributes  → every non-core DATA column flows into obsAttribute generically
//                   (`seq_pos`, `contribution_role` need no per-attribute code)

import type {
  RawClassifierRow, RawDisplayRow, RawObsRow,
} from '../types.js'
import type { Cell, SheetMatrices } from './read-workbook.js'
import type {
  CanonicalDsd, CodelistRef, ParseIssue,
} from './types.js'

/** The injected config SSOT: which locales are active (improvement 1, F-LANG). */
export interface ParseCtx {
  /** From `config.locale` (the `validate.ts::fetchActiveLocales` SSOT). */
  activeLocales: string[]
}

export interface ParseResult {
  dsd: CanonicalDsd
  bronze: {
    obs: RawObsRow[]
    classifiers: RawClassifierRow[]
    displays: RawDisplayRow[]
  }
  parseIssues: ParseIssue[]
}

// ── Fixed grammar (the canonical workbook's small DSL — §1) ────────────────────
const STRUCTURE_SHEET = 'STRUCTURE'
const DATA_SHEET = 'DATA'
const TIME_DIM = 'time'
const CL_PREFIX = 'CL_'
const NAME_PREFIX = 'name_'

// DATA core columns (everything else in the header is an attribute column).
const COL_TIME = 'time'
const COL_OBS_VALUE = 'obs_value'
const COL_OBS_STATUS = 'obs_status'

// CL_<dim> fixed columns.
const CL_CODE = 'code'
const CL_PARENT = 'parent'
const CL_ORDER = 'order'

// STRUCTURE core keys (the rest become `meta`).
const KEY_DATASET_CODE = 'dataset_code'
const KEY_DIMENSIONS = 'dimensions'
const KEY_MEASURE = 'measure'

// ── Cell helpers (the boundary between spreadsheet cells and clean data) ───────

/** A header label as a trimmed lowercase string ('' for an absent/blank cell). */
function header(cell: Cell): string {
  return cell == null ? '' : String(cell).trim()
}

/** A cell as a CODE/label string; null/blank → ''. Numbers (e.g. a numeric code) stringify. */
function asStr(cell: Cell): string {
  return cell == null ? '' : String(cell).trim()
}

/** A cell as an obs_value number, or null. Empty/non-numeric → null (validate flags it). */
function asNum(cell: Cell): number | null {
  if (cell == null || cell === '') return null
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null
  const n = Number(String(cell).trim())
  return Number.isFinite(n) ? n : null
}

// ── STRUCTURE → CanonicalDsd ───────────────────────────────────────────────────

/**
 * Parse the STRUCTURE key/value sheet into the DSD. `dimensions` is the SSOT for
 * the ordered dim set (Law 1). `name_<lang>` rows become the locale name bag;
 * `dataset_code`/`dimensions`/`measure` are the core keys, every OTHER key/value
 * row flows into `meta` (the SIMS/ESMS-lite slot, improvement 6).
 */
function parseStructure(
  matrix: Cell[][],
  issues: ParseIssue[],
): CanonicalDsd | null {
  // Row 0 is the ['key','value'] header; subsequent rows are key/value pairs.
  const kv = new Map<string, string>()
  for (let i = 1; i < matrix.length; i++) {
    const k = header(matrix[i]?.[0]).toLowerCase()
    if (!k) continue
    kv.set(k, asStr(matrix[i]?.[1]))
  }

  const datasetCode = kv.get(KEY_DATASET_CODE) ?? ''
  if (!datasetCode) {
    issues.push({ code: 'MISSING_DATASET_CODE', detail: { sheet: STRUCTURE_SHEET } })
    return null
  }

  const dimsRaw = kv.get(KEY_DIMENSIONS) ?? ''
  if (!dimsRaw) {
    issues.push({ code: 'MISSING_DIMENSIONS', detail: { sheet: STRUCTURE_SHEET, datasetCode } })
    return null
  }
  const dimensions = dimsRaw.split(',').map((d) => d.trim()).filter(Boolean)

  // name_<lang> rows → the locale name bag (open; not intersected here — the DSD
  // name carries whatever the workbook declares, the CL labels are the locale-gated
  // surface). Core keys are excluded from `meta`.
  const name: Record<string, string> = {}
  const meta: Record<string, string> = {}
  const CORE = new Set([KEY_DATASET_CODE, KEY_DIMENSIONS, KEY_MEASURE])
  for (const [k, v] of kv) {
    if (k.startsWith(NAME_PREFIX)) {
      name[k.slice(NAME_PREFIX.length)] = v
    } else if (!CORE.has(k)) {
      meta[k] = v
    }
  }

  // Per non-time dim: `declared` (this workbook carries a CL_<dim> sheet). The
  // `reference` case (codelist_ref:<dim> = id/ver) is a reserved seam — the type
  // union carries it; resolution is built on trigger (registry.ts SEAM-DEFER).
  const codelistRefs: Record<string, CodelistRef> = {}
  for (const dim of dimensions) {
    if (dim === TIME_DIM) continue
    codelistRefs[dim] = { kind: 'declared', dim }
  }

  return {
    datasetCode,
    name,
    dimensions,
    measureConcept: kv.get(KEY_MEASURE) ?? 'OBS_VALUE',
    meta,
    codelistRefs,
  }
}

// ── CL_<dim> → RawClassifierRow[] ──────────────────────────────────────────────

/**
 * Parse one `CL_<dim>` sheet into classifier rows. The `name_<lang>` columns are
 * discovered by header scan ∩ `activeLocales` (improvement 1 / F-LANG) — a new
 * `name_fr` column with `fr` active yields an `fr` label; with `fr` inactive it is
 * ignored (no leak). `parent`/`order` are optional (blank → undefined).
 */
function parseCodelist(
  dim: string,
  matrix: Cell[][],
  activeLocales: Set<string>,
  issues: ParseIssue[],
): RawClassifierRow[] {
  const head = (matrix[0] ?? []).map(header)
  const idxCode = head.indexOf(CL_CODE)
  if (idxCode < 0) {
    issues.push({ code: 'BAD_CL_HEADER', detail: { dim, header: head } })
    return []
  }
  const idxParent = head.indexOf(CL_PARENT)
  const idxOrder = head.indexOf(CL_ORDER)

  // Discover name_<lang> columns and gate them by the active-locale set.
  const labelCols: { locale: string; idx: number }[] = []
  for (let c = 0; c < head.length; c++) {
    const h = head[c]
    if (h.startsWith(NAME_PREFIX)) {
      const locale = h.slice(NAME_PREFIX.length)
      if (activeLocales.has(locale)) labelCols.push({ locale, idx: c })
    }
  }

  const out: RawClassifierRow[] = []
  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r] ?? []
    const code = asStr(row[idxCode])
    if (!code) continue // a blank spacer line — skip (no phantom member)

    const label: Record<string, string> = {}
    for (const { locale, idx } of labelCols) {
      const v = asStr(row[idx])
      if (v) label[locale] = v
    }

    const parentRaw = idxParent >= 0 ? asStr(row[idxParent]) : ''
    const orderRaw = idxOrder >= 0 ? row[idxOrder] : null
    const ord = typeof orderRaw === 'number'
      ? orderRaw
      : (orderRaw != null && String(orderRaw).trim() !== '' && Number.isFinite(Number(orderRaw)))
        ? Number(orderRaw)
        : undefined

    out.push({
      dimCode: dim,
      code,
      label,
      parentCode: parentRaw || undefined,
      ord,
      metadata: {},
      rowIndex: r,
    })
  }
  return out
}

// ── DATA → RawObsRow[] ─────────────────────────────────────────────────────────

/**
 * Parse the tidy/long DATA sheet into observation rows. The header is split into:
 * the dim columns (∈ dsd.dimensions, non-time), the fixed time/obs_value/obs_status,
 * and EVERYTHING ELSE → `obsAttribute` (generic — `seq_pos`/`contribution_role`
 * flow through with no per-attribute code). `dimKey` is built by iterating the
 * DSD's non-time dimensions, so its keys are EXACTLY the DSD non-time dims and the
 * existing `validateObs` set-equality check passes by construction (F-5).
 */
function parseData(
  dsd: CanonicalDsd,
  matrix: Cell[][],
  issues: ParseIssue[],
): RawObsRow[] {
  const head = (matrix[0] ?? []).map(header)
  const idxTime = head.indexOf(COL_TIME)
  const idxValue = head.indexOf(COL_OBS_VALUE)
  const idxStatus = head.indexOf(COL_OBS_STATUS)

  if (idxTime < 0 || idxValue < 0) {
    issues.push({
      code: 'BAD_DATA_HEADER',
      detail: { header: head, missing: [idxTime < 0 ? COL_TIME : null, idxValue < 0 ? COL_OBS_VALUE : null].filter(Boolean) },
    })
    return []
  }

  const nonTimeDims = dsd.dimensions.filter((d) => d !== TIME_DIM)

  // Map each non-time DSD dim to its DATA column index (Law-1 generic: keyed off
  // the DSD, not hardcoded names). A dim declared but absent from the header is a
  // structural defect surfaced as BAD_DATA_HEADER.
  const dimIdx = new Map<string, number>()
  for (const dim of nonTimeDims) {
    const idx = head.indexOf(dim)
    if (idx < 0) {
      issues.push({ code: 'BAD_DATA_HEADER', detail: { header: head, missingDim: dim } })
    } else {
      dimIdx.set(dim, idx)
    }
  }

  // Attribute columns = every header column that is neither a DSD dim nor a core
  // column. Captured by INDEX so duplicate/unknown labels still flow through.
  const coreIdx = new Set<number>([idxTime, idxValue, idxStatus].filter((i) => i >= 0))
  const dimIdxSet = new Set(dimIdx.values())
  const attrCols: { name: string; idx: number }[] = []
  for (let c = 0; c < head.length; c++) {
    if (coreIdx.has(c) || dimIdxSet.has(c)) continue
    if (!head[c]) continue
    attrCols.push({ name: head[c], idx: c })
  }

  const out: RawObsRow[] = []
  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r] ?? []
    const timePeriod = asStr(row[idxTime])
    if (!timePeriod && row.every((c) => c == null)) continue // blank spacer

    const dimKey: Record<string, string> = {}
    for (const dim of nonTimeDims) {
      const idx = dimIdx.get(dim)
      dimKey[dim] = idx == null ? '' : asStr(row[idx])
    }

    const obsAttribute: Record<string, unknown> = {}
    for (const { name, idx } of attrCols) {
      const v = row[idx]
      // Preserve the raw cell (number stays number); '' / null means "not present".
      if (v != null && v !== '') obsAttribute[name] = v
    }

    out.push({
      timePeriod,
      dimKey,
      obsValue: asNum(row[idxValue]),
      obsStatus: idxStatus >= 0 ? (asStr(row[idxStatus]) || undefined) : undefined,
      obsAttribute,
      rowIndex: r,
    })
  }
  return out
}

// ── The interpreter ─────────────────────────────────────────────────────────────

/**
 * Parse a canonical workbook's sheet matrices into the DSD + the existing bronze
 * contract. PURE (no IO). Structural defects (missing sheet / bad header) become
 * `parseIssues` (fail-fast at the boundary); if STRUCTURE itself cannot be read,
 * returns an empty-bronze result so the route can 422 with the issues.
 */
export function parseCanonicalWorkbook(
  sheets: SheetMatrices,
  ctx: ParseCtx,
): ParseResult {
  const parseIssues: ParseIssue[] = []
  const empty: ParseResult['bronze'] = { obs: [], classifiers: [], displays: [] }

  const structMatrix = sheets[STRUCTURE_SHEET]
  if (!structMatrix) {
    parseIssues.push({ code: 'MISSING_STRUCTURE', detail: { sheets: Object.keys(sheets) } })
    return { dsd: emptyDsd(), bronze: empty, parseIssues }
  }

  const dsd = parseStructure(structMatrix, parseIssues)
  if (!dsd) return { dsd: emptyDsd(), bronze: empty, parseIssues }

  const activeLocales = new Set(ctx.activeLocales)

  // Codelists: one CL_<dim> sheet per non-time dim (the `declared` path).
  const classifiers: RawClassifierRow[] = []
  for (const dim of dsd.dimensions) {
    if (dim === TIME_DIM) continue
    const sheetName = CL_PREFIX + dim.toUpperCase()
    const clMatrix = sheets[sheetName]
    if (!clMatrix) {
      parseIssues.push({ code: 'MISSING_CL_SHEET', detail: { dim, expectedSheet: sheetName } })
      continue
    }
    classifiers.push(...parseCodelist(dim, clMatrix, activeLocales, parseIssues))
  }

  // Facts: the tidy DATA sheet.
  const dataMatrix = sheets[DATA_SHEET]
  let obs: RawObsRow[] = []
  if (!dataMatrix) {
    parseIssues.push({ code: 'MISSING_DATA', detail: { sheets: Object.keys(sheets) } })
  } else {
    obs = parseData(dsd, dataMatrix, parseIssues)
  }

  // Displays: the canonical CL already carries name_<lang> in the SAME row, so the
  // parser does NOT duplicate obs data per language. Display OVERLAYS remain the
  // separate `displays` lane (displays.ts); emit [] unless a DISPLAY sheet exists
  // (SEAM-DEFER per §2).
  const displays: RawDisplayRow[] = []

  return { dsd, bronze: { obs, classifiers, displays }, parseIssues }
}

/** A well-formed empty DSD for the unreadable-STRUCTURE error path. */
function emptyDsd(): CanonicalDsd {
  return {
    datasetCode: '',
    name: {},
    dimensions: [],
    measureConcept: 'OBS_VALUE',
    meta: {},
    codelistRefs: {},
  }
}

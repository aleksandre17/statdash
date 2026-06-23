// ── displaysRoutes — curator display-overlay CSV round-trip [admin] ────────────
//
// stats.classifier_display holds per-member, per-locale display overrides (the SDMX
// official label "Gross Domestic Product at constant prices" → the platform display
// "Real GDP"). This route gives curators an offline editing loop:
//
//   GET  /export → CSV of every member + its current overlay (read-only, no staging)
//        ↓  curator edits labels in Excel
//   POST /import → CSV (or raw JSON rows) → translate to the standard ingest
//        BronzePayload { displays: RawDisplayRow[] } → createSubmission(kind=
//        'displays') → 202 { jobId }. The conform/validate/publish pipeline does
//        the rest. This route NEVER writes stats.classifier_display directly: every
//        write goes through the Staged Submission Pipeline (the one approval gate).
//
// FORMAT — CSV, not XLSX. No xlsx/exceljs/papaparse dependency is in the workspace
// and adding one is out of scope; Excel reads/writes CSV natively, so the curator
// experience is unchanged. The codec is lib/csv.ts (RFC 4180, dependency-free).
//
// TRANSPORT — the import accepts raw `text/csv` OR `application/json`. We do NOT use
// multipart/form-data: @fastify/multipart is not installed and adding it for a single
// curator route is not justified. A raw CSV upload (Content-Type: text/csv) is the
// dependency-free equivalent of the multipart 'file' field; an `application/json`
// body of { rows: RawDisplayRow[] } is the programmatic path. Postel's Law: liberal
// in what we accept, one canonical BronzePayload downstream.
//
// AUTH — own scope (authPlugin then a curator-role gate: admin OR editor). Mirrors
// ingestRoutes' two-layer guard: 401 = no/invalid token, 403 = valid token wrong role
// (RFC 7235). Display curation is a data-curation surface, not a governance one, so
// editor suffices (same WRITE_ROLES as ingest), unlike the audit-log's admin-only gate.

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { ok, HttpError, parseQuery, parseBody } from '../../lib/http.js'
import { authPlugin } from '../../auth.js'
import { toCsv, parseCsv } from '../../lib/csv.js'
import { createSubmission, AlreadyPublishedError } from '../../ingest/index.js'
import type { RawDisplayRow } from '../../ingest/index.js'

// ── Curator-write role gate (admin OR editor) — same surface as ingestRoutes ───
const WRITE_ROLES = ['admin', 'editor'] as const
function requireWrite(roles: string[] | undefined): void {
  const r = roles ?? []
  if (!WRITE_ROLES.some((role) => r.includes(role))) {
    throw new HttpError(403, 'admin or editor role required')
  }
}

// ── CSV column contract (the lossless round-trip header) ───────────────────────
// Export emits all of these; import reads BY HEADER NAME (not position) so a curator
// may reorder/drop the read-only context columns. official_label_* are context only
// (the SDMX source labels, never written back); display_* are the editable overlay.
const COL = {
  dimCode:           'dim_code',
  code:              'code',
  officialLabelKa:   'official_label_ka',
  officialLabelEn:   'official_label_en',
  locale:            'locale',
  displayLabel:      'display_label',
  displayColor:      'display_color',
  displayFullLabel:  'display_full_label',
  displayExtra:      'display_extra',
} as const

const EXPORT_HEADER = [
  COL.dimCode, COL.code, COL.officialLabelKa, COL.officialLabelEn,
  COL.locale, COL.displayLabel, COL.displayColor, COL.displayFullLabel, COL.displayExtra,
] as const

// Reserved display keys promoted to their own columns; everything else round-trips
// through display_extra. SSOT for the column↔JSONB mapping (used both directions).
const RESERVED_DISPLAY_KEYS = ['label', 'color', 'fullLabel'] as const

const ExportQuery = z.object({
  dimCode: z.string().min(1).optional(),
  locale:  z.string().min(1).optional(),
})

// Programmatic import path: { rows: RawDisplayRow[] }. The CSV path builds the same
// shape, so both converge on one BronzePayload. display is an open bag (unknown
// values), validated downstream by the pipeline's validateDisplays — not here.
const ImportJsonBody = z.object({
  rows: z.array(
    z.object({
      dimCode: z.string().min(1),
      code:    z.string().min(1),
      locale:  z.string().min(1),
      display: z.record(z.unknown()),
    }),
  ).min(1),
  dryRun: z.boolean().optional().default(false),
  source: z.string().min(1).optional(),
})

// ── display JSONB ⇄ CSV cell mapping ──────────────────────────────────────────

/** Pull the reserved keys + a JSON blob of the remainder out of a display bag. */
function displayToColumns(display: Record<string, unknown>): {
  label: string; color: string; fullLabel: string; extra: string
} {
  const asStr = (v: unknown): string => (v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v))
  const extra: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(display)) {
    if (!(RESERVED_DISPLAY_KEYS as readonly string[]).includes(k)) extra[k] = v
  }
  return {
    label:     asStr(display.label),
    color:     asStr(display.color),
    fullLabel: asStr(display.fullLabel),
    // Emit {} (not empty) so the round-trip column is always valid JSON the curator
    // can edit; an empty cell on import is treated as no extra (see columnsToDisplay).
    extra:     Object.keys(extra).length > 0 ? JSON.stringify(extra) : '{}',
  }
}

/**
 * Build a display bag from the CSV cells. Reserved columns become their typed keys;
 * display_extra (when non-empty valid JSON) is merged underneath so an explicit
 * column always wins. Throws on malformed display_extra (fail-fast at the boundary
 * with the row number, rather than silently dropping a curator's edit).
 */
function columnsToDisplay(
  cells: { label: string; color: string; fullLabel: string; extra: string },
  rowIndex: number,
): Record<string, unknown> {
  let extra: Record<string, unknown> = {}
  const raw = cells.extra.trim()
  if (raw !== '' && raw !== '{}') {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new HttpError(400, `row ${rowIndex}: ${COL.displayExtra} is not valid JSON`)
    }
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new HttpError(400, `row ${rowIndex}: ${COL.displayExtra} must be a JSON object`)
    }
    extra = parsed as Record<string, unknown>
  }

  const display: Record<string, unknown> = { ...extra }
  if (cells.label !== '')     display.label = cells.label
  if (cells.color !== '')     display.color = cells.color
  if (cells.fullLabel !== '') display.fullLabel = cells.fullLabel
  return display
}

// ── CSV → RawDisplayRow[] (the thin adapter into the ingest contract) ──────────
// Maps the header by name (Postel: tolerate reordered/extra columns, require only
// the load-bearing ones). dim_code, code, locale are mandatory per data row; a row
// missing any of them fails fast with its line number.
function csvToDisplayRows(csv: string): RawDisplayRow[] {
  const matrix = parseCsv(csv)
  if (matrix.length === 0) throw new HttpError(400, 'CSV is empty')

  const header = matrix[0].map((h) => h.trim())
  const idx = (name: string): number => header.indexOf(name)
  const iDim = idx(COL.dimCode), iCode = idx(COL.code), iLocale = idx(COL.locale)
  if (iDim < 0 || iCode < 0 || iLocale < 0) {
    throw new HttpError(400, `CSV header must include ${COL.dimCode}, ${COL.code}, ${COL.locale}`)
  }
  const iLabel = idx(COL.displayLabel), iColor = idx(COL.displayColor)
  const iFull = idx(COL.displayFullLabel), iExtra = idx(COL.displayExtra)

  const at = (cols: string[], i: number): string => (i >= 0 ? (cols[i] ?? '').trim() : '')

  const rows: RawDisplayRow[] = []
  for (let r = 1; r < matrix.length; r++) {
    const cols = matrix[r]
    const dimCode = at(cols, iDim), code = at(cols, iCode), locale = at(cols, iLocale)
    // A row with no dim/code/locale at all is skipped (a stray blank line); a row
    // with SOME but not all is a curator error → fail fast with the line number.
    if (dimCode === '' && code === '' && locale === '') continue
    if (dimCode === '' || code === '' || locale === '') {
      throw new HttpError(400, `row ${r}: ${COL.dimCode}, ${COL.code} and ${COL.locale} are all required`)
    }
    const display = columnsToDisplay(
      {
        label:     iLabel >= 0 ? (cols[iLabel] ?? '') : '',
        color:     iColor >= 0 ? (cols[iColor] ?? '') : '',
        fullLabel: iFull >= 0 ? (cols[iFull] ?? '') : '',
        extra:     iExtra >= 0 ? (cols[iExtra] ?? '') : '',
      },
      r,
    )
    rows.push({ dimCode, code, locale, display, rowIndex: rows.length })
  }

  if (rows.length === 0) throw new HttpError(400, 'CSV has a header but no data rows')
  return rows
}

export const displaysRoutes: FastifyPluginAsync = async (app) => {
  await app.register(authPlugin)

  // ── text/csv body parser (scoped to this plugin) ────────────────────────────
  // The default Fastify parser only knows application/json. A raw CSV upload arrives
  // as text/csv; we capture the body as a UTF-8 string and let the route decode it.
  // Scoped to this encapsulated plugin so it never affects sibling routes.
  app.addContentTypeParser('text/csv', { parseAs: 'string' }, (_req, body, done) => {
    done(null, body)
  })

  // ── GET /export — current overlays as CSV (read-only, no staging) ───────────-
  // LEFT JOIN so members with NO overlay still appear (empty display_* cells) — the
  // curator sees the full surface they can fill in, not only already-edited members.
  // Optional dimCode/locale narrow the export. When locale is given the LEFT JOIN
  // condition (not a WHERE) keeps members with no row for that locale visible.
  app.get('/export', { onRequest: async (req) => requireWrite(req.jwtPayload?.roles) }, async (req, reply) => {
    const { dimCode, locale } = parseQuery(ExportQuery, req.query)

    const { rows } = await app.pg.query<{
      dim_code: string
      code: string
      label: Record<string, string> | null
      locale: string | null
      display: Record<string, unknown> | null
    }>(
      `SELECT c.dim_code, c.code, c.label, cd.locale, cd.display
         FROM stats.classifier c
         LEFT JOIN stats.classifier_display cd
                ON cd.member_id = c.id
               AND ($2::text IS NULL OR cd.locale = $2)
        WHERE ($1::text IS NULL OR c.dim_code = $1)
        ORDER BY c.dim_code, c.code, cd.locale NULLS FIRST`,
      [dimCode ?? null, locale ?? null],
    )

    const body = rows.map((r) => {
      const d = r.display ? displayToColumns(r.display) : { label: '', color: '', fullLabel: '', extra: '{}' }
      return [
        r.dim_code,
        r.code,
        r.label?.ka ?? '',
        r.label?.en ?? '',
        r.locale ?? '',
        d.label,
        d.color,
        d.fullLabel,
        d.extra,
      ]
    })

    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD (UTC)
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="displays-export-${today}.csv"`)
      .send(toCsv(EXPORT_HEADER, body))
  })

  // ── POST /import — CSV or JSON rows → ingest pipeline submission ─────────────-
  // Thin adapter: parse the input into RawDisplayRow[], wrap in the BronzePayload
  // { displays: [...] }, and hand to the ONE createSubmission service (idempotency +
  // bronze write + worker). Same 202 { jobId } contract as POST /api/ingest/displays.
  app.post('/import', { onRequest: async (req) => requireWrite(req.jwtPayload?.roles) }, async (req, reply) => {
    const contentType = (req.headers['content-type'] ?? '').toLowerCase()

    let displays: RawDisplayRow[]
    let dryRun = false
    let source: string | undefined

    if (contentType.includes('text/csv')) {
      if (typeof req.body !== 'string' || req.body.trim() === '') {
        throw new HttpError(400, 'empty CSV body')
      }
      displays = csvToDisplayRows(req.body)
      // dryRun/source ride as query params on the CSV path (the body is the file).
      const q = parseQuery(
        z.object({ dryRun: z.coerce.boolean().optional().default(false), source: z.string().min(1).optional() }),
        req.query,
      )
      dryRun = q.dryRun
      source = q.source
    } else {
      // application/json (default parser): { rows: RawDisplayRow[] }.
      const body = parseBody(ImportJsonBody, req.body)
      displays = body.rows.map((r, i) => ({ ...r, rowIndex: i }))
      dryRun = body.dryRun
      source = body.source
    }

    try {
      const jobId = await createSubmission(app.pg, app.log, {
        kind: 'displays',
        datasetCode: null, // displays span dimensions, not one dataset (DB chk enforces NULL)
        format: 'xlsx-rows', // the displays conform/parse format the worker expects
        payload: { displays },
        dryRun,
        source: source ?? 'curator-csv-import',
        submittedBy: req.jwtPayload?.sub,
      })
      return reply.status(202).send(ok({ jobId }))
    } catch (err) {
      if (err instanceof AlreadyPublishedError) {
        throw new HttpError(
          409,
          JSON.stringify({ code: 'ALREADY_PUBLISHED', existingJobId: err.existingJobId }),
        )
      }
      throw err
    }
  })
}

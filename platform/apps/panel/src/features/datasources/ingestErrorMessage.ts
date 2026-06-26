// ── ingestErrorMessage — RFC 9457 problem `code` → a friendly, specific message ─
//
//  The error-contract boundary: maps a canonical-upload IngestProblem (the parsed
//  RFC 9457 body) to a curator-facing message. NEVER a raw 500/JSON dump — every
//  branch names what went wrong and (where the body carries them) the specifics:
//  the parse issues, the DSD-change reason. A `code` the panel does not yet know is
//  surfaced as the server's own `detail` (Postel: liberal in what we accept) with a
//  safe generic fallback, so a new server-side code degrades gracefully instead of
//  leaking a blob.
//
//  Pure + isolated from the component so the mapping is unit-tested directly (the
//  spec's "maps a 400 PARSE_ISSUES to a friendly message" check) and reused if a
//  second upload surface ever appears (M-5: one mapping, every caller).
//
import { IngestProblem } from '../../lib/ingestApi'
import { AuthError } from '../../lib/auth'

/** One structural parse issue the route returns in the PARSE_ISSUES extension. */
interface ParseIssue {
  message?: string
  sheet?:   string
  detail?:  string
  [k: string]: unknown
}

/**
 * The parsed structural diff carried on a DSD_INCOMPATIBLE problem. The route ships
 * `dimensionsBefore`/`dimensionsAfter` (the registered vs the uploaded DSD shape) +
 * `reason`. We diff the two dimension lists into the plain-language ADDED / REMOVED
 * sets the governance panel renders — and carry `datasetCode` so the panel can name
 * the dataset and the version flow can re-target it. This is the structured trigger
 * for the "ingest as a new version" UX (SDMX governance — a DSD change is a versioned
 * change, never silent). `versioned` echoes the route's flag (false on this 400 path).
 */
export interface DsdChange {
  datasetCode:      string
  dimensionsBefore: string[]
  dimensionsAfter:  string[]
  /** Dimensions the workbook ADDS over the registered DSD (after − before). */
  added:            string[]
  /** Dimensions the workbook REMOVES from the registered DSD (before − after). */
  removed:          string[]
  /** The route's human reason for the incompatibility (if it sent one). */
  reason?:          string
}

/** Read an extension member as a string[] (tolerant of a missing/non-array value). */
function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}

/**
 * Parse the DSD_INCOMPATIBLE structural diff from the problem body, or null if the
 * body does not carry the versionable shape (Postel: if the route ever omits the
 * dimension lists we fall back to the flat message rather than render an empty panel).
 */
export function parseDsdChange(body: IngestProblem['body']): DsdChange | null {
  if (!body) return null
  const datasetCode = typeof body.datasetCode === 'string' ? body.datasetCode : ''
  if (!datasetCode) return null
  const before = readStringList(body.dimensionsBefore)
  const after  = readStringList(body.dimensionsAfter)
  // Only a real structural diff is versionable here. If neither list is present the
  // route gave us no diff to render — let the caller fall back to the flat message.
  if (before.length === 0 && after.length === 0) return null
  const beforeSet = new Set(before)
  const afterSet  = new Set(after)
  const reason =
    (typeof body.reason === 'string' && body.reason) ||
    (typeof body.contractChange === 'string' && body.contractChange) ||
    undefined
  return {
    datasetCode,
    dimensionsBefore: before,
    dimensionsAfter:  after,
    added:   after.filter((d) => !beforeSet.has(d)),
    removed: before.filter((d) => !afterSet.has(d)),
    reason,
  }
}

/** Read the `parseIssues` extension member as a list of human strings. */
function parseIssueLines(body: IngestProblem['body']): string[] {
  const raw = body?.parseIssues
  if (!Array.isArray(raw)) return []
  return raw
    .map((i) => {
      const issue = i as ParseIssue
      const text = issue.message ?? issue.detail ?? (typeof i === 'string' ? i : undefined)
      return issue.sheet && text ? `${issue.sheet}: ${text}` : (text ?? '')
    })
    .filter((s): s is string => s.length > 0)
}

/**
 * The friendly-error shape the UI renders. `message` is the headline; `lines` carry
 * per-issue detail (PARSE_ISSUES). `dsdChange`, when present (a DSD_INCOMPATIBLE), is
 * the structured trigger for the governance "ingest as a new version" panel — the UI
 * renders that instead of a flat error (a versionable change is a resolution, not a
 * dead end). Thin base + one optional discriminant (no bloating every error shape).
 */
export interface IngestErrorMessage {
  message:    string
  lines:      string[]
  dsdChange?: DsdChange
}

/**
 * Map any thrown upload/publish error to a friendly message. An IngestProblem is
 * mapped by its RFC 9457 `code`; an AuthError names the session; anything else gets
 * a generic, non-leaking fallback. The returned `lines` carry the per-issue detail
 * (PARSE_ISSUES) so the UI can render them as a list under the headline `message`.
 */
export function ingestErrorMessage(err: unknown): IngestErrorMessage {
  if (err instanceof AuthError) {
    return { message: 'სესია ამოიწურა — გთხოვთ თავიდან შეხვიდეთ.', lines: [] }
  }

  if (err instanceof IngestProblem) {
    switch (err.code) {
      case 'PARSE_ISSUES': {
        const lines = parseIssueLines(err.body)
        return { message: 'სამუშაო წიგნის სტრუქტურა არასწორია:', lines }
      }
      case 'DSD_INCOMPATIBLE': {
        // A structural (DSD) change. Parse the dimension diff so the UI can render the
        // governance "ingest as a new version" panel rather than a flat error. If the
        // body lacks the versionable diff shape we still surface a friendly headline
        // (Postel: degrade to the message, never an empty panel).
        const dsdChange = parseDsdChange(err.body)
        // The headline names the route's reason regardless of whether the full diff is
        // present (the panel renders the diff; the headline + live region name the why).
        const reason =
          (typeof err.body?.reason === 'string' && err.body.reason) ||
          (typeof err.body?.contractChange === 'string' && err.body.contractChange) ||
          err.message
        return {
          message: `ეს ცვლის მონაცემთა ნაკრების სტრუქტურას — საჭიროა ახალი ვერსია: ${reason}`,
          lines: [],
          ...(dsdChange ? { dsdChange } : {}),
        }
      }
      case 'ALREADY_PUBLISHED':
        return { message: 'ეს ფაილი უკვე ჩატვირთულია (იდენტური შიგთავსი).', lines: [] }
      case 'EMPTY_WORKBOOK':
        return { message: 'მონაცემები ვერ მოიძებნა — ცარიელი სამუშაო წიგნი.', lines: [] }
      case 'SUBMISSION_REJECTED':
        return { message: `მონაცემი უარყოფილია ვალიდაციისას: ${err.message}`, lines: [] }
      default:
        // A known-shape problem with an unrecognised (or absent) code: surface the
        // server's own occurrence detail — still friendly, never a raw blob.
        return { message: err.message, lines: [] }
    }
  }

  if (err instanceof Error) return { message: err.message, lines: [] }
  return { message: 'ატვირთვა ვერ მოხერხდა.', lines: [] }
}

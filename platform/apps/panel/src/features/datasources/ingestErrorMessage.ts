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
 * Map any thrown upload/publish error to a friendly message. An IngestProblem is
 * mapped by its RFC 9457 `code`; an AuthError names the session; anything else gets
 * a generic, non-leaking fallback. The returned `lines` carry the per-issue detail
 * (PARSE_ISSUES) so the UI can render them as a list under the headline `message`.
 */
export function ingestErrorMessage(err: unknown): { message: string; lines: string[] } {
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
        // The route carries the reason as `reason` / `contractChange` / the change
        // detail spread onto the body. Prefer an explicit `reason`, else the detail.
        const reason =
          (typeof err.body?.reason === 'string' && err.body.reason) ||
          (typeof err.body?.contractChange === 'string' && err.body.contractChange) ||
          err.message
        return {
          message: `ეს ცვლის მონაცემთა ნაკრების სტრუქტურას — საჭიროა ახალი ვერსია: ${reason}`,
          lines: [],
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

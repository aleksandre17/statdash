// ── canonicalRoutes — canonical-workbook UPLOAD [admin|editor] ─────────────────
//
// ADR-0031 §2/§5/§6 Wave 3a. THE primary steady-state ingest surface: a curator
// POSTs a conformant canonical workbook (.xlsx bytes) and it lands in the EXISTING
// Staged Submission Pipeline as up to three submissions — codelists, displays, facts
// — IN DEPENDENCY ORDER. The route is the boundary that parses the spreadsheet; the
// worker NEVER sees Excel (`format:'canonical-xlsx'` is a provenance LABEL, not a
// worker branch — exactly the displays.ts CSV-at-boundary precedent).
//
// FLOW (mirrors admin/displays.ts EXACTLY):
//   POST /api/ingest/canonical  raw application/octet-stream body (the .xlsx bytes),
//   requireWrite (admin|editor) →
//     1. readWorkbook(buffer)              the ONLY xlsx boundary (ACL).
//     2. parseCanonicalWorkbook(sheets,…)  generic, self-describing → bronze + DSD.
//        fail-fast structural parseIssues  → 400 (the workbook could not be read).
//     3. sourceDigest = SHA-256(bytes)     PROV lineage (≠ createSubmission's payload hash).
//     4. PRE-PASS precheckContractCompat   an unversioned DSD_INCOMPATIBLE → 400/block
//        (do NOT submit); CODELIST_EXTENDED/DEPRECATED warns are carried forward (the
//        pipeline records them at validate; they never block — codelist OPEN, DSD GATED).
//     5. for each NON-EMPTY kind IN ORDER (codelists → displays → facts):
//        createSubmission({ format:'canonical-xlsx', payload, sourceDigest, provenance }).
//        Order matters: classifier members must exist in gold before the facts that
//        reference them validate (validateObs checks codes against gold is_current).
//   → 202 { jobIds }.   409 on duplicate identical bytes (the Idempotent Receiver —
//        an identical already-published payload for the same dataset).
//
// AUTH — own scope (authPlugin then a curator-role gate: admin OR editor), the same
// two-layer guard + WRITE_ROLES as ingestRoutes / displaysRoutes. 401 = no/invalid
// token, 403 = valid token wrong role (RFC 7235).
//
// TRANSPORT — raw application/octet-stream (the .xlsx bytes), not multipart: the
// displays.ts decision (no @fastify/multipart for a single curator route). A raw
// binary upload is the dependency-free equivalent of the multipart 'file' field.

import type { FastifyPluginAsync } from 'fastify'
import { createHash } from 'node:crypto'
import { ok, HttpError } from '../../lib/http.js'
import { problem, alreadyPublished } from '../../lib/problem.js'
import { authPlugin } from '../../auth.js'
import {
  createSubmission, AlreadyPublishedError, fetchActiveLocales, precheckContractCompat,
} from '../../ingest/index.js'
import type {
  RawObsRow, RawClassifierRow, RawDisplayRow, DsdSnapshot,
} from '../../ingest/index.js'
import { readWorkbook } from '../../ingest/canonical/read-workbook.js'
import { parseCanonicalWorkbook } from '../../ingest/canonical/parse.js'
import type { CanonicalDsd } from '../../ingest/canonical/types.js'
import { recognizeReferenceMetadata } from '../../ingest/reference-metadata-map.js'

// ── Curator-write role gate (admin OR editor) — same surface as ingestRoutes ───
const WRITE_ROLES = ['admin', 'editor'] as const
function requireWrite(roles: string[] | undefined): void {
  const r = roles ?? []
  if (!WRITE_ROLES.some((role) => r.includes(role))) {
    throw new HttpError(403, 'admin or editor role required')
  }
}

// The provenance label on every submission from this route. A pure string at the
// createSubmission boundary (the DB `format` column is text — no enum migration; the
// worker does not branch on it). Pinned so the audit trail records which parser ran.
const FORMAT = 'canonical-xlsx'
const PARSER_VERSION = 'canonical-workbook@1'

// The max upload (bytes). The largest real fixture is ~380 KB; 25 MB is generous
// headroom for a multi-sheet workbook while bounding a hostile upload (fail-fast).
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

/** One submission this upload produced — the kind + its pipeline jobId. */
interface KindJob {
  kind: 'codelists' | 'displays' | 'facts'
  jobId: string
}

/**
 * Build the DECLARED DsdSnapshot for the compat pre-pass from the parsed DSD + the
 * emitted classifier rows. dims + measure come from STRUCTURE; members are the codes
 * this workbook declares per dim (so the classifier can diff them against gold). A
 * dataset_version STRUCTURE row (if present) lets a governed DSD change pass.
 */
function declaredSnapshot(dsd: CanonicalDsd, classifiers: RawClassifierRow[]): DsdSnapshot {
  const members: Record<string, string[]> = {}
  for (const c of classifiers) {
    ;(members[c.dimCode] ??= []).push(c.code)
  }
  const datasetVersion = (dsd.meta.dataset_version ?? '').trim() || undefined
  return {
    datasetCode: dsd.datasetCode,
    dimensions: dsd.dimensions,
    measureConcept: dsd.measureConcept,
    members,
    datasetVersion,
  }
}

export const canonicalRoutes: FastifyPluginAsync = async (app) => {
  await app.register(authPlugin)

  // ── octet-stream body parser (scoped to this plugin) ────────────────────────
  // The default Fastify parser only knows application/json. The .xlsx upload arrives
  // as application/octet-stream; capture it as a Buffer and let the route decode it.
  // Scoped to this encapsulated plugin so it never affects sibling routes (mirrors
  // displays.ts's text/csv parser). bodyLimit bounds a hostile upload (fail-fast).
  app.addContentTypeParser(
    'application/octet-stream',
    { parseAs: 'buffer', bodyLimit: MAX_UPLOAD_BYTES },
    (_req, body, done) => { done(null, body) },
  )

  // ── POST / — upload a canonical workbook → up to 3 ordered submissions ──────-
  app.post('/', { onRequest: async (req) => requireWrite(req.jwtPayload?.roles) }, async (req, reply) => {
    const buffer = req.body
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new HttpError(400, 'empty body — POST the .xlsx bytes as application/octet-stream')
    }

    // 1+2. Read (xlsx ACL) → parse (generic, pure). A spreadsheet xlsx can't open →
    // fail-fast 400 (a malformed upload, not a server fault).
    let sheets
    try {
      sheets = readWorkbook(buffer)
    } catch (err) {
      throw new HttpError(400, `could not read workbook: ${err instanceof Error ? err.message : 'unknown error'}`)
    }

    const activeLocales = await fetchActiveLocales(app.pg)
    const { dsd, bronze, parseIssues } = parseCanonicalWorkbook(sheets, { activeLocales })

    // Structural defects (missing sheet / bad header) fail fast at the boundary — the
    // curator sees exactly why the workbook could not be read (RFC 9457, machine-readable
    // `parseIssues` extension member, never a stringified blob).
    if (parseIssues.length > 0) {
      throw problem('bad-request', 'canonical workbook has structural issues', {
        code: 'PARSE_ISSUES',
        datasetCode: dsd.datasetCode || null,
        parseIssues,
      })
    }

    // 3. sourceDigest — SHA-256 of the RAW source bytes. Distinct from createSubmission's
    // contentHash (which hashes the JSON payload); this is the W3C-PROV source-entity id.
    const sourceDigest = createHash('sha256').update(buffer).digest('hex')
    const sourceFilename =
      typeof req.headers['x-filename'] === 'string' ? req.headers['x-filename'] : undefined

    // 4. PRE-PASS — data-contract compatibility. An UNVERSIONED DSD change is the gate:
    // block (400) and do NOT submit. Codelist deltas (extend/deprecate) are warns the
    // pipeline records at validate — they are carried forward, never blocked here.
    const declared = declaredSnapshot(dsd, bronze.classifiers)
    const change = await precheckContractCompat(app.pg, declared)
    const blockingDsd = change.issues.find((i) => i.code === 'DSD_INCOMPATIBLE' && i.severity === 'error')
    if (blockingDsd) {
      throw problem('bad-request', 'canonical workbook DSD is incompatible with the registered dataset', {
        code: 'DSD_INCOMPATIBLE',
        datasetCode: dsd.datasetCode,
        contractChange: change.kind,
        ...blockingDsd.detail,
      })
    }

    // The shared provenance bag, stamped on EVERY submission this upload produces.
    const provenance = { parserVersion: PARSER_VERSION, sourceDigest, sourceFilename }
    const submittedBy = req.jwtPayload?.sub
    const source = sourceFilename ? `canonical-upload:${sourceFilename}` : 'canonical-upload'

    // The recognized V31 metadata projection (Wave 3b) rides on the FACTS payload (the
    // dataset-scoped submission); the publish path lands it as an SCD-2 report row.
    const referenceMetadata = recognizeReferenceMetadata(dsd.meta)

    // 5. Submit each NON-EMPTY kind IN ORDER: codelists → displays → facts. Order is
    // load-bearing — classifier members must exist in gold before the facts that
    // reference them validate (validateObs checks codes against gold is_current=true).
    const jobs: KindJob[] = []
    try {
      if (bronze.classifiers.length > 0) {
        const jobId = await createSubmission(app.pg, app.log, {
          kind: 'codelists',
          datasetCode: null, // codelists span dimensions, not one dataset (DB chk enforces NULL)
          format: FORMAT,
          payload: { classifiers: bronze.classifiers } satisfies { classifiers: RawClassifierRow[] },
          dryRun: false,
          source, submittedBy, sourceDigest, provenance,
        })
        jobs.push({ kind: 'codelists', jobId })
      }

      if (bronze.displays.length > 0) {
        const jobId = await createSubmission(app.pg, app.log, {
          kind: 'displays',
          datasetCode: null,
          format: FORMAT,
          payload: { displays: bronze.displays } satisfies { displays: RawDisplayRow[] },
          dryRun: false,
          source, submittedBy, sourceDigest, provenance,
        })
        jobs.push({ kind: 'displays', jobId })
      }

      if (bronze.obs.length > 0) {
        const jobId = await createSubmission(app.pg, app.log, {
          kind: 'facts',
          datasetCode: dsd.datasetCode, // facts are dataset-scoped (DB chk enforces NON-NULL)
          format: FORMAT,
          // referenceMetadata (Wave 3b) is carried on the facts blob; publishFacts lands it.
          payload: {
            obs: bronze.obs,
            ...(referenceMetadata ? { referenceMetadata } : {}),
          } satisfies { obs: RawObsRow[]; referenceMetadata?: typeof referenceMetadata },
          dryRun: false,
          source, submittedBy, sourceDigest, provenance,
        })
        jobs.push({ kind: 'facts', jobId })
      }
    } catch (err) {
      if (err instanceof AlreadyPublishedError) {
        // 409 — an identical payload was already published (Idempotent Receiver). The
        // one shared factory carries { code, existingJobId } as RFC 9457 extension
        // members (SSOT with the JSON ingest + curator-import surfaces).
        throw alreadyPublished(err.existingJobId)
      }
      throw err
    }

    if (jobs.length === 0) {
      // A well-formed workbook with no codelists, no displays, and no observations has
      // nothing to ingest — a curator error, surfaced rather than a silent 202.
      throw problem('bad-request', 'canonical workbook produced no submissions (no codelists, displays, or observations)', {
        code: 'EMPTY_WORKBOOK',
        datasetCode: dsd.datasetCode,
      })
    }

    return reply.status(202).send(ok({
      datasetCode: dsd.datasetCode,
      sourceDigest,
      jobIds: jobs,
    }))
  })
}

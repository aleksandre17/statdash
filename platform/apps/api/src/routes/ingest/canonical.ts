// ── canonicalRoutes — canonical-workbook UPLOAD [admin|editor] ─────────────────
//
// ADR-0031 §2/§5/§6 Wave 3a. THE primary steady-state ingest surface: a curator
// POSTs a conformant canonical workbook (.xlsx bytes) and it lands in the EXISTING
// Staged Submission Pipeline as up to three submissions — codelists, displays, facts
// — IN DEPENDENCY ORDER. The route is the boundary that parses the spreadsheet; the
// worker NEVER sees Excel (`format:'canonical-xlsx'` is a provenance LABEL, not a
// worker branch — exactly the displays.ts CSV-at-boundary precedent).
//
// FLOW (mirrors admin/displays.ts at the boundary; orchestrates seed-pipeline ordering):
//   POST /api/ingest/canonical  raw application/octet-stream body (the .xlsx bytes),
//   requireWrite (admin|editor) →
//     1. readWorkbook(buffer)              the ONLY xlsx boundary (ACL).
//     2. parseCanonicalWorkbook(sheets,…)  generic, self-describing → bronze + DSD.
//        fail-fast structural parseIssues  → 400 (the workbook could not be read).
//     3. sourceDigest = SHA-256(bytes)     PROV lineage (≠ createSubmission's payload hash).
//     4. PRE-PASS precheckContractCompat   an unversioned DSD_INCOMPATIBLE → 400/block
//        (do NOT submit); CODELIST_EXTENDED/DEPRECATED warns are carried forward (the
//        pipeline records them at validate; they never block — codelist OPEN, DSD GATED).
//     5. ORCHESTRATE the seed-pipeline ORDERING (the e2e ordering bug fix). The pipeline
//        requires REFERENCE DATA published to GOLD before facts validate — validateObs
//        checks every code against stats.classifier is_current=true. A single batched
//        submit (codelists+displays+facts, each staged-and-validated immediately) breaks
//        this: facts validate while the classifiers are only STAGED, never gold → every
//        code rejects UNKNOWN_CODE. So this route drives each REFERENCE kind FULLY to gold
//        FIRST, exactly like scripts/seed-pipeline.ts submitAndPublish (submit → drain the
//        worker → poll 'staged' → publish → poll 'published'), THEN submits facts:
//          a. codelists (if any) → submitToGold (auto-published; additive, compat-gated).
//          b. displays  (if any) → submitToGold (auto-published; additive, compat-gated).
//          c. facts               → createSubmission + drive to 'staged' ONLY. The facts are
//             the approval-gated DATA: the route returns the facts jobId STAGED, awaiting a
//             curator's POST /jobs/:id/publish. It does NOT auto-publish them.
//        Reference data (codelists/displays) auto-publishing in the route is correct + safe:
//        they are additive and already governed by the compat pre-pass (CODELIST_EXTENDED/
//        DEPRECATED/DSD_INCOMPATIBLE). The facts stay behind the publish/approval gate.
//   → 202 { jobIds }: the published codelist/display summaries + the facts jobId (staged,
//        the one the curator approves).   409 on duplicate identical bytes (the Idempotent
//        Receiver — an identical already-published payload for the same dataset).
//        400 on parse issues / unversioned DSD_INCOMPATIBLE / empty workbook.
//
// THE WORKER NEVER SEES EXCEL: the route parses at the boundary; the worker/publish only
// ever read the JSON bronze blob. We drive the worker IN-PROCESS (runIngestionWorker over
// app.pg, a Pool) so staging is deterministic — createSubmission fires the worker via
// setImmediate (out of band), so a naive "submit then publish" would race an unstaged job.
// runIngestionWorker DRAINS every claimable 'received' row and only returns once none
// remain claimable; we then poll the job FSM to its terminal staging status (fail-fast on
// rejected/failed) before reusing the SAME publish path (publishSubmission) — no duplicate
// publish logic. SKIP LOCKED makes the racing setImmediate worker a harmless no-op.
//
// AUTH — own scope (authPlugin then a curator-role gate: admin OR editor), the same
// two-layer guard + WRITE_ROLES as ingestRoutes / displaysRoutes. 401 = no/invalid
// token, 403 = valid token wrong role (RFC 7235).
//
// TRANSPORT — raw application/octet-stream (the .xlsx bytes), not multipart: the
// displays.ts decision (no @fastify/multipart for a single curator route). A raw
// binary upload is the dependency-free equivalent of the multipart 'file' field.

import type { FastifyPluginAsync, FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { createHash } from 'node:crypto'
import { ok, HttpError } from '../../lib/http.js'
import { problem, alreadyPublished, tooManyRequests } from '../../lib/problem.js'
import { authPlugin } from '../../auth.js'
import { BulkheadRejectedError, createBulkhead, type Bulkhead } from '../../lib/bulkhead.js'
import {
  createSubmission, AlreadyPublishedError, fetchActiveLocales, precheckContractCompat,
  mintDatasetVersion,
} from '../../ingest/index.js'
import type {
  RawObsRow, RawClassifierRow, RawDisplayRow, VersionMintResult,
} from '../../ingest/index.js'
import { readWorkbook } from '../../ingest/canonical/read-workbook.js'
import { parseCanonicalWorkbook } from '../../ingest/canonical/parse.js'
import { recognizeReferenceMetadata } from '../../ingest/reference-metadata-map.js'
import {
  resolveDeclaredVersion, declaredSnapshot, buildMintPlan,
} from './canonical-dsd-inputs.js'
import {
  submitToGold, driveToStaged, readStatus, type KindJob,
} from './canonical-fsm-drive.js'

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

// Retry-After (seconds) advertised when the ingest bulkhead sheds a request: the
// drive is fast, so a short backoff lets a legitimate caller retry promptly.
const INGEST_SHED_RETRY_AFTER_SECONDS = 5

// The in-process FSM drive (readStatus / driveToStaged / submitToGold) + KindJob live
// in ./canonical-fsm-drive.js — this file is the HTTP boundary + orchestration only.

// The bulkhead is injected at the app layer (index.ts) so it is ONE semaphore
// shared across all uploads. It defaults to an unbounded passthrough for tests /
// offline use (no shedding) — production always wires a bounded instance.
const PASSTHROUGH_BULKHEAD: Bulkhead = createBulkhead({
  name: 'ingest-passthrough', maxConcurrent: Number.MAX_SAFE_INTEGER, maxQueue: 0,
})

export const canonicalRoutes = (bulkhead: Bulkhead = PASSTHROUGH_BULKHEAD): FastifyPluginAsync => async (app) => {
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
  // BULKHEAD (API-11): the whole synchronous drive (parse → stage → publish
  // reference → stage facts) runs under a bounded-concurrency semaphore so a burst
  // of large uploads cannot saturate the event loop + pg pool. Beyond N concurrent
  // + a small queue, the request is LOAD-SHED with a 429 (Retry-After), fail-fast,
  // rather than piling onto an overloaded server.
  app.post('/', { onRequest: async (req) => requireWrite(req.jwtPayload?.roles) }, async (req, reply) => {
    try {
      return await bulkhead.run(() => handleCanonicalUpload(app, req, reply))
    } catch (err) {
      if (err instanceof BulkheadRejectedError) {
        throw tooManyRequests(
          'ingest is saturated — too many concurrent uploads; retry shortly',
          INGEST_SHED_RETRY_AFTER_SECONDS,
          'INGEST_BUSY',
        )
      }
      throw err
    }
  })
}

// The upload handler proper — extracted so the route registration stays a thin
// bulkhead wrapper. Returns the 202 reply or throws an RFC 9457 Problem.
async function handleCanonicalUpload(
  app: FastifyInstance,
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<unknown> {
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
    //
    // VERSION RESOLUTION (the governance vehicle): ?datasetVersion / x-dataset-version /
    // STRUCTURE row (query wins). A declared version flips a DSD change from a 400 gate
    // to a governed warn (compat.ts) — the SDMX-canonical "new version" response to a
    // structural change. WITHOUT a version a DSD change stays 400 (the gate holds).
    const declaredVersion = resolveDeclaredVersion(
      dsd,
      typeof (req.query as Record<string, unknown>)?.datasetVersion === 'string'
        ? (req.query as { datasetVersion: string }).datasetVersion : undefined,
      typeof req.headers['x-dataset-version'] === 'string'
        ? req.headers['x-dataset-version'] : undefined,
    )
    const declared = declaredSnapshot(dsd, bronze.classifiers, declaredVersion)
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

    // A VERSIONED DSD change is the GOVERNED path: the gate did not block (the warn-
    // governed branch), so this is a new dataset VERSION. Detect it = the change is a
    // dsd-change AND a version was declared (compat.ts marked dsdDelta.versioned). The
    // actual mint is applied below — AFTER reference data lands in gold, BEFORE facts are
    // submitted — because the DSD widen must be committed before validateObs/the V4 gold
    // trigger check the facts' dim_key against the (now new) structure.
    const isVersionedDsdChange =
      change.kind === 'dsd-change' && change.dsdDelta?.versioned === true && !!declaredVersion

    // The shared provenance bag, stamped on EVERY submission this upload produces.
    const provenance = { parserVersion: PARSER_VERSION, sourceDigest, sourceFilename }
    const submittedBy = req.jwtPayload?.sub
    const source = sourceFilename ? `canonical-upload:${sourceFilename}` : 'canonical-upload'

    // The recognized V31 metadata projection (Wave 3b) rides on the FACTS payload (the
    // dataset-scoped submission); the publish path lands it as an SCD-2 report row.
    const referenceMetadata = recognizeReferenceMetadata(dsd.meta)

    // 5. ORCHESTRATE the seed-pipeline ORDERING (submit → stage → PUBLISH → next kind):
    // REFERENCE DATA (codelists, then displays) is driven FULLY to gold BEFORE facts are
    // submitted, so classifier members exist in gold (stats.classifier is_current=true)
    // before validateObs checks the facts' codes against them. This is the fix for the
    // e2e ordering bug: a single batched submit validated facts while the classifiers
    // were only STAGED → every code rejected UNKNOWN_CODE.
    const jobs: KindJob[] = []
    let versionMint: VersionMintResult | undefined
    try {
      // a. Codelists → published gold (auto-published: additive + compat-gated reference data).
      if (bronze.classifiers.length > 0) {
        jobs.push(await submitToGold(app.pg, app.log, {
          kind: 'codelists',
          datasetCode: null, // codelists span dimensions, not one dataset (DB chk enforces NULL)
          format: FORMAT,
          payload: { classifiers: bronze.classifiers } satisfies { classifiers: RawClassifierRow[] },
          dryRun: false,
          source, submittedBy, sourceDigest, provenance,
        }, { userId: submittedBy }))
      }

      // b. Displays → published gold (auto-published: additive overlays on the members).
      if (bronze.displays.length > 0) {
        jobs.push(await submitToGold(app.pg, app.log, {
          kind: 'displays',
          datasetCode: null,
          format: FORMAT,
          payload: { displays: bronze.displays } satisfies { displays: RawDisplayRow[] },
          dryRun: false,
          source, submittedBy, sourceDigest, provenance,
        }, { userId: submittedBy }))
      }

      // b.5. VERSION MINT (the governed structural change). When the pre-pass classified
      // a VERSIONED dsd-change, apply it NOW — after the codelist members for the new
      // dim(s) are in gold, BEFORE facts are submitted. mintDatasetVersion widens
      // stats.dataset_dimension to the canonical STRUCTURE (adds the new dim in order),
      // records the version label on the dataset's metadata slot, and bumps the V6 ETag
      // counter (the new version row). It is ATOMIC + IDEMPOTENT: a re-ingest of the same
      // versioned workbook converges (no dup dim, no dup version churn beyond the counter).
      // Old observations are untouched (as-of preserved). The facts submitted next then
      // validate against the NEW (widened) DSD — DIM_KEY_MISMATCH no longer fires.
      if (isVersionedDsdChange && bronze.obs.length > 0) {
        versionMint = await mintDatasetVersion(
          app.pg,
          buildMintPlan(dsd, bronze.classifiers, declaredVersion as string),
        )
      }

      // c. Facts → STAGED ONLY (the approval-gated DATA). createSubmission + drive to
      // 'staged'; the facts now validate against the PUBLISHED classifiers. We return the
      // facts jobId staged — the curator approves it via POST /jobs/:id/publish. We do
      // NOT auto-publish facts: the publish/approval gate is preserved by design.
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
        await driveToStaged(app.pg, app.log, jobId)
        jobs.push({ kind: 'facts', jobId, status: await readStatus(app.pg, jobId) })
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
      // Present ONLY on a governed versioned DSD-change: the minted version label, the
      // dims added to the series key, and the new ETag counter. Absent on every routine /
      // codelist-only / non-versioned ingest (the panel keys its "new version" UX on it).
      ...(versionMint ? { versionMint } : {}),
    }))
}

// ════════════════════════════════════════════════════════════════════════
// seed-pipeline.ts — bronze PRODUCER for the Staged Submission Pipeline
// ════════════════════════════════════════════════════════════════════════
//
// ROLE (Strangler-Fig completion): the seed's direct stats.* upserts are
// replaced by API calls through the Medallion pipeline. This script no longer
// touches the database — it is a pure bronze producer that POSTs the same three
// static bundles to the Submission API and waits for each job to PUBLISH.
//
//   bundle data  →  BronzePayload { obs?, classifiers?, displays? }  →  POST
//                →  worker drains to `staged`  →  POST /jobs/:id/publish
//                →  `published` (gold).
//
// The OLD direct path lives on in seed.ts under SEED_MODE=direct (default) for
// CI that runs without the API server. SEED_MODE=pipeline selects THIS path.
//
// DEPENDENCY ORDER (same invariant as the direct seed, so the gold validation
// trigger always has its referents present before facts arrive):
//   1. codelists (classifier members)  → publish
//   2. displays  (per-member overlays)  → publish
//   3. facts     (observations, per dataset) → publish
//
// The bundle→Raw*Row[] mappers live in seed-pipeline-payloads.ts (one concern).
// NO new deps: Node 18+ global fetch for HTTP, no pg, no axios.
// ════════════════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { RawObsRow, RawClassifierRow, RawDisplayRow } from '../src/ingest/types.js'

// ── BronzePayload (the worker's parseBronze contract) ─────────────────────
interface BronzePayload {
  obs?: RawObsRow[]
  classifiers?: RawClassifierRow[]
  displays?: RawDisplayRow[]
}

// ── Extracted seed-data files (ADR-0028 SSOT) ─────────────────────────────
// The TS dataset bundles + their mappers (seed-pipeline-payloads.ts) were
// deleted when geostat was de-tenanted (ADR-0028 D5). The committed files under
// ops/seed-data/geostat/ ARE the bronze payloads now — the EXACT `format:'bundle'`
// shape the worker's parseBronze reads — so this producer reads + POSTs them
// verbatim (no mapper, no re-projection: the id→code/geo-inject/seqPos work
// already happened at extraction time).
const here = dirname(fileURLToPath(import.meta.url))
const SEED_DATA_DIR = resolve(here, '../../../../ops/seed-data/geostat')
const FACTS_DIR = resolve(SEED_DATA_DIR, 'facts')

function readBundle(path: string): BronzePayload {
  return JSON.parse(readFileSync(path, 'utf8')) as BronzePayload
}

// ════════════════════════════════════════════════════════════════════════
// HTTP client — Node global fetch. Fail-fast on every non-2xx (Postel: we are
// conservative in what we send and strict in what we accept back).
// ════════════════════════════════════════════════════════════════════════

const PORT = process.env.PORT ?? '3001'
const BASE_URL = process.env.API_BASE_URL ?? `http://localhost:${PORT}`

interface Envelope<T> { data?: T; error?: string; message?: string }

async function apiPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  const env = (await res.json().catch(() => ({}))) as Envelope<T>
  if (!res.ok) {
    throw new Error(`POST ${path} → ${res.status}: ${env.message ?? env.error ?? res.statusText}`)
  }
  return env.data as T
}

async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  })
  const env = (await res.json().catch(() => ({}))) as Envelope<T>
  if (!res.ok) {
    throw new Error(`GET ${path} → ${res.status}: ${env.message ?? env.error ?? res.statusText}`)
  }
  return env.data as T
}

// ── Auth: exchange admin credentials for a JWT (bootstrap or DB-backed) ───
async function login(): Promise<string> {
  const username = process.env.ADMIN_USERNAME
  const password = process.env.ADMIN_PASSWORD
  if (!username || !password) {
    throw new Error('[seed:pipeline] ADMIN_USERNAME and ADMIN_PASSWORD are required to authenticate')
  }
  const { token } = await apiPost<{ token: string }>('/api/auth', { username, password })
  return token
}

// ════════════════════════════════════════════════════════════════════════
// Submission + polling. The worker drains received → staged; a curator (here,
// the producer itself, with admin rights) then publishes staged → published.
// Full automated cycle: submit → wait(staged) → publish → wait(published).
// ════════════════════════════════════════════════════════════════════════

const POLL_INTERVAL_MS = 2_000
const POLL_TIMEOUT_MS = 60_000

type JobKind = 'facts' | 'codelists' | 'displays'

interface JobView {
  job: { id: string; status: string; stagedCount?: number }
  issuesBySeverity: { error: number; warn: number; info: number }
  canPublish: boolean
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** POST a bronze payload to the submission API; return the new jobId. */
async function postIngest(
  kind: JobKind,
  payload: BronzePayload,
  opts: { datasetCode?: string; dryRun?: boolean; format: string; token: string },
): Promise<string> {
  const body: Record<string, unknown> = {
    format: opts.format,
    payload,
    dryRun: opts.dryRun ?? false,
    source: 'seed:pipeline',
  }
  if (kind === 'facts') body.datasetCode = opts.datasetCode
  const { jobId } = await apiPost<{ jobId: string }>(`/api/ingest/${kind}`, body, opts.token)
  return jobId
}

/** Poll one job until it reaches a target status; throw on failed/rejected/timeout. */
async function waitForStatus(
  jobId: string,
  token: string,
  target: 'staged' | 'published',
): Promise<JobView> {
  const deadline = Date.now() + POLL_TIMEOUT_MS
  for (;;) {
    const view = await apiGet<JobView>(`/api/ingest/jobs/${jobId}`, token)
    const status = view.job.status

    if (status === target) return view
    if (status === 'published' && target === 'staged') return view // already past target
    if (status === 'failed' || status === 'rejected') {
      await reportIssuesAndThrow(jobId, token, status)
    }

    if (Date.now() >= deadline) {
      throw new Error(`[seed:pipeline] job ${jobId} did not reach '${target}' within ${POLL_TIMEOUT_MS / 1000}s (last status: '${status}')`)
    }
    await sleep(POLL_INTERVAL_MS)
  }
}

/** Print the full per-row validation report, then throw (fail-fast, non-zero exit). */
async function reportIssuesAndThrow(jobId: string, token: string, status: string): Promise<never> {
  const { issues } = await apiGet<{ issues: Array<{ severity: string; code: string; rowIndex?: number; detail: unknown }> }>(
    `/api/ingest/jobs/${jobId}/issues`, token,
  )
  console.error(`[seed:pipeline] job ${jobId} ${status.toUpperCase()} — ${issues.length} issue(s):`)
  for (const i of issues) {
    console.error(`  [${i.severity}] ${i.code} row=${i.rowIndex ?? '-'} ${JSON.stringify(i.detail)}`)
  }
  throw new Error(`[seed:pipeline] job ${jobId} ${status}; aborting`)
}

/** Submit → wait(staged) → publish → wait(published). One full bronze→gold cycle. */
async function submitAndPublish(
  step: string,
  kind: JobKind,
  payload: BronzePayload,
  opts: { datasetCode?: string; format: string; token: string },
): Promise<void> {
  const jobId = await postIngest(kind, payload, opts)
  console.log(`[seed:pipeline] ${step} submitted → job ${jobId}`)

  const staged = await waitForStatus(jobId, opts.token, 'staged')
  if (staged.job.status === 'published') {
    console.log(`[seed:pipeline] ${step} already published (idempotent re-run).`)
    return
  }
  if (staged.issuesBySeverity.warn > 0) {
    console.log(`[seed:pipeline] ${step} staged with ${staged.issuesBySeverity.warn} warning(s).`)
  }

  const result = await apiPost<{ preview?: { newRows: number; revisedRows: number; unchangedRows: number } }>(
    `/api/ingest/jobs/${jobId}/publish`, {}, opts.token,
  )
  await waitForStatus(jobId, opts.token, 'published')

  const p = result.preview
  const summary = p
    ? `new=${p.newRows} revised=${p.revisedRows} unchanged=${p.unchangedRows}`
    : `staged=${staged.job.stagedCount ?? '?'}`
  console.log(`[seed:pipeline] ${step} published. ${summary}`)
}

// ════════════════════════════════════════════════════════════════════════
// Orchestration — codelists → displays → facts, each its own publish cycle.
// The codelists/displays files are ALREADY cross-dataset merged + re-indexed
// (export-seed-data), so they POST verbatim; facts stay per-dataset (a facts
// submission is dataset-scoped by the API contract).
// ════════════════════════════════════════════════════════════════════════

const FACT_DATASETS = ['GDP_ANNUAL', 'ACCOUNTS_SEQUENCE', 'REGIONAL_GVA'] as const

export async function seedViaPipeline(): Promise<void> {
  console.log(`[seed:pipeline] target API: ${BASE_URL}`)
  const token = await login()
  console.log('[seed:pipeline] authenticated.')

  // 1. Codelists (classifier members) — the merged file, then publish.
  const classifiers = readBundle(resolve(SEED_DATA_DIR, 'codelists.bundle.json')).classifiers ?? []
  await submitAndPublish('codelists', 'codelists', { classifiers }, { format: 'bundle', token })

  // 2. Displays (per-member overlays) — the merged file, then publish.
  const displays = readBundle(resolve(SEED_DATA_DIR, 'displays.bundle.json')).displays ?? []
  await submitAndPublish('displays', 'displays', { displays }, { format: 'bundle', token })

  // 3. Facts — one submission per dataset (dataset-scoped by contract).
  for (const datasetCode of FACT_DATASETS) {
    const obs = readBundle(resolve(FACTS_DIR, `${datasetCode}.bundle.json`)).obs ?? []
    await submitAndPublish(`${datasetCode} facts`, 'facts', { obs },
      { datasetCode, format: 'bundle', token })
  }

  console.log('[seed:pipeline] done — all datasets published through the pipeline.')
}

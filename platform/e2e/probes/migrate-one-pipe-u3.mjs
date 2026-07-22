// ── migrate-one-pipe-u3 — the governed corpus rewrite (ONE-PIPE §5·U3, owner-ordered) ──
//
//  Rewrites every STORED sugar-dialect DataSpec (page-config `data` fields + the
//  data-specs collection) onto the canonical `pipeline` spine via the ENGINE's OWN
//  `desugarToPipeline` (never a re-implementation). Safety rails, in order:
//    1. FULL backup of every original artifact → work/data-spec-backups/one-pipe-u3-<ts>/
//    2. Per-spec parity BEFORE any write:
//         a. `extractRequirements(orig, ctx)` ≡ `extractRequirements(lowered, ctx)`
//            for the two canonical ctx modes (the pipeline-equiv fitness precedent);
//         b. `desugar(lowered) === lowered` (canonical idempotence, reference identity).
//       ANY parity failure → the whole artifact is SKIPPED (no partial page writes).
//    3. DRY RUN by default — set APPLY=1 to write (PUT via the panel's own API).
//  U2-blocked kinds (ratio-list / row-list / multi-code growth) are LEFT + counted
//  (the recon says zero exist; a non-zero count here is a finding, not a failure).
//
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
// Engine imported via the built dist directly (the probe dir has no workspace link);
// the dist is the EXACT artifact the deployed panel bundles — same truth, no drift.
import { desugar, desugarToPipeline, extractRequirements } from '../../packages/core/dist/index.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const OUT = resolve(HERE, '..', '..', '..', 'work', 'data-spec-backups', `one-pipe-u3-${TS}`)
mkdirSync(resolve(OUT, 'pages'), { recursive: true })
const BASE = process.env.PW_BASE_URL ?? 'http://192.168.1.199:3013'
const APPLY = process.env.APPLY === '1'
const log = (stage, data) => console.log(JSON.stringify({ stage, ...data }))

// The sugar kinds the live switch folds (U1) — rewritable now. `growth` only single-code.
const FOLDED = new Set(['query', 'transform', 'pivot', 'timeseries'])
const isSingleCodeGrowth = (s) => s?.type === 'growth' && !Array.isArray(s.code)
const isBlocked = (s) => s?.type === 'ratio-list' || s?.type === 'row-list' ||
  (s?.type === 'growth' && Array.isArray(s.code))
const isSugar = (s) => s && typeof s === 'object' && (FOLDED.has(s.type) || isSingleCodeGrowth(s))

const CTX_MODES = [
  { dims: {} },
  { dims: { time: '2024' } },
]

function deepEq(a, b) { return JSON.stringify(a) === JSON.stringify(b) }

/** Lower ONE spec with full parity; returns { lowered } or { fail } . */
function lowerWithParity(orig, where) {
  const lowered = desugarToPipeline(orig)
  if (lowered === orig || lowered.type !== 'pipeline') return { fail: `${where}: did not lower (type=${lowered.type})` }
  for (const ctx of CTX_MODES) {
    let a, b
    try { a = extractRequirements(orig, ctx) } catch (e) { a = `ERR:${e.message}` }
    try { b = extractRequirements(lowered, ctx) } catch (e) { b = `ERR:${e.message}` }
    if (!deepEq(a, b)) return { fail: `${where}: requirements diverge under ctx=${JSON.stringify(ctx.dims)}` }
  }
  if (desugar(lowered) !== lowered) return { fail: `${where}: lowered form not canonical-idempotent` }
  return { lowered }
}

/** Recursively rewrite `data`-resident sugar specs in a config tree. Returns counts. */
function rewriteTree(node, path, counts, failures) {
  if (Array.isArray(node)) {
    node.forEach((c, i) => rewriteTree(c, `${path}[${i}]`, counts, failures))
    return
  }
  if (!node || typeof node !== 'object') return
  for (const [k, v] of Object.entries(node)) {
    if (k === 'data' && isSugar(v)) {
      const r = lowerWithParity(v, `${path}.data(${v.type})`)
      if (r.fail) { failures.push(r.fail); counts.failed++ }
      else { node[k] = r.lowered; counts.lowered++; counts.byKind[v.type] = (counts.byKind[v.type] ?? 0) + 1 }
      continue // never recurse INTO a spec
    }
    if (k === 'data' && isBlocked(v)) { counts.blocked++; continue }
    if (v && typeof v === 'object') rewriteTree(v, `${path}.${k}`, counts, failures)
  }
}

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
await page.waitForTimeout(1500)
const passField = page.locator('input[type="password"]').first()
if (await passField.count()) {
  await page.locator('input[name="username"], input[type="text"]').first().fill('admin').catch(() => {})
  await passField.fill(process.env.PW_ADMIN_PW ?? 'dev_admin_pw_123').catch(() => {})
  await page.locator('button[type="submit"], button:has-text("შესვლა"), button:has-text("Login")').first().click().catch(() => {})
  await page.waitForTimeout(4000)
}
const token = await page.evaluate(() => sessionStorage.getItem('geostat_panel_token'))
if (!token) { log('fatal', { error: 'no auth token' }); process.exit(1) }
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
const unwrap = (j) => (j && typeof j === 'object' && 'data' in j ? j.data : j)

async function GET(p) { const r = await page.request.get(BASE + '/api/config' + p, { headers }); return { status: r.status(), body: unwrap(await r.json().catch(() => null)) } }
async function PUT(p, body) { const r = await page.request.put(BASE + '/api/config' + p, { headers, data: body }); return { status: r.status(), body: await r.text().then((t) => t.slice(0, 300)).catch(() => '') } }

const summary = { pages: [], dataSpecs: [], apply: APPLY }

// ── Pages ──────────────────────────────────────────────────────────────────────
const pageList = (await GET('/pages')).body ?? []
for (const row of pageList) {
  const det = (await GET(`/pages/${row.id}`)).body
  const config = det?.config
  if (!config) { summary.pages.push({ id: row.id, note: 'no config' }); continue }
  writeFileSync(resolve(OUT, 'pages', `${row.id}.json`), JSON.stringify(det, null, 2))
  const counts = { lowered: 0, blocked: 0, failed: 0, byKind: {} }
  const failures = []
  const next = JSON.parse(JSON.stringify(config))
  rewriteTree(next, `page(${det.slug ?? row.id})`, counts, failures)
  const entry = { id: row.id, slug: det.slug ?? det.path, ...counts, failures }
  if (counts.failed > 0) { entry.action = 'SKIPPED (parity failure)' }
  else if (counts.lowered === 0) { entry.action = 'unchanged' }
  else if (APPLY) {
    const res = await PUT(`/pages/${row.id}`, { config: next })
    entry.action = `PUT ${res.status}`
    if (res.status >= 300) entry.putBody = res.body
  } else entry.action = 'DRY (would PUT)'
  summary.pages.push(entry)
}

// ── Data-specs collection ──────────────────────────────────────────────────────
const specList = (await GET('/data-specs')).body ?? []
writeFileSync(resolve(OUT, 'data-specs-original.json'), JSON.stringify(specList, null, 2))
for (const rowRef of specList) {
  const row = (await GET(`/data-specs/${rowRef.id}`)).body ?? rowRef
  const spec = row.spec
  const entry = { id: row.id, name: row.name, type: spec?.type }
  if (isBlocked(spec)) entry.action = 'BLOCKED (U2 kind, left)'
  else if (!isSugar(spec)) entry.action = 'unchanged'
  else {
    const r = lowerWithParity(spec, `data-spec(${row.name})`)
    if (r.fail) entry.action = `SKIPPED: ${r.fail}`
    else if (APPLY) {
      const res = await PUT(`/data-specs/${row.id}`, { spec: r.lowered })
      entry.action = `PUT ${res.status}`
      if (res.status >= 300) entry.putBody = res.body
    } else entry.action = 'DRY (would PUT)'
  }
  summary.dataSpecs.push(entry)
}

writeFileSync(resolve(OUT, 'migration-summary.json'), JSON.stringify(summary, null, 2))
log('summary', {
  backupDir: OUT,
  pages: summary.pages.map((p) => ({ slug: p.slug ?? p.id, lowered: p.lowered, blocked: p.blocked, failed: p.failed, action: p.action })),
  specs: summary.dataSpecs.reduce((acc, s) => { acc[s.action?.split(':')[0] ?? '?'] = (acc[s.action?.split(':')[0] ?? '?'] ?? 0) + 1; return acc }, {}),
})
await browser.close()

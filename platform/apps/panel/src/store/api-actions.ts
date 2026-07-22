// ── API-backed async actions (thunks) ─────────────────────────────────────────
//
//  The Zustand store stays purely synchronous (single source of truth, no async
//  in reducers). These standalone thunks own the API round-trip and then write
//  through to the store. Components call these instead of the raw store actions
//  whenever a change must persist.
//
//  Init = read path (load all layers in parallel on boot).
//  Thunks = write path (create = server-assigns-id-then-store;
//           update/delete = optimistic store-then-sync).
//

import type {
  DataSourceDef,
  NamedDataSpec,
  SiteDef,
  CanvasPage,
} from '../types/constructor'
import { useConstructorStore } from './constructor.store'
import { useDataSpecDraftStore } from './dataSpecDraft.store'
import { useDataSpecPublishStore } from './dataSpecPublish.store'
import type { DataSpec } from '@statdash/engine'
import type { RevisionSummary, ConfigViolation } from '@statdash/contracts'
import {
  configApi,
  ApiError,
  fromApiDataSource,
  fromApiDataSpec,
  fromApiSite,
  fromApiPage,
  toApiPage,
  type PageVersionRow,
} from '../lib/api'
import type { PageStatus } from './constructor.lifecycle'
import type { SaveIssue } from '../save/saveGuard'
import { resolveActiveLocales } from '../inspector/useActiveLocales'
import { newNodeId } from '../canvas/nodeId'

/** Coerce a server status string into the lifecycle FSM enum (default draft). */
function toPageStatus(raw: string | undefined): PageStatus {
  return raw === 'published' || raw === 'archived' ? raw : 'draft'
}

// ── Save guard error — raised when a page fails the C5 four-check gate ────────
//
//  The Constructor must ONLY emit configs that pass migrate-identity +
//  round-trip + per-node-valid + locale-complete. createPage/savePage run the
//  guard BEFORE the API write and throw this on failure — shifting the failure
//  LEFT to authoring time (the caller renders `issues` inline) instead of
//  letting an invalid config reach the server / gold gate.
export class SaveGuardError extends Error {
  readonly issues: SaveIssue[]
  constructor(issues: SaveIssue[]) {
    super(`Page failed ${issues.length} save check${issues.length === 1 ? '' : 's'}`)
    this.name = 'SaveGuardError'
    this.issues = issues
  }
}

// The save guard pulls the engine graph (nodeRegistry + canvasPageAdapter +
// validateField → @statdash/react/engine, ~150 kB). It is reached ONLY on a save
// (createPage / savePage), never on boot, so it is loaded lazily here to keep the
// engine chunk off the eager boot path. The save thunks are already async, so the
// dynamic import is transparent (same behavior, deferred load).
const loadSaveGuard = () => import('../save/saveGuard')

/** Run the C5 save guard for a page against the session's active locales. */
async function assertSaveable(page: CanvasPage): Promise<void> {
  const { validatePageForSave } = await loadSaveGuard()
  const { activeLocales, defaultLocale } = useConstructorStore.getState().site
  const report = validatePageForSave(page, {
    activeLocales: resolveActiveLocales(activeLocales, defaultLocale),
  })
  if (!report.ok) throw new SaveGuardError(report.issues)
}

// ── Init ──────────────────────────────────────────────────────────────────────
// Load every layer in parallel on app start. Returns true on success, false if
// the API is unreachable (caller then seeds mock data — graceful degradation).
export async function initFromApi(): Promise<boolean> {
  try {
    const [sources, specs, siteMap, navRows, pageList] = await Promise.all([
      configApi.dataSources.list(),
      configApi.dataSpecs.list(),
      configApi.site.get(),
      configApi.nav.list(),
      configApi.pages.list(),
    ])

    // Hydrate page trees from their latest version. Bound the fan-out so a large
    // site does not open hundreds of parallel connections on boot.
    const pageDetails = await Promise.all(
      pageList.slice(0, 20).map((p) => configApi.pages.get(p.id)),
    )

    const store = useConstructorStore.getState()
    // Hydrate is an authoritative REPLACE of the sources/specs/pages collections
    // (setDataSources/setDataSpecs/setPages), never an incremental append
    // (addDataSource/addDataSpec/addPage) — idempotent under a re-run of this whole
    // function (React StrictMode's double-invoked boot effect, or a re-init after
    // re-login), so it can never duplicate a source/spec/page id / duplicate a React
    // key in the Data-modeling panel's lists or the page tablist / top-bar page
    // Select. See store/constructor.pages.ts setPagesPatch (the pattern this mirrors).
    store.setDataSources(sources.map(fromApiDataSource))
    store.setDataSpecs(specs.map(fromApiDataSpec))
    // Re-apply crash-persisted drafts over the just-loaded published specs (C3 — a draft
    // survives reload; a stale one is dropped). Runs after the authoritative REPLACE.
    rehydrateDataSpecDrafts()
    store.updateSite(fromApiSite(siteMap, navRows))
    store.setPages(pageDetails.map(fromApiPage))
    pageDetails.forEach((p) => {
      // Reflect the server FSM for each loaded page (status + published flag).
      // A freshly-loaded page is clean (no local edits yet) — dirty:false. Keyed by
      // id (a record merge, not an append) so this loop is already idempotent.
      store.reflectLifecycle(p.id, {
        status:          toPageStatus(p.status),
        versionNumber:   p.version_number,
        latestPublished: p.is_published === true,
        dirty:           false,
      })
    })
    if (pageDetails[0]) store.setActivePage(pageDetails[0].id)
    return true
  } catch (e) {
    console.warn('[api] init failed, falling back to mock data', e)
    return false
  }
}

// ── Data sources ───────────────────────────────────────────────────────────────

export async function createDataSource(
  input: Omit<DataSourceDef, 'id' | 'status'>,
): Promise<DataSourceDef> {
  // Server assigns the UUID + initial status — store after the round-trip.
  const row = await configApi.dataSources.create({
    name: input.name,
    type: input.type,
    url: input.url,
    config: input.config,
  })
  const ds = fromApiDataSource(row)
  useConstructorStore.getState().addDataSource(ds)
  return ds
}

export async function updateDataSource(
  id: string,
  patch: Partial<DataSourceDef>,
): Promise<void> {
  useConstructorStore.getState().updateDataSource(id, patch) // optimistic
  try {
    await configApi.dataSources.update(id, {
      name: patch.name,
      type: patch.type,
      url: patch.url,
      config: patch.config,
      status: patch.status,
    })
  } catch (e) {
    console.error('[api] updateDataSource failed', e)
    // No rollback — user can retry. Phase 3 adds proper error recovery.
  }
}

export async function deleteDataSource(id: string): Promise<void> {
  useConstructorStore.getState().removeDataSource(id) // optimistic
  try {
    await configApi.dataSources.delete(id)
  } catch (e) {
    console.error('[api] deleteDataSource failed', e)
  }
}

/**
 * Re-list data sources from the server and replace the store's set. The refresh
 * path after an OUT-OF-BAND write the panel did not author through the CRUD thunks
 * — e.g. an Excel ingest that publishes new gold data. Returns true on success,
 * false on an API failure (the caller keeps the stale-but-usable list — graceful
 * degradation, never a blank list). Read-only sync, so it never throws to the UI.
 */
export async function refreshDataSources(): Promise<boolean> {
  try {
    const rows = await configApi.dataSources.list()
    useConstructorStore.getState().setDataSources(rows.map(fromApiDataSource))
    return true
  } catch (e) {
    console.error('[api] refreshDataSources failed', e)
    return false
  }
}

// ── Data specs ──────────────────────────────────────────────────────────────────

export async function createDataSpec(
  input: Omit<NamedDataSpec, 'id'>,
): Promise<NamedDataSpec> {
  const row = await configApi.dataSpecs.create({
    name: input.name,
    description: input.description,
    spec: input.spec as Record<string, unknown>,
  })
  const spec = fromApiDataSpec(row)
  useConstructorStore.getState().addDataSpec(spec)
  return spec
}

// ── Authoring Lifecycle — draft → explicit publish → revision (ADR-052 · C3) ─────
//
//  The auto-save era is OVER (DESIGN-0104 §2·C3, superseding the debounced PUT + the
//  authoring-hold that gated it). Every edit is a DRAFT by default: the optimistic
//  store write stays IMMEDIATE (the controlled workbench value reflects the edit at
//  once — snappy, in-session UX unchanged), and the edit is recorded CLIENT-SIDE in
//  the draft store (localStorage-persisted, crash-safe). NO durable PUT fires here —
//  a spec reaches the server ONLY through an explicit `publishDataSpec` gesture. This
//  is the integrity boundary a live public statistical portal needs (Law 9): the
//  author decides when a change is real, and a validated PUT is the gate it passes.

/** Record an edit as a draft — optimistic store write + client-side draft (NO PUT). */
export function updateDataSpec(id: string, patch: Partial<NamedDataSpec>): void {
  const store = useConstructorStore.getState()
  // The published-before value (the draft's base on the FIRST edit) — captured BEFORE
  // the optimistic write, so discard always returns to the genuinely-published spec.
  const before = store.dataSpecs.find((s) => s.id === id)?.spec
  // Optimistic + IMMEDIATE — the in-session UI stays live regardless of persistence.
  store.updateDataSpec(id, patch)
  // Track the draft only for a spec edit (a `spec` patch); a bare name/description patch
  // still writes optimistically but the lifecycle chip counts SPEC changes.
  const after = useConstructorStore.getState().dataSpecs.find((s) => s.id === id)?.spec
  if (patch.spec !== undefined && before !== undefined && after !== undefined) {
    useDataSpecDraftStore.getState().recordEdit(id, before, after)
  }
}

/**
 * Publish the spec's current draft — the explicit gesture that durably persists it via
 * the VALIDATED PUT (ADR-052). On 422 `config-invalid` the failing checks are surfaced
 * as `violations[]` on the publish store (rendered AT their fields — never a toast-and-
 * swallow). On success the server appends a revision and the draft is cleared. Returns
 * the outcome so a caller (the band) can react without a try/catch.
 */
export async function publishDataSpec(
  id: string,
): Promise<{ ok: boolean; violations?: boolean }> {
  const pub = useDataSpecPublishStore.getState()
  const spec = useConstructorStore.getState().dataSpecs.find((s) => s.id === id)
  if (!spec) return { ok: false }
  pub.setPublish(id, { phase: 'publishing' })
  try {
    await configApi.dataSpecs.update(id, {
      name:        spec.name,
      description: spec.description,
      spec:        spec.spec as Record<string, unknown>,
    })
    // Durable — the draft is now the published truth; drop it (changeCount → clean).
    useDataSpecDraftStore.getState().clearDraft(id)
    pub.setPublish(id, { phase: 'published' })
    return { ok: true }
  } catch (e) {
    const violations = configViolationsOf(e)
    if (violations) {
      // Honest, machine-readable rejection — the edit stays a draft, retryable.
      pub.setPublish(id, { phase: 'error', violations })
      return { ok: false, violations: true }
    }
    const message = e instanceof Error ? e.message : 'Publish failed'
    console.error('[api] publishDataSpec failed', e)
    pub.setPublish(id, { phase: 'error', error: message })
    return { ok: false }
  }
}

/** The `violations[]` of a 422 `config-invalid` ApiError, or null for any other error. */
function configViolationsOf(e: unknown): ConfigViolation[] | null {
  if (!(e instanceof ApiError) || e.status !== 422) return null
  const problem = e.problem
  if (problem && Array.isArray(problem.violations)) return problem.violations as ConfigViolation[]
  return null
}

/**
 * Discard the current draft — drop the unpublished edit and restore the published base
 * into the store (client-side, no round-trip). Idempotent: a no-op when clean.
 */
export function discardDataSpec(id: string): void {
  const draft = useDataSpecDraftStore.getState().getDraft(id)
  if (!draft) return
  useConstructorStore.getState().updateDataSpec(id, { spec: draft.base })
  useDataSpecDraftStore.getState().clearDraft(id)
  useDataSpecPublishStore.getState().clearPublish(id)
}

/** Fetch a spec's append-only revision history (genesis backfill → never empty). */
export async function fetchDataSpecRevisions(id: string): Promise<RevisionSummary[]> {
  try {
    return await configApi.dataSpecs.revisions(id)
  } catch (e) {
    console.error('[api] fetchDataSpecRevisions failed', e)
    return []
  }
}

/**
 * Restore a historical revision as the live document — a NEW validated revision
 * server-side (admin-gated). A 403 surfaces as `forbidden` (needs admin, honest — never
 * reimplemented client-side); a stale body may 422 with violations. On success the
 * restored body is hydrated into the store and any local draft is dropped.
 */
export async function restoreDataSpecRevision(
  id: string,
  revId: string,
): Promise<{ ok: boolean; forbidden?: boolean; violations?: boolean }> {
  const pub = useDataSpecPublishStore.getState()
  pub.setPublish(id, { phase: 'publishing' })
  try {
    const row = await configApi.dataSpecs.restore(id, revId)
    const restored = fromApiDataSpec(row)
    const store = useConstructorStore.getState()
    if (store.dataSpecs.some((s) => s.id === id)) store.updateDataSpec(id, restored)
    else store.addDataSpec(restored)
    useDataSpecDraftStore.getState().clearDraft(id)
    pub.setPublish(id, { phase: 'published' })
    return { ok: true }
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) {
      pub.setPublish(id, { phase: 'forbidden', error: e.message })
      return { ok: false, forbidden: true }
    }
    const violations = configViolationsOf(e)
    if (violations) {
      pub.setPublish(id, { phase: 'error', violations })
      return { ok: false, violations: true }
    }
    const message = e instanceof Error ? e.message : 'Restore failed'
    console.error('[api] restoreDataSpecRevision failed', e)
    pub.setPublish(id, { phase: 'error', error: message })
    return { ok: false }
  }
}

/**
 * Re-apply any crash-persisted drafts over the freshly-loaded published specs (called by
 * initFromApi after the authoritative REPLACE). A draft whose `base` still matches the
 * loaded published spec is re-applied (the in-session edit survives a reload); a draft
 * whose base has DRIFTED (the doc was published elsewhere) is dropped — published wins,
 * never a silent resurrection of an edit onto a changed base (Law 11).
 */
export function rehydrateDataSpecDrafts(): void {
  const draftStore = useDataSpecDraftStore.getState()
  const constructor = useConstructorStore.getState()
  const deepEqual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
  for (const [id, draft] of Object.entries(draftStore.drafts)) {
    const published = constructor.dataSpecs.find((s) => s.id === id)?.spec
    if (published !== undefined && deepEqual(published, draft.base)) {
      constructor.updateDataSpec(id, { spec: draft.current as DataSpec })
    } else {
      draftStore.clearDraft(id) // stale (published advanced) or the doc is gone
    }
  }
}

export async function deleteDataSpec(id: string): Promise<void> {
  useConstructorStore.getState().removeDataSpec(id) // optimistic
  try {
    await configApi.dataSpecs.delete(id)
  } catch (e) {
    console.error('[api] deleteDataSpec failed', e)
  }
}

// ── Site ───────────────────────────────────────────────────────────────────────
// The site PUT is a key/value upsert — we send the flat identity/theme fields.
// Nav is its own resource (config.nav_item); it is not part of this save.
export async function saveSite(patch: Partial<SiteDef>): Promise<void> {
  useConstructorStore.getState().updateSite(patch) // optimistic
  try {
    const map: Record<string, unknown> = {}
    if (patch.name !== undefined) map.name = patch.name
    if (patch.defaultLocale !== undefined) map.defaultLocale = patch.defaultLocale
    if (patch.logo !== undefined) map.logo = patch.logo
    if (patch.themeOverrides !== undefined) map.themeOverrides = patch.themeOverrides
    if (patch.dataSourceBindings !== undefined)
      map.dataSourceBindings = patch.dataSourceBindings
    // Chrome per-element config (Phase C) — persisted as SiteManifest.chrome.
    if (patch.chrome !== undefined) map.chrome = patch.chrome
    if (Object.keys(map).length > 0) await configApi.site.update(map)
  } catch (e) {
    console.error('[api] saveSite failed', e)
  }
}

// ── Pages ──────────────────────────────────────────────────────────────────────

export async function createPage(input: Omit<CanvasPage, 'id'>): Promise<CanvasPage> {
  // Two distinct ids meet on the create path (root-cause of the id lifecycle):
  //   • page IDENTITY — the server-owned key, assigned by the POST and read back
  //     below as the store key + lifecycle key.
  //   • config ROOT-NODE id — a node id like every child; the emitted config must
  //     carry a NON-EMPTY one or (a) the engine's INVALID_ID guard 400s the POST
  //     and (b) the client save-guard's round-trip is asymmetric (absent id
  //     hydrates back to a synthesized 'page', breaking the identity check).
  // So mint a provisional root-node id from the ONE node-id factory (never id:''),
  // guard + POST with it, then adopt the server identity into the stored page. The
  // first real save reconciles the persisted config's root id to that identity.
  const rootId = newNodeId()
  // C5 save guard — block an invalid config before it ever reaches the server.
  await assertSaveable({ ...input, id: rootId })
  const { id } = await configApi.pages.create(toApiPage({ ...input, id: rootId }))
  const page: CanvasPage = { ...input, id }
  const store = useConstructorStore.getState()
  store.addPage(page)
  // A new page starts as a clean draft at version 1 (POST creates the first
  // version) — reflect the server FSM so the workflow shows the right state.
  store.reflectLifecycle(id, { status: 'draft', versionNumber: 1, latestPublished: false, dirty: false })
  return page
}

/**
 * Open a page for authoring: fetch its latest version, hydrate the flat canvas
 * store from the persisted NodePageConfig tree, reflect the server FSM, and make
 * it the active page. The single read-path entry the page-list "open" uses.
 */
export async function openPage(id: string): Promise<CanvasPage | null> {
  try {
    const row = await configApi.pages.get(id)
    const page = fromApiPage(row)
    const store = useConstructorStore.getState()
    // Replace (not duplicate) any already-loaded copy, then reflect + activate.
    if (store.pages.some((p) => p.id === id)) store.updatePage(id, page)
    else store.addPage(page)
    store.reflectLifecycle(id, {
      status:          toPageStatus(row.status),
      versionNumber:   row.version_number,
      latestPublished: row.is_published === true,
      dirty:           false,
    })
    store.setActivePage(id)
    return page
  } catch (e) {
    console.error('[api] openPage failed', e)
    return null
  }
}

/**
 * Save the active draft. Runs the C5 save-guard BEFORE the API call and records
 * the outcome on the store (saveStatus[id]) so the workflow renders blocking
 * issues inline (shift-left) WITHOUT the caller needing a try/catch. Returns the
 * guard report so callers that DO want the result inline (tests) can read it.
 */
export async function savePage(
  id: string,
  patch: Partial<Omit<CanvasPage, 'nodes'>> = {},
): Promise<{ ok: boolean; issues: SaveIssue[] }> {
  const store = useConstructorStore.getState()
  if (Object.keys(patch).length > 0) store.updatePage(id, patch) // optimistic

  // Re-read the merged page so the version snapshot is whole (config = the full
  // canvas tree), never a partial that would orphan nodeIds from nodes.
  const merged = useConstructorStore.getState().pages.find((p) => p.id === id)
  if (!merged) {
    const issues: SaveIssue[] = []
    store.setSaveStatus(id, { issues, error: 'Page not found', saved: false })
    return { ok: false, issues }
  }

  // C5 save guard — runs on the WHOLE merged page (the artefact persisted). The
  // guard is the gate: a failure is an authoring error to fix (recorded as inline
  // issues), never a config that reaches the server. Loaded lazily (see
  // loadSaveGuard) so the engine graph it pulls stays off the eager boot path.
  const { validatePageForSave } = await loadSaveGuard()
  const report = validatePageForSave(merged, {
    activeLocales: resolveActiveLocales(store.site.activeLocales, store.site.defaultLocale),
  })
  if (!report.ok) {
    store.setSaveStatus(id, { issues: report.issues, saved: false })
    return report
  }

  try {
    const res = await configApi.pages.update(id, toApiPage(merged))
    // Saving a new version supersedes any previously-published one — the latest
    // version is now an unpublished draft until publish promotes it again.
    store.reflectLifecycle(id, {
      status:          'draft',
      versionNumber:   res.version_number,
      latestPublished: false,
      dirty:           false,
    })
    store.setSaveStatus(id, { issues: [], saved: true })
    return { ok: true, issues: [] }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Save failed'
    store.setSaveStatus(id, { issues: [], error: message, saved: false })
    return { ok: false, issues: [] }
  }
}

/**
 * Publish the page's latest version (server FSM draft→published). Admin-gated:
 * a 403 is surfaced as `forbidden` (needs publisher/admin) — NEVER reimplemented
 * client-side. On success the server FSM is reflected (status:published, the
 * latest version is now the published one).
 */
export async function publishPage(id: string): Promise<{ ok: boolean; forbidden: boolean }> {
  const store = useConstructorStore.getState()
  try {
    await configApi.pages.publish(id)
    store.reflectLifecycle(id, { status: 'published', latestPublished: true })
    store.setPublishStatus(id, { forbidden: false })
    return { ok: true, forbidden: false }
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) {
      store.setPublishStatus(id, { forbidden: true, error: e.message })
      return { ok: false, forbidden: true }
    }
    const message = e instanceof Error ? e.message : 'Publish failed'
    store.setPublishStatus(id, { forbidden: false, error: message })
    return { ok: false, forbidden: false }
  }
}

/** Fetch a page's append-only version history (newest first). Read path. */
export async function fetchVersions(id: string): Promise<PageVersionRow[]> {
  try {
    return await configApi.pages.versions(id)
  } catch (e) {
    console.error('[api] fetchVersions failed', e)
    return []
  }
}

export async function deletePage(id: string): Promise<void> {
  useConstructorStore.getState().removePage(id) // optimistic (soft-archive on API)
  try {
    await configApi.pages.delete(id)
  } catch (e) {
    console.error('[api] deletePage failed', e)
  }
}

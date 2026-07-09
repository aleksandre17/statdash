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
    sources.forEach((r) => store.addDataSource(fromApiDataSource(r)))
    specs.forEach((r) => store.addDataSpec(fromApiDataSpec(r)))
    store.updateSite(fromApiSite(siteMap, navRows))
    // Hydrate is an authoritative REPLACE of the pages collection (setPages), never
    // an incremental append (addPage) — idempotent under a re-run of this whole
    // function (React StrictMode's double-invoked boot effect, or a re-init after
    // re-login), so it can never duplicate a page id / duplicate a React key in the
    // page tablist or top-bar page Select. See store/constructor.pages.ts setPagesPatch.
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

export async function updateDataSpec(
  id: string,
  patch: Partial<NamedDataSpec>,
): Promise<void> {
  useConstructorStore.getState().updateDataSpec(id, patch) // optimistic
  try {
    await configApi.dataSpecs.update(id, {
      name: patch.name,
      description: patch.description,
      spec: patch.spec as Record<string, unknown> | undefined,
    })
  } catch (e) {
    console.error('[api] updateDataSpec failed', e)
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
  // C5 save guard — block an invalid config before it ever reaches the server.
  await assertSaveable({ ...input, id: '' })
  const { id } = await configApi.pages.create(toApiPage({ ...input, id: '' }))
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

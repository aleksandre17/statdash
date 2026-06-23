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
  fromApiDataSource,
  fromApiDataSpec,
  fromApiSite,
  fromApiPage,
  toApiPage,
} from '../lib/api'
import { validatePageForSave, type SaveIssue } from '../save/saveGuard'
import { orderLocales } from '../inspector/useActiveLocales'

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

/** Run the C5 save guard for a page against the session's active locales. */
function assertSaveable(page: CanvasPage): void {
  const { defaultLocale } = useConstructorStore.getState().site
  const report = validatePageForSave(page, { activeLocales: orderLocales(defaultLocale) })
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
    pageDetails.forEach((p) => store.addPage(fromApiPage(p)))
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
    if (Object.keys(map).length > 0) await configApi.site.update(map)
  } catch (e) {
    console.error('[api] saveSite failed', e)
  }
}

// ── Pages ──────────────────────────────────────────────────────────────────────

export async function createPage(input: Omit<CanvasPage, 'id'>): Promise<CanvasPage> {
  // C5 save guard — block an invalid config before it ever reaches the server.
  assertSaveable({ ...input, id: '' })
  const { id } = await configApi.pages.create(toApiPage({ ...input, id: '' }))
  const page: CanvasPage = { ...input, id }
  useConstructorStore.getState().addPage(page)
  return page
}

export async function savePage(id: string, patch: Partial<CanvasPage>): Promise<void> {
  const store = useConstructorStore.getState()
  store.updatePage(id, patch) // optimistic (store rejects `nodes` in patch type)

  // Re-read the merged page so the version snapshot is whole (config = the full
  // canvas tree), never a partial that would orphan nodeIds from nodes.
  const merged = useConstructorStore.getState().pages.find((p) => p.id === id)
  if (!merged) return

  // C5 save guard — runs on the WHOLE merged page (the artefact actually
  // persisted). Throws SaveGuardError on any failed check; the caller surfaces
  // the issues inline (shift-left). NOT swallowed like the network catch below:
  // a guard failure is an authoring error to fix, not a transient fault to retry.
  assertSaveable(merged)

  try {
    await configApi.pages.update(id, toApiPage(merged))
  } catch (e) {
    console.error('[api] savePage failed', e)
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

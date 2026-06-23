// ── Config API client ─────────────────────────────────────────────────────────
//
//  Native-fetch boundary to @statdash/api (Fastify, /api/config/*).
//  Law 5 (API-readiness): this is the only HTTP adapter for the Constructor —
//  swap BASE or the transport here, nothing else changes.
//  Law 1 (no privileged dims) + Law 2 (declarative config): `spec` and `config`
//  payloads are opaque `Record<string, unknown>` — never narrowed to a stat
//  domain, never carrying functions. The client is generic over capability.
//

import type {
  DataSourceDef,
  DataSourceType,
  ConnectionStatus,
  NamedDataSpec,
  SiteDef,
  NavItem,
  CanvasPage,
} from '../types/constructor'
import type { DataSpec } from '@statdash/engine'
import type { NodePageConfig } from '@statdash/react/engine'
import { getToken, clearToken, AuthError } from './auth'
import { toNodePageConfig, fromNodePageConfig } from '../canvas/canvasPageAdapter'

// ── Transport ───────────────────────────────────────────────────────────────

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
const PREFIX = '/api/config'

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface Envelope<T> {
  data?: T
  error?: string
  message?: string
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  return requestAt<T>(PREFIX, method, path, body)
}

/**
 * Transport core, parameterised by API scope prefix. The config surface
 * (`/api/config`) and the cube discovery surface (`/api/cube`) are distinct
 * server scopes (the cube routes are deliberately OFF the JWT-guarded config
 * scope — least-privilege at the boundary). One transport, two prefixes —
 * Law 5: this stays the only HTTP adapter for the Constructor. Exported so the
 * sibling cubeApi (lib/cubeApi.ts) reuses the exact same fetch/401/envelope path.
 */
export async function requestAt<T>(prefix: string, method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {}
  if (body !== undefined)  headers['Content-Type'] = 'application/json'
  if (token !== null)      headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${prefix}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  // 401 — token expired or invalid; clear storage so the UI can redirect to login.
  if (res.status === 401) {
    clearToken()
    throw new AuthError(401, 'Session expired — please log in again')
  }

  const json = (await res.json()) as Envelope<T>
  if (!res.ok || json.error) {
    throw new ApiError(res.status, json.message ?? json.error ?? 'Request failed')
  }
  return json.data as T
}

// ── DB row shapes (snake_case — the wire contract) ──────────────────────────

export interface DataSourceRow {
  id: string
  name: string
  type: DataSourceType
  url: string | null
  config: Record<string, unknown>
  status: string
  created_at: string
  updated_at: string
}

export interface DataSpecRow {
  id: string
  name: string
  description: string | null
  spec: Record<string, unknown>
  source_id: string | null
  created_at: string
  updated_at: string
}

export type SiteConfigMap = Record<string, unknown>

export interface PageListRow {
  id: string
  slug: string
  title: { ka: string; en?: string }
  status: string
  updated_at: string
}

export interface PageDetailRow {
  id: string
  slug: string
  title: { ka: string; en?: string }
  status: string
  config: Record<string, unknown>
  data_specs: unknown[]
  version_number: number
  /** True when the latest version is the published one (GET /:id LATERAL join). */
  is_published?: boolean
  created_at?: string
  updated_at?: string
}

/** One row of a page's append-only version history (GET /:id/versions). */
export interface PageVersionRow {
  id: string
  version_number: number
  is_published: boolean
  created_at: string
}

/** Response of POST /:id/publish — which version was promoted. */
export interface PublishResult {
  id: string
  published_version_id: string
}

export interface NavRow {
  id: string
  parent_id: string | null
  page_id: string | null
  label: { ka: string; en?: string }
  href: string | null
  ord: number
  depth: number
}

// ── Write payloads (what each endpoint accepts) ──────────────────────────────

interface DataSourceCreateBody {
  name: string
  type: DataSourceType
  url?: string
  config: Record<string, unknown>
}

interface DataSourceUpdateBody {
  name?: string
  type?: DataSourceType
  url?: string | null
  config?: Record<string, unknown>
  status?: ConnectionStatus
}

interface DataSpecCreateBody {
  name: string
  description?: string | null
  spec: Record<string, unknown>
  source_id?: string | null
}

type DataSpecUpdateBody = Partial<DataSpecCreateBody>

interface PageWriteBody {
  slug: string
  title: { ka: string; en?: string }
  config: Record<string, unknown>
  data_specs: unknown[]
}

interface NavCreateBody {
  label: { ka: string; en?: string }
  href?: string
  page_id?: string
  parent_id?: string
  ord: number
}

type NavUpdateBody = {
  label?: { ka: string; en?: string }
  href?: string | null
  page_id?: string | null
  parent_id?: string | null
  ord?: number
}

// ── Endpoint groups ─────────────────────────────────────────────────────────

export const configApi = {
  dataSources: {
    list: () => request<DataSourceRow[]>('GET', '/data-sources'),
    get: (id: string) => request<DataSourceRow>('GET', `/data-sources/${id}`),
    create: (body: DataSourceCreateBody) => request<DataSourceRow>('POST', '/data-sources', body),
    update: (id: string, body: DataSourceUpdateBody) =>
      request<DataSourceRow>('PUT', `/data-sources/${id}`, body),
    delete: (id: string) =>
      request<{ id: string; deleted: true }>('DELETE', `/data-sources/${id}`),
  },
  dataSpecs: {
    list: () => request<DataSpecRow[]>('GET', '/data-specs'),
    get: (id: string) => request<DataSpecRow>('GET', `/data-specs/${id}`),
    create: (body: DataSpecCreateBody) => request<DataSpecRow>('POST', '/data-specs', body),
    update: (id: string, body: DataSpecUpdateBody) =>
      request<DataSpecRow>('PUT', `/data-specs/${id}`, body),
    delete: (id: string) => request<{ id: string }>('DELETE', `/data-specs/${id}`),
  },
  site: {
    get: () => request<SiteConfigMap>('GET', '/site'),
    update: (body: SiteConfigMap) => request<SiteConfigMap>('PUT', '/site', body),
  },
  pages: {
    list: () => request<PageListRow[]>('GET', '/pages'),
    get: (id: string) => request<PageDetailRow>('GET', `/pages/${id}`),
    create: (body: PageWriteBody) => request<{ id: string }>('POST', '/pages', body),
    update: (id: string, body: Partial<PageWriteBody>) =>
      request<{ id: string; version_number?: number }>('PUT', `/pages/${id}`, body),
    delete: (id: string) =>
      request<{ id: string; status: 'archived' }>('DELETE', `/pages/${id}`),
    // Append-only version history (newest first). Read path — any auth role.
    versions: (id: string) => request<PageVersionRow[]>('GET', `/pages/${id}/versions`),
    // Promote the latest version to published. Server FSM (draft→published);
    // admin-gated — a non-admin token yields ApiError 403 (surfaced as a
    // "needs publisher" state, never reimplemented client-side).
    publish: (id: string) => request<PublishResult>('POST', `/pages/${id}/publish`),
  },
  nav: {
    list: () => request<NavRow[]>('GET', '/nav'),
    create: (body: NavCreateBody) => request<NavRow>('POST', '/nav', body),
    update: (id: string, body: NavUpdateBody) => request<NavRow>('PUT', `/nav/${id}`, body),
    delete: (id: string) => request<{ id: string; deleted: true }>('DELETE', `/nav/${id}`),
  },
}

// ── Adapters: DB rows ↔ domain types ─────────────────────────────────────────
//
//  The wire is snake_case; the store is camelCase. These pure functions are the
//  single mapping seam — no component or store action reasons about row shapes.

const CONNECTION_STATES: ReadonlySet<string> = new Set<ConnectionStatus>([
  'idle',
  'connected',
  'error',
  'pending',
])

function toConnectionStatus(raw: string): ConnectionStatus {
  return CONNECTION_STATES.has(raw) ? (raw as ConnectionStatus) : 'idle'
}

export function fromApiDataSource(row: DataSourceRow): DataSourceDef {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    url: row.url ?? undefined,
    config: row.config ?? {},
    status: toConnectionStatus(row.status),
  }
}

export function fromApiDataSpec(row: DataSpecRow): NamedDataSpec {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    // `spec` is opaque JSON — engine-compatible by contract, never inspected here.
    spec: row.spec as DataSpec,
  }
}

export function fromApiSite(map: SiteConfigMap, navRows: NavRow[]): SiteDef {
  // Nav is sourced from the nav tree, not from the site map. Constructor nav is
  // a flat ordered list of page-targeting items, so we keep page-backed rows in
  // wire (depth, ord) order and assign a contiguous local order.
  const nav: NavItem[] = navRows
    .filter((r) => r.page_id != null)
    .map((r, i) => ({
      id: r.id,
      label: { ka: r.label.ka, en: r.label.en ?? r.label.ka },
      pageId: r.page_id as string,
      order: i,
    }))

  return {
    name: typeof map.name === 'string' ? map.name : '',
    defaultLocale: map.defaultLocale === 'en' ? 'en' : 'ka',
    logo: typeof map.logo === 'string' ? map.logo : undefined,
    nav,
    themeOverrides: isStringRecord(map.themeOverrides) ? map.themeOverrides : {},
    dataSourceBindings: isStringRecord(map.dataSourceBindings) ? map.dataSourceBindings : {},
    // Chrome is opaque JSON (Record<slot, ChromeSlotConfig>) — engine-compatible
    // by contract (it serializes straight to SiteManifest.chrome), never inspected
    // here. Default to {} when absent so older site configs keep loading.
    chrome: (map.chrome && typeof map.chrome === 'object' && !Array.isArray(map.chrome))
      ? (map.chrome as SiteDef['chrome'])
      : {},
  }
}

export function fromApiPage(row: PageDetailRow): CanvasPage {
  // The persisted config IS a NodePageConfig (engine NodeDef tree) — the same
  // shape the renderer consumes. Hydrate the flat editor store from it via the
  // tree→flat adapter (C2 load side), so the API boundary and the canvas share
  // one serialization contract. Title lives on the page row, not the tree.
  const title = { ka: row.title.ka, en: row.title.en ?? row.title.ka }
  const config = (row.config ?? {}) as unknown as NodePageConfig
  return fromNodePageConfig(config, title)
}

export function toApiPage(page: CanvasPage): PageWriteBody {
  return {
    slug: page.slug,
    title: page.title,
    // The canvas tree is persisted as a real NodePageConfig (NodeDef tree) —
    // the flat→tree adapter (C2 save side). Round-trips losslessly with
    // fromApiPage → fromNodePageConfig.
    config: toNodePageConfig(page) as unknown as Record<string, unknown>,
    data_specs: [],
  }
}

// ── Local helpers ───────────────────────────────────────────────────────────

function isStringRecord(v: unknown): v is Record<string, string> {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    Object.values(v as Record<string, unknown>).every((x) => typeof x === 'string')
  )
}

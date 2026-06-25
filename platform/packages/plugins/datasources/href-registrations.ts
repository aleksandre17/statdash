// ── Href datasource plugin builder (SHARED — the HREF source kind, D-HREF) ───
//
//  Registers the 'href' kind with the engine's store-builder registry. This is
//  the THIRD source mode of the data-source-reference spectrum (ADR
//  adr_data_source_reference_spectrum — the Vega-Lite `data: { values | url |
//  name }` trichotomy mapped to store KINDS behind the ONE DataStore port):
//    • 'static' — Vega-Lite `values`: inline literal rows, no backend.
//                 (static-registrations.ts)
//    • 'href'   — THIS builder. Vega-Lite `url` + `format`: fetch a remote
//                 CSV/JSON document, parse it to EngineRow[], serve it through
//                 the SAME DataStore port as a zero-network ExternalStore.
//    • 'stats'  — the live cube (Vega-Lite `name`). (stats-registrations.ts)
//
//  WHY this lives in @statdash/plugins/datasources (NOT packages/core):
//    The engine core (@statdash/engine) is PURE — `src/data/` is data only and
//    `fromSDMX` is its single adapter boundary (Law 5). `href` opens a NEW
//    adapter boundary: network I/O (fetch) + response-format parsing. That I/O
//    belongs in the ADAPTER layer (plugins), below apps, exactly like the
//    'stats' builder's fetch. The engine stays fetch-free; href fetches HERE and
//    hands the engine plain EngineRow[] via ExternalStore (Ports & Adapters).
//
//  ─ The two OCP registries this module ships ──────────────────────────────────
//    1. FORMAT-PARSER registry  — response-format string → (text → EngineRow[]).
//       Ships 'json' + 'csv'. A new format = one registerHrefFormatParser call;
//       the builder is closed. This IS the Vega-Lite `format` concern, open.
//    2. AUTH-STRATEGY registry  — auth-scheme string → (config → headers). Ships
//       'none' + 'bearer'/'header'. A new scheme = one registerHrefAuthStrategy
//       call. Deliberately MINIMAL — NOT a full auth framework (YAGNI).
//
//  ─ SECURITY — SSRF posture (default-safe) ────────────────────────────────────
//    Author-supplied URLs are an SSRF vector (a config could point fetch at an
//    internal/metadata endpoint). The default posture BLOCKS every remote fetch:
//    a URL resolves ONLY if its origin is on an explicit allowlist supplied via
//    `params.allowedOrigins` (per-source) OR the deploy-level
//    `VITE_HREF_ALLOWED_ORIGINS` env (a comma-separated origin list). No
//    allowlist ⇒ no fetch. Secrets (auth tokens) are NEVER logged — errors
//    report status/origin only. PROD posture: set VITE_HREF_ALLOWED_ORIGINS to
//    the exact external origins you trust; leave it unset to keep href disabled.
//
//  Law 2 (declarative): the descriptor is pure JSON — url string + format string
//  + an auth descriptor that is data (scheme + a token-VALUE / header name), NEVER
//  a function. Law 3 (arrow): imports only @statdash/react/engine
//  (registerStoreBuilder) + @statdash/engine (ExternalStore) — both below apps.
//

import { registerStoreBuilder, registerStoreCapabilities } from '@statdash/react/engine'
import type {
  Classifier, DisplayMap, EngineRow, Observation, SourceMetadata, SourceTestResult,
} from '@statdash/engine'

// ── Descriptor params ────────────────────────────────────────────────────────

/** Auth descriptor — pure data (scheme + value), never a function (Law 2). */
export interface HrefAuthConfig {
  /** Registered auth-scheme id. 'none' (default) | 'bearer' | 'header'. */
  scheme: string
  /** Bearer token VALUE ('bearer') — sent as `Authorization: Bearer <token>`. */
  token?: string
  /** Header name + value ('header') — sent verbatim as one request header. */
  header?: { name: string; value: string }
}

/** Kind-specific params for an 'href' datasource descriptor. */
export interface HrefParams {
  /** Response format id — picks the registered parser. Default 'json'. */
  format?:      string
  /** Auth descriptor (data, not a fn). Absent ⇒ 'none'. */
  auth?:        HrefAuthConfig
  /**
   * Per-source SSRF allowlist — exact origins (scheme+host+port) this source may
   * fetch. Merged with the deploy-level env allowlist. Empty/absent ⇒ this source
   * relies solely on the env allowlist (and is blocked if that is also empty).
   */
  allowedOrigins?: string[]
  /** Inline classifiers for `$cl`/`$d` resolution + filter dropdowns. */
  classifiers?: Record<string, Classifier>
  /** Inline display maps for label resolution. */
  display?:     Record<string, DisplayMap>
}

// ── 1. FORMAT-PARSER registry (OCP) ──────────────────────────────────────────
//
//  A parser maps the raw response TEXT to EngineRow[] — the neutral engine row.
//  Pure (no I/O): the builder owns the fetch, the parser owns the shape. New
//  format = one registration; impls closed.

/** Parses a raw response body (already read as text) into engine rows. */
export type HrefFormatParser = (text: string) => EngineRow[]

const _formatParsers = new Map<string, HrefFormatParser>()

/** Register (or override) a response-format parser. OCP entry point. */
export function registerHrefFormatParser(format: string, parser: HrefFormatParser): void {
  _formatParsers.set(format, parser)
}

/** The registered format ids — feeds the Constructor's format picker (OCP). */
export function registeredHrefFormats(): string[] {
  return [..._formatParsers.keys()]
}

/**
 * JSON parser — accepts either a bare array of rows OR a `{ data: [...] }` /
 * `{ values: [...] }` envelope (the two shapes the rest of the platform speaks:
 * the `{ data }` API envelope and Vega-Lite `values`). Anything else → [].
 */
function parseJsonRows(text: string): EngineRow[] {
  const json = JSON.parse(text) as unknown
  const rows =
    Array.isArray(json)                               ? json
    : isRecord(json) && Array.isArray(json['data'])   ? json['data']
    : isRecord(json) && Array.isArray(json['values']) ? json['values']
    : []
  return (rows as unknown[]).filter(isRecord) as EngineRow[]
}

/**
 * Minimal CSV parser — RFC-4180 essentials only (header row → keys; commas;
 * double-quoted fields with "" escaping + embedded newlines/commas). NO heavy
 * dep: a self-contained ~40-line tokenizer is sufficient for the tabular,
 * already-clean open-data CSV this kind targets. Numeric-looking cells are
 * coerced to numbers (so `value` arrives as a number the OLAP sum can add);
 * everything else stays a string. Blank input ⇒ [].
 */
function parseCsvRows(text: string): EngineRow[] {
  const records = tokenizeCsv(text)
  if (records.length === 0) return []
  const [header, ...body] = records
  return body
    .filter((cells) => cells.length > 1 || (cells.length === 1 && cells[0] !== ''))
    .map((cells) => {
      const row: Record<string, string | number> = {}
      header.forEach((key, i) => { row[key] = coerceCell(cells[i] ?? '') })
      return row as EngineRow
    })
}

/** Split CSV text into records of fields, honouring quoted fields. */
function tokenizeCsv(text: string): string[][] {
  const records: string[][] = []
  let field = ''
  let record: string[] = []
  let inQuotes = false
  const src = text.replace(/\r\n?/g, '\n') // normalize CRLF/CR → LF

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ } // escaped quote
        else inQuotes = false
      } else field += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      record.push(field); field = ''
    } else if (ch === '\n') {
      record.push(field); records.push(record); field = ''; record = []
    } else {
      field += ch
    }
  }
  // flush trailing field/record (no terminating newline)
  if (field !== '' || record.length > 0) { record.push(field); records.push(record) }
  return records
}

/** Coerce a finite-numeric-looking cell to a number; otherwise keep the string. */
function coerceCell(cell: string): string | number {
  const t = cell.trim()
  if (t === '') return ''
  const n = Number(t)
  return Number.isFinite(n) && /^-?\d/.test(t) ? n : cell
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/** Register the built-in parsers. Idempotent (Map overwrite). */
function registerBuiltinHrefFormats(): void {
  registerHrefFormatParser('json', parseJsonRows)
  registerHrefFormatParser('csv', parseCsvRows)
}

// ── 2. AUTH-STRATEGY registry (OCP, minimal) ─────────────────────────────────
//
//  A strategy maps the (data-only) auth descriptor to request headers. Ships
//  'none' + 'bearer'/'header'. NOT a full auth framework — a new scheme is one
//  registration. Secrets live in the descriptor VALUE and are returned as a
//  header; they are never logged.

/** Produces request headers from a (data-only) auth descriptor. */
export type HrefAuthStrategy = (auth: HrefAuthConfig) => Record<string, string>

const _authStrategies = new Map<string, HrefAuthStrategy>()

/** Register (or override) an auth strategy. OCP entry point. */
export function registerHrefAuthStrategy(scheme: string, strategy: HrefAuthStrategy): void {
  _authStrategies.set(scheme, strategy)
}

/** The registered auth-scheme ids — feeds the Constructor's auth picker (OCP). */
export function registeredHrefAuthSchemes(): string[] {
  return [..._authStrategies.keys()]
}

function registerBuiltinHrefAuthStrategies(): void {
  registerHrefAuthStrategy('none', () => ({}))
  registerHrefAuthStrategy('bearer', (auth): Record<string, string> =>
    auth.token ? { Authorization: `Bearer ${auth.token}` } : {})
  registerHrefAuthStrategy('header', (auth): Record<string, string> =>
    auth.header?.name ? { [auth.header.name]: auth.header.value ?? '' } : {})
}

/** Resolve the headers for an auth descriptor (defaulting to 'none'). */
function authHeaders(auth: HrefAuthConfig | undefined): Record<string, string> {
  const scheme   = auth?.scheme ?? 'none'
  const strategy = _authStrategies.get(scheme)
  if (!strategy) {
    throw new Error(`[href] Unknown auth scheme '${scheme}'. Register one via registerHrefAuthStrategy.`)
  }
  return strategy(auth ?? { scheme: 'none' })
}

// ── SSRF gate — default-safe origin allowlisting ─────────────────────────────

/**
 * The deploy-level allowlist origins, parsed once from the Vite-injected env
 * (`VITE_HREF_ALLOWED_ORIGINS`, a comma-separated origin list). Consistent with
 * the rest of this layer reading config off `import.meta.env` (see
 * stats-registrations resolveStatsBase). No secret is read here — only an
 * allowlist of PUBLIC origins. A server-side (non-Vite) consumer supplies the
 * allowlist per-source via `params.allowedOrigins` instead.
 */
function envAllowedOrigins(): string[] {
  const raw =
    typeof import.meta !== 'undefined' && import.meta.env
      ? (import.meta.env.VITE_HREF_ALLOWED_ORIGINS as string | undefined)
      : undefined
  return splitOrigins(raw ?? '')
}

function splitOrigins(raw: string): string[] {
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

/**
 * Assert a URL is fetchable under the SSRF posture, returning its parsed origin.
 * BLOCKS by default: the URL's origin must appear on the merged allowlist
 * (per-source `params.allowedOrigins` ∪ the env allowlist). A malformed URL, a
 * non-http(s) scheme, or an un-allowlisted origin all throw — fetch never fires.
 * The error names the BLOCKED origin (public info), never the auth token.
 */
export function assertHrefAllowed(url: string, perSource: string[] | undefined): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`[href] Malformed url — cannot fetch.`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`[href] Blocked non-http(s) url scheme '${parsed.protocol}'.`)
  }
  const allow = new Set([...(perSource ?? []), ...envAllowedOrigins()])
  if (allow.size === 0) {
    throw new Error(
      `[href] Remote fetch is disabled (SSRF-safe default). No allowed origins ` +
      `configured. Set VITE_HREF_ALLOWED_ORIGINS (deploy) or params.allowedOrigins ` +
      `(per-source) to '${parsed.origin}' to enable it.`,
    )
  }
  if (!allow.has(parsed.origin)) {
    throw new Error(`[href] Origin '${parsed.origin}' is not on the allowed-origins list (SSRF block).`)
  }
  return parsed.origin
}

// ── The fetch + parse core — the single network seam for href ────────────────

/**
 * Fetch the url (under the SSRF gate + auth headers) and parse it with the
 * registered format parser into EngineRow[]. This is the ONLY place href issues
 * a network request — the Hexagonal adapter boundary for this kind. `fetchImpl`
 * defaults to global fetch (overridable for tests).
 */
export async function fetchHrefRows(
  url:    string,
  params: HrefParams,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<EngineRow[]> {
  assertHrefAllowed(url, params.allowedOrigins)

  const format = params.format ?? 'json'
  const parser = _formatParsers.get(format)
  if (!parser) {
    throw new Error(`[href] Unknown format '${format}'. Register one via registerHrefFormatParser.`)
  }

  const headers = authHeaders(params.auth)
  const res = await fetchImpl(url, { headers, signal })
  if (!res.ok) {
    // Status only — never echo the body or the auth token.
    throw new Error(`[href] Fetch failed: HTTP ${res.status} for ${new URL(url).origin}.`)
  }
  const text = await res.text()
  return parser(text)
}

// ── M2 authoring — getMetadata / testConnection (probe + parse-preview) ───────

const RESERVED_VALUE_KEYS = new Set(['value', 'obsStatus', 'time'])

/** Derive dims/measures from already-parsed rows — the same split as 'static'. */
function deriveHrefMetadata(rows: EngineRow[], format: string): SourceMetadata {
  const dimKeys = new Set<string>()
  let hasValue = false
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (key === 'value') { hasValue = true; continue }
      if (RESERVED_VALUE_KEYS.has(key)) continue
      dimKeys.add(key)
    }
  }
  return {
    kind:       'href',
    dimensions: [...dimKeys].map((code) => ({ code })),
    measures:   hasValue ? [{ code: 'value' }] : [],
    note:       `Probed ${rows.length} row(s) over '${format}'.`,
  }
}

// ── Registration ─────────────────────────────────────────────────────────────

/**
 * Register the 'href' store-builder + its format/auth registries + M2 authoring
 * capabilities. Called from registerStoreBuilders() (alongside 'static'/'stats')
 * so BOTH the geostat runner and the panel Constructor get it through their one
 * shared boot call. Idempotent — the registries are Maps keyed by id.
 *
 * The builder FETCHES at build time (under the SSRF gate), parses, and hands the
 * engine an ExternalStore over the parsed rows: href data flows through the SAME
 * sync DataStore port as static/stats, reusing all the OLAP query logic. No
 * parallel resolution path (one port, href is a KIND).
 */
export function registerHrefStoreBuilder(): void {
  registerBuiltinHrefFormats()
  registerBuiltinHrefAuthStrategies()

  registerStoreBuilder('href', async (config, signal) => {
    const params = (config.params ?? {}) as HrefParams
    if (!config.url) {
      throw new Error(`[href] Source '${config.id}' has no url. An href source requires a url.`)
    }
    const rows = await fetchHrefRows(config.url, params, signal)
    const { ExternalStore } = await import('@statdash/engine')
    return new ExternalStore(rows as Observation[], {
      classifiers: params.classifiers,
      display:     params.display,
    })
  })

  // M2 authoring — both PROBE the live url (network), then derive structure /
  // report reachability from the parsed first rows. Gated by the same SSRF check
  // as the builder (assertHrefAllowed runs inside fetchHrefRows), so the panel
  // can never probe an un-allowlisted origin either.
  registerStoreCapabilities('href', {
    getMetadata: async (config, signal): Promise<SourceMetadata> => {
      const params = (config.params ?? {}) as HrefParams
      if (!config.url) return { kind: 'href', dimensions: [], measures: [], note: 'No url.' }
      const rows = await fetchHrefRows(config.url, params, signal)
      return deriveHrefMetadata(rows, params.format ?? 'json')
    },
    testConnection: async (config, signal): Promise<SourceTestResult> => {
      const params = (config.params ?? {}) as HrefParams
      if (!config.url) return { ok: false, message: 'No url — enter a remote url.' }
      try {
        const rows = await fetchHrefRows(config.url, params, signal)
        return rows.length > 0
          ? { ok: true, message: `Reachable — parsed ${rows.length} row(s).` }
          : { ok: false, message: 'Reachable but parsed 0 rows — check the format.' }
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : 'Fetch failed.' }
      }
    },
  })
}

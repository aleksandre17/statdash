// ── Datasource secret redaction (API-08) ──────────────────────────────────────
//
//  The public, UNGUARDED bootstrap + data-sources reads project config.data_source
//  rows — including the open `config` JSONB — straight to the anonymous browser
//  client. The documented AuthConfig envelope (docs …/25-datasource-system.md:
//  bearer.token / basic.password / apikey.value / custom) and any future credential
//  would therefore be SERVED to every boot client. Today's geostat sources carry no
//  secrets, but the contract permits it and there was no redaction — a latent
//  credential-exposure (the Grafana lesson: datasource secrets are write-only,
//  never returned; the backend proxies the authenticated call).
//
//  ROOT-CAUSE FIX: redact at the SERIALIZATION BOUNDARY (here), not at each call
//  site, so every present and future public projection of a data source passes
//  through one seam. Two complementary guards (defense in depth):
//
//    1. The `auth` envelope is dropped WHOLESALE — it is the credential carrier by
//       contract; nothing inside it is ever client-safe (a browser must never hold
//       the upstream credential — that is what the future backend proxy is for).
//    2. Any key whose NAME matches a secret pattern is stripped at ANY depth — so a
//       credential placed outside `auth` (a stray `token`, `apiKey`, `password`)
//       still never leaves the server. The denylist-of-secret-names is the SSOT.
//
//  Non-secret config (the renderer's binding params: refresh intervals, display
//  options, public base paths) passes through unchanged — Postel/least-privilege:
//  serve exactly what the client needs, never the credentials it must not hold.

/** Keys whose presence at ANY depth marks a secret-bearing field (case-insensitive). */
const SECRET_KEY_PATTERNS: readonly RegExp[] = [
  /token/i,
  /secret/i,
  /password/i,
  /passwd/i,
  /passphrase/i,
  /api[-_]?key/i,
  /apikey/i,
  /credential/i,
  /private[-_]?key/i,
  /bearer/i,
  /access[-_]?key/i,
  /authorization/i, // the `Authorization` header carrier (Bearer/Basic credentials)
]

/** The whole credential-envelope keys dropped wholesale (the AuthConfig carriers). */
const ENVELOPE_KEYS: readonly string[] = ['auth', 'secureJsonData', 'credentials']

function isSecretKey(key: string): boolean {
  if (ENVELOPE_KEYS.includes(key)) return true
  return SECRET_KEY_PATTERNS.some((re) => re.test(key))
}

/**
 * Recursively strip secret-bearing keys from an arbitrary JSON value. Returns a
 * NEW value (never mutates the input — the input is the row from the DB and may be
 * reused). Arrays are mapped; objects drop secret keys and recurse into the rest;
 * primitives pass through.
 */
export function redactSecrets<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => redactSecrets(v)) as unknown as T
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSecretKey(k)) continue
      out[k] = redactSecrets(v)
    }
    return out as unknown as T
  }
  return value
}

/**
 * Redact a data-source `config` JSONB for a public projection. A null/non-object
 * config (legacy single-origin rows store NULL) is normalized to an empty object —
 * the public shape is always a plain object the client can spread.
 */
export function redactDataSourceConfig(config: unknown): Record<string, unknown> {
  if (config === null || typeof config !== 'object' || Array.isArray(config)) return {}
  return redactSecrets(config as Record<string, unknown>)
}

// ── Config migration chain [N19] ───────────────────────────────────────
//
//  Page configs carry a `schemaVersion` integer.
//  migratePageConfig() upgrades a raw config from its stored version
//  to CURRENT_SCHEMA_VERSION by running any registered migration functions.
//
//  Usage:
//    1. Load raw JSON page config from storage.
//    2. Call migratePageConfig(raw) before parsing/typing.
//    3. The returned config is at CURRENT_SCHEMA_VERSION.
//
//  Adding a new schema version:
//    1. Bump CURRENT_SCHEMA_VERSION.
//    2. Register a migration: registerMigration(newVersion, fn).
//    3. fn receives the previous-version config and returns the next-version config.
//
//  Current version: 4.
//    v1 → v2: page-level `color` moved from a flat PageConfigBase field into
//    `presentation.color` (the presentation-projection registry's single home).
//    v2 → v3: node `type: 'georgraph'` renamed to `'geograph'` (misspelling fix),
//    applied recursively across the whole node tree.
//    v3 → v4: a section's two mutually-exclusive `view.hero` / `view.compact`
//    booleans collapse into ONE declared `variants.emphasis` enum
//    ('hero' | 'compact') — the variant-style spine. Applied recursively.
//    See the registered migrators at the foot of this module.
//

/** Current schema version for page configs. Bump when introducing breaking config changes. */
export const CURRENT_SCHEMA_VERSION = 4

/**
 * A migration function.
 * Receives a raw config object at version (target - 1) and returns it at version target.
 * Must be a pure function — no side-effects, no network, no DOM.
 */
export type MigrationFn = (config: Record<string, unknown>) => Record<string, unknown>

const _migrations = new Map<number, MigrationFn>()

/**
 * Register a migration to a specific target version.
 * `toVersion` must be > 0 and <= CURRENT_SCHEMA_VERSION.
 * Last-write-wins (allows test overrides).
 *
 * Example — migrating from v1 to v2:
 *   registerMigration(2, cfg => ({ ...cfg, newField: cfg.oldField ?? 'default' }))
 */
export function registerMigration(toVersion: number, fn: MigrationFn): void {
  _migrations.set(toVersion, fn)
}

/**
 * Migrate a raw page config to CURRENT_SCHEMA_VERSION.
 *
 * - If `schemaVersion` is absent, the config is treated as version 0.
 * - If already at CURRENT_SCHEMA_VERSION, returns the config unchanged (+ schemaVersion stamped).
 * - Applies migrations in version order; stops at the first missing migration.
 * - Never mutates the input: always returns a fresh object (pure function).
 * - Forward-compat guard: a config whose `schemaVersion` is GREATER than
 *   CURRENT_SCHEMA_VERSION was written by a newer platform build. We cannot
 *   safely downgrade it (migrations are forward-only, immutable history), so
 *   we throw rather than silently render a future config the renderer may not
 *   understand. Retrograde migration is out of scope by design.
 *
 * @param config - The raw JSONB value from config.page_version.config.
 * @returns A new object at CURRENT_SCHEMA_VERSION with `schemaVersion` set.
 * @throws If the config is at a version newer than CURRENT_SCHEMA_VERSION.
 */
export function migratePageConfig(
  config: Record<string, unknown>,
): Record<string, unknown> {
  let current = { ...config }
  let version = typeof current.schemaVersion === 'number' ? current.schemaVersion : 0

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Config schemaVersion ${version} is newer than the supported ` +
      `CURRENT_SCHEMA_VERSION ${CURRENT_SCHEMA_VERSION}. This config was ` +
      `written by a newer platform build and cannot be migrated backward. ` +
      `Upgrade the platform to read it.`,
    )
  }

  while (version < CURRENT_SCHEMA_VERSION) {
    const toVersion = version + 1
    const fn = _migrations.get(toVersion)
    if (!fn) {
      // No migration registered for this step — stop here.
      // This is normal when the version is new and no breaking change was introduced.
      break
    }
    current = { ...fn(current), schemaVersion: toVersion }
    version = toVersion
  }

  return { ...current, schemaVersion: CURRENT_SCHEMA_VERSION }
}

/**
 * Type guard: is this config already at the current schema version?
 *
 * Use before rendering to detect unmigrated configs early — a stored config
 * loaded from the DB that has not been run through {@link migratePageConfig}
 * will return `false` (its `schemaVersion` is absent or behind).
 *
 * @param config - Any raw config-shaped value (the schemaVersion field is read defensively).
 */
export function isCurrentSchema(config: unknown): boolean {
  return (config as { schemaVersion?: number } | null | undefined)?.schemaVersion
    === CURRENT_SCHEMA_VERSION
}

/**
 * Returns the highest registered migration target version, or 0 if none.
 * Useful for debugging and testing.
 */
export function highestMigrationVersion(): number {
  if (_migrations.size === 0) return 0
  return Math.max(..._migrations.keys())
}

// ── Registered migrators (immutable platform history) ───────────────────
//
//  Migrations are pure, forward-only, fixed platform history — not a per-tenant
//  extension seam — so they register at module load, baked into the chain wherever
//  @statdash/engine is imported (the api read/save paths, the panel save-gate).
//

// ── v0 → v1: identity (contiguity) ──────────────────────────────────────
//
//  v1 was the initial format — there is no structural change FROM v0 (the
//  unversioned legacy shape) TO v1. But the runner stops at the FIRST missing
//  step (a deliberate forward-compat break), so a contiguous chain is required
//  for a v0 stored config to REACH the v2 color migrator. This identity step
//  keeps v0 → v1 → v2 reachable without altering any field. (A v0 stored config
//  IS structurally a v1 config; this only stamps the version progression.)
//
registerMigration(1, (config) => config)

// ── v1 → v2: page color → presentation.color (single home) ──────────────
//
//  Page color had TWO homes — a flat `color` field AND `presentation.color`
//  (the presentation-projection registry key). This migrator collapses them to
//  ONE: it moves a flat `color` into `presentation.color` and drops the flat key.
//
//  Edge cases (all proven in migration.test.ts):
//    • no flat `color`          → no spurious `presentation` is created.
//    • `presentation.color` set → the authored presentation value WINS; the flat
//      `color` is still dropped (the flat field is being retired, not merged over).
//    • other `presentation` keys (e.g. crumbs) are preserved.
//
//  The migration is the canonical mechanism — color is not special-cased outside
//  this chain (the renderer reads `presentation.color` only).
//
registerMigration(2, (config) => {
  // No flat color authored ⇒ nothing to move; leave presentation untouched.
  if (config.color === undefined) return config

  // Drop the flat `color` regardless (it is the field being retired).
  const { color, presentation, ...rest } = config

  const existingPresentation =
    presentation && typeof presentation === 'object' && !Array.isArray(presentation)
      ? (presentation as Record<string, unknown>)
      : {}

  // Existing presentation.color WINS (the authored projector value is canonical);
  // otherwise the flat color becomes presentation.color.
  const nextPresentation: Record<string, unknown> =
    'color' in existingPresentation
      ? existingPresentation
      : { ...existingPresentation, color }

  return { ...rest, presentation: nextPresentation }
})

// ── v2 → v3: node type 'georgraph' → 'geograph' (misspelling fix) ────────
//
//  The public node-type discriminant was misspelled 'georgraph'. It is a
//  SERIALIZED value (stored page configs + provisioning), so the rename is a
//  real schema migration, not just a code rename. This migrator rewrites every
//  `type: 'georgraph'` to `'geograph'` anywhere in the config tree.
//
//  Pure + idempotent + structure-preserving:
//    • walks arrays and plain objects recursively (children, slots, any nesting).
//    • rewrites ONLY a string `type` field whose value is exactly 'georgraph'.
//    • a config with no georgraph node passes through structurally unchanged.
//    • re-running on an already-migrated config is a no-op (no 'georgraph' left).
//
//  The migration is the canonical mechanism — no stored config is stranded, and
//  the renderer/registry knows only 'geograph' (the corrected discriminant).
//
const OLD_GEO_TYPE = 'georgraph'
const NEW_GEO_TYPE = 'geograph'

function renameGeoType(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(renameGeoType)
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = k === 'type' && v === OLD_GEO_TYPE ? NEW_GEO_TYPE : renameGeoType(v)
    }
    return out
  }
  return value
}

registerMigration(3, (config) => renameGeoType(config) as Record<string, unknown>)

// ── v3 → v4: section view.hero / view.compact → variants.emphasis enum ────
//
//  The shell-variant-style spine collapses a section's two mutually-exclusive
//  emphasis booleans (`view.hero`, `view.compact`) into ONE declared enum
//  `variants.emphasis` ('hero' | 'compact'). The booleans were a SERIALIZED
//  config shape (stored configs + provisioning), so retiring them is a real
//  migration, applied recursively across the whole node tree.
//
//  Per-node rewrite (pure, idempotent, structure-preserving):
//    • `view.hero === true`    → set `variants.emphasis = 'hero'`; drop view.hero.
//    • `view.compact === true` → set `variants.emphasis = 'compact'`; drop view.compact.
//    • hero WINS when both are set (they were mutually exclusive; this makes the
//      collapse deterministic). An already-authored `variants.emphasis` is left
//      untouched (authored value is canonical), but the legacy booleans are still
//      dropped (they are the fields being retired).
//    • a `view` left empty after dropping its only keys is preserved as `{}` —
//      structure-preserving; the renderer treats `{}` and absent identically.
//    • nodes without these booleans pass through structurally unchanged.
//
const EMPHASIS_FIELD = 'emphasis'

function migrateEmphasis(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(migrateEmphasis)
  if (!value || typeof value !== 'object') return value

  const node = value as Record<string, unknown>
  // Recurse first so nested children/slots are migrated regardless of this node.
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(node)) out[k] = migrateEmphasis(v)

  const view = out.view
  if (!view || typeof view !== 'object' || Array.isArray(view)) return out

  const v = view as Record<string, unknown>
  const hasHero    = v.hero === true
  const hasCompact = v.compact === true
  if (!hasHero && !hasCompact) return out

  // Strip the retiring booleans from a fresh view object.
  const { hero: _h, compact: _c, ...restView } = v
  out.view = restView

  // hero wins over compact (mutually exclusive); an authored emphasis is canonical.
  const existing = out.variants && typeof out.variants === 'object' && !Array.isArray(out.variants)
    ? (out.variants as Record<string, unknown>)
    : {}
  if (EMPHASIS_FIELD in existing) {
    out.variants = existing
  } else {
    const emphasis = hasHero ? 'hero' : 'compact'
    out.variants = { ...existing, [EMPHASIS_FIELD]: emphasis }
  }
  return out
}

registerMigration(4, (config) => migrateEmphasis(config) as Record<string, unknown>)

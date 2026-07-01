// ── saveGuard — the Constructor save gate (C5 round-trip hardening) ──────────
//
//  The Constructor must ONLY emit configs that are SAFE to publish. This pure
//  gate runs FOUR checks against a CanvasPage and blocks save (with clear,
//  actionable errors) when any fails — shifting failures LEFT to authoring time
//  instead of gold-trigger-reject time:
//
//    1. migrate-identity     — toNodePageConfig(page) is already at the current
//                              schema (migratePageConfig is a no-op / identity).
//                              A config that would be MUTATED by load-time
//                              migration is not yet save-ready.
//    2. serialize-round-trip — fromNodePageConfig(toNodePageConfig(page)) ≡ page
//                              AND the config is JSON-serializable (no functions,
//                              Law 2; no undefined surprises). What you save is
//                              exactly what reloads (lossless).
//    3. per-node-valid       — every node validates against its slice: required
//                              PropSchema fields are filled AND the slice's own
//                              registered validate() (if any) passes.
//    4. locale-complete      — every coverage:'localized' / LocaleString field
//                              carries EVERY active locale (mirrors V13/V14 gold
//                              completeness, caught in the editor — i18n
//                              shift-left).
//
//  Pure: (page, ctx) → SaveGuardReport. No store, no network, no React — so it
//  is the same gate the save button calls AND the fitness tests assert.
//
import type { CanvasPage, Locale } from '../types/constructor'
import type { PropField, PropSchema, NodePageConfig } from '@statdash/react/engine'
import { nodeRegistry, getAtPath } from '@statdash/react/engine'
import {
  migratePageConfig as migratePageBlob,
  isCurrentSchema,
} from '@statdash/engine'
import { toNodePageConfig, fromNodePageConfig } from '../canvas/canvasPageAdapter'
import { validateField } from '../inspector/validateField'

// ── Report shapes ─────────────────────────────────────────────────────────────

/** Which of the four checks an issue belongs to (for grouped UI display). */
export type SaveCheck = 'migrate-identity' | 'round-trip' | 'per-node-valid' | 'locale-complete'

/** One blocking issue. `nodeId`/`field` locate it so the UI can deep-link. */
export interface SaveIssue {
  check:   SaveCheck
  message: string
  nodeId?: string
  field?:  string
}

/** The gate result. `ok` is the single boolean the save button reads. */
export interface SaveGuardReport {
  ok:     boolean
  issues: SaveIssue[]
}

/** Context the gate needs that is not on the page itself. */
export interface SaveGuardContext {
  /** The site's active locales — every localized field must cover all of them. */
  activeLocales: Locale[]
}

// ── The gate ──────────────────────────────────────────────────────────────────

/**
 * Run all four save checks against a page. Returns every issue found (not just
 * the first) so the author fixes the whole batch in one pass (fail-fast at the
 * boundary, but report-complete for UX).
 */
export function validatePageForSave(page: CanvasPage, ctx: SaveGuardContext): SaveGuardReport {
  const issues: SaveIssue[] = []

  // The serialized config — the single artefact the next three checks reason on.
  const config = toNodePageConfig(page)

  checkMigrateIdentity(config, issues)
  checkRoundTrip(page, config, issues)
  checkPerNodeValidity(page, issues)
  checkLocaleCompleteness(page, ctx.activeLocales, issues)

  return { ok: issues.length === 0, issues }
}

// ── Check 1 — migrate identity ────────────────────────────────────────────────

function checkMigrateIdentity(config: NodePageConfig, issues: SaveIssue[]): void {
  try {
    const blob = config as unknown as Record<string, unknown>
    const migrated = migratePageBlob(blob)
    // The emitted config must already be at the current schema: migration must
    // be a no-op. If migratePageConfig had to change anything (beyond stamping
    // schemaVersion), the config is not save-ready.
    if (!isCurrentSchema(migrated)) {
      issues.push({ check: 'migrate-identity', message: 'Config is not at the current schema version' })
      return
    }
    // Compare ignoring the schemaVersion stamp the migrator always adds.
    if (!sameIgnoringSchemaVersion(blob, migrated)) {
      issues.push({
        check: 'migrate-identity',
        message: 'Config would be altered by load-time migration — re-author at the current schema',
      })
    }
  } catch (err) {
    issues.push({
      check: 'migrate-identity',
      message: err instanceof Error ? err.message : 'Migration check failed',
    })
  }
}

/** Deep-equal two config blobs after dropping the `schemaVersion` field. */
function sameIgnoringSchemaVersion(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  const strip = (o: Record<string, unknown>) => {
    const rest: Record<string, unknown> = {}
    for (const key of Object.keys(o)) {
      if (key !== 'schemaVersion') rest[key] = o[key]
    }
    return rest
  }
  return stableStringify(strip(a)) === stableStringify(strip(b))
}

// ── Check 2 — serialize round-trip ────────────────────────────────────────────

function checkRoundTrip(page: CanvasPage, config: NodePageConfig, issues: SaveIssue[]): void {
  // 2a — JSON-serializable (Law 2: no functions in config; no undefined holes).
  let json: string
  try {
    json = JSON.stringify(config)
  } catch (err) {
    issues.push({
      check: 'round-trip',
      message: err instanceof Error ? `Config is not JSON-serializable: ${err.message}` : 'Config is not JSON-serializable',
    })
    return
  }
  if (containsFunction(config)) {
    issues.push({ check: 'round-trip', message: 'Config contains a function — config must be pure data (Law 2)' })
    return
  }

  // 2b — lossless: rehydrate the serialized config and re-project it; the tree
  // it produces must equal the tree we saved (identity over the node graph).
  try {
    const reparsed = JSON.parse(json) as NodePageConfig
    const rehydrated = fromNodePageConfig(reparsed, page.title)
    const reprojected = toNodePageConfig(rehydrated)
    if (stableStringify(config) !== stableStringify(reprojected)) {
      issues.push({ check: 'round-trip', message: 'Config does not survive a save/load round-trip losslessly' })
    }
  } catch (err) {
    issues.push({
      check: 'round-trip',
      message: err instanceof Error ? err.message : 'Round-trip check failed',
    })
  }
}

// ── Check 3 — per-node validity ───────────────────────────────────────────────

function checkPerNodeValidity(page: CanvasPage, issues: SaveIssue[]): void {
  for (const nodeId of allNodeIds(page)) {
    const node = page.nodes[nodeId]
    if (!node) continue

    // 3a — schema-declared validity (required fields, range/pattern). Reuses the
    // same validateField the Inspector renders inline, so save and edit agree.
    const schema: PropSchema = nodeRegistry.getSchema(node.type, node.variant) ?? []
    for (const field of schema) {
      const value = getAtPath(node.props, field.field)
      const error = validateField(field, value)
      if (error) {
        issues.push({ check: 'per-node-valid', message: error, nodeId, field: field.field })
      }
    }

    // 3b — the slice's own registered validate(), if any (cross-field / domain
    // rules the schema can't express). The engine NodeDef shape is the node's
    // props plus type/variant/id.
    const validate = nodeRegistry.getValidate(node.type, node.variant)
    if (validate) {
      const def = { ...node.props, type: node.type, variant: node.variant, id: node.id }
      const errs = validate(def as Parameters<typeof validate>[0]) ?? []
      for (const e of errs) {
        if (e.level === 'error') {
          issues.push({ check: 'per-node-valid', message: e.message, nodeId, field: e.field })
        }
      }
    }
  }
}

// ── Check 4 — locale completeness (i18n shift-left) ───────────────────────────

function checkLocaleCompleteness(page: CanvasPage, locales: Locale[], issues: SaveIssue[]): void {
  for (const nodeId of allNodeIds(page)) {
    const node = page.nodes[nodeId]
    if (!node) continue
    const schema: PropSchema = nodeRegistry.getSchema(node.type, node.variant) ?? []
    for (const field of schema) {
      if (!isLocalized(field)) continue
      const value = getAtPath(node.props, field.field)
      // An OPTIONAL localized field that is entirely absent is fine (the author
      // chose not to use it). Completeness is enforced only when the field is
      // REQUIRED, or when it HAS a value (a partially-filled localized value is
      // the illegal state we shift left). `validateField`/Check 3 owns the
      // "required but empty" case; here we own "present but incomplete".
      if (value == null && !field.required) continue
      const missing = missingLocales(value, locales)
      if (missing.length > 0) {
        issues.push({
          check: 'locale-complete',
          message: `Missing translation${missing.length > 1 ? 's' : ''} for: ${missing.join(', ')}`,
          nodeId,
          field: field.field,
        })
      }
    }
  }
}

/** A field requiring a complete LocaleString — coverage:'localized' or type LocaleString. */
function isLocalized(field: PropField): boolean {
  return (field as { coverage?: string }).coverage === 'localized' || field.type === 'LocaleString'
}

/** Active locales NOT covered by a localized value (empty/missing string counts as missing). */
function missingLocales(value: unknown, locales: Locale[]): Locale[] {
  // A plain string covers the default ONLY — it is incomplete unless there is
  // exactly one active locale. Treat it as covering nothing in multi-locale mode.
  if (typeof value === 'string') {
    return locales.length <= 1 && value.trim() !== '' ? [] : locales.filter(() => locales.length > 1)
  }
  if (value == null || typeof value !== 'object') return [...locales]
  const rec = value as Record<string, unknown>
  return locales.filter((l) => {
    const v = rec[l]
    return typeof v !== 'string' || v.trim() === ''
  })
}

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Every node id in the page (top-level + nested), depth-first, deduped. */
function allNodeIds(page: CanvasPage): string[] {
  return Object.keys(page.nodes)
}

/** True if any nested value is a function (Law 2 — config must be pure data). */
function containsFunction(value: unknown, seen = new Set<unknown>()): boolean {
  if (typeof value === 'function') return true
  if (value == null || typeof value !== 'object') return false
  if (seen.has(value)) return false
  seen.add(value)
  if (Array.isArray(value)) return value.some((v) => containsFunction(v, seen))
  return Object.values(value as Record<string, unknown>).some((v) => containsFunction(v, seen))
}

/** Deterministic JSON (object keys sorted) for order-insensitive deep equality. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortDeep(value))
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortDeep((value as Record<string, unknown>)[key])
    }
    return out
  }
  return value
}

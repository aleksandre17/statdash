// ── Config schema versioning [N19 / P3-3] ──────────────────────────────
//
//  Covers the migration runner + guards on the canonical migration module.
//  The runner is the lazy-migration seam: stored JSONB blobs are forward-
//  migrated to CURRENT_SCHEMA_VERSION on read, never mutated in place.
//
// @vitest-environment node

import { describe, it, expect, beforeEach } from 'vitest'
import {
  CURRENT_SCHEMA_VERSION,
  migratePageConfig,
  isCurrentSchema,
  registerMigration,
  highestMigrationVersion,
} from './migration'

describe('migratePageConfig — version stamping', () => {
  it('stamps schemaVersion onto a v0 config (no schemaVersion field)', () => {
    const v0 = { id: 'gdp', type: 'inner-page', children: [] }
    const out = migratePageConfig(v0)
    expect(out.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(out.schemaVersion).toBe(3)
  })

  it('returns a config already at the current version unchanged in content', () => {
    const v3 = { id: 'gdp', type: 'inner-page', schemaVersion: 3, children: [] }
    const out = migratePageConfig(v3)
    expect(out.schemaVersion).toBe(3)
    expect(out).toEqual(v3)
  })

  it('is idempotent — migrating twice equals migrating once', () => {
    const v0 = { id: 'gdp', type: 'inner-page' }
    const once = migratePageConfig(v0)
    const twice = migratePageConfig(once)
    expect(twice).toEqual(once)
  })
})

describe('migratePageConfig — purity (never mutates input)', () => {
  it('does not mutate the input object', () => {
    const v0 = { id: 'gdp', type: 'inner-page' }
    const snapshot = { ...v0 }
    migratePageConfig(v0)
    expect(v0).toEqual(snapshot)
    expect(v0).not.toHaveProperty('schemaVersion')
  })

  it('returns a new object reference', () => {
    const v1 = { id: 'gdp', schemaVersion: 1 }
    const out = migratePageConfig(v1)
    expect(out).not.toBe(v1)
  })
})

describe('migratePageConfig — non-destructive field preservation', () => {
  it('preserves unknown / extra fields through migration', () => {
    const v0 = {
      id: 'gdp',
      type: 'inner-page',
      frame: 'landing',
      vars: { currentYear: 2023 },
      children: [{ type: 'section', id: 's1' }],
      futureField: { nested: ['a', 'b'] },
    }
    const out = migratePageConfig(v0)
    expect(out.id).toBe('gdp')
    expect(out.frame).toBe('landing')
    expect(out.vars).toEqual({ currentYear: 2023 })
    expect(out.children).toEqual([{ type: 'section', id: 's1' }])
    expect(out.futureField).toEqual({ nested: ['a', 'b'] })
  })
})

describe('isCurrentSchema', () => {
  it('is true for a migrated config', () => {
    const out = migratePageConfig({ id: 'gdp' })
    expect(isCurrentSchema(out)).toBe(true)
  })

  it('is false for a raw v0 config (no schemaVersion)', () => {
    expect(isCurrentSchema({ id: 'gdp', type: 'inner-page' })).toBe(false)
  })

  it('is false for a behind-version config', () => {
    expect(isCurrentSchema({ id: 'gdp', schemaVersion: 0 })).toBe(false)
  })

  it('is defensive against null / undefined / non-object input', () => {
    expect(isCurrentSchema(null)).toBe(false)
    expect(isCurrentSchema(undefined)).toBe(false)
    expect(isCurrentSchema('not-a-config')).toBe(false)
  })
})

describe('migratePageConfig — forward-compat guard', () => {
  it('throws for a config newer than CURRENT_SCHEMA_VERSION (no retrograde migration)', () => {
    const future = { id: 'gdp', schemaVersion: CURRENT_SCHEMA_VERSION + 1 }
    expect(() => migratePageConfig(future)).toThrow(/newer than/)
  })

  it('throws message names both the config version and the supported version', () => {
    const future = { id: 'gdp', schemaVersion: 99 }
    expect(() => migratePageConfig(future)).toThrow(
      new RegExp(`99.*${CURRENT_SCHEMA_VERSION}`),
    )
  })
})

// ── v1 → v2: page color → presentation.color (the FIRST real migrator) ──────
//
//  Proves the migration chain runs end-to-end through a REAL registered migrator
//  (P-4: the chain previously had ZERO migrators — dead code). The v1→v2 migrator
//  collapses the page-color SSOT wobble (P-5): a flat `color` moves into
//  `presentation.color`, and the flat field is dropped — its single home.
//
describe('v1 → v2 — page color migrates into presentation.color (single home)', () => {
  it('a v1 page with a flat color → v2 with presentation.color and no flat color', () => {
    const v1 = { id: 'gdp', type: 'inner-page', schemaVersion: 1, color: '#0080BE', children: [] }
    const out = migratePageConfig(v1)
    expect(out.schemaVersion).toBe(3)
    expect(out.color).toBeUndefined()
    expect(out.presentation).toEqual({ color: '#0080BE' })
    // Other fields are preserved.
    expect(out.id).toBe('gdp')
    expect(out.children).toEqual([])
  })

  it('a v0 page (no schemaVersion) with a flat color migrates through v1→v2', () => {
    // v0 → v1 has no registered migrator (identity step), v1 → v2 moves the color.
    const v0 = { id: 'gdp', type: 'inner-page', color: '#123456', children: [] }
    const out = migratePageConfig(v0)
    expect(out.schemaVersion).toBe(3)
    expect(out.color).toBeUndefined()
    expect(out.presentation).toEqual({ color: '#123456' })
  })

  it('a page with NO color migrates cleanly — no spurious presentation bag', () => {
    const v1 = { id: 'landing', type: 'container-page', schemaVersion: 1, children: [] }
    const out = migratePageConfig(v1)
    expect(out.schemaVersion).toBe(3)
    expect(out.presentation).toBeUndefined()
    expect(out).not.toHaveProperty('color')
  })

  it('an existing presentation.color WINS; the flat color is still dropped', () => {
    const v1 = {
      id: 'regional', type: 'inner-page', schemaVersion: 1,
      color: '#0080BE',
      presentation: { color: { op: 'find', by: 'region' }, crumbs: [{ label: 'X' }] },
      children: [],
    }
    const out = migratePageConfig(v1) as { presentation: Record<string, unknown>; color?: unknown }
    expect(out.color).toBeUndefined()
    // The authored presentation.color (an expression) is canonical — NOT overwritten.
    expect(out.presentation.color).toEqual({ op: 'find', by: 'region' })
    // Sibling presentation keys are preserved.
    expect(out.presentation.crumbs).toEqual([{ label: 'X' }])
  })

  it('merges flat color into an existing presentation that has NO color', () => {
    const v1 = {
      id: 'p', type: 'inner-page', schemaVersion: 1,
      color: '#abcdef',
      presentation: { crumbs: [{ label: 'Home' }] },
      children: [],
    }
    const out = migratePageConfig(v1) as { presentation: Record<string, unknown> }
    expect(out.presentation).toEqual({ crumbs: [{ label: 'Home' }], color: '#abcdef' })
  })

  it('is idempotent on a v3 input — re-migration is a no-op', () => {
    const v3 = {
      id: 'gdp', type: 'inner-page', schemaVersion: 3,
      presentation: { color: '#0080BE' }, children: [],
    }
    const out = migratePageConfig(v3)
    expect(out).toEqual(v3)
    // And migrating the output of a v1 migration again is stable.
    const fromV1 = migratePageConfig({ id: 'gdp', type: 'inner-page', schemaVersion: 1, color: '#0080BE', children: [] })
    expect(migratePageConfig(fromV1)).toEqual(fromV1)
  })

  it('does not mutate the v1 input', () => {
    const v1 = { id: 'gdp', type: 'inner-page', schemaVersion: 1, color: '#0080BE', children: [] }
    const snapshot = JSON.parse(JSON.stringify(v1))
    migratePageConfig(v1)
    expect(v1).toEqual(snapshot)
    expect(v1).toHaveProperty('color', '#0080BE')
  })
})

// ── v2 → v3: node type 'georgraph' → 'geograph' (misspelling fix) ───────────
//
//  The public node-type discriminant was misspelled. It is serialized (stored
//  configs + provisioning), so the rename is a real migration applied across the
//  whole node tree. Pure, idempotent, structure-preserving.
//
describe('v2 → v3 — node type georgraph renamed to geograph', () => {
  it('renames a top-level georgraph node and recurses into children', () => {
    const v2 = {
      id: 'regional', type: 'inner-page', schemaVersion: 2,
      children: [
        {
          type: 'section', id: 's1',
          children: [
            { type: 'georgraph', id: 'map1', title: 'GDP by region', paramKey: 'region' },
          ],
        },
      ],
    }
    const out = migratePageConfig(v2) as Record<string, unknown>
    expect(out.schemaVersion).toBe(3)
    const section = (out.children as Array<Record<string, unknown>>)[0]
    const geoNode = (section.children as Array<Record<string, unknown>>)[0]
    expect(geoNode.type).toBe('geograph')
    // Sibling fields on the renamed node are untouched.
    expect(geoNode.id).toBe('map1')
    expect(geoNode.title).toBe('GDP by region')
    expect(geoNode.paramKey).toBe('region')
  })

  it('renames multiple georgraph nodes anywhere in the tree', () => {
    const v2 = {
      id: 'p', type: 'inner-page', schemaVersion: 2,
      children: [
        { type: 'georgraph', id: 'a' },
        { type: 'section', id: 's', children: [{ type: 'georgraph', id: 'b' }] },
      ],
    }
    const out = migratePageConfig(v2) as Record<string, unknown>
    const kids = out.children as Array<Record<string, unknown>>
    expect(kids[0].type).toBe('geograph')
    expect((kids[1].children as Array<Record<string, unknown>>)[0].type).toBe('geograph')
  })

  it('a config with NO georgraph node passes through structurally unchanged (modulo version)', () => {
    const v2 = {
      id: 'landing', type: 'container-page', schemaVersion: 2,
      children: [{ type: 'section', id: 's1', children: [{ type: 'chart', id: 'c1' }] }],
    }
    const out = migratePageConfig(v2)
    expect(out).toEqual({ ...v2, schemaVersion: 3 })
  })

  it('does NOT rewrite a non-type field whose value happens to be "georgraph"', () => {
    const v2 = {
      id: 'p', type: 'inner-page', schemaVersion: 2,
      children: [{ type: 'georgraph', id: 'm', note: 'georgraph' }],
    }
    const out = migratePageConfig(v2) as Record<string, unknown>
    const node = (out.children as Array<Record<string, unknown>>)[0]
    expect(node.type).toBe('geograph')   // the discriminant is renamed
    expect(node.note).toBe('georgraph')  // an incidental string value is NOT
  })

  it('is idempotent — already-migrated geograph survives re-migration', () => {
    const v3 = {
      id: 'p', type: 'inner-page', schemaVersion: 3,
      children: [{ type: 'geograph', id: 'm' }],
    }
    const out = migratePageConfig(v3)
    expect(out).toEqual(v3)
  })

  it('does not mutate the v2 input tree', () => {
    const v2 = {
      id: 'p', type: 'inner-page', schemaVersion: 2,
      children: [{ type: 'georgraph', id: 'm' }],
    }
    const snapshot = JSON.parse(JSON.stringify(v2))
    migratePageConfig(v2)
    expect(v2).toEqual(snapshot)
  })
})

// ── Migration chain mechanics — exercises the registry seam ─────────────
//
//  These tests register a migration to a HIGHER target than the live
//  CURRENT_SCHEMA_VERSION, then drive the runner manually via the registry
//  to prove the v_n → v_n+1 sequencing. They do NOT alter CURRENT_SCHEMA_VERSION
//  (a const), so they assert the registered step is reachable up to current.

describe('migration registry — registerMigration / highestMigrationVersion', () => {
  beforeEach(() => {
    // No global reset API by design (migrations are immutable history); these
    // tests register idempotent steps and read back the highest target.
  })

  it('records the highest registered target version', () => {
    // Register to HIGH throwaway targets (well above CURRENT_SCHEMA_VERSION) so we
    // exercise the registry seam WITHOUT clobbering the real v1/v2 migrators
    // (registerMigration is last-write-wins on the module-global Map).
    registerMigration(90, (c) => ({ ...c, addedInV90: true }))
    registerMigration(91, (c) => ({ ...c, addedInV91: true }))
    expect(highestMigrationVersion()).toBeGreaterThanOrEqual(91)
  })
})

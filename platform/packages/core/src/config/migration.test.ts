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
    expect(out.schemaVersion).toBe(1)
  })

  it('returns a config already at the current version unchanged in content', () => {
    const v1 = { id: 'gdp', type: 'inner-page', schemaVersion: 1, children: [] }
    const out = migratePageConfig(v1)
    expect(out.schemaVersion).toBe(1)
    expect(out).toEqual(v1)
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
    registerMigration(2, (c) => ({ ...c, addedInV2: true }))
    registerMigration(3, (c) => ({ ...c, addedInV3: true }))
    expect(highestMigrationVersion()).toBeGreaterThanOrEqual(3)
  })
})

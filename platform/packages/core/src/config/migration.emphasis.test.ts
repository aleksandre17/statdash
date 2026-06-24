// ── v3 → v4 emphasis migrator [shell-variant-style spine] ──────────────────
//
//  The variant-style spine collapses a section's two mutually-exclusive emphasis
//  booleans (`view.hero`, `view.compact`) into ONE declared enum
//  `variants.emphasis`. The booleans were a SERIALIZED config shape (stored
//  configs + provisioning), so retiring them is a real migration applied across
//  the whole node tree — pure, idempotent, structure-preserving. Split from
//  migration.test.ts (one concern per file, bloat ceiling).
//
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { CURRENT_SCHEMA_VERSION, migratePageConfig } from './migration'

describe('v3 → v4 — section view.hero / view.compact collapse into variants.emphasis', () => {
  it('rewrites view.hero:true → variants.emphasis:"hero" and drops the boolean', () => {
    const v3 = {
      id: 'accounts', type: 'inner-page', schemaVersion: 3,
      children: [
        { type: 'section', id: 'sna-hero', view: { hero: true, noCollapse: true, subtitle: 'x' } },
      ],
    }
    const out = migratePageConfig(v3) as Record<string, unknown>
    expect(out.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    const sec = (out.children as Array<Record<string, unknown>>)[0]
    expect(sec.variants).toEqual({ emphasis: 'hero' })
    // The boolean is gone; sibling view keys survive.
    expect((sec.view as Record<string, unknown>).hero).toBeUndefined()
    expect((sec.view as Record<string, unknown>).noCollapse).toBe(true)
    expect((sec.view as Record<string, unknown>).subtitle).toBe('x')
  })

  it('rewrites view.compact:true → variants.emphasis:"compact" and drops the boolean', () => {
    const v3 = {
      id: 'p', type: 'inner-page', schemaVersion: 3,
      children: [{ type: 'section', id: 's', view: { compact: true, width: 'half' } }],
    }
    const out = migratePageConfig(v3) as Record<string, unknown>
    const sec = (out.children as Array<Record<string, unknown>>)[0]
    expect(sec.variants).toEqual({ emphasis: 'compact' })
    expect((sec.view as Record<string, unknown>).compact).toBeUndefined()
    expect((sec.view as Record<string, unknown>).width).toBe('half')
  })

  it('hero WINS over compact when both are set (mutually-exclusive collapse is deterministic)', () => {
    const v3 = {
      id: 'p', type: 'inner-page', schemaVersion: 3,
      children: [{ type: 'section', id: 's', view: { hero: true, compact: true } }],
    }
    const out = migratePageConfig(v3) as Record<string, unknown>
    const sec = (out.children as Array<Record<string, unknown>>)[0]
    expect(sec.variants).toEqual({ emphasis: 'hero' })
  })

  it('recurses into deeply-nested section nodes', () => {
    const v3 = {
      id: 'p', type: 'inner-page', schemaVersion: 3,
      children: [
        { type: 'row', children: [{ type: 'section', id: 'deep', view: { hero: true } }] },
      ],
    }
    const out = migratePageConfig(v3) as Record<string, unknown>
    const row = (out.children as Array<Record<string, unknown>>)[0]
    const sec = (row.children as Array<Record<string, unknown>>)[0]
    expect(sec.variants).toEqual({ emphasis: 'hero' })
  })

  it('an authored variants.emphasis WINS; the legacy booleans are still dropped', () => {
    const v3 = {
      id: 'p', type: 'inner-page', schemaVersion: 3,
      children: [{ type: 'section', id: 's', variants: { emphasis: 'compact' }, view: { hero: true } }],
    }
    const out = migratePageConfig(v3) as Record<string, unknown>
    const sec = (out.children as Array<Record<string, unknown>>)[0]
    expect(sec.variants).toEqual({ emphasis: 'compact' })              // authored value canonical
    expect((sec.view as Record<string, unknown>).hero).toBeUndefined()  // boolean retired
  })

  it('a config with no hero/compact section passes through unchanged (modulo version)', () => {
    const v3 = {
      id: 'p', type: 'inner-page', schemaVersion: 3,
      children: [{ type: 'section', id: 's', view: { width: 'full', noCollapse: true } }],
    }
    const out = migratePageConfig(v3)
    expect(out).toEqual({ ...v3, schemaVersion: CURRENT_SCHEMA_VERSION })
  })

  it('does NOT touch a chart node\'s own `compact` prop (only section view booleans)', () => {
    // The chart-interpreter `compact` lives at node-top-level, not in `view`.
    const v3 = {
      id: 'p', type: 'inner-page', schemaVersion: 3,
      children: [{ type: 'chart', id: 'c', compact: true }],
    }
    const out = migratePageConfig(v3) as Record<string, unknown>
    const chart = (out.children as Array<Record<string, unknown>>)[0]
    expect(chart.compact).toBe(true)        // untouched — not a `view` boolean
    expect(chart.variants).toBeUndefined()  // no spurious variants bag
  })

  it('is idempotent — a v4 emphasis config survives re-migration', () => {
    const vCur = {
      id: 'p', type: 'inner-page', schemaVersion: CURRENT_SCHEMA_VERSION,
      children: [{ type: 'section', id: 's', variants: { emphasis: 'hero' }, view: { noCollapse: true } }],
    }
    const out = migratePageConfig(vCur)
    expect(out).toEqual(vCur)
  })

  it('does not mutate the v3 input tree', () => {
    const v3 = {
      id: 'p', type: 'inner-page', schemaVersion: 3,
      children: [{ type: 'section', id: 's', view: { hero: true } }],
    }
    const snapshot = JSON.parse(JSON.stringify(v3))
    migratePageConfig(v3)
    expect(v3).toEqual(snapshot)
  })
})

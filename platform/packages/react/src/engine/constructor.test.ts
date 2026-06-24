// @vitest-environment node
//
// ── constructor.test.ts — N2: describeApp() manifest compositing ──────────────
//
//  Tests structural invariants of describeApp(). Uses:
//    - real SPEC_CATALOG (static, 9 entries)
//    - real chartRegistry (pre-populated by @statdash/charts side-effect import)
//    - singleton nodeRegistry (empty in node test env — no setupRegistrations)
//    - singleton modeRegistry (empty in node test env — modes registered at app boot)
//    - singleton storeManifest _registry (empty in node test env)
//
//  Strategy: structural invariants, not content equality. Avoids coupling
//  tests to app-boot registration counts.
//

import { describe, it, expect } from 'vitest'
import { describeApp }           from './constructor'
import { SPEC_CATALOG }          from '@statdash/engine'
import { nodeRegistry }          from './register-all'

// ── Shape ─────────────────────────────────────────────────────────────────────

describe('describeApp() — shape', () => {

  it('returns an object with all required fields', () => {
    const manifest = describeApp()

    expect(manifest).toHaveProperty('contractVersion')
    expect(manifest).toHaveProperty('palette')
    expect(manifest).toHaveProperty('propertySchemas')
    expect(manifest).toHaveProperty('chartTypes')
    expect(manifest).toHaveProperty('specTypes')
    expect(manifest).toHaveProperty('modes')
    expect(manifest).toHaveProperty('datasourceKinds')
    expect(manifest).toHaveProperty('transformOps')
    expect(manifest).toHaveProperty('metrics')
    expect(manifest).toHaveProperty('exportFormats')
    expect(manifest).toHaveProperty('filterControlTypes')
  })

  it('filterControlTypes is an array of strings', () => {
    const { filterControlTypes } = describeApp()
    expect(Array.isArray(filterControlTypes)).toBe(true)
    // may be empty in node test env (filter controls registered at app boot)
    filterControlTypes.forEach(t => expect(typeof t).toBe('string'))
  })

  it('exportFormats is a non-empty string array (csv + sdmx-json registered at import)', () => {
    const { exportFormats } = describeApp()
    expect(Array.isArray(exportFormats)).toBe(true)
    expect(exportFormats.length).toBeGreaterThan(0)
    exportFormats.forEach(f => expect(typeof f).toBe('string'))
  })

  it('exportFormats includes the built-in csv and sdmx-json formats', () => {
    const { exportFormats } = describeApp()
    expect(exportFormats).toContain('csv')
    expect(exportFormats).toContain('sdmx-json')
  })

  it('palette is an array', () => {
    expect(Array.isArray(describeApp().palette)).toBe(true)
  })

  it('propertySchemas is a plain object', () => {
    const { propertySchemas } = describeApp()
    expect(typeof propertySchemas).toBe('object')
    expect(propertySchemas).not.toBeNull()
    expect(Array.isArray(propertySchemas)).toBe(false)
  })

  it('chartTypes is a non-empty string array (built-in interpreters registered at import)', () => {
    const { chartTypes } = describeApp()
    expect(Array.isArray(chartTypes)).toBe(true)
    expect(chartTypes.length).toBeGreaterThan(0)
    chartTypes.forEach(t => expect(typeof t).toBe('string'))
  })

  it('specTypes is a plain object', () => {
    const { specTypes } = describeApp()
    expect(typeof specTypes).toBe('object')
    expect(specTypes).not.toBeNull()
    expect(Array.isArray(specTypes)).toBe(false)
  })

  it('modes is an array', () => {
    expect(Array.isArray(describeApp().modes)).toBe(true)
  })

  it('datasourceKinds is an array', () => {
    expect(Array.isArray(describeApp().datasourceKinds)).toBe(true)
  })

  it('transformOps is a non-empty string array (15 built-in steps registered at import)', () => {
    const { transformOps } = describeApp()
    expect(Array.isArray(transformOps)).toBe(true)
    expect(transformOps.length).toBeGreaterThan(0)
    transformOps.forEach(op => expect(typeof op).toBe('string'))
  })

  it('transformOps includes the core built-in ops', () => {
    const { transformOps } = describeApp()
    const coreOps = ['sort', 'filter', 'melt', 'rename', 'aggregate', 'derive']
    coreOps.forEach(op => expect(transformOps).toContain(op))
  })

  it('metrics is a plain object (empty in node test env — no setupRegistrations)', () => {
    const { metrics } = describeApp()
    expect(typeof metrics).toBe('object')
    expect(metrics).not.toBeNull()
    expect(Array.isArray(metrics)).toBe(false)
  })

})

// ── specTypes — SPEC_CATALOG passthrough ──────────────────────────────────────

describe('describeApp() — specTypes', () => {

  it('contains all keys from SPEC_CATALOG', () => {
    const { specTypes } = describeApp()
    const catalogKeys   = Object.keys(SPEC_CATALOG)

    expect(catalogKeys.length).toBeGreaterThanOrEqual(7)
    catalogKeys.forEach(key => {
      expect(specTypes).toHaveProperty(key)
    })
  })

  it('includes the canonical spec type strings', () => {
    const { specTypes } = describeApp()
    const expectedKeys = ['query', 'row-list', 'timeseries', 'growth', 'ratio-list', 'pivot', 'by-mode']

    expectedKeys.forEach(key => {
      expect(specTypes).toHaveProperty(key)
    })
  })

  it('each SpecDescriptor has label, description, constructorReady, fields, example', () => {
    const { specTypes } = describeApp()

    Object.entries(specTypes).forEach(([, descriptor]) => {
      expect(descriptor).toHaveProperty('label')
      expect(descriptor).toHaveProperty('description')
      expect(descriptor).toHaveProperty('constructorReady')
      expect(descriptor).toHaveProperty('fields')
      expect(descriptor).toHaveProperty('example')
      expect(Array.isArray(descriptor.fields)).toBe(true)
    })
  })

})

// ── nodeRegistry passthrough ──────────────────────────────────────────────────

describe('describeApp() — palette + propertySchemas', () => {

  it('palette and propertySchemas match nodeRegistry.describeRegistry()', () => {
    const registryManifest = nodeRegistry.describeRegistry()
    const manifest         = describeApp()

    expect(manifest.palette).toEqual(registryManifest.palette)
    expect(manifest.propertySchemas).toEqual(registryManifest.propertySchemas)
  })

})

// ── JSON-serializable invariant ───────────────────────────────────────────────

describe('describeApp() — JSON-serializable', () => {

  it('round-trips through JSON.parse(JSON.stringify(...)) without loss', () => {
    const manifest   = describeApp()
    const serialized = JSON.parse(JSON.stringify(manifest)) as typeof manifest

    expect(serialized).toEqual(manifest)
  })

  it('JSON.stringify does not throw', () => {
    expect(() => JSON.stringify(describeApp())).not.toThrow()
  })

})

// ── Stability — two calls return equal values ─────────────────────────────────

describe('describeApp() — stability', () => {

  it('two successive calls return deeply equal results', () => {
    expect(describeApp()).toEqual(describeApp())
  })

})

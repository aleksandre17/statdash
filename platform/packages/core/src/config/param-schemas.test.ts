// ── param-schemas — every ParamDef type carries an authoring PropSchema [V0] ───
//
//  The engine-side half of Coverage Fitness #1 for ParamDefs: each ParamDef type
//  (the SSOT tuple PARAMDEF_TYPES) registers an authoring PropSchema, and those
//  schemas bind their dimension `key` to the cube-profile (pick-don't-type). This
//  pins the OCP contract at the registration layer (the panel's coverage test pins
//  it at the surface layer).
//
import { describe, it, expect } from 'vitest'
import { getParamSchema, listParamSchemas, PARAMDEF_TYPES } from '../index'

describe('param-schemas — ParamDef authoring schemas (V0)', () => {
  it('every ParamDef type registers an authoring PropSchema', () => {
    for (const type of PARAMDEF_TYPES) {
      const schema = getParamSchema(type)
      expect(schema, `${type} must carry an authoring schema`).toBeTruthy()
      expect(Array.isArray(schema)).toBe(true)
      expect(schema!.length).toBeGreaterThan(0)
    }
  })

  it('the registered set is EXACTLY the engine SSOT (no drift either way)', () => {
    expect(listParamSchemas().sort()).toEqual([...PARAMDEF_TYPES].sort())
  })

  it('cube-bound types pick their dimension from the cube-profile (Law 2)', () => {
    // select / multi-select / chip-select / cascade / year-select / range all bind
    // `key` to the cube.dimensions discovery source — the author picks, never types.
    for (const type of ['select', 'multi-select', 'chip-select', 'cascade', 'range', 'year-select'] as const) {
      const schema = getParamSchema(type)!
      const keyField = schema.find((f) => f.field === 'key')
      expect(keyField, `${type}.key must exist`).toBeTruthy()
      expect(keyField!.type).toBe('enum-ref')
      expect(keyField!.source).toBe('cube.dimensions')
    }
  })

  it('select default is a cube.members enum-ref scoped to the chosen dimension', () => {
    const schema = getParamSchema('select')!
    const def = schema.find((f) => f.field === 'default')!
    expect(def.type).toBe('enum-ref')
    expect(def.source).toBe('cube.members')
    expect(def.sourceDim).toBe('key') // member list follows the sibling `key`
  })

  it('the label field is a localized LocaleString (locale-coverage enforced)', () => {
    const schema = getParamSchema('select')!
    const label = schema.find((f) => f.field === 'label')!
    expect(label.type).toBe('LocaleString')
    expect(label.coverage).toBe('localized')
  })
})

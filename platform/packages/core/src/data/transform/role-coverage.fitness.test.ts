// ── FF-ROLE-COVERAGE — card 0087 · P-OFFER · every op declares its offer story ────
//
//  The Authoring Canon's P-OFFER principle (owner 2026-07-18: «მთელ პაიპლაინზე
//  ვრცელდებოდეს შემოთავაზებები … არაფერი გამორჩეს … აგნოსტიკური») demands that the
//  panel's ONE generic step editor can PROJECT every authorable field to an offered
//  control. That is only possible if every LEAF field of every registered op-schema
//  DECLARES its authoring `role` (field / member / newName / expr / literal). This gate
//  is the CATEGORY_PIN pattern for roles: a NEW op (or a new field on an existing op)
//  cannot ship without its offer story — `listUnroledFields()` must stay `[]`, else it
//  points at the exact `op.field` path with no role.
//
//  It ALSO pins the role taxonomy for the demo verbs (filter/aggregate/derive/sort/
//  lookup) so a silent re-role of a load-bearing field fails loudly.
//
import { describe, it, expect } from 'vitest'
// Side-effect import: registers all built-in transform ops (+ their schemas) .
import './index'
import {
  listUnroledFields,
  getTransformStepSchema,
  listTransformOpSchemas,
} from './step-registry'
import type { PropField, PropFieldRole } from '../../config/prop-schema'

/** Flatten a schema to `path → role` for every LEAF field (recursing itemSchema). */
function leafRoles(op: string): Record<string, PropFieldRole | undefined> {
  const out: Record<string, PropFieldRole | undefined> = {}
  const walk = (fields: PropField[], prefix: string) => {
    for (const f of fields) {
      const path = prefix ? `${prefix}.${f.field}` : f.field
      if (f.itemSchema && f.itemSchema.length > 0) walk(f.itemSchema, path)
      else out[path] = f.role
    }
  }
  walk((getTransformStepSchema(op) ?? []) as PropField[], '')
  return out
}

describe('FF-ROLE-COVERAGE — every op-schema leaf field declares its P-OFFER role (card 0087)', () => {
  it('no registered op-schema leaf field is unroled (a NEW op must declare its offer story)', () => {
    const unroled = listUnroledFields()
    expect(
      unroled,
      `these op-schema leaf fields carry no P-OFFER role decision:\n`
      + unroled.map((u) => `  · ${u.field}`).join('\n')
      + `\nEvery leaf field must declare role: 'field' | 'member' | 'newName' | 'expr' | 'literal' `
      + `(card 0087) so the ONE generic TransformStepEditor can project it to an offered control. `
      + `A structured container declares itemSchema instead; its sub-fields carry the roles.`,
    ).toEqual([])
  })

  it('every schema-carrying op is covered (the coverage scan is not vacuously empty)', () => {
    // Guard against the gate passing because nothing was scanned.
    expect(listTransformOpSchemas().length).toBeGreaterThan(10)
  })

  // ── Taxonomy pin for the demo verbs — a silent re-role fails loudly ────────────────
  it('filter/aggregate/derive/sort/lookup keep their load-bearing roles', () => {
    expect(leafRoles('filter')).toEqual({ where: 'field' })

    // aggregate: groupBy picks input columns; each aggregation = field + op + newName.
    expect(leafRoles('aggregate')).toEqual({
      groupBy: 'field',
      'aggregations.field': 'field',
      'aggregations.op': 'literal',
      'aggregations.as': 'newName',
    })

    // derive: a produced name + a formula (the expr editor + live preview).
    expect(leafRoles('derive')).toEqual({ as: 'newName', expr: 'expr' })

    expect(leafRoles('sort')).toEqual({ by: 'field', dir: 'literal' })

    // lookup: the key is an input column; from is a source ref; fields/rename name the
    // JOINED source (free text — not offered from the input rows).
    expect(leafRoles('lookup')).toEqual({
      key: 'field', from: 'literal', fields: 'newName', rename: 'newName',
    })
  })

  // ── The member seam (agnostic parity) — rollup.of is scoped to rollup.dim ──────────
  it('a member-role field carries memberOf pointing at the column it offers members of', () => {
    const of = (getTransformStepSchema('rollup') ?? []).find((f) => f.field === 'of')
    expect(of?.role).toBe('member')
    expect(of?.memberOf).toBe('dim')
  })
})

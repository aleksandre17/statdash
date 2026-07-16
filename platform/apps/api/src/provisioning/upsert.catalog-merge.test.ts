// ── mergeCatalogById — seed-provenance three-way merge (kubectl last-applied) ──
//
// The contract that closes the 0078 P2 (B5G) incident class: a provisioning label
// fix MUST reach entries the steward never touched, while a steward-edited entry
// survives every re-provision. Ownership is decided per id by the seed-hash ledger:
// hash(stored) === recorded hash ⇔ provisioning still owns the id.

import { describe, it, expect } from 'vitest'
import { mergeCatalogById } from './upsert.js'
import { canonicalHash, jsonEqual } from './util.js'

const gni = (label: string) => ({ id: 'accounts.gni', label: { ka: label }, format: 'mln_gel' })
const stewardMetric = { id: 'steward.custom', label: { ka: 'სტიუარდის მეტრიკა' } }

describe('mergeCatalogById — seed provenance', () => {
  it('refuses non-arrays (never clobbers an unmergeable value)', () => {
    expect(mergeCatalogById({ not: 'array' }, [])).toBeNull()
    expect(mergeCatalogById([], { not: 'array' })).toBeNull()
  })

  it('fresh seed: every shipped entry becomes provisioning-owned', () => {
    const shipped = [gni('მთლიანი ეროვნული შემოსავალი')]
    const r = mergeCatalogById([], shipped)!
    expect(r.merged).toEqual(shipped)
    expect(r.nextHashes['accounts.gni']).toBe(canonicalHash(shipped[0]))
  })

  it('absent id is appended and recorded; steward entries are untouched', () => {
    const shipped = [gni('ახალი')]
    const r = mergeCatalogById([stewardMetric], shipped, {})!
    expect(r.merged).toEqual([stewardMetric, shipped[0]])
    expect(r.nextHashes).toEqual({ 'accounts.gni': canonicalHash(shipped[0]) })
  })

  it('THE (B5G) CASE: a provisioning update APPLIES while the id is provisioning-owned', () => {
    const seeded = gni('მთლიანი ეროვნული შემოსავალი (B5G)')
    const fixed = gni('მთლიანი ეროვნული შემოსავალი')
    const ledger = { 'accounts.gni': canonicalHash(seeded) }
    const r = mergeCatalogById([seeded], [fixed], ledger)!
    expect(r.merged).toEqual([fixed])
    expect(r.nextHashes['accounts.gni']).toBe(canonicalHash(fixed))
  })

  it('a steward-edited entry SURVIVES and ownership transfers (hash dropped)', () => {
    const seeded = gni('სათაური')
    const stewardEdited = gni('სტიუარდის სათაური')
    const ledger = { 'accounts.gni': canonicalHash(seeded) } // recorded for the SEEDED form
    const r = mergeCatalogById([stewardEdited], [gni('ფაილის ახალი სათაური')], ledger)!
    expect(r.merged).toEqual([stewardEdited])
    expect(r.nextHashes['accounts.gni']).toBeUndefined()
  })

  it('pre-provenance bridge: identical content adopts the id losslessly', () => {
    const entry = gni('იგივე')
    const r = mergeCatalogById([entry], [gni('იგივე')], {})!
    expect(r.merged).toEqual([entry])
    expect(r.nextHashes['accounts.gni']).toBe(canonicalHash(entry))
  })

  it('pre-provenance divergence stays conservative: stored wins, no adoption', () => {
    const stored = gni('შენახული')
    const r = mergeCatalogById([stored], [gni('ფაილისეული')], {})!
    expect(r.merged).toEqual([stored])
    expect(r.nextHashes['accounts.gni']).toBeUndefined()
  })

  it('file omission ≠ retirement: an owned entry no longer shipped is kept, still owned', () => {
    const kept = gni('აღარ იზიდება ფაილით')
    const ledger = { 'accounts.gni': canonicalHash(kept) }
    const r = mergeCatalogById([kept], [], ledger)!
    expect(r.merged).toEqual([kept])
    expect(r.nextHashes['accounts.gni']).toBe(ledger['accounts.gni'])
  })

  it('replacement is in place — stored order is stable', () => {
    const a = { id: 'a', label: { ka: 'ა' } }
    const b = gni('ძველი')
    const c = { id: 'c', label: { ka: 'გ' } }
    const fixed = gni('ახალი')
    const ledger = { 'accounts.gni': canonicalHash(b) }
    const r = mergeCatalogById([a, b, c], [fixed], ledger)!
    expect(r.merged).toEqual([a, fixed, c])
  })

  it('idempotent: re-running an unchanged file changes neither value nor ledger', () => {
    const shipped = [gni('სტაბილური'), { id: 'x', label: { ka: 'იქსი' } }]
    const first = mergeCatalogById([], shipped)!
    const second = mergeCatalogById(first.merged, shipped, first.nextHashes)!
    expect(jsonEqual(first.merged, second.merged)).toBe(true)
    expect(jsonEqual(first.nextHashes, second.nextHashes)).toBe(true)
  })

  it('an id-less provisioned entry is malformed and skipped', () => {
    const r = mergeCatalogById([], [{ label: { ka: 'უიდო' } }])!
    expect(r.merged).toEqual([])
    expect(r.nextHashes).toEqual({})
  })
})

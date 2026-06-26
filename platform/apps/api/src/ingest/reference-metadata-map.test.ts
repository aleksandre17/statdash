// ── Unit — metadata slot → V31 recognizer (ADR-0031 §6 Wave 3b), DB-free ──────
//
// THE INVARIANTS this locks:
//   · Only the non-LocaleString provenance keys map BAKE-NOW (methodology_ref →
//     methodologyUrl, last_update → lastUpdated). A plain-string `source`/`vintage`
//     does NOT fabricate a half-translated LocaleString content field.
//   · An empty/whitespace meta value is treated as absent (no empty badge).
//   · Nothing recognized → null (the publish path then writes no report row).

import { describe, expect, it } from 'vitest'
import { recognizeReferenceMetadata } from './reference-metadata-map.js'

describe('recognizeReferenceMetadata (Wave 3b BAKE-NOW slot)', () => {
  it('maps methodology_ref → methodologyUrl and last_update → lastUpdated', () => {
    const rm = recognizeReferenceMetadata({
      methodology_ref: 'https://geostat.ge/gdp',
      last_update: '2026-06-26',
    })
    expect(rm).toEqual({ methodologyUrl: 'https://geostat.ge/gdp', lastUpdated: '2026-06-26' })
  })

  it('ignores the SEAM-DEFER plain-string keys (source/vintage/unit_default) — no fabricated LocaleString', () => {
    // These are the real ACCOUNTS_SEQUENCE meta values; none is a complete ka+en
    // LocaleString, so none may enter a content column (the completeness trigger).
    const rm = recognizeReferenceMetadata({
      source: 'GeoStat', vintage: '2026-06-26', unit_default: 'GEL_MN',
    })
    expect(rm).toBeNull()
  })

  it('maps only the recognized key when a workbook carries just methodology_ref', () => {
    expect(recognizeReferenceMetadata({ methodology_ref: 'https://x/m', source: 'GeoStat' }))
      .toEqual({ methodologyUrl: 'https://x/m' })
  })

  it('treats a blank/whitespace value as absent (no empty badge)', () => {
    expect(recognizeReferenceMetadata({ methodology_ref: '   ', last_update: '' })).toBeNull()
  })

  it('returns null for an empty meta bag', () => {
    expect(recognizeReferenceMetadata({})).toBeNull()
  })
})

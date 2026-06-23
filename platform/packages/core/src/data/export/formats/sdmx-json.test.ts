import { describe, it, expect } from 'vitest'
import { serializeSdmxJson } from './sdmx-json'

const ROWS = [
  { year: '2021', value: 12.3 },
  { year: '2022', value: 14.5 },
]

describe('serializeSdmxJson', () => {
  it('produces valid JSON', () => {
    const out = serializeSdmxJson(ROWS, { title: 'GDP' })
    expect(() => JSON.parse(out)).not.toThrow()
  })

  it('includes required SDMX-JSON top-level keys', () => {
    const doc = JSON.parse(serializeSdmxJson(ROWS, {}))
    expect(doc).toHaveProperty('header')
    expect(doc).toHaveProperty('structure')
    expect(doc).toHaveProperty('dataSets')
  })

  it('header contains sender and prepared fields', () => {
    const doc = JSON.parse(serializeSdmxJson(ROWS, { title: 'TEST' }))
    expect(doc.header.id).toBe('TEST')
    expect(doc.header).toHaveProperty('sender')
    expect(doc.header).toHaveProperty('prepared')
  })

  it('structure.dimensions.observation matches field count', () => {
    const doc = JSON.parse(serializeSdmxJson(ROWS, {}))
    expect(doc.structure.dimensions.observation).toHaveLength(2) // year + value
  })

  it('dataSets[0].observations is non-empty for non-empty rows', () => {
    const doc = JSON.parse(serializeSdmxJson(ROWS, {}))
    const obs = doc.dataSets[0].observations
    expect(Object.keys(obs).length).toBeGreaterThan(0)
  })

  it('returns valid JSON for empty rows', () => {
    const out = serializeSdmxJson([], {})
    const doc = JSON.parse(out)
    expect(doc.dataSets[0].observations).toEqual({})
  })
})

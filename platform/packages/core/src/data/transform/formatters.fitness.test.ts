import { describe, it, expect } from 'vitest'
import { fmtNum } from './formatters'

// FF-FMTNUM-NO-DIGIT-LOSS — a regression guard for a real data-integrity bug:
// the old `/\.?0+$/` strip ate an INTEGER's trailing zeros at max=0
// (120000 -> "12", 2500 -> "25", 0 -> "", -100000 -> "-1"). Trailing-zero
// stripping must apply ONLY to the fractional part. Round numbers (axis ticks!)
// must keep every digit. The thousands separator is a NBSP (U+00A0).
const NB = String.fromCharCode(0xa0)

describe('fmtNum — no integer digit loss (FF-FMTNUM-NO-DIGIT-LOSS)', () => {
  it('keeps every integer digit for round numbers at max=0', () => {
    expect(fmtNum(120000, 0)).toBe(`120${NB}000`)
    expect(fmtNum(2500, 0)).toBe(`2${NB}500`)
    expect(fmtNum(2530, 0)).toBe(`2${NB}530`)
    expect(fmtNum(1000, 0)).toBe(`1${NB}000`)
    expect(fmtNum(0, 0)).toBe('0')
    expect(fmtNum(-100000, 0)).toBe(`-100${NB}000`)
  })
  it('still strips only fractional trailing zeros', () => {
    expect(fmtNum(12.5, 1)).toBe('12.5')
    expect(fmtNum(12.0, 1)).toBe('12')
    expect(fmtNum(12.34, 2)).toBe('12.34')
    expect(fmtNum(120000, 1)).toBe(`120${NB}000`)
    expect(fmtNum(120543.7, 0)).toBe(`120${NB}544`)
  })
})

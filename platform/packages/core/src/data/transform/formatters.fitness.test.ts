import { describe, it, expect } from 'vitest'
import { fmtNum, compact, getFormatter } from './formatters'

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

// FF-SIGN-PRESERVED (BI-B3 / C1) — sign_pct is a SIGNED formatter: the minus must
// survive so the growth TABLE (format:"sign_pct") agrees with the CHART (which plots
// the signed value). The old `Math.abs` dropped it (−6.3 → "6.3%"). Guards the whole
// signed-round-trip class through the ONE registry both views read.
describe('sign_pct — signed formatter SSOT (FF-SIGN-PRESERVED)', () => {
  const signPct = getFormatter('sign_pct')
  it('renders the negative sign for a signed datum', () => {
    expect(signPct(-6.3)).toBe('-6.3%')
    expect(signPct(-0.5)).toBe('-0.5%')
  })
  it('prepends + for positives and bare 0 for zero', () => {
    expect(signPct(7.9)).toBe('+7.9%')
    expect(signPct(11)).toBe('+11%')
    expect(signPct(0)).toBe('0%')
  })
  it('a negative always begins with a leading minus (round-trip invariant)', () => {
    for (const x of [6.3, 0.1, 12.75, 100]) expect(signPct(-x).startsWith('-')).toBe(true)
  })
})

// FF-AXIS-MONOTONIC (C1) — compact is the ONE axis-tick SSOT. It must (a) preserve
// MAGNITUDE (no lossy `/1000+' 000'` fabrication: 88 425.6 stays ~88K, never "88 000"),
// and (b) keep adjacent ticks DISTINCT so a scale never shows a duplicate label
// (1500 & 2000 both → "2 000" was the bug). Locale-aware via Intl (en / ka).
describe('compact — axis-tick SSOT, monotonic + magnitude-honest (FF-AXIS-MONOTONIC)', () => {
  it('preserves magnitude within one significant fraction digit (no fabricated 000)', () => {
    expect(compact(88425.6, 'en')).toBe('88.4K')   // was the lossy "88 000"
    expect(compact(4830, 'en')).toBe('4.8K')        // was "5 000"
  })
  it('keeps adjacent ticks distinct (the 1500/2000 duplicate-collapse bug)', () => {
    expect(compact(1500, 'en')).not.toBe(compact(2000, 'en'))
    expect(compact(1500, 'en')).toBe('1.5K')
    expect(compact(2000, 'en')).toBe('2K')
  })
  it('is monotonic across an ascending sample (strictly increasing values → distinct labels)', () => {
    const scale = [0, 1500, 2000, 4830, 88425.6, 104598.1]
    const labels = scale.map((v) => compact(v, 'en'))
    expect(new Set(labels).size).toBe(labels.length)
  })
  it('is locale-aware (ka glyph via Intl, O-1 confirmed)', () => {
    // Intl separates value and glyph with a narrow no-break space (U+202F) under
    // ka — assert on the locale-distinguishing parts, not the invisible separator.
    const ka = compact(88425.6, 'ka')
    expect(ka).toMatch(/^88,4\s*ათ\.$/u)
    expect(ka).not.toBe(compact(88425.6, 'en'))   // genuinely locale-driven
  })
})

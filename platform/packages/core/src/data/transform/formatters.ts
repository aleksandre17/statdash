// No trailing zeros, max `max` decimals, space thousands separator
export const fmtNum = (n: number, max = 1): string => {
  const abs = Math.abs(n), neg = n < 0 ? '-' : ''
  const s = abs.toFixed(max).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
  const [i, d] = s.split('.')
  return neg + i.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0') + (d ? '.' + d : '')
}
const fmtMlnGel = (n: number) => fmtNum(n, 0)
// Signed percent \u2014 the minus MUST survive (a growth rate is a signed datum).
// fmtNum carries the sign; the ternary only ADDS the explicit '+' for positives.
// -6.3 \u2192 "-6.3%", +7.9 \u2192 "+7.9%", 0 \u2192 "0%". (BI-B3: dropping Math.abs here is what
// makes the growth TABLE agree with the CHART, which already plots the signed value.)
const fmtSign   = (n: number) => `${n > 0 ? '+' : ''}${fmtNum(n, 1)}%`
// Magnitude percent \u2014 for provably non-negative columns only (shares). A signed
// column MUST use `sign_pct`, never this (Math.abs would silently eat the sign).
const fmtPct    = (n: number) => `${fmtNum(Math.abs(n), 1)}%`
const fmtUSD    = (n: number) => `$\u00A0${fmtMlnGel(n)}`

// \u2500\u2500 Compact / abbreviated notation \u2014 the ONE axis-tick + compact-cell SSOT \u2500\u2500
//
//  Locale-aware, backed by Intl (adopt the CLDR standard whole, Law 4):
//    en \u2192 88.4K \u00B7 1.2M \u00B7 2B      ka \u2192 88,4 \u10D0\u10D7. \u00B7 1,2 \u10DB\u10DA\u10DC. \u00B7 2 \u10DB\u10DA\u10E0\u10D3.
//  Preserves 1 significant fraction digit, so adjacent ticks never collapse to a
//  duplicate (monotonic \u2014 FF-AXIS-MONOTONIC) and the axis agrees in MAGNITUDE with
//  the honest table value. This REPLACES the lossy `fmtNum(val/1000,0)+' 000'` axis
//  hack that rounded 88 425.6 \u2192 "88 000" and collapsed 1500 & 2000 both \u2192 "2 000".
//  Falls back to a deterministic manual abbreviation if Intl compact is unavailable.
export function compact(n: number, locale = 'en'): string {
  try {
    return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n)
  } catch {
    const abs = Math.abs(n)
    const [div, suf] = abs >= 1e9 ? [1e9, 'B'] : abs >= 1e6 ? [1e6, 'M'] : abs >= 1e3 ? [1e3, 'K'] : [1, '']
    return fmtNum(n / div, 1) + suf
  }
}

// ── Formatter Registry ────────────────────────────────────────────────
//
//  JSON-serializable names → runtime functions.
//  EncodingSpec.seriesFormat references these by name.
//
export const FORMATTERS: Record<string, (n: number) => string> = {
  mln_gel:  fmtMlnGel,
  sign_pct: fmtSign,
  pct:      fmtPct,
  usd:      fmtUSD,
  number:   (n) => String(n),
  decimal1: (n) => fmtNum(n, 1),
  decimal2: (n) => fmtNum(n, 2),
  // Schema-browsable / JSON-referenceable compact (Constructor-ready): a table
  // column can request `format:"compact"`. Registry entries are (n)=>string, so
  // this binds the app-default locale; the axis seam calls compact(val, locale)
  // directly for the active locale (see plugins yFormatter).
  compact:  (n) => compact(n),
  default:  (n) => fmtNum(n, 0),
}

export function getFormatter(name: string): (n: number) => string {
  return FORMATTERS[name] ?? FORMATTERS['default']
}

// No trailing zeros, max `max` decimals, space thousands separator
export const fmtNum = (n: number, max = 1): string => {
  const abs = Math.abs(n), neg = n < 0 ? '-' : ''
  const s = abs.toFixed(max).replace(/\.?0+$/, '')
  const [i, d] = s.split('.')
  return neg + i.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0') + (d ? '.' + d : '')
}
const fmtMlnGel = (n: number) => fmtNum(n, 0)
const fmtSign   = (n: number) => `${n > 0 ? '+' : ''}${fmtNum(Math.abs(n), 1)}%`
const fmtPct    = (n: number) => `${fmtNum(Math.abs(n), 1)}%`
const fmtUSD    = (n: number) => `$\u00A0${fmtMlnGel(n)}`

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
  default:  (n) => fmtNum(n, 0),
}

export function getFormatter(name: string): (n: number) => string {
  return FORMATTERS[name] ?? FORMATTERS['default']
}

// ── Linear scale + nice ticks — Grammar-of-Graphics value scale ─────────
//
//  Law 4 (adopt standards whole): the value axis is a continuous linear scale
//  with a "nice" tick sequence — the same primitive Vega-Lite / d3-scale / the
//  ApexCharts `forceNiceScale` the live renderer relies on all implement. The
//  emitter cannot import ApexCharts (arrow + no-DOM), so it reuses the STANDARD
//  nice-number algorithm (Heckbert, "Graphics Gems") rather than inventing a
//  parallel geometry. Tick *positions* are therefore a faithful nice-scale of
//  the same domain — not guaranteed pixel-identical to Apex's internal count,
//  but structurally the same family (zero-baseline honoured, monotonic, spans
//  the data). The fitness test asserts that structure, not Apex byte-parity.
//

/** Round a number to a "nice" value (1/2/5/10 × 10^k). */
function niceNum(range: number, round: boolean): number {
  if (range === 0 || !Number.isFinite(range)) return 1
  const exp  = Math.floor(Math.log10(range))
  const frac = range / Math.pow(10, exp)
  let nice: number
  if (round) {
    if (frac < 1.5) nice = 1
    else if (frac < 3) nice = 2
    else if (frac < 7) nice = 5
    else nice = 10
  } else {
    if (frac <= 1) nice = 1
    else if (frac <= 2) nice = 2
    else if (frac <= 5) nice = 5
    else nice = 10
  }
  return nice * Math.pow(10, exp)
}

export interface NiceScale {
  /** Nice domain lower bound (≤ data min). */
  readonly niceMin: number
  /** Nice domain upper bound (≥ data max). */
  readonly niceMax: number
  /** Tick spacing. */
  readonly step: number
  /** Monotonic tick values from niceMin to niceMax inclusive. */
  readonly ticks: readonly number[]
}

/**
 * Nice linear scale over [min, max] with ~`maxTicks` divisions.
 *
 * `forceMin` / `forceMax` pin an authored axis bound (ChartOutput axes.y.min /
 * .max) EXACTLY — an authored bound is deliberate and must not be rounded away
 * (mirrors the live axis honouring `axes.y.min/max`). A degenerate domain
 * (all-zero / single value) still yields a valid two-tick scale so the axis
 * never collapses.
 */
export function niceScale(
  min: number,
  max: number,
  maxTicks = 5,
  forceMin?: number,
  forceMax?: number,
): NiceScale {
  let lo = Number.isFinite(min) ? min : 0
  let hi = Number.isFinite(max) ? max : 0
  if (lo === hi) { hi = lo + 1 }            // degenerate → unit span
  if (lo > hi) { const t = lo; lo = hi; hi = t }

  const range = niceNum(hi - lo, false)
  const step  = niceNum(range / Math.max(1, maxTicks - 1), true)
  let niceMin = Math.floor(lo / step) * step
  let niceMax = Math.ceil(hi / step) * step

  if (forceMin !== undefined && Number.isFinite(forceMin)) niceMin = forceMin
  if (forceMax !== undefined && Number.isFinite(forceMax)) niceMax = forceMax

  const ticks: number[] = []
  // Guard against a zero/negative step producing an infinite loop.
  const s = step > 0 ? step : (niceMax - niceMin) || 1
  for (let v = niceMin; v <= niceMax + s * 1e-9; v += s) {
    // Normalise -0 and floating tail (…9999999) to the intended value.
    ticks.push(Number(v.toFixed(10)))
    if (ticks.length > 1000) break          // hard safety cap
  }
  if (ticks[ticks.length - 1] !== niceMax) ticks.push(niceMax)

  return { niceMin, niceMax, step: s, ticks }
}

/** Map a value in [domainMin, domainMax] to a pixel in [rangeA, rangeB]. */
export function linear(
  value: number,
  domainMin: number,
  domainMax: number,
  rangeA: number,
  rangeB: number,
): number {
  const span = domainMax - domainMin
  if (span === 0) return rangeA
  const t = (value - domainMin) / span
  return rangeA + t * (rangeB - rangeA)
}

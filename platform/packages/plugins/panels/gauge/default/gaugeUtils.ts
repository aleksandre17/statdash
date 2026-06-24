/**
 * Convert a raw value to a percentage within [min, max], clamped to [0, 100].
 * Returns 0 when range is zero (degenerate case).
 */
export function toGaugePct(raw: number, min: number, max: number): number {
  const range = max - min
  if (range === 0) return 0
  return Math.round(Math.max(0, Math.min(1, (raw - min) / range)) * 100)
}

// ── Gauge geometry — the radial-bar dial dimensions, named once ───────────
//  A 270° arc (the classic speedometer sweep): the dial opens at -135° and
//  closes at +135°, leaving the bottom 90° as the gap. HOLLOW_SIZE is the
//  inner-circle radius (the empty centre that holds the value label).
const GAUGE_START_ANGLE  = -135
const GAUGE_END_ANGLE    =  135
const GAUGE_HOLLOW_SIZE  = '65%'
/** The value-label type style inside the dial centre. */
const GAUGE_VALUE_FONT_SIZE   = '28px'
const GAUGE_VALUE_FONT_WEIGHT = 700

/** Pixel height of the rendered gauge chart. */
export const GAUGE_HEIGHT = 220

/**
 * Build the ApexCharts radialBar options for a gauge. Pure — the displayed
 * value (`raw`), fill colour and whether the value label shows are the only
 * inputs; all dial geometry is named above.
 */
export function gaugeApexOptions(
  raw:       number,
  color:     string | undefined,
  showValue: boolean,
): ApexCharts.ApexOptions {
  return {
    chart: {
      type:      'radialBar',
      sparkline: { enabled: true },
      animations: { enabled: false },
    },
    plotOptions: {
      radialBar: {
        startAngle: GAUGE_START_ANGLE,
        endAngle:   GAUGE_END_ANGLE,
        hollow:     { size: GAUGE_HOLLOW_SIZE },
        track:      { background: 'var(--color-border)' },
        dataLabels: {
          name:  { show: false },
          value: {
            show:       showValue,
            fontSize:   GAUGE_VALUE_FONT_SIZE,
            fontWeight: GAUGE_VALUE_FONT_WEIGHT,
            formatter:  () => String(raw),
          },
        },
      },
    },
    fill:   { colors: [color ?? 'var(--color-accent)'] },
    stroke: { lineCap: 'round' },
  }
}

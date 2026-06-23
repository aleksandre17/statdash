// ── FieldConfig utility functions ─────────────────────────────────────

import type { FieldConfig, Threshold } from './config'

/**
 * Format a numeric value using FieldConfig display settings.
 * Returns a string ready for display (tooltip, data label, export).
 */
export function formatFieldValue(value: number, config?: FieldConfig): string {
  if (!value && value !== 0 && config?.noValue) return config.noValue
  const max = config?.decimals ?? 1
  const abs = Math.abs(value), neg = value < 0 ? '-' : ''
  const s = abs.toFixed(max).replace(/\.?0+$/, '')
  const [i, d] = s.split('.')
  const formatted = neg + i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (d ? '.' + d : '')
  const unit = config?.unit
  return unit ? `${formatted} ${unit}` : formatted
}

/**
 * Resolve the color for a value given a threshold array.
 * Thresholds evaluated ascending; highest exceeded threshold wins.
 * Returns undefined when colorMode !== 'thresholds'.
 */
export function resolveThresholdColor(
  value:      number,
  thresholds: Threshold[],
): string | undefined {
  if (!thresholds.length) return undefined
  const base    = thresholds.find(t => t.value === null)
  const stepped = [...thresholds]
    .filter(t => t.value !== null)
    .sort((a, b) => (a.value as number) - (b.value as number))

  let color = base?.color
  for (const t of stepped) {
    if (value >= (t.value as number)) color = t.color
  }
  return color
}

/**
 * Resolve FieldConfig for a given series name, applying overrides.
 * Returns the base config with any matching override merged in.
 */
export function resolveFieldConfig(
  base:       FieldConfig | undefined,
  seriesName: string,
): FieldConfig | undefined {
  if (!base) return undefined
  const override = base.overrides?.find(o => o.match === seriesName)
  if (!override) return base
  return { ...base, ...override.config }
}
/**
 * Convert a raw value to a percentage within [min, max], clamped to [0, 100].
 * Returns 0 when range is zero (degenerate case).
 */
export function toGaugePct(raw: number, min: number, max: number): number {
  const range = max - min
  if (range === 0) return 0
  return Math.round(Math.max(0, Math.min(1, (raw - min) / range)) * 100)
}

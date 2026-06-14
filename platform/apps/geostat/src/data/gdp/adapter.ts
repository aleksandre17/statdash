import type { Observation } from '@geostat/engine'
import type { GDPFact }     from './raw'

// ── Boundary: GDPFact[] → Observation[] ──────────────────────────────
//
//  GDP facts are flat { time, measure, value, obsStatus }.
//  Typed identity — display fields (label, color) live in GDP_DISPLAY, not observations.
//  Production swap: replace GDP_FACTS with API response → zero other file changes.

export function fromGDPFacts(facts: readonly GDPFact[]): Observation[] {
  return facts as unknown as Observation[]
}
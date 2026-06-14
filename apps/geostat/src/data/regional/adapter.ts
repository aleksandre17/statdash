import type { Observation }  from '@geostat/engine'
import type { RegionalFact } from './raw'

// ── Boundary: RegionalFact[] → Observation[] ──────────────────────────
//
//  Regional facts are already flat { time, geo, sector, measure, value }
//  with surrogate ids for geo/sector. The adapter is a typed identity —
//  its only job is to give the engine a typed Observation[] at the port.
//
//  Swap dataset shape? Only this file changes.

export function fromRegionalFacts(facts: readonly RegionalFact[]): Observation[] {
  return facts as unknown as Observation[]
}
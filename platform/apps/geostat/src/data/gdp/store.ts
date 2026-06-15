import { ExternalStore }                            from '@geostat/engine'
import { fromGDPFacts }                             from './adapter'
import { GDP_FACTS, GDP_CLASSIFIERS, GDP_DISPLAY }  from './raw'

// DataBundle pattern (same contract as every dataset module):
//   facts        — structural Observation[] (time, measure, approach, value, status)
//   classifiers  — code-keyed codelists; engine uses for code↔id translation + rollup
//   display      — UI overlay (label, color); merged at { $d: 'dim' } ref resolution
//
// GDP has no hierarchy (no rollups); classifiers drive filter selectors and
// display lookup in pipe transforms. Key === code (no surrogate IDs needed).
export const gdpStore = new ExternalStore(
  fromGDPFacts(GDP_FACTS),
  { classifiers: GDP_CLASSIFIERS, display: GDP_DISPLAY },
)

// Convenience re-exports for configs that need classifier access at module load.
// New year in GDP_DATA → GDP_CLASSIFIERS.time updates automatically.
export { GDP_CLASSIFIERS, GDP_DISPLAY } from './raw'
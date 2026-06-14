import { ExternalStore }                                          from '@geostat/engine'
import { fromRegionalFacts }                                       from './adapter'
import { REGIONAL_CLASSIFIERS, REGIONAL_DISPLAY, REGIONAL_FACTS }  from './raw'

// DataBundle pattern (universal contract for every dataset):
//   facts        — Observation[] with surrogate ids on classifier-backed dims
//   classifiers  — STRUCTURAL only: code, parent edges; engine internals consume
//   display      — UI overlay; merged onto classifier entries by
//                  resolveClassifierRef() at `{ $cl }` refs (engine ignores it)
//
// Splitting these lets display swap per locale / theme / branding without
// touching the structural codelist that the engine matches against.
export const regionalStore = new ExternalStore(
  fromRegionalFacts(REGIONAL_FACTS),
  {
    classifiers: REGIONAL_CLASSIFIERS,
    display:     REGIONAL_DISPLAY,
  },
)

// Convenience re-exports for configs that need module-load access to dim data.
export { REGIONAL_CLASSIFIERS, REGIONAL_DISPLAY } from './raw'
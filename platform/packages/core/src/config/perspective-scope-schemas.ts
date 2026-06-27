// ── PerspectiveScope authoring catalog [VISION #3 / P0] ───────────────────────
//
//  The built-in authoring PropSchemas for the two perspective-scope keys registered
//  TODAY — `timeBinding` and `metric` (the real effects time-mode needs). The SAME
//  registry/catalog split the rest of the Constructor uses: perspective-scope-registry.ts
//  is pure logic; THIS file is the i18n authoring catalog (bilingual { ka, en } PropField
//  labels the generic Inspector renders), allowlisted exactly like param-schemas.ts /
//  visibility-schemas.ts / rowspec-schemas.ts in the no-tenant-content gate.
//
//  Registered as a side-effect at module load (the core index imports this file). A
//  NEW scope door (store/dims/blend/facet) is a new registerPerspectiveScopeKey() call
//  HERE + an optional field on the core PerspectiveScope type — the interpreter, the
//  pane, and the coverage gate are unchanged (OCP, Law 8, SYNTHESIS §1.4).

import { registerPerspectiveScopeKey } from './perspective-scope-registry'

registerPerspectiveScopeKey('timeBinding', [
  // The time dimension the binding scopes — a cube-profile dimension (pick-don't-type, Law 2).
  { field: 'timeBinding.dim',            type: 'enum-ref', source: 'cube.dimensions', label: { ka: 'დროის განზომილება', en: 'Time dimension' } },
  // Single-period PIN (year perspective) — a $ctx ref or literal year (P4.5 (a)).
  { field: 'timeBinding.pin',            type: 'string',   label: { ka: 'წელი (პინი)', en: 'Pin (year)' } },
  // Window DESTINATION keys (range perspective) — the dim keys the window writes (P4.5 (b)).
  { field: 'timeBinding.targetKeys.from', type: 'string',  label: { ka: 'დან-გასაღები', en: 'Target key (from)' } },
  { field: 'timeBinding.targetKeys.to',   type: 'string',  label: { ka: 'მდე-გასაღები', en: 'Target key (to)' } },
])

registerPerspectiveScopeKey('metric', [
  // A perspective-wide measurement swap — a MetricDef ref (pick-don't-type from the semantic layer, R1).
  { field: 'metric', type: 'enum-ref', source: 'cube.measures', label: { ka: 'მეტრიკა', en: 'Metric' } },
])

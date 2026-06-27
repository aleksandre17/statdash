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
  { field: 'timeBinding.dim',  type: 'enum-ref', source: 'cube.dimensions', label: { ka: 'დროის განზომილება', en: 'Time dimension' } },
  // Single-period pin (year perspective) — a $ctx ref or literal year.
  { field: 'timeBinding.pick', type: 'string',   label: { ka: 'წელი', en: 'Pick (year)' } },
  // Window bounds (range perspective) — $ctx refs or literal years.
  { field: 'timeBinding.from', type: 'string',   label: { ka: 'დან', en: 'From' } },
  { field: 'timeBinding.to',   type: 'string',   label: { ka: 'მდე', en: 'To' } },
])

registerPerspectiveScopeKey('metric', [
  // A perspective-wide measurement swap — a MetricDef ref (pick-don't-type from the semantic layer, R1).
  { field: 'metric', type: 'enum-ref', source: 'cube.measures', label: { ka: 'მეტრიკა', en: 'Metric' } },
])

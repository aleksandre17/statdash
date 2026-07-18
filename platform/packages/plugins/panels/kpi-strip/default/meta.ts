import type { PanelSliceMeta } from '@statdash/react/engine'
import { KpiStripSchema, KpiStripGroups } from './KpiStripNode'

export const META: PanelSliceMeta = {
  sliceType:       'panel',
  type:            'kpi-strip',
  variant:         'default',
  label:           { ka: 'KPI სტრიპი', en: 'KPI Strip' },
  icon:            'trending-up',
  category:        'data',
  schema:          KpiStripSchema,
  groups:          KpiStripGroups,
  canHaveChildren: false,
  // `flow` (placement capability): a kpi-strip is flow content, admissible in a section.
  // STYLE + VISIBILITY are UNIVERSAL facets (every renderable node — no cap needed).
  // `interactive`: opt into the universal EVENTS facet — a kpi tile emits point:click
  // gestures the `on[]`/NodeAction spine folds (element.facet.events over `on`).
  //
  // NOT `data-bindable` (WORK-0083 root-fix — was a copy-paste artefact from chart/
  // table/geograph's meta.ts). A kpi-strip has NO `data: DataSpec` field in its own
  // contract (KpiStripSchema = `items: KpiSpec[]` only) and its shell never reads
  // `ctx.rows` (KpiStripShell.tsx: "does NOT consume ctx.rows / useNodeRows — it
  // reads the store through interpretKpis, an entirely separate read surface").
  // Declaring `data-bindable` anyway mounted the generic Inspector Data facet
  // (DataFacetField/MetricPalette) for a kpi-strip selection, and binding a metric
  // there wrote a STRAY `node.data` the shell never renders — but `effectiveStoreKey`
  // (renderNode.ts) DOES generically walk any node's `.data` for its metric's
  // `dataSource` and overrides `ctx.pageStoreKey` for the WHOLE node. A stray bind
  // of a different-dataSource metric (e.g. a 'gdp' metric onto the regional page's
  // kpi-strip) silently rerouted EVERY sibling KPI item (still carrying their own
  // correct raw codes) through the WRONG store → 0 rows → honest "no observation for
  // this coordinate" on every card (WORK-0083's "wrong coordinate"). The kpi-strip's
  // REAL, correct per-item bind surface already exists: each item's OWN governed
  // `value.measure` (KpiValueItemSchema, `type:'enum-ref', source:'metrics'`),
  // authored through the per-item Inspector drill (ADR-041 value-band Part grammar)
  // — never a node-level `data` facet.
  caps:            ['filterable', 'flow', 'interactive'],
  version:         1,
  i18n: {
    ka: {
      'trend-up': 'მზარდი:', 'trend-down': 'კლებადი:', 'trend-flat': 'სტაბილური:',
      'methodology': 'მეთოდოლოგია',
      // Honest UNBOUND state (Canon C2) — never a fake 0; an affordance to bind (J4).
      'unbound-title': 'აუბმელი მაჩვენებელი',
      'unbound-hint':  'აირჩიე მეტრიკა',
      // Honest INTERPRET-DERIVED states (AR-52 · Law 11) — never a fabricated 0.
      // no-data: the spec IS bound but the store has no observation at the coordinate.
      'no-data-title': 'მონაცემი არ არის',
      'no-data-hint':  'ამ კოორდინატისთვის დაკვირვება არ მოიძებნა',
      // masked: SDMX OBS_STATUS 'c' — confidential, the value must NOT be published.
      'masked-title':  'კონფიდენციალური',
      'masked-hint':   'მნიშვნელობა დაფარულია',
      // transient-retrying (ADR-048): a 429/503 in backoff — auto-recovering, never a fake 0.
      'retrying-title': 'მონაცემი იტვირთება…',
      'retrying-hint':  'დროებითი შეფერხება — ხელახლა ვცდით',
    },
    en: {
      'trend-up': 'Up:', 'trend-down': 'Down:', 'trend-flat': 'Flat:',
      'methodology': 'Methodology',
      'unbound-title': 'Unbound metric',
      'unbound-hint':  'Choose a metric',
      'no-data-title': 'No data',
      'no-data-hint':  'No observation for this coordinate',
      'masked-title':  'Confidential',
      'masked-hint':   'Value withheld',
      'retrying-title': 'Retrying…',
      'retrying-hint':  'Temporary delay — retrying',
    },
  },
}

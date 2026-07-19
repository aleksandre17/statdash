// ── canvasPresets — the shell-side curated starter presets (ADR-049 P2b · ADR-050 R2) ─
//
//  The CONTENT half of the composed-preset split. `PresetRegistry` (packages/react) is
//  the app-AGNOSTIC mechanism; THIS file is the shell's curated declarations — real,
//  statistics-native starting objects that carry domain metric ids. Domain codes are
//  allowed here (apps/panel is above the dependency arrow), exactly as the geostat runner
//  registers domain slices at boot. Each preset is PURE CONFIG (Law 2 — no functions): a
//  `NodeSeed` composing an EXISTING registered node type with sensible props, a bound
//  DataSpec, and pre-wired trend/visibility — so a dropped preset lands bound + pre-wired
//  (the P1 DataSpec + P2a trend/visibility capabilities reachable by tweak, not escalation).
//
//  Adding a preset is ONE declaration here (+ nothing else) — the palette projects it and
//  the insert path expands it with zero per-type code (OCP · FF-PRESET-NO-SPECIAL-CASE).
//
import { registerPreset } from '@statdash/react/engine'
import type { PresetDecl } from '@statdash/react/engine'

/**
 * The starter set. Small on purpose (3 is enough to prove the capability). Each pre-wires
 * a distinct capability so the primitive is exercised end-to-end:
 *   • kpi — a per-item GOVERNED metric bind (kpi-strip's real bind surface: items[].value
 *           .measure — NOT a node.data bind, which a kpi-strip does not read; WORK-0083)
 *           PLUS a pre-wired `trend` (P2a Lane 3) on the item.
 *   • chart — a node-level bound DataSpec (P1 `query`) + a pre-wired `view.visibleWhen`
 *           (P2a) — merged OVER the chart's birth defaults (`getDefaults('chart')` →
 *           chartType + view.role) so the pre-wired visibility composes without clobbering
 *           the mark/role the chart needs to render.
 *   • section→chart — a composed SUBTREE (a section wrapping a bound chart) — proves the
 *           recursive seed build + the shared placement resolver land a whole with bound data.
 *           The child chart is a MINIMAL seed (`{type:'chart', data}`, NO restated view/mark):
 *           `getDefaults('chart')` supplies chartType + view.role, so the whole renders.
 */
export const STARTER_PRESETS: PresetDecl[] = [
  {
    id:       'preset-kpi-metric',
    label:    { ka: 'მაჩვენებელი (მეტრიკა)', en: 'Key indicator (metric)' },
    description: { ka: 'აკინძული მაჩვენებელი ტრენდით', en: 'A bound KPI with a trend' },
    icon:     'trending-up',
    caps:     ['flow'],
    seed: {
      type: 'kpi-strip',
      props: {
        items: [
          {
            label: { ka: 'მშპ', en: 'GDP' },
            value: { measure: 'gdp.current', type: 'point' },
            trend: { type: 'yoy' },
          },
        ],
      },
    },
  },
  {
    id:       'preset-chart-timeseries',
    label:    { ka: 'დროითი მწკრივი', en: 'Time series' },
    description: { ka: 'აკინძული query დიაგრამა', en: 'A query-bound chart' },
    icon:     'bar-chart',
    caps:     ['flow', 'data-bindable'],
    seed: {
      type: 'chart',
      data: { type: 'query', query: { measure: 'gdp.current' }, encoding: { label: 'time', value: 'value' } },
      view: { visibleWhen: { op: 'perspective-is', perspective: 'range' } },
    },
  },
  {
    id:       'preset-section-chart',
    label:    { ka: 'სექცია დიაგრამით', en: 'Section with chart' },
    description: { ka: 'სექცია აკინძული დიაგრამით', en: 'A section wrapping a bound chart' },
    icon:     'layout',
    caps:     ['flow'],
    seed: {
      type: 'section',
      props: { title: { ka: 'მიმოხილვა', en: 'Overview' } },
      children: [
        {
          type: 'chart',
          data: { type: 'query', query: { measure: 'gdp.current' }, encoding: { label: 'time', value: 'value' } },
        },
      ],
    },
  },
]

/** Register the curated starter presets (the shell boot idiom — mirrors registerSlice). */
export function registerCanvasPresets(): void {
  for (const preset of STARTER_PRESETS) registerPreset(preset)
}

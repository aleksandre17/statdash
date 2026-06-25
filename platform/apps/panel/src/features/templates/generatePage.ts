// ── generatePage — data-first "generate a dashboard" (V7, Budibase pattern) ──
//
//  Connect a cube → one click → a real, POPULATED starter page the author then
//  refines (ADR V7 "never start blank", data-first). PURE: a CubeProfile in, a
//  valid NodePageConfig out — no store, no fetch, no side effects.
//
//  REUSE, no new suggestion logic (the V7 invariant):
//    suggestPanels(profile)        the EXISTING role→panel recommender (V5/C3)
//    buildSuggestedSpec(s, profile) the EXISTING populated-DataSpec builder (V5)
//  This module only ASSEMBLES those reused pieces into a page tree: it wraps each
//  suggested panel (with its bound DataSpec) in a titled section and stacks the
//  sections under a header. It invents NO recommendation and NO data binding.
//
//  Law 2 (pick-don't-type): every code in the produced page rides in through
//  buildSuggestedSpec, whose codes come from the PROFILE — never typed here.
//
//  Every generated panel is a `chart` (its only required field, chartType, is
//  always supplied by the placement below). suggestPanels recommends richer
//  visuals (map/tree/kpi-strip) too, but those carry required fields a generator
//  can't fill from a profile alone (geoJsonUrl, a non-empty KPI items array);
//  rendering each suggestion as a data-bound chart keeps the generated page
//  VALID (save-guard-passing) while preserving the recommendation's intent
//  (line for a time axis, bar for a categorical compare). The author swaps in a
//  map/KPI once the extra inputs exist — the generated page is the starting
//  point, not the finished artefact.
//
//  The output IS a valid NodePageConfig (same tree the adapter round-trips and
//  validateConfig accepts) — generation produces a config a human could also have
//  built, not a new dialect (the V7 additive invariant the fitness test asserts).
//
import type { NodePageConfig } from '@statdash/react/engine'
import type { CubeProfile } from '../../lib/cubeApi'
import { suggestPanels, type PanelSuggestion } from '../../discovery/suggestPanels'
import { buildSuggestedSpec } from '../data-layer/showme/buildSuggestedSpec'

// ── Suggestion panelType → chart variant (the one translation SSOT) ───────────
//
//  suggestPanels speaks in DATA-SHAPE recommendations (timeseries/bar/tree/…);
//  the generated panel is always a registry `chart`, so this maps the
//  recommendation to the chart's discriminating `chartType`. A time axis → a
//  line; everything else → a bar (the safe categorical default). A new
//  suggestion kind needs no change unless it warrants a different chartType
//  (OCP — add one row). Kept beside the generator (its only consumer); promote
//  to discovery/ if a second caller appears (YAGNI).
//
const CHART_TYPE_BY_SUGGESTION: Record<string, string> = {
  timeseries: 'line',
}
const DEFAULT_CHART_TYPE = 'bar'

function chartTypeFor(panelType: string): string {
  return CHART_TYPE_BY_SUGGESTION[panelType] ?? DEFAULT_CHART_TYPE
}

/** One generated node (section or panel) — a structural NodeDef the engine reads. */
interface GeneratedNode {
  type:      string
  id:        string
  title?:    string
  chartType?: string
  data?:     unknown
  children?: GeneratedNode[]
}

// Generic placeholder section title (the author renames) — never domain data.
const SECTION_TITLE = 'სექცია'   // "Section"

/**
 * Assemble a populated NodePageConfig from a cube profile.
 *
 * Pipeline (pure, deterministic): suggestPanels(profile) → for each suggestion,
 * buildSuggestedSpec binds a DataSpec (measure + encoding from the profile) and
 * the panel is rendered as a data-bound chart wrapped in a titled section. The
 * sections stack under a single page-header. Suggestions whose builder yields no
 * bindable spec (no measure) are skipped — the generated page only contains
 * panels that actually carry data.
 *
 * Returns null when no suggestion yields a populated panel (no measure at all):
 * there is nothing to generate, so the caller falls back to a starter/blank page
 * (an accelerator, never the only path).
 *
 * Ids are deterministic (`gen-<i>` / `gen-<i>-panel`) so the generated page is
 * stable + round-trips losslessly. `id`/`path` are placeholders the caller
 * overwrites with the new page's identity (mirrors the starter templates).
 */
export function generatePageFromProfile(profile: CubeProfile): NodePageConfig | null {
  const suggestions = suggestPanels(profile)

  const sections: GeneratedNode[] = []
  suggestions.forEach((s: PanelSuggestion, i: number) => {
    const spec = buildSuggestedSpec(s, profile)
    if (!spec) return                                  // no bindable measure → skip
    sections.push({
      type:     'section',
      id:       `gen-${i}`,
      title:    SECTION_TITLE,
      children: [
        {
          type:      'chart',
          id:        `gen-${i}-panel`,
          chartType: chartTypeFor(s.panelType),
          data:      spec,
        },
      ],
    })
  })

  if (sections.length === 0) return null

  return {
    type:          'inner-page',
    id:            'generated',
    path:          'generated',
    schemaVersion: 1,
    children: [
      { type: 'page-header', id: 'hdr', title: 'ახალი გვერდი' },
      ...sections,
    ],
  } as unknown as NodePageConfig
}

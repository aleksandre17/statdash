// ── starterTemplates — committed, valid NodePageConfig starters (V7) ─────────
//
//  "Never start blank" (ADR V7, Wix/Gutenberg templates-first): instead of an
//  empty canvas, the author picks a pre-built page. EACH starter IS a valid
//  `NodePageConfig` — the SAME engine tree the adapter round-trips and the SAME
//  shape the C5 save-guard (validate + round-trip + per-node-valid) accepts. A
//  template is not a new dialect; it is a page someone could have built by hand,
//  committed as a fixture.
//
//  Structure-first (no fabricated indicator codes): a starter lays out the page
//  ANATOMY (header → filter bar → sections [chart ↔ table] → methodology) with
//  panels that carry NO `data`. The author binds data afterwards through Show-Me
//  / field-wells (where codes come from the cube profile, Law 2) — so a committed
//  template never smuggles a magic indicator code. A panel with no `data` is
//  structurally valid (validateConfig only checks `data` when present).
//
//  REQUIRED fields ARE filled (the save-guard's per-node check enforces them):
//  every page-header / section carries a placeholder `title`, every chart a
//  `chartType`. These are generic, refine-me placeholders — not domain data.
//
//  Node types used are all REGISTERED slices with fillable required fields
//  (page-header, filter-bar, section, chart, table). Heavyweight nodes whose
//  required fields can't be sensibly placeholdered (map/geograph: geoJsonUrl,
//  geoCodeMap; kpi-strip: a non-empty items array) are deliberately NOT used in
//  a blank starter — the author adds them once data is bound.
//
//  Ids are STABLE (authored, not random) so a starter round-trips deterministically
//  (the fitness test asserts fromNodePageConfig(toNodePageConfig(x)) ≡ x).
//
import type { NodePageConfig } from '@statdash/react/engine'

/** A pickable starter: identity + preview metadata + the page config it loads. */
export interface StarterTemplate {
  /** Stable template id (the gallery key + the analytics/selection token). */
  id:          string
  /** Display name (always bilingual — Law 4). */
  name:        { ka: string; en: string }
  /** One-line description of what the author gets. */
  description: { ka: string; en: string }
  /** Icon token (MUI icon name the gallery maps to a component). */
  icon:        string
  /**
   * The starter page — a valid NodePageConfig. `id`/`path` are PLACEHOLDERS:
   * the gallery overwrites them with the new page's identity at pick time (the
   * author names the page), so two pages from the same starter never collide.
   */
  config:      NodePageConfig
}

// Placeholder identity every starter carries; the gallery rewrites it on pick.
const TPL_ID = 'starter'
const TPL_PATH = 'starter'

// Generic, refine-me placeholder titles (NOT domain data — the author renames).
const HEADER_TITLE  = 'ახალი გვერდი'   // "New page"
const SECTION_TITLE = 'სექცია'         // "Section"

// ── 1. Single chart ──────────────────────────────────────────────────────────
//  The smallest meaningful page: a header + one section holding a single chart.
//  The "headline metric" starting point (an author refining one indicator).
const singleChart: NodePageConfig = {
  type:          'inner-page',
  id:            TPL_ID,
  path:          TPL_PATH,
  schemaVersion: 1,
  children: [
    { type: 'page-header', id: 'hdr', title: HEADER_TITLE },
    {
      type:     'section',
      id:       'sec',
      title:    SECTION_TITLE,
      children: [
        { type: 'chart', id: 'sec-chart', chartType: 'line' },
      ],
    },
  ],
} as unknown as NodePageConfig

// ── 2. Chart + Table section ─────────────────────────────────────────────────
//  One section holding a chart with its table twin — the Eurostat "chart ↔ table"
//  unit. The everyday "show one indicator two ways" page.
const chartTable: NodePageConfig = {
  type:          'inner-page',
  id:            TPL_ID,
  path:          TPL_PATH,
  schemaVersion: 1,
  children: [
    { type: 'page-header', id: 'hdr', title: HEADER_TITLE },
    {
      type:     'section',
      id:       'sec',
      title:    SECTION_TITLE,
      children: [
        { type: 'chart', id: 'sec-chart', chartType: 'bar' },
        { type: 'table', id: 'sec-table' },
      ],
    },
  ],
} as unknown as NodePageConfig

// ── 3. Full ONS-standard dashboard ───────────────────────────────────────────
//  The plugins-CLAUDE page anatomy in full:
//    PageHeader → FilterBar (sticky) → Sections [chart ↔ table]
//    → Methodology footer (the last section's methodology disclosure, Law 9)
//  The "proper statistical dashboard" the platform exists to produce. (KPI strip
//  is added by the author once measures are bound — its required `items` array
//  can't ship empty.)
const onsDashboard: NodePageConfig = {
  type:          'inner-page',
  id:            TPL_ID,
  path:          TPL_PATH,
  schemaVersion: 1,
  children: [
    { type: 'page-header', id: 'hdr', title: HEADER_TITLE },
    { type: 'filter-bar',  id: 'bar', position: 'sticky' },
    {
      type:     'section',
      id:       'sec-trend',
      title:    SECTION_TITLE,
      children: [
        { type: 'chart', id: 'trend-chart', chartType: 'line' },
        { type: 'table', id: 'trend-table' },
      ],
    },
    {
      type:        'section',
      id:          'sec-detail',
      title:       SECTION_TITLE,
      // Methodology disclosure (Law 9 — IMF/Eurostat/ONS data integrity): the
      // section shell renders the note/source/last-updated panel when authored.
      methodology: { note: '', source: '', lastUpdated: '' },
      children: [
        { type: 'chart', id: 'detail-chart', chartType: 'bar' },
      ],
    },
  ],
} as unknown as NodePageConfig

// ── The committed gallery (3 GOOD starters — YAGNI, not a huge catalog) ───────
export const STARTER_TEMPLATES: readonly StarterTemplate[] = [
  {
    id:          'single-chart',
    name:        { ka: 'ერთი გრაფიკი', en: 'Single chart' },
    description: { ka: 'სათაური და ერთი გრაფიკი — უმარტივესი გვერდი', en: 'Header + one chart — the simplest page' },
    icon:        'speed',
    config:      singleChart,
  },
  {
    id:          'chart-table',
    name:        { ka: 'გრაფიკი და ცხრილი', en: 'Chart + Table' },
    description: { ka: 'ერთი სექცია გრაფიკითა და ცხრილით', en: 'One section with a chart and its table' },
    icon:        'insert-chart',
    config:      chartTable,
  },
  {
    id:          'ons-dashboard',
    name:        { ka: 'სრული დაშბორდი (ONS)', en: 'Full dashboard (ONS)' },
    description: { ka: 'სათაური → ფილტრები → სექციები → მეთოდოლოგია', en: 'Header → filters → sections → methodology' },
    icon:        'dashboard',
    config:      onsDashboard,
  },
] as const

// ── pageStarters — starters as REGISTERED declarations (ADR-050 R3) ──────────
//
//  "Never start blank" (V7), but as DECLARATIONS, not a fixture. R3's structural
//  move — SKELETON = registered page-KIND × page-level PresetDecl — generalizes
//  ADR-049 P2b's `NodeSeed` to a PAGE ROOT: a page starter is a `PresetDecl` whose
//  `seed.type` is a registered `sliceType:'page'` kind (inner-page/…), carrying the
//  section scaffold as its `seed.children`. These land in the SAME app-agnostic
//  `presetRegistry` R2 introduced — ONE curated-whole home, discoverable by
//  capability, extensible by declaration. This file is the SHELL content half
//  (domain-free scaffold here; it carries no indicator codes — the author binds
//  data afterwards), registered at boot exactly as `registerCanvasPresets` /
//  `registerSlice` are (setupCanvasRegistry).
//
//  This REPLACES the hand-committed `starterTemplates.ts` fixture — the
//  fixture-outside-every-registry the disease named (FF-STARTERS-ARE-DECLARATIONS).
//  A page starter is distinguished from an element preset GENERICALLY: its
//  `seed.type` is a registered PAGE kind (`objectRegistry.has('page', …)`), never a
//  hardcoded id list — so a new page starter is ONE declaration, machinery unchanged.
//
//  Structure-first (Law 2 — pick-don't-type): a starter lays out the page ANATOMY
//  (header → filter bar → sections [chart ↔ table] → methodology) with panels that
//  carry NO `data`; a panel with no `data` is structurally valid. Generic, refine-me
//  placeholder titles + a chart `chartType` are the only required fields filled (the
//  save-guard's per-node check enforces them) — never domain data.
//
import { registerPreset, presetRegistry, objectRegistry } from '@statdash/react/engine'
import type { PresetDecl, NodeSeed, NodePageConfig } from '@statdash/react/engine'

// Generic, refine-me placeholder titles (NOT domain data — the author renames).
const HEADER_TITLE  = 'ახალი გვერდი'   // "New page"
const SECTION_TITLE = 'სექცია'         // "Section"

// ── seed → NodePageConfig — the page-root peer of buildSeedInserts ────────────
//
//  A page starter's `seed` is expanded into the engine page tree the create path
//  consumes (the SAME NodeSeed grammar element presets use — NOT a new dialect).
//  Node-body props spread FLAT at the top level (the NodePageConfig node shape the
//  adapter round-trips: `title`/`chartType`/`data` are top-level, folded to `props`
//  by fromNodePageConfig). Ids are deterministic in pre-order (`${id}-${i}`) so a
//  starter hydrates to a stable, addressable, losslessly round-tripping tree; the
//  placeholder root id/path are rewritten with the new page's identity at pick time
//  (loadTemplate.hydrateTemplate), so two pages from one starter never collide.
//
function seedToNode(seed: NodeSeed, id: string): Record<string, unknown> {
  const node: Record<string, unknown> = { type: seed.type, id }
  if (seed.variant) node.variant = seed.variant
  if (seed.props) Object.assign(node, seed.props)   // flat node-body props (page-config shape)
  if (seed.data !== undefined) node.data = seed.data
  if (seed.view !== undefined) node.view = seed.view
  if (seed.children && seed.children.length > 0) {
    node.children = seed.children.map((child, i) => seedToNode(child, `${id}-${i}`))
  }
  return node
}

/** Expand a page-root seed into the valid NodePageConfig the create path consumes. */
export function seedToPageConfig(seed: NodeSeed, id = 'starter', path = 'starter'): NodePageConfig {
  const root = seedToNode(seed, id)
  root.path = path
  root.schemaVersion = 1
  return root as unknown as NodePageConfig
}

// ── The curated page starters (3 GOOD ones — YAGNI, not a huge catalog) ───────
//
//  Each seed is an inner-page skeleton with a distinct section scaffold. The KIND
//  is declared on `seed.type` (a registered page kind) — the page-kind × preset
//  pairing R3 restores. A landing/tab starter is ONE more declaration here (its
//  own `seed.type`), needing no machinery change.
//
export const PAGE_STARTERS: PresetDecl[] = [
  {
    // The smallest meaningful page: a header + one section holding a single chart.
    id:          'single-chart',
    label:       { ka: 'ერთი გრაფიკი', en: 'Single chart' },
    description: { ka: 'სათაური და ერთი გრაფიკი — უმარტივესი გვერდი', en: 'Header + one chart — the simplest page' },
    icon:        'gauge',
    seed: {
      type: 'inner-page',
      children: [
        { type: 'page-header', props: { title: HEADER_TITLE } },
        { type: 'section', props: { title: SECTION_TITLE }, children: [
          { type: 'chart', props: { chartType: 'line' } },
        ] },
      ],
    },
  },
  {
    // One section holding a chart with its table twin — the Eurostat chart ↔ table unit.
    id:          'chart-table',
    label:       { ka: 'გრაფიკი და ცხრილი', en: 'Chart + Table' },
    description: { ka: 'ერთი სექცია გრაფიკითა და ცხრილით', en: 'One section with a chart and its table' },
    icon:        'bar-chart',
    seed: {
      type: 'inner-page',
      children: [
        { type: 'page-header', props: { title: HEADER_TITLE } },
        { type: 'section', props: { title: SECTION_TITLE }, children: [
          { type: 'chart', props: { chartType: 'bar' } },
          { type: 'table' },
        ] },
      ],
    },
  },
  {
    // The full ONS anatomy: header → sticky filter bar → sections [chart ↔ table]
    // → methodology footer (the last section's disclosure, Law 9).
    id:          'ons-dashboard',
    label:       { ka: 'სრული დაშბორდი (ONS)', en: 'Full dashboard (ONS)' },
    description: { ka: 'სათაური → ფილტრები → სექციები → მეთოდოლოგია', en: 'Header → filters → sections → methodology' },
    icon:        'layout-grid',
    seed: {
      type: 'inner-page',
      children: [
        { type: 'page-header', props: { title: HEADER_TITLE } },
        { type: 'filter-bar',  props: { position: 'sticky' } },
        { type: 'section', props: { title: SECTION_TITLE }, children: [
          { type: 'chart', props: { chartType: 'line' } },
          { type: 'table' },
        ] },
        { type: 'section', props: { title: SECTION_TITLE, methodology: { note: '', source: '', lastUpdated: '' } }, children: [
          { type: 'chart', props: { chartType: 'bar' } },
        ] },
      ],
    },
  },
]

/** Register the curated page starters into presetRegistry (the shell boot idiom). */
export function registerPageStarters(): void {
  for (const starter of PAGE_STARTERS) registerPreset(starter)
}

/**
 * The page starters currently registered — the create-page gallery's ONE source.
 * A page starter is a preset whose `seed.type` is a registered PAGE kind (the R3
 * skeleton pairing), read GENERICALLY from `objectRegistry` — never a hardcoded id
 * list. This is the symmetric complement of the palette's element-preset filter
 * (which excludes page-kind seeds), so ONE registry feeds both surfaces cleanly.
 */
export function pageStarterList(): PresetDecl[] {
  return presetRegistry.list().filter((p) => isPageStarter(p))
}

/** Is this preset a PAGE starter (its seed roots a registered page kind)? Generic. */
export function isPageStarter(preset: PresetDecl): boolean {
  return objectRegistry.has('page', preset.seed.type, preset.seed.variant ?? 'default')
}

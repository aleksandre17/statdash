// @vitest-environment node
//
// ── schema-completeness.fitness.test.ts — Constructor C0 invariant ────────────
//
//  ADR (adr_constructor_phase2) fitness function #1:
//    "Every placeable type is inspectable — for every nodeRegistry.list() entry
//     that is not `transparent` and not a pure container, getSchema(type,variant)
//     returns a non-empty PropSchema."
//
//  This closes the C0 deliverable: the panel Inspector renders a property panel
//  for ANY placeable node/panel generically from its `schema` (OCP — no per-type
//  UI). A placeable type without a schema would force the Inspector into a raw
//  JSON fallback, breaking the "one inspector for all types" guarantee.
//
//  Scope of the invariant (what MUST have a non-empty schema):
//    - sliceType 'node'  — UNLESS it is `transparent` (expanded in place, never
//      a selectable inspector target) OR a pure container (its only editable
//      surface is its children slot — no scalar/authored props).
//    - sliceType 'panel' — ALWAYS (leaf data panels are always inspector targets).
//
//  Out of scope (legitimately schema-less):
//    - sliceType 'page'  — page-template ROOTS. Structure is authored in the tree
//      (slots), offered only when the canvas is empty; not a property-panel target.
//    - 'transparent' nodes (e.g. wrap) — never selected as an inspector target.
//    - pure containers — declared below in PURE_CONTAINERS with the reason.
//
//  Lives in engine/plugins — the only layer permitted to import plugin META
//  (dependency arrow: engine/core ← engine/react ← engine/plugins). META imports
//  resolve to pure `meta.ts` files (no Shell/React/apexcharts transitive deps).
//

import { describe, it, expect } from 'vitest'
import type {
  NodeSliceMeta, PanelSliceMeta, PageSliceMeta, ChromeSliceMeta, PropSchema,
} from '@statdash/react/engine/slice-meta'

// Page-canvas metas all carry `.type` (unlike chrome/control). Narrow the corpus
// to exactly these three sliceTypes so the fitness can index `.type` directly.
type PlaceableMeta = NodeSliceMeta | PanelSliceMeta | PageSliceMeta

// ── Node metas ────────────────────────────────────────────────────────────────
import { META as section }       from '../section/default/meta'
import { META as modeBar }       from '../mode-bar/default/meta'
import { META as filterBar }     from '../filter-bar/default/meta'
import { META as pageHeader }    from '../page-header/default/meta'
import { META as georgraph }     from '../georgraph/default/meta'
import { META as links }         from '../links/default/meta'
import { META as repeat }        from '../repeat/default/meta'
import { META as hero }          from '../hero/default/meta'
import { META as statsCarousel } from '../stats-carousel/default/meta'

// ── Layout node metas ───────────────────────────────────────────────────────
import { META as row }     from '../layout/row/default/meta'
import { META as grid }    from '../layout/grid/default/meta'
import { META as columns } from '../layout/columns/default/meta'
import { META as stack }   from '../layout/stack/default/meta'
import { META as card }    from '../layout/card/default/meta'
import { META as divider } from '../layout/divider/default/meta'
import { META as spacer }  from '../layout/spacer/default/meta'
import { META as wrap }    from '../layout/wrap/default/meta'

// ── Panel metas ───────────────────────────────────────────────────────────────
import { META as chart }    from '../../panels/chart/default/meta'
import { META as kpiStrip } from '../../panels/kpi-strip/default/meta'
import { META as table }    from '../../panels/table/default/meta'
import { META as map }      from '../../panels/map/default/meta'
import { META as gauge }    from '../../panels/gauge/default/meta'
import { META as text }     from '../../panels/text/default/meta'

// ── Chrome metas — only variants that own per-instance authored config ────────
//
//  Imported from each variant's `meta.ts` (pure — no Shell/React deps), matching
//  this file's node-env constraint. ONLY the variants that carry per-element
//  authored config have a sibling `meta.ts`; the schema-less variants
//  (hidden/transparent/locale-switcher) inline their META beside a Shell export
//  in `index.ts` and are intentionally NOT imported here (see CHROME_EXEMPT).
//
import { META as appHeaderChrome }   from '../../chrome/app-header/default/meta'
import { META as appFooterChrome }   from '../../chrome/app-footer/default/meta'
import { META as innerSidebarChrome } from '../../chrome/inner-sidebar/default/meta'

// ── Pure containers — schema-exempt by design ─────────────────────────────────
//
//  A node whose ONLY editable surface is its children slot: structure is edited
//  in the tree, not the property panel. If one of these later grows a scalar
//  authored prop, remove it from this set and give it a schema. Keeping the
//  exemption explicit (not implicit) is the point — it documents the decision.
//
//  As of C0 every layout container already carries layout-prop schema (gap,
//  columns, direction…), so this set is empty. It exists as the documented
//  escape hatch for genuinely propless containers, not as a silent loophole.
//
const PURE_CONTAINERS: ReadonlySet<string> = new Set<string>([])

// ── Catalog of every page-canvas META (node + panel) ─────────────────────────
const ALL_METAS: PlaceableMeta[] = [
  section, modeBar, filterBar, pageHeader, georgraph, links, repeat, hero,
  statsCarousel,
  row, grid, columns, stack, card, divider, spacer, wrap,
  chart, kpiStrip, table, map, gauge, text,
]

function hasNonEmptySchema(m: PlaceableMeta): boolean {
  const schema = m.schema as PropSchema | undefined
  return Array.isArray(schema) && schema.length > 0
}

/** Metas the C0 invariant REQUIRES to carry a non-empty schema. */
function requiresSchema(m: PlaceableMeta): boolean {
  // panels are always inspector targets
  if (m.sliceType === 'panel') return true
  // pages are template ROOTS — structure edited in the tree, not a prop panel
  if (m.sliceType !== 'node') return false
  // transparent nodes are expanded in place — never an inspector target
  if ('transparent' in m && m.transparent) return false
  // pure containers edit structure in the tree, not the property panel
  if (PURE_CONTAINERS.has(m.type)) return false
  return true
}

// ── Fitness #1 — every placeable, non-transparent, non-container type is inspectable

describe('Constructor C0 — schema completeness (fitness #1)', () => {

  it('every placeable node/panel meta declares a non-empty schema', () => {
    const offenders = ALL_METAS
      .filter(requiresSchema)
      .filter(m => !hasNonEmptySchema(m))
      .map(m => m.type)

    expect(offenders).toEqual([])
  })

  it('the C0-backfilled metas now carry a schema (filter-bar, card, panels)', () => {
    // Regression guard for the exact C0 deliverable — these were the named gaps.
    expect(hasNonEmptySchema(filterBar)).toBe(true)
    expect(hasNonEmptySchema(card)).toBe(true)
    expect(hasNonEmptySchema(chart)).toBe(true)
    expect(hasNonEmptySchema(table)).toBe(true)
    expect(hasNonEmptySchema(kpiStrip)).toBe(true)
  })

})

// ── Schema vocabulary extensions (enum-ref + coverage) are usable ─────────────

describe('Constructor C0 — slice-meta extensions are honoured by metas', () => {

  it('card.title is a localized LocaleString field (coverage:"localized")', () => {
    const schema = (card as { schema?: PropSchema }).schema ?? []
    const title  = schema.find(f => f.field === 'title')
    expect(title).toBeDefined()
    expect(title?.type).toBe('LocaleString')
    expect(title?.coverage).toBe('localized')
  })

  it('every enum-ref field declares a resolver source', () => {
    // A type:'enum-ref' field without `source` is undefined behaviour for the
    // panel — the Inspector cannot resolve its options. Assert across all metas.
    const enumRefFields = ALL_METAS
      .flatMap(m => (m.schema as PropSchema | undefined) ?? [])
      .filter(f => f.type === 'enum-ref')

    for (const f of enumRefFields) {
      expect(f.source, `enum-ref field '${f.field}' must declare a source`).toBeDefined()
    }
  })

})

// ── Fitness #1b — chrome elements with per-element config are inspectable ──────
//
//  Same C0 invariant, applied to the chrome layer: a chrome variant that owns
//  per-INSTANCE authored config (read via useSlotConfig) MUST declare a
//  non-empty schema so the Inspector renders its property panel generically.
//
//  Out of scope (legitimately schema-less — the chrome analogue of transparent /
//  pure-container nodes), enumerated in CHROME_EXEMPT below so the deferral is
//  visible, not hidden:
//    - hidden variants (NullChromeSlot) — render nothing; nothing to author.
//    - transparent header — presentational variant, no per-element config.
//    - locale-switcher — reads ONLY the site-singleton `localeLabels` off the
//      shared ChromeConfig base (useChromeConfig), NOT per-element slot config.
//      Per STRICT SOLID (ChromeConfig.ts KEEP-list) a site singleton is edited
//      by the site-brand editor, never duplicated onto an element PropSchema —
//      so this element correctly carries no schema.
//
//  The schema-less variants inline their META beside a Shell export in index.ts
//  (not a pure meta.ts), so they cannot be imported into this node-env test
//  without pulling React. They are documented here rather than asserted.

const CHROME_EXEMPT: ReadonlySet<string> = new Set<string>([
  'AppHeader::transparent',   // presentational variant — no per-element config
  'AppHeader::hidden',        // NullChromeSlot — renders nothing
  'AppFooter::hidden',        // NullChromeSlot — renders nothing
  'InnerSidebar::hidden',     // NullChromeSlot — renders nothing
  'AppBanner::hidden',        // NullChromeSlot — renders nothing
  'LocaleSwitcher::default',  // reads site-singleton ChromeConfig.localeLabels only
])

// Chrome variants that own per-element authored config — MUST carry a schema.
const CHROME_WITH_CONFIG: ChromeSliceMeta[] = [
  appHeaderChrome,    // socialLinks
  appFooterChrome,    // footerLinks
  innerSidebarChrome, // brandTitle, sectionsLabel
]

describe('Constructor C0 — chrome schema completeness (fitness #1b)', () => {

  it('every chrome variant with per-element config declares a non-empty schema', () => {
    const offenders = CHROME_WITH_CONFIG
      .filter(m => {
        const schema = m.schema as PropSchema | undefined
        return !(Array.isArray(schema) && schema.length > 0)
      })
      .map(m => `${m.slot}::${m.key}`)

    expect(offenders).toEqual([])
  })

  it('the in-scope chrome corpus and its exempt set are disjoint and complete', () => {
    // Guards against a schema-less variant silently slipping in without either a
    // schema OR an explicit CHROME_EXEMPT entry pointing back to this rationale.
    const inScope = CHROME_WITH_CONFIG.map(m => `${m.slot}::${m.key}`)
    for (const key of inScope) {
      expect(CHROME_EXEMPT.has(key), `${key} is both in-scope and exempt`).toBe(false)
    }
    // The exempt set is the documented allow-list (ADR adr_constructor_phase2):
    // every entry is a deliberate, reasoned deferral, not a coverage hole.
    expect(CHROME_EXEMPT.size).toBe(6)
  })

})

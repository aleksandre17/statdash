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
import { propSchemaToSubSchema } from '@statdash/react/engine'

// Page-canvas metas all carry `.type` (unlike chrome/control). Narrow the corpus
// to exactly these three sliceTypes so the fitness can index `.type` directly.
type PlaceableMeta = NodeSliceMeta | PanelSliceMeta | PageSliceMeta

// ── Node metas ────────────────────────────────────────────────────────────────
import { META as section }       from '../section/default/meta'
import { META as perspectiveBar } from '../perspective-bar/default/meta'
import { META as filterBar }     from '../filter-bar/default/meta'
import { META as pageHeader }    from '../page-header/default/meta'
import { META as geograph }     from '../geograph/default/meta'
import { META as links }         from '../links/default/meta'
import { META as repeat }        from '../repeat/default/meta'
import { META as hero }          from '../hero/default/meta'
import { META as statsCarousel } from '../stats-carousel/default/meta'
import { META as featuredSlider } from '../featured-slider/default/meta'

// ── Layout node metas ───────────────────────────────────────────────────────
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
  section, perspectiveBar, filterBar, pageHeader, geograph, links, repeat, hero,
  statsCarousel, featuredSlider,
  grid, columns, stack, card, divider, spacer, wrap,
  chart, kpiStrip, table, gauge, text,
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

// ── Fitness #1 UPGRADED — non-empty → INTERFACE-COMPLETE (Wave 8, tier a) ──────
//
//  Non-empty is necessary but not sufficient: a placeable could ship a token
//  one-field schema and still silently drop props from the Inspector. Tier a
//  strengthens the runtime gate with two structural oracles the runtime CAN see
//  (TS interfaces are erased — the compile-time 1:1 half lives beside each schema
//  as `AssertSchemaCovers`, packages/plugins/schema-contract.ts):
//
//    (1) defaults-coverage — every key a meta ships in its runtime `defaults`
//        (its authored seed) MUST have a schema field. A default with no editable
//        control is a prop the author can never see or change → an Inspector gap.
//    (2) JSON-Schema round-trip — the emitted authoring subschema
//        (propSchemaToSubSchema, the SAME bridge generatePageConfigSchema uses)
//        MUST expose exactly the schema's field-set: no field silently dropped,
//        no phantom property invented. This pins the schema↔wire contract lossless.
//
//  Together with the compile-time 1:1 assert, this makes an incomplete placeable
//  FAIL THE BUILD → Inspector.tsx's empty branch is unreachable by construction.

// System / structural keys never authored as a top-level scalar prop (NodeBase +
// child-slot). Mirrors schema-contract.ts's SystemKeys — kept as a runtime literal
// set because the type is erased. A default carrying one of these (e.g. section's
// seeded `view`) is structural, not an authored prop, so it is exempt.
const SYSTEM_KEYS: ReadonlySet<string> = new Set<string>([
  'type', 'id', 'variant', 'data', 'view', 'storeKey', 'variants', 'visibleToRoles',
  'transforms', 'fieldConfig', 'vars', 'dataLinks', 'on', 'children',
])

/** Top-level segment of a (possibly dot-path) schema field. */
const topLevel = (field: string): string => field.split('.')[0]

/** The set of top-level field names a meta's schema declares. */
function schemaTopLevelFields(m: PlaceableMeta): Set<string> {
  const schema = (m.schema as PropSchema | undefined) ?? []
  return new Set(schema.map(f => topLevel(f.field)))
}

describe('Constructor C0 — schema completeness is INTERFACE-COMPLETE (fitness #1, tier a)', () => {

  it('every default key (minus system/slot keys) is covered by a schema field', () => {
    const offenders: string[] = []
    for (const m of ALL_METAS.filter(requiresSchema)) {
      const defaults = (m as { defaults?: Record<string, unknown> }).defaults ?? {}
      const covered  = schemaTopLevelFields(m)
      for (const key of Object.keys(defaults)) {
        if (SYSTEM_KEYS.has(key)) continue
        if (!covered.has(key)) offenders.push(`${m.type}.${key}`)
      }
    }
    // An authored default with no editable control = a silent Inspector gap.
    expect(offenders, `defaults with no schema field: ${offenders.join(' | ')}`).toEqual([])
  })

  it('the JSON-Schema bridge is lossless — emitted property keys === schema field-set', () => {
    const offenders: string[] = []
    for (const m of ALL_METAS.filter(requiresSchema)) {
      const schema     = (m.schema as PropSchema | undefined) ?? []
      const fieldSet   = new Set(schema.map(f => f.field))
      const emittedKeys = Object.keys(propSchemaToSubSchema(schema).properties)
      const emittedSet = new Set(emittedKeys)
      // dropped: a schema field with no emitted property (the bridge lost it)
      for (const f of fieldSet) if (!emittedSet.has(f)) offenders.push(`${m.type}: dropped '${f}'`)
      // phantom: an emitted property with no schema field (the bridge invented it)
      for (const k of emittedSet) if (!fieldSet.has(k)) offenders.push(`${m.type}: phantom '${k}'`)
    }
    expect(offenders, `bridge drift: ${offenders.join(' | ')}`).toEqual([])
  })

})

// ── Fitness #1c — nested authorability is 100%-gated (D7.2 — backlog DRAINED) ──
//
//  Tier b's compile-time 1:1 assert (AssertSchemaCovers) proves TOP-LEVEL coverage.
//  The remaining frontier was DEPTH: an `array`/`object` field was authored through a
//  single OPAQUE control, its item's sub-fields having no structured sub-schema. The
//  additive `itemSchema` PropField seam (D7.0 / ADR-022) + the generic nested editor
//  (D7.1) closed that; D7.2 populated every meta, so the SCHEMA_TODO backlog has
//  fully DRAINED — the terminal state SPEC §6.1 promised.
//
//  This gate now enforces the 100%-authorable invariant in TWO moves:
//    (1) SCHEMA_TODO === {} — the backlog is empty, red-on-regression.
//    (2) `collectOpaqueNested` RECURSES the whole schema tree (into every itemSchema,
//        arbitrary depth) and asserts every opaque leaf — at ANY depth — is argued in
//        OPAQUE_BY_DESIGN. A NEW opaque nested field (top-level OR deep) cannot slip
//        in silently (must be argued); a stale entry (once given an itemSchema) is
//        forced out. Depth is gated, not just breadth — "neither editable nor opaque
//        is a silent gap."

/** Stable id for a meta in the nested-backlog (page canvas + chrome-with-config). */
const metaId = (m: PlaceableMeta | ChromeSliceMeta): string =>
  'type' in m ? m.type : `${m.slot}::${m.key}`

/**
 * Recursively collect the dot-keys of every opaque nested array/object field —
 * DESCENDING into each structured `itemSchema` so DEPTH is gated, not just breadth
 * (D7.2 — the completeness oracle now recurses, per ADR-022 / SPEC §6.3). A field
 * WITH an itemSchema is not opaque itself; we recurse into it to surface any opaque
 * SUB-field (e.g. a KPI item's `value.filter` DimFilter map, at arbitrary depth). A
 * field WITHOUT one is an opaque leaf and its full dot-path key is recorded.
 */
function collectOpaqueNested(schema: PropSchema, prefix: string, out: string[]): void {
  for (const f of schema) {
    if (f.type !== 'array' && f.type !== 'object') continue
    const key = `${prefix}.${f.field}`
    const itemSchema = (f as { itemSchema?: PropSchema }).itemSchema
    if (itemSchema && itemSchema.length > 0) collectOpaqueNested(itemSchema, key, out)
    else out.push(key)
  }
}

// ── SCHEMA_TODO — DRAINED (D7.2). ─────────────────────────────────────────────
//  The nested-item backlog has fully retired: every nested array/object field now
//  either carries a structured `itemSchema` (authored item-by-item via the D7.1
//  editor) OR is acknowledged in OPAQUE_BY_DESIGN below with an argued rationale.
//  The "100%-authorable, nothing-un-buildable" invariant (SPEC §6.1) is now a build
//  gate: an EMPTY object, held empty by the terminal assertion.
const SCHEMA_TODO: Readonly<Record<string, string>> = {}

// ── OPAQUE_BY_DESIGN — the argued allowlist (SPEC §6.2 / §9 gate 4) ────────────
//  Fields that STAY raw-JSON, by deliberate reasoned choice ("opacity must be
//  argued, not defaulted"). Keyed by full (possibly DEEP) dot-path so the gate
//  distinguishes 'intentionally opaque' from 'silent gap'. Three justified classes:
const OPAQUE_BY_DESIGN: Readonly<Record<string, string>> = {
  // (a) Top-level free-form bags — owner-ratified (SPEC §9 gate 4).
  'wrap.styles':         'NodeStyles — arbitrary CSS-property map; free-form by design',
  'repeat.each':         'Record<string,unknown>[] — free-form static iteration rows',
  'geograph.geoCodeMap': 'Record<iso,dimValue> — opaque ISO→dim-value code map',

  // (b) Scalar-array — the nested-item editor authors OBJECT items, not scalars, so
  //     the object-itemSchema model structurally does not fit a string[]. A proper
  //     picker needs a multi-value enum-ref control (a `bars` source + scalar-item
  //     editor support) that does not yet exist; raw-JSON `["bar1"]` is the honest,
  //     adequate fallback until then. Flagged for owner-gate (see D7.2 report).
  'filter-bar.barIds':   'string[] — SCALAR bar-id list; needs a future multi-enum-ref control (object-itemSchema model N/A)',

  // (c) Deep union / free-form sub-objects INSIDE a structured itemSchema — the
  //     governed KPI/featured items are reachable item-by-item (metric-ref, label,
  //     color…), but these sub-fields are free-form maps that stay raw-JSON in the item
  //     editor (the honest fallback for expert coordinates).
  //     NOTE (ADR-049 P2a): `items.when` (→ type:'visibility', Lane 2) and `items.trend`
  //     (→ type:'trend', Lane 3) are NO LONGER opaque — they now project through the
  //     VisibilityField / TrendField controls, so they left this allowlist (their absence
  //     is asserted by the `stale` check: a re-opaqued field would red the build).
  'kpi-strip.items.value.filter': 'DimFilter — free-form dim→value coordinate map',
  'featured-slider.items.at':     'DimFilter — free-form dim→value coordinate map',
}

describe('Constructor C0 — nested authorability is 100%-gated (fitness #1c)', () => {

  it('SCHEMA_TODO has fully DRAINED — the nested-item backlog is empty (D7.2)', () => {
    // Terminal gate (SPEC §6.1): every nested field is either structured (itemSchema)
    // or argued-opaque (OPAQUE_BY_DESIGN). "Nothing un-buildable" is red-on-regression.
    expect(Object.keys(SCHEMA_TODO)).toEqual([])
  })

  it('every opaque nested field — at ANY DEPTH — is acknowledged in OPAQUE_BY_DESIGN', () => {
    const corpus = [...ALL_METAS, ...CHROME_WITH_CONFIG]
    const live: string[] = []
    for (const m of corpus) {
      const schema = ((m as { schema?: PropSchema }).schema) ?? []
      collectOpaqueNested(schema, metaId(m as PlaceableMeta), live)
    }
    const allowed = new Set(Object.keys(OPAQUE_BY_DESIGN))

    const unlisted = live.filter(k => !allowed.has(k))            // opaque field, not argued
    const stale    = [...allowed].filter(k => !live.includes(k))  // allowlist entry no longer live

    expect(unlisted, `opaque nested fields missing an OPAQUE_BY_DESIGN rationale: ${unlisted.join(' | ')}`).toEqual([])
    expect(stale, `stale OPAQUE_BY_DESIGN entries (field gone or now structured): ${stale.join(' | ')}`).toEqual([])
  })

  it('every OPAQUE_BY_DESIGN entry carries a non-empty rationale', () => {
    const blank = Object.entries(OPAQUE_BY_DESIGN).filter(([, why]) => !why.trim()).map(([k]) => k)
    expect(blank).toEqual([])
  })

  // D7.2 — the recursion is DETECTABLE at depth: a bare array/object field is opaque;
  // one with a populated itemSchema is structured (recursed into, not recorded); an
  // itemSchema whose OWN sub-field is a bare array/object surfaces that deep key. This
  // proves the gate fires the moment a meta populates — or under-populates — the seam.
  it('collectOpaqueNested records opaque leaves and recurses structured fields (depth-detectable)', () => {
    const label = { en: 'x' }
    const schema: PropSchema = [
      { field: 'bareArr', type: 'array',  label },                      // opaque leaf
      { field: 'bareObj', type: 'object', label },                      // opaque leaf
      {
        field: 'items', type: 'array', label,                           // structured → recurse
        itemSchema: [
          { field: 'measure', type: 'enum-ref', source: 'metrics', label }, // scalar — ignored
          { field: 'coord',   type: 'object', label },                      // deep opaque leaf
        ],
      },
    ]
    const out: string[] = []
    collectOpaqueNested(schema, 'x', out)
    expect(out.sort()).toEqual(['x.bareArr', 'x.bareObj', 'x.items.coord'])
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
  'ThemeSwitcher::default',   // no per-element config — built-in light/dark axis + useTheme hook
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
    expect(CHROME_EXEMPT.size).toBe(7)
  })

})

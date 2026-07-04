/**
 * @statdash/plugins/catalog
 * Platform vocabulary for the Constructor (panel) palette editor.
 *
 * Exports: META descriptors (type, label, category, schema, defaults, slots, groups)
 * for every registered node, panel, and control — plus a STRUCTURED palette index
 * (`byCategory` / `bySliceType`) the Constructor reads to lay out its palette without
 * re-deriving the grouping itself.
 *
 * Reference: docs/architecture/subsystems/15-constructor.md §1 (palette grouping by
 * category) + 30-plugin-taxonomy.md §8 (palette categorization by sliceType).
 *
 * ── React-purity ──
 * All META imports resolve directly to `meta.ts` files — pure TypeScript with no
 * Shell/React/apexcharts/leaflet/i18next transitive imports.  This module is safe
 * to import from `apps/panel` and any other non-React environment.
 */
import type { SliceCategory, SliceMeta } from '@statdash/react/engine'

// ── Nodes ─────────────────────────────────────────────────────────────────────
export { META as section }       from './nodes/section'
export { META as perspectiveBar } from './nodes/perspective-bar'
export { META as filterBar }     from './nodes/filter-bar'
export { META as pageHeader }    from './nodes/page-header'
export { META as geograph }      from './nodes/geograph'
export { META as links }         from './nodes/links'
export { META as repeat }        from './nodes/repeat'
export { META as hero }          from './nodes/hero'
export { META as statsCarousel } from './nodes/stats-carousel'
export { META as featuredSlider } from './nodes/featured-slider'

// ── Layout nodes (namespace: layout.grid.META, layout.columns.META, …) ────────
export * as layout from './nodes/layout'

// ── Panels ────────────────────────────────────────────────────────────────────
export { META as chart }    from './panels/chart'
export { META as kpiStrip } from './panels/kpi-strip'
export { META as table }    from './panels/table'
export { META as text }     from './panels/text'
export { META as gauge }    from './panels/gauge'

// ── Pages ─────────────────────────────────────────────────────────────────────
export * as pages from './pages'

// ── Controls (slices contain META + codec + Shell; bundler tree-shakes Shell) ──
export * from './controls'

// ── Imports for the structured index (direct meta.ts paths — no Shell in graph) ─
import { META as sectionMeta }       from './nodes/section/default/meta'
import { META as perspectiveBarMeta } from './nodes/perspective-bar/default/meta'
import { META as filterBarMeta }     from './nodes/filter-bar/default/meta'
import { META as pageHeaderMeta }    from './nodes/page-header/default/meta'
import { META as geographMeta }      from './nodes/geograph/default/meta'
import { META as linksMeta }         from './nodes/links/default/meta'
import { META as repeatMeta }        from './nodes/repeat/default/meta'
import { META as heroMeta }          from './nodes/hero/default/meta'
import { META as statsCarouselMeta } from './nodes/stats-carousel/default/meta'
import { META as featuredSliderMeta } from './nodes/featured-slider/default/meta'
import { META as chartMeta }         from './panels/chart/default/meta'
import { META as kpiStripMeta }      from './panels/kpi-strip/default/meta'
import { META as tableMeta }         from './panels/table/default/meta'
import { META as textMeta }          from './panels/text/default/meta'
import { META as gaugeMeta }         from './panels/gauge/default/meta'
import * as pagesMeta                from './pages/meta'

// ─────────────────────────────────────────────────────────────────────────────
// Structured palette contract — what the Constructor reads to build its palette.
// Builder.io block list · Grafana panel-plugin catalog · Sanity field groups.
// ─────────────────────────────────────────────────────────────────────────────

/** A single palette tile the Constructor can render and drag onto the canvas. */
export interface PaletteEntry {
  /** nodeRegistry key — matches NodeDef.type. */
  type:       string
  /** Registry routing discriminant — also the coarsest palette axis. */
  sliceType:  SliceMeta['sliceType']
  /** Fine palette grouping (orthogonal to sliceType). */
  category?:  SliceCategory
  /** Display label — LocaleString; Constructor resolves to active locale. */
  label?:     unknown
  /** Constructor palette tile icon key. */
  icon?:      string
  /** Static thumbnail path for the palette tile (not the canvas). */
  preview?:   string
  /** Page templates are tree roots — Constructor hides them unless canvas is empty. */
  rootOnly?:  boolean
  /** Whether this entry accepts children (drop target).  Pinned false on panels. */
  canHaveChildren?: boolean
  /** Schema present → form editor; absent → raw JSON editor fallback. */
  hasSchema:  boolean
}

/** The full plugin catalog the Constructor consumes — two indices over one list. */
export interface PluginCatalog {
  /** Flat list of every placeable entry, in registration order. */
  entries:      PaletteEntry[]
  /** Entries grouped by palette category (`15-constructor.md` palette grouping). */
  byCategory:   Record<string, PaletteEntry[]>
  /** Entries grouped by sliceType (`30-plugin-taxonomy.md` tier categorization). */
  bySliceType:  Record<string, PaletteEntry[]>
}

function toEntry(m: SliceMeta): PaletteEntry | null {
  // Chrome and filter controls are not page-canvas palette entries — they live in
  // the chrome editor / filter-bar editor respectively, keyed by slot/controlType.
  if (m.sliceType === 'chrome' || m.sliceType === 'control') return null
  return {
    type:            m.type,
    sliceType:       m.sliceType,
    category:        m.category,
    label:           m.label,
    icon:            m.icon,
    preview:         m.preview,
    rootOnly:        'rootOnly'        in m ? m.rootOnly        : undefined,
    canHaveChildren: 'canHaveChildren' in m ? m.canHaveChildren : undefined,
    hasSchema:       'schema' in m && m.schema != null,
  }
}

/** Every page-canvas META known to the platform, in palette order. */
const PALETTE_META: SliceMeta[] = [
  // pages first — Constructor offers them only when the canvas is empty
  ...(Object.values(pagesMeta) as Array<{ META?: SliceMeta }>)
    .map(ns => ns.META)
    .filter((m): m is SliceMeta => m != null),
  // structural + content nodes
  sectionMeta, perspectiveBarMeta, filterBarMeta, pageHeaderMeta,
  geographMeta, linksMeta, repeatMeta, heroMeta, statsCarouselMeta, featuredSliderMeta,
  // data panels
  chartMeta, kpiStripMeta, tableMeta, gaugeMeta,
  // content panels
  textMeta,
]

/**
 * The structured catalog.  Built once at module load from the META values above.
 * `nodeRegistry.list()` (engine/react) is the runtime equivalent for registered
 * types; this is the static, build-time view used by the panel editor before the
 * full engine is booted.
 */
export const PLUGIN_CATALOG: PluginCatalog = (() => {
  const entries     = PALETTE_META.map(toEntry).filter((e): e is PaletteEntry => e != null)
  const byCategory  : Record<string, PaletteEntry[]> = {}
  const bySliceType : Record<string, PaletteEntry[]> = {}
  for (const e of entries) {
    ;(byCategory[e.category ?? 'uncategorized'] ??= []).push(e)
    ;(bySliceType[e.sliceType]                  ??= []).push(e)
  }
  return { entries, byCategory, bySliceType }
})()

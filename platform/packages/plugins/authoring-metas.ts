/**
 * @statdash/plugins/authoring-metas
 * The PURE, COMPLETE roster of every shipped authoring META.
 *
 * WHY THIS MODULE EXISTS (separate from `catalog.ts`):
 *   `catalog.ts` is the Constructor *palette* facade — it re-exports node/panel
 *   SHELL barrels (`export { META } from './nodes/section'`, `export * from
 *   './controls'`), so importing it pulls the whole React/Leaflet/Apex shell graph
 *   AND it deliberately omits non-palette surfaces (layout nodes, chrome slots).
 *   The i18n `labelCompleteness` fitness gate needs the opposite: a graph that is
 *   (a) PURE (only `default/meta.ts` files — zero Shell/React/leaflet), so it loads
 *   in a node test env, and (b) COMPLETE (every label-bearing META, incl. layout +
 *   chrome), so no authoring label escapes the gate.
 *
 *   Every import below resolves to a pure `meta.ts` (typed imports + plain META
 *   objects) — there is no Shell/React in this module's graph. Discovery-robust:
 *   a new authoring slice is covered the moment its META is added here.
 */
import type { SliceMeta } from '@statdash/react/engine'

// ── Structural + content + data nodes ─────────────────────────────────────────
import { META as section }        from './nodes/section/default/meta'
import { META as perspectiveBar } from './nodes/perspective-bar/default/meta'
import { META as filterBar }      from './nodes/filter-bar/default/meta'
import { META as pageHeader }     from './nodes/page-header/default/meta'
import { META as geograph }       from './nodes/geograph/default/meta'
import { META as links }          from './nodes/links/default/meta'
import { META as repeat }         from './nodes/repeat/default/meta'
import { META as hero }           from './nodes/hero/default/meta'
import { META as statsCarousel }  from './nodes/stats-carousel/default/meta'
import { META as featuredSlider } from './nodes/featured-slider/default/meta'

// ── Layout nodes ──────────────────────────────────────────────────────────────
import { META as card }    from './nodes/layout/card/default/meta'
import { META as columns } from './nodes/layout/columns/default/meta'
import { META as divider } from './nodes/layout/divider/default/meta'
import { META as grid }    from './nodes/layout/grid/default/meta'
import { META as spacer }  from './nodes/layout/spacer/default/meta'
import { META as stack }   from './nodes/layout/stack/default/meta'
import { META as wrap }    from './nodes/layout/wrap/default/meta'

// ── Data + content panels ─────────────────────────────────────────────────────
import { META as chart }    from './panels/chart/default/meta'
import { META as kpiStrip } from './panels/kpi-strip/default/meta'
import { META as table }    from './panels/table/default/meta'
import { META as gauge }    from './panels/gauge/default/meta'
import { META as text }     from './panels/text/default/meta'

// ── Page template roots ───────────────────────────────────────────────────────
import * as pagesMeta from './pages/meta'

// ── Chrome slots (schema-bearing + label-only variants) ───────────────────────
import { META as appHeaderDefault }     from './chrome/app-header/default/meta'
import { META as appFooterDefault }     from './chrome/app-footer/default/meta'
import { META as innerSidebarDefault }  from './chrome/inner-sidebar/default/meta'

/** Every shipped authoring META, pure and complete (the i18n-gate discovery SSOT). */
export const AUTHORING_METAS: SliceMeta[] = [
  // pages
  ...(Object.values(pagesMeta) as Array<{ META?: SliceMeta }>)
    .map((ns) => ns.META)
    .filter((m): m is SliceMeta => m != null),
  // nodes
  section, perspectiveBar, filterBar, pageHeader, geograph, links, repeat, hero, statsCarousel, featuredSlider,
  // layout
  card, columns, divider, grid, spacer, stack, wrap,
  // panels
  chart, kpiStrip, table, gauge, text,
  // chrome (schema-bearing default variants)
  appHeaderDefault, appFooterDefault, innerSidebarDefault,
]

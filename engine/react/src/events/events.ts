// ── GeostatEventMap — typed event catalogue ───────────────────────────────
//
//  Augment this interface to add custom events (module augmentation, OCP):
//    declare module '@geostat/react/events' {
//      interface GeostatEventMap {
//        'my:event': { data: string }
//      }
//    }
//

import type { DimVal } from '@geostat/engine'

export interface GeostatEventMap {
  /** Row hover — synchronises highlight across charts on the same page. */
  'row:hover':     { rowKey: string; nodeType: string }
  /** Row hover end — clear highlight. */
  'row:leave':     { nodeType: string }
  /** Row click — other panels can react (filter, highlight, navigate). */
  'row:click':     { row: Record<string, DimVal>; nodeType: string }
  /** Legend series toggle — sync series visibility across charts. */
  'legend:toggle': { seriesKey: string; visible: boolean }
  /** Drill-down navigation — navigate to page with row params. */
  'drill:down':    { page: string; params: Record<string, string> }
  /** Mode change — emitted by ModeBar when user switches year/range/compare. */
  'mode:change':   { mode: string }
}
// ── GeostatEventMap — typed event catalogue ───────────────────────────────
//
//  Augment this interface to add custom events (module augmentation, OCP):
//    declare module '@statdash/react/events' {
//      interface GeostatEventMap {
//        'my:event': { data: string }
//      }
//    }
//

import type { DimVal } from '@statdash/engine'

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
  /**
   * Node data-status change — a data-bearing panel emits this when its resolved
   * data status changes: 'ok' (rows present), 'empty' (resolved, zero rows), or
   * 'error' (resolution failed). Carries the emitting node's id + type so a
   * subscriber can attribute the status.
   *
   * This is the foundation for the deferred NodeStatusContext (see SectionShell's
   * Option-D ADR): once a real aggregate consumer exists — e.g. collapse a
   * section when ALL its panels are empty, or disable section export on empty —
   * the section subscribes to 'node:status' and aggregates. Until that second
   * consumer is real, this event is the published seam, not yet consumed (YAGNI:
   * the type is cheap and additive; the aggregator is built when needed).
   */
  'node:status':   { nodeId?: string; nodeType: string; status: 'ok' | 'empty' | 'error' }
}
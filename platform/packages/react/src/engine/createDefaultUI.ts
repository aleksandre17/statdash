// ── createDefaultUI — platform default Container factory ──────────────────
//
//  Extracted from SiteRenderer so test harnesses can import it without
//  pulling in SiteRenderer's hook dependencies (useFilter, useStores, etc.).
//
//  Usage:
//    import { createDefaultUI } from './createDefaultUI'
//    holder.ctx = { ..., ui: createDefaultUI(), ... }
//
//  Dependency arrow: engine/react (this file) ← plugins ← src.
//  Zero app-specific references here.
//

import { MapContainer }             from './di/Container'
import type { Container }           from './di/Container'
import { PanelLayout, PANEL_LAYOUT } from '../components/PanelLayout'
import { EmptyState,  EMPTY_STATE  } from '../components/feedback/EmptyState'
import { ExportMenu,  EXPORT_MENU  } from '../components/feedback/ExportMenu'

/**
 * Returns a populated Container — the three built-in components provided by
 * token against a MapContainer. NodePageRenderer applies caller overrides on
 * top at baseCtx assembly time. Test harnesses call this directly to satisfy
 * the required `ui` field on RenderContext without reimporting each
 * component individually.
 *
 * Token descriptions match the former UIComponentMap string keys —
 * a new platform primitive is one token declaration + one provide() line here.
 */
export function createDefaultUI(): Container {
  const c = new MapContainer()
  c.provide(PANEL_LAYOUT, PanelLayout)
  c.provide(EMPTY_STATE,  EmptyState)
  c.provide(EXPORT_MENU,  ExportMenu)
  return c
}

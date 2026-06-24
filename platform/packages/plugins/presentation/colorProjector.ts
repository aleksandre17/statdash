// ── colorProjector — page color → CSS custom property [N-ADR-0029 v2] ────────
//
//  The FIRST registered presentation projector. Page color is a literal string
//  OR a data-driven VarExpr (op:'find', …) evaluated per render. It projects to
//  the CSS custom property `--sc` on the page wrapper div — every concern detail
//  (the `--sc` var name, the literal-vs-expr narrow, the page-color fallback)
//  lives HERE, with the concern, NOT in the generic renderer.
//
//  Registered at app boot via registerPresentationProjector (setupRegistrations /
//  setupCanvasRegistry), beside registerStoreBuilders / registerSlice.
//
//  Layer: @statdash/plugins (above react in the arrow) — imports only inward
//  (@statdash/react/engine types + contract). Carries no tenant content (Law 3).
//

import type { PresentationProjector } from '@statdash/react/engine'
import type { VarExpr }                from '@statdash/react/engine'

/** CSS custom property the page color cascades through. Owned by THIS concern. */
const PAGE_COLOR_VAR = '--sc'

export const colorProjector: PresentationProjector<VarExpr | string, string> = {
  key: 'color',

  // Label is the en-only baseline (Law 3 — no first-tenant `ka` content in a
  // reusable library; tenant locales arrive via the manifest i18n catalog).
  schema: () => [
    { field: 'color', type: 'color', label: { en: 'Page color' } },
  ],

  evaluate(raw, evalExpr, ctx) {
    // No authored color ⇒ fall back to the static literal page color (if any).
    if (raw === undefined) return ctx.pageColorFallback
    // Literal string ⇒ use as-is; otherwise evaluate the VarExpr (op:'find', …).
    const v = typeof raw === 'string' ? raw : evalExpr(raw)
    return (typeof v === 'string' ? v : undefined) ?? ctx.pageColorFallback
  },

  project(color, sink) {
    if (color) sink.cssVars[PAGE_COLOR_VAR] = color
  },
}

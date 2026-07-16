// ── colorProjector — page color → CSS custom property [N-ADR-0029 v2] ────────
//
//  The FIRST registered presentation projector. Page color is a literal string
//  OR a data-driven VarExpr (op:'find', …) evaluated per render. It projects to
//  the CSS custom property `--sc` on the page wrapper div — every concern detail
//  (the `--sc` var name, the literal-vs-expr narrow) lives HERE, with the concern,
//  NOT in the generic renderer.
//
//  Single home (schemaVersion ≥ 2): page color is authored ONLY at
//  `presentation.color`. The legacy flat `PageConfigBase.color` field was retired
//  and its values migrated into `presentation.color` by the v1→v2 migrator
//  (packages/core/src/config/migration.ts). There is no flat fallback to fold.
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

  // Neutral platform label. A presentation projector is library LOGIC code, not a
  // catalog-class descriptor (*Node.ts / meta.ts / *-schemas.ts), so it must stay
  // tenant-content-free (Law 3; FF no-tenant-content forbids Georgian script here).
  // The Georgian display for this label belongs in the panel i18n surface, not baked
  // in the library. ARCHITECT-FLAG: decide whether a PresentationProjector.schema()
  // should be recognized as catalog-class (peer of node-schema labels) — until then,
  // en-neutral keeps the gate honest.
  schema: () => [
    { field: 'color', type: 'color', label: { en: 'Page color' } },
  ],

  evaluate(raw, evalExpr) {
    // No authored presentation.color ⇒ contribute nothing.
    if (raw === undefined) return undefined
    // Literal string ⇒ use as-is; otherwise evaluate the VarExpr (op:'find', …).
    const v = typeof raw === 'string' ? raw : evalExpr(raw)
    return typeof v === 'string' ? v : undefined
  },

  project(color, sink) {
    if (color) sink.cssVars[PAGE_COLOR_VAR] = color
  },
}

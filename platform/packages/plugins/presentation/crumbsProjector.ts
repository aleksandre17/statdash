// ── crumbsProjector — derived breadcrumbs → navContext.crumbs [N-ADR-0029 v2] ──
//
//  The SECOND registered presentation projector. A page's breadcrumb trail is a
//  data-driven VarExpr (op:'breadcrumbs') evaluating to a Crumb[]. It projects to
//  `ctx.navContext.crumbs`, consumed by PageHeaderShell.
//
//  The runtime GUARD (isCrumbs) lives HERE, with the concern — it was previously
//  in the shared engine (pageVars.ts). The engine now keeps only the structural
//  `Crumb` type (part of the generic RenderContext.navContext contract); the
//  guard + the projection belong to this projector.
//
//  Registered at app boot via registerPresentationProjector (setupRegistrations /
//  setupCanvasRegistry), beside registerStoreBuilders / registerSlice.
//
//  Layer: @statdash/plugins (above react in the arrow) — imports only inward.
//

import type { PresentationProjector } from '@statdash/react/engine'
import type { VarExpr, Crumb }         from '@statdash/react/engine'

/**
 * Runtime guard for the evaluated crumbs value.
 *
 * A boundary type-guard, NOT a schema validator: the evaluated VarExpr is
 * untrusted `unknown` produced by evalVarMap. Narrow it to `Crumb[]` by checking
 * it is an array of `{ label: string }` objects (href optional, unchecked).
 * Keep it cheap — runs every render.
 */
export function isCrumbs(v: unknown): v is Crumb[] {
  return (
    Array.isArray(v) &&
    v.every(
      c => c !== null && typeof c === 'object' && typeof (c as Crumb).label === 'string',
    )
  )
}

export const crumbsProjector: PresentationProjector<VarExpr, Crumb[]> = {
  key: 'crumbs',

  // Label is the en-only baseline (Law 3 — no first-tenant `ka` content in a
  // reusable library; tenant locales arrive via the manifest i18n catalog).
  // `plane:'system'`: the breadcrumb trail is a DERIVED data-driven VarExpr
  // (op:'breadcrumbs' → by · op · prefix · source), not hand-authoring — plumbing.
  // It projects to no one on the author plane (root Law 11 · ADR-043); the trail is
  // computed from the page's nav model, never typed as a raw object in the inspector.
  schema: () => [
    { field: 'crumbs', type: 'array', label: { en: 'Breadcrumbs' }, plane: 'system' },
  ],

  evaluate(raw, evalExpr) {
    if (raw === undefined) return undefined
    const v = evalExpr(raw)
    return isCrumbs(v) ? v : undefined
  },

  project(crumbs, sink) {
    sink.nav.crumbs = crumbs
  },
}

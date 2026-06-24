// ── pageVars — breadcrumb structural type (engine-owned) ─────────────────────
//
//  Crumb is the structural shape of one breadcrumb item. It is part of the
//  GENERIC RenderContext contract: ctx.navContext.crumbs?: Crumb[] is what page
//  shells (PageHeaderShell) consume, regardless of WHO produced the trail. So
//  the structural type lives here, in the app-agnostic engine layer.
//
//  The runtime GUARD (isCrumbs) and the PROJECTION of a page's presentation
//  into navContext.crumbs are a per-concern concern — they live WITH the
//  crumbs projector (@statdash/plugins .../presentation/crumbsProjector.ts),
//  behind the presentation registry [N-ADR-0029 v2]. The engine never reads
//  a `crumbs` key by name; presentation flows only through projectPresentation.
//
//  Law 3 (engine/react is app-agnostic): no brand defaults here.
//

// ── Crumb — breadcrumb trail item ─────────────────────────────────────
//
//  Shared shape for the evaluated crumbs value and ctx.navContext.crumbs.
//  Owned here so plugin authors who build dynamic breadcrumbs can import
//  Crumb from @statdash/react/engine without touching internals.
//
export interface Crumb {
  label: string
  href?: string
}

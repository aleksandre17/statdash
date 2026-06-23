// ── pageVars — breadcrumb types (engine-owned) ───────────────────────
//
//  Crumb type and isCrumbs boundary guard.
//
//  Color is set as a CSS custom property (--sc) on wrapper elements via the
//  DOM cascade — no var slot, no constant needed.
//
//  Breadcrumbs flow: page.vars['_pageCrumbs'] → SiteRenderer reads with
//  isCrumbs() → populates navContext.crumbs → consumed by PageHeaderShell.
//  The string key '_pageCrumbs' is used directly in page configs as a plain
//  string literal; no exported constant needed.
//
//  Law 3 (engine/react is app-agnostic): no brand defaults here.
//

// ── Crumb — breadcrumb trail item ─────────────────────────────────────
//
//  Shared shape for the `_pageCrumbs` var slot and navContext.crumbs.
//  Owned here so plugin authors who build dynamic breadcrumbs can import
//  Crumb + isCrumbs from @statdash/react/engine without touching internals.
//
export interface Crumb {
  label: string
  href?: string
}

/**
 * Runtime guard for the `_pageCrumbs` var slot.
 *
 * A boundary type-guard, NOT a schema validator: `ctx.vars` is
 * `Record<string, unknown>` produced by evalVarMap, so the value at the
 * crumbs key is untrusted. We narrow it to `Crumb[]` by checking it is an
 * array of `{ label: string }` objects (href is optional, unchecked). Keep it
 * cheap — this runs every render.
 */
export function isCrumbs(v: unknown): v is Crumb[] {
  return (
    Array.isArray(v) &&
    v.every(
      c => c !== null && typeof c === 'object' && typeof (c as Crumb).label === 'string',
    )
  )
}

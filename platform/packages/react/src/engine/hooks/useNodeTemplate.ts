// ── Node template resolution — the ONE canonical shell seam ───────────
//
//  Every shell that resolves a template string (section title/label/subtitle/
//  prependLabel, geograph label, page-header badge, methodology note, …) must
//  bind `resolveTemplate` (the @statdash/engine primitive) to a RenderContext
//  in EXACTLY one way. Before this seam each shell hand-rolled the param merge
//  and the `{`-guard inconsistently — some merged ctx.vars, some merged only
//  ctx.filterParams, some merged nothing — which was both a DRY violation and a
//  latent correctness bug (vars-templated labels silently failed to resolve in
//  geograph/page-header/prependLabel).
//
//  Canonical contract:
//    • params are ALWAYS `{ ...ctx.filterParams, ...ctx.vars }` — node.vars and
//      RepeatShell flat vars (account_label, …) resolve everywhere, every time.
//    • a template with no `{` (or undefined) short-circuits to the input — no
//      regex work, undefined stays undefined.
//
//  Two surfaces, one behavior:
//    resolveNodeTemplate(tpl, sectionCtx, params) — pure util; for non-hook
//      call-sites that already hold sectionCtx + params (e.g. SectionMethodology,
//      which receives them as props). Reusable outside React.
//    useNodeTemplate(ctx) — convenience that derives the canonical params from a
//      RenderContext once and returns resolve(tpl?) => string | undefined.
//
//  The helper carries ZERO element-specific knowledge — it knows only the
//  RenderContext param contract, never any node's fields.
//

import { resolveTemplate } from '@statdash/engine'
import type { SectionContext } from '@statdash/engine'
import type { RenderContext } from '../types/context'

// ── resolveNodeTemplate — pure, context-param-bound resolver ───────────
//
//  Cheap guard first: undefined passes through as undefined; a string with no
//  `{` passes through unchanged (no regex). Only `{…}`-bearing strings hit the
//  engine primitive. `{ year, range }` union templates always resolve (the
//  primitive selects by ctx.timeMode) — they have no string form to guard on.
//
export function resolveNodeTemplate(
  tpl:    string | { year: string; range: string } | undefined,
  sectionCtx: SectionContext,
  params: Record<string, unknown>,
): string | undefined {
  if (tpl === undefined) return undefined
  if (typeof tpl === 'string' && !tpl.includes('{')) return tpl
  return resolveTemplate(tpl, sectionCtx, params)
}

// ── useNodeTemplate — bind resolveNodeTemplate to a RenderContext ──────
//
//  Returns `resolve(tpl?)` that applies the canonical
//  `{ ...ctx.filterParams, ...ctx.vars }` param merge every call. Not a React
//  hook in the rules-of-hooks sense (no hook calls inside) — named `use*` for
//  ergonomics in shell components; safe to call unconditionally.
//
export function useNodeTemplate(
  ctx: RenderContext,
): (tpl?: string | { year: string; range: string }) => string | undefined {
  const params = { ...ctx.filterParams, ...ctx.vars }
  return (tpl) => resolveNodeTemplate(tpl, ctx.sectionCtx, params)
}

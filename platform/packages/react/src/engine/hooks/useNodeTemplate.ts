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
import type { SectionContext, LocaleString } from '@statdash/engine'
import type { RenderContext } from '../types/context'

// The template carrier a shell may hand the resolver: a LocaleString ({ ka, en } or
// a plain string) OR the `{ year, range }` perspective union. resolveTemplate
// collapses whichever carrier to a single string (active locale / perspective) before
// expanding `{key}` vars — so a shell never has to pre-resolve the i18n bag.
type TemplateCarrier = LocaleString | { year: string; range: string }

// ── resolveNodeTemplate — pure, context-param-bound resolver ───────────
//
//  Cheap guard first: undefined passes through as undefined; a string with no
//  `{` passes through unchanged (no regex). Only `{…}`-bearing strings hit the
//  engine primitive. `{ year, range }` union templates always resolve (the
//  primitive selects by the active perspective) — they have no string form to guard on.
//
// A definite template (string or {year,range}) ALWAYS resolves to a string;
// only an `undefined` input yields `undefined`. The overloads make that precise
// so callers resolving a REQUIRED field (e.g. section title: string) get a
// `string` back with no non-null assertion. resolveTemplate returns `string`,
// and the no-`{` short-circuit returns the input string — both string for a
// string input — so the narrowed signature is sound.
export function resolveNodeTemplate(
  tpl:    TemplateCarrier,
  sectionCtx: SectionContext,
  params: Record<string, unknown>,
): string
export function resolveNodeTemplate(
  tpl:    TemplateCarrier | undefined,
  sectionCtx: SectionContext,
  params: Record<string, unknown>,
): string | undefined
export function resolveNodeTemplate(
  tpl:    TemplateCarrier | undefined,
  sectionCtx: SectionContext,
  params: Record<string, unknown>,
): string | undefined {
  if (tpl === undefined) return undefined
  // Fast path: a plain string with no `{` needs no work. An object carrier (LocaleString
  // or {year,range}) always goes to resolveTemplate, which collapses + expands it.
  if (typeof tpl === 'string' && !tpl.includes('{')) return tpl
  return resolveTemplate(tpl, sectionCtx, params)
}

// The bound resolver mirrors resolveNodeTemplate's overloads: a definite
// template → string, an optional/absent one → string | undefined.
export interface NodeTemplateResolver {
  (tpl:  TemplateCarrier): string
  (tpl?: TemplateCarrier): string | undefined
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
): NodeTemplateResolver {
  const params = { ...ctx.filterParams, ...ctx.vars }
  return ((tpl?: TemplateCarrier) =>
    resolveNodeTemplate(tpl, ctx.sectionCtx, params)) as NodeTemplateResolver
}

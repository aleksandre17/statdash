// ── projectPresentation — the generic projection pass (SSOT) [N-ADR-0029 v2] ──
//
//  The ONE loop both render paths share (SiteRenderer + renderPageToHTML). For
//  each registered projector: read the page's raw value for that key, evaluate()
//  it (reusing the injected evalVarMap closure — find/breadcrumbs unchanged),
//  and project() it into the sink. The caller applies the sink generically
//  (cssVars on the wrapper, nav merged into navContext) and knows NO concern.
//
//  Adding a presentation concern requires ZERO edits here — the loop names no
//  concern. It only knows the protocol: evaluate → project.
//

import type { PagePresentation }              from '../types/node'
import { listPresentationProjectors }         from './presentationRegistry'
import type { PresentationSink, ProjectorEvalCtx, EvalExpr } from './PresentationProjector'

/**
 * Run every registered projector over a page's presentation contributions.
 *
 * @param presentation  The page's `presentation` bag (raw, per-key values). May be undefined.
 * @param evalExpr      The evalVarMap-bound closure injected by the caller.
 * @param evalCtx       Read-only render state a projector may consult.
 * @returns             A PresentationSink the caller applies generically.
 */
export function projectPresentation(
  presentation: PagePresentation | undefined,
  evalExpr:     EvalExpr,
  evalCtx:      ProjectorEvalCtx,
): PresentationSink {
  const sink: PresentationSink = { cssVars: {}, nav: {} }
  const pres = presentation ?? {}
  for (const proj of listPresentationProjectors()) {
    const out = proj.evaluate(pres[proj.key], evalExpr, evalCtx)
    if (out !== undefined) proj.project(out, sink)
  }
  return sink
}

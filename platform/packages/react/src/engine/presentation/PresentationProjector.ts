// ── PresentationProjector — the presentation-projection contract [N-ADR-0029 v2] ──
//
//  A page's presentation is a list of declarative contributions. Each one names
//  a registered PROJECTOR capability — a typed, registered unit that declares
//  three things and NOTHING more:
//
//    1. key + schema — its config key under `page.presentation` (also its
//       PropSchema field name; Constructor-authorable, never a magic string).
//    2. evaluate     — how to turn its raw page value into a resolved value.
//       Data-driven projectors reuse the EXISTING evalVarMap / VarExpr machinery
//       (injected as `evalExpr`), so `op:'find'` / `op:'breadcrumbs'` keep working
//       unchanged — no new grammar.
//    3. project      — its TARGET: how the resolved value is applied to the render
//       output (a CSS custom property, a navContext patch, …).
//
//  The renderer becomes a generic visitor over the registry: for each registered
//  projector it reads the page's raw value for that key, evaluate()s it, and
//  project()s it into a PresentationSink accumulator. The renderer knows the
//  PROTOCOL (evaluate → project), never any CONCERN. A new concern = a new
//  registration, ZERO renderer edits (OCP / Law 8 M-5 / Law 1).
//
//  Layer: engine-react infrastructure — same tier as storeManifest.ts /
//  middlewareRegistry. Respects the arrow (imports only inward: react/core types).
//

import type { VarExpr }       from '../types/node'
import type { PropField }     from '../slice-meta'
import type { RenderContext } from '../types/context'

/** The evaluated, JSON-ish value a projector produces from its raw page value. */
export type ProjectedValue = unknown

/**
 * What a projector writes into. The renderer owns this accumulator and is the
 * ONLY thing that reads it back — projectors never touch React or the DOM.
 * The channel set is bounded and named; a new TARGET (e.g. a `<meta>` tag) is
 * an additive field here, applied generically by the renderer — never a
 * per-concern branch. (Same shape as adding a target to RenderTarget.)
 */
export interface PresentationSink {
  /** CSS custom properties set on the page wrapper div (e.g. the page-color var). */
  cssVars: Record<string, string>
  /** Patch merged into ctx.navContext (e.g. { crumbs }). */
  nav:     Record<string, unknown>
}

/**
 * The slice of render state a projector may read while evaluating (read-only).
 * Carries the same fields evalVarMap consumes — nothing more. A projector's raw
 * value comes from `page.presentation[key]` (its single authored home); there is
 * no privileged flat-field fallback channel (the legacy `PageConfigBase.color`
 * was retired into `presentation.color` by the v1→v2 migration).
 */
export type ProjectorEvalCtx = Pick<RenderContext, 'filterParams' | 'stores' | 'pageStoreKey'>

/** Evaluator injected into a projector — the SiteRenderer-bound evalVarMap
 *  closure. A projector reuses the SAME VarExpr machinery (find/breadcrumbs)
 *  without importing React state. A pure-literal projector may ignore it. */
export type EvalExpr = (e: VarExpr) => unknown

/**
 * A registered presentation capability. The thin contract is the SAME for every
 * concern; each concern's specifics (its `--…` var name, its runtime guard, its
 * literal-vs-expr handling) live INSIDE its own projector, behind the registry.
 */
export interface PresentationProjector<Raw = unknown, Out = ProjectedValue> {
  /** Config key under page.presentation (also the PropSchema field name). */
  key: string
  /** Constructor-authorable schema for this concern (one or more PropFields). */
  schema(): PropField[]
  /**
   * Resolve the raw authored value to its projected value. `evalExpr` is the
   * injected evalVarMap closure (data-driven find/breadcrumbs keep working).
   * Return `undefined` to contribute nothing.
   */
  evaluate(raw: Raw, evalExpr: EvalExpr, ctx: ProjectorEvalCtx): Out | undefined
  /** Apply the resolved value to the sink. Pure; no side effects beyond `sink`. */
  project(value: Out, sink: PresentationSink): void
}

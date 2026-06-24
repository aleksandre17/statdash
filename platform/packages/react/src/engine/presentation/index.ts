// ── presentation — the Presentation-Projection Registry barrel [N-ADR-0029 v2] ──
//
//  Public surface of the presentation seam: the projector contract, the open
//  registry (register/list/schema), the generic sink, and the shared projection
//  pass. Concrete projectors (color, crumbs, …) live in @statdash/plugins and
//  register at app boot — none ship here (engine stays app-agnostic, Law 3).
//

export type {
  PresentationProjector,
  PresentationSink,
  ProjectorEvalCtx,
  ProjectedValue,
  EvalExpr,
}                                       from './PresentationProjector'
export {
  registerPresentationProjector,
  listPresentationProjectors,
  presentationPropSchema,
}                                       from './presentationRegistry'
export { projectPresentation }          from './projectPresentation'

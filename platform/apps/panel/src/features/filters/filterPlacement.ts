// ── filterPlacement — the page filter pipeline's SHAPE, derived (AR-49 SL-5) ────
//
//  The Placement Law (`studio/placement`) is DOMAIN-FREE: it weighs an abstract
//  `SubjectShape` and maps scope × weight → container. It does NOT know what a
//  FilterSchema is. So the translation from the filter authoring model to that
//  abstract shape lives HERE, in the consumer that owns the schema (the filters
//  feature) — never in the pure kernel. This mirrors the SL-4 pattern exactly
//  (`inspector/controls/nestedItemPlacement.schemaSubjectShape`): the owner of the
//  schema declares its structural facts; the LAW decides where it lands.
//
//  ── Why the page filter pipeline is WORKSPACE-weight (§3.1 rich type) ───────────
//  The whole `page.meta.filterSchema` is a FilterSchemaInput — a whole engine
//  sub-document (bars → controls → ParamDefs, plus crossValidate / context /
//  computed). That is exactly the §3.1 "rich type" category (alongside DataSpec /
//  ChartDef): a subject dominated by a rich sub-document is WORKSPACE-weight
//  REGARDLESS of breadth — it needs its own screen, not a dock slot. So the moment
//  the pipeline carries any bar to author, it is `hasRichType` → oversize →
//  `resolveSurface('page', …) === 'focus-view'`: it escalates OUT of the page dock
//  instead of stacking every bar's every control fully-expanded beneath the page
//  panes (the reported cram — FF-NO-CRAMMED-DOCK). An ABSENT pipeline (no bars) is
//  not yet a subject to author: it weighs flat (the light in-dock "no bars yet"
//  stub). This is EXISTENCE-gated, not breadth-as-magnitude — one bar and fifty
//  bars both escalate; only nothing-to-author stays in the dock.
//
//  No per-type placement literal: the container is derived from `deriveWeight`, never
//  a hardcoded `if (subject === 'filters') → focus-view`.
//
import { placeSubject, type Container, type SubjectShape } from '../../studio/placement'
import type { BarView } from './filterSchemaModel'

/** The page filter pipeline's abstract shape. A populated FilterSchema is a §3.1 rich
 *  engine sub-document (workspace-weight regardless of breadth); an empty/absent one is
 *  a flat stub. The law never names FilterSchema — this consumer maps its own type onto
 *  the abstract `hasRichType` flag. */
export function filterPipelineShape(bars: BarView[]): SubjectShape {
  return { flatFields: bars.length, hasRichType: bars.length > 0 }
}

/** Where the page filter pipeline belongs — the derived Placement Law verdict (page scope).
 *  `'focus-view'` ⇒ escalate OUT of the dock; anything lighter ⇒ the in-dock stub. */
export function filtersPipelineContainer(bars: BarView[]): Container {
  return placeSubject('page', filterPipelineShape(bars))
}

/** True when the page filter pipeline is workspace-weight and must escalate to a
 *  focus-view rather than stack in the bounded page dock (FF-NO-CRAMMED-DOCK). */
export function shouldEscalateFilters(bars: BarView[]): boolean {
  return filtersPipelineContainer(bars) === 'focus-view'
}

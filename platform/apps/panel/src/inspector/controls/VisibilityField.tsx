// ── VisibilityField — the VISIBILITY facet control (PropFieldType 'visibility') ───
//
//  The fifth (final) FACET control, sibling of StyleField / DataFacetField / EventsField:
//  it authors an element's `view.visibleWhen: VisibilityExpr` in place — the conditional-
//  visibility half of Gap 2 (SPEC-deep-authorability-completion), completing the FACET
//  axis (content·style·data·events·visibility·chrome). Registered in FieldControlRegistry
//  under `type:'visibility'`, so the generic Inspector dispatches the VISIBILITY facet's
//  `contract` field to it (genericity in the DISPATCH — a rich facet resolves to a rich
//  editor, exactly like Webflow/Framer/Builder.io project a fixed "Conditions" tab per
//  element).
//
//  FOLD, not parallel: this control REUSES the existing `VisibilitySection` recursive
//  builder verbatim — the hand-wired `element.visibility` dock section is DELETED and
//  re-homed as this facet projection (the peer of how the DATA facet folded the old
//  `element.data` metric-bind). NO second visibility surface, NO forked evaluator: the
//  authored value is the SAME `VisibilityExpr` `renderNode`/`evalVisibility` already
//  interprets at render (zero new runtime). `heading={false}` — the generic Inspector
//  renders the facet's field label as the single section heading (DRY).
//
//  Controlled component: value in (the current VisibilityExpr | undefined), onChange out
//  (the next expr, or undefined to clear — always visible). The Inspector owns the store
//  write (patchProp at the facet's `view.visibleWhen` readPath), composing with undo/redo.
//
import type { VisibilityExpr } from '@statdash/engine'
import type { FieldControlProps } from '../fieldControl.types'
import { VisibilitySection } from '../../features/visibility'

export function VisibilityField({ value, onChange }: FieldControlProps) {
  return (
    <VisibilitySection
      value={value as VisibilityExpr | undefined}
      onChange={(next) => onChange(next)}
      heading={false}
    />
  )
}

// ── DockBody — the dock body, concern-grouped for a whole element (REFINE canon) ──
//
//  Two composition modes, one grammar:
//   • WHOLE ELEMENT selected (a page node) → the CONCERN-GROUPED surface (root Law 11):
//     every declared field + facet projected into CONTENT · DATA · STYLE · LAYOUT ·
//     BEHAVIOR, collapsible + progressive (see `ConcernGroupedInspector`). This is the
//     owner's REFINE moment — a calm, legible dock, not a flat property dump.
//   • EVERYTHING ELSE (a bounded PART drill, the site-frame chrome composition, the PAGE
//     context) → the applicable `dockSectionRegistry` sections, joined by ONE token'd
//     divider grammar. A section that renders null contributes nothing (no stray rule).
//
//  The registry stays the SSOT of what sections EXIST (its shape + plane-filtering are
//  proven by dockSection / planeProjection fitness); the whole-node branch simply
//  COMPOSES those declarations by concern instead of stacking them flat. A bounded
//  Strangler seam — the part-drill / page paths are byte-identical; deleting the branch
//  restores the flat stack (reversible).
//
import { Fragment } from 'react'
import { dockSectionRegistry, type DockRenderCtx } from './dockSection'
import { ConcernGroupedInspector } from '../ConcernGroupedInspector'

/** A whole page node is the active selection (not a bounded part drill). */
function isWholeNode(ctx: DockRenderCtx): boolean {
  return ctx.scope === 'element'
    && !!ctx.controller.selected
    && !ctx.controller.selectedBand
}

export function DockBody({ ctx }: { ctx: DockRenderCtx }) {
  // ── Whole-node → the concern-grouped REFINE surface ─────────────────────────────
  if (isWholeNode(ctx)) {
    return (
      <div className="studio-dock__sections">
        <ConcernGroupedInspector
          node={ctx.controller.selected!}
          controller={ctx.controller}
          locale={ctx.locale}
          role={ctx.role}
        />
      </div>
    )
  }

  // ── Part drill / chrome composition / page → the registry sections (token'd rule) ─
  const rendered = dockSectionRegistry
    .list(ctx)
    .map((s) => ({ id: s.id, node: s.render(ctx) }))
    .filter((r): r is { id: string; node: NonNullable<typeof r.node> } => r.node != null)

  return (
    <div className="studio-dock__sections">
      {rendered.map((r, i) => (
        <Fragment key={r.id}>
          {i > 0 && <hr className="studio-dock__rule" />}
          <div data-dock-section={r.id}>{r.node}</div>
        </Fragment>
      ))}
    </div>
  )
}

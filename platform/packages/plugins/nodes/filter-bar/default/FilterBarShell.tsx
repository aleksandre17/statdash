import './filter-bar.css'
import type { ReactNode }                                    from 'react'
import { evalWhen, evalVisibility }                          from '@statdash/engine'
import type { BarNode, ParamNode }                           from '@statdash/engine'
import { filterControlRegistry, useFiltersContext, PartAnchor } from '@statdash/react/engine'
import type { NodeRenderer, RenderContext }                  from '@statdash/react/engine'
import { useT }                                              from '@statdash/react'
import type { FilterBarNode }                               from './FilterBarNode'

// A select param may declare itself the `from`/`to` endpoint of a year-span window
// (the dynamics fromYear/toYear pair). The two params stay INDEPENDENT `type:'select'`
// filters — each keeps its own options, default, ctx-key write, and perspective gate,
// so the two-key filter pipeline is untouched — the bar merely COMPOSES their render
// into one localized template by wrapping each endpoint with connector words.
type SpanRole = 'from' | 'to'
const spanRoleOf = (item: ParamNode): SpanRole | undefined =>
  (item as { spanRole?: SpanRole }).spanRole

export const FilterBarShell: NodeRenderer<FilterBarNode> = (def, ctx, _children) =>
  <FilterBarControl def={def} ctx={ctx} />

function FilterBarControl({ def, ctx }: { def: FilterBarNode; ctx: RenderContext }) {
  const { bars } = useFiltersContext()
  const t  = useT('filter-bar')
  const fp = ctx.filterParams as Record<string, string>
  // Active perspective ids — the SAME SSOT renderNode reads for node `visibleWhen`
  // (ctx.sectionCtx.perspectiveState). Threaded here so a filter ITEM can be scoped
  // to a perspective (e.g. year-selector only in `year`, from/to only in `range`)
  // via the canonical `perspective-is` op — render-only, never default resolution.
  const perspectiveState = ctx.sectionCtx.perspectiveState

  const visible = def.barIds
    ? bars.filter((b: BarNode) => def.barIds!.includes(b.id ?? ''))
    : bars

  if (visible.length === 0) return null

  return (
    <>
      {visible.map((bar: BarNode, i: number) => {
        if (bar.showWhen && !evalWhen(bar.showWhen, fp)) return null
        return (
          <div
            key={bar.id ?? i}
            className="filter-bar"
            data-position={bar.position ?? 'sticky'}
            style={{ order: bar.order }}
          >
            {(() => {
              // Render items in order, but COLLECT a contiguous run of span endpoints
              // (from→to) into ONE `.filter-span-group` wrapper. The group is a single
              // non-wrapping, non-shrinking flex unit, so `[from-sel] დან [to-sel] მდე`
              // ALWAYS stays side-by-side on one line — even inside a wrapping (`--strip`)
              // bar where the two endpoints would otherwise break across rows.
              const out:  ReactNode[] = []
              let   span: ReactNode[] = []
              const flushSpan = () => {
                if (span.length) {
                  out.push(<span key={`span-group-${out.length}`} className="filter-span-group">{span}</span>)
                  span = []
                }
              }
              bar.items.forEach((item, itemIndex) => {
                // Perspective-scoped item visibility [P5.1] — render-only gate, mirrors
                // node `view.visibleWhen`. Skip the control when its expr is false against
                // the active perspectiveState. Default resolution is UNAFFECTED (it gates
                // on the P4.5 ownership seam in useFilterState).
                if (item.visibleWhen && !evalVisibility(item.visibleWhen, fp, perspectiveState))
                  return
                const slice = filterControlRegistry.get(item.type)
                if (!slice) return
                // ── Bounded-part anchor (ADR-041 · the ONE PartAnchor) ──────────────
                //  Wrap each rendered control in the ONE generic PartAnchor keyed by its
                //  (bar.id, item index) coordinate — the SAME primitive kpi-strip cards
                //  use. Layout-inert (display:contents) and ON only inside the
                //  authoring canvas; a zero-DOM Fragment on the live site, so runtime
                //  output stays byte-identical. The overlay frames each control by this
                //  anchor with NO filter-specific marker. The index is the control's true
                //  position in `bar.items` — it matches the page filterSchema enumeration
                //  order (toBarViews), so the selected frame maps to the right ParamDef
                //  even when a hidden/perspective-gated control is skipped from render.
                // Non-endpoint controls render exactly as before (byte-identical off-canvas
                // — PartAnchor is a zero-DOM keyed Fragment when not authoring).
                const role = spanRoleOf(item)
                if (!role) {
                  const el = (
                    <PartAnchor key={item.key} field={bar.id ?? ''} index={itemIndex}>
                      <slice.Shell filterKey={item.key} config={item} />
                    </PartAnchor>
                  )
                  // A `hidden` param renders nothing (HiddenShell → null), so it must NOT
                  // break a contiguous from→to run: keep it inside the open span buffer
                  // (harmless null) so the two endpoints stay in ONE group even when a
                  // hidden carrier sits between them.
                  if (item.type === 'hidden') (span.length ? span : out).push(el)
                  else { flushSpan(); out.push(el) }
                  return
                }
                // from→to span endpoint — wrap the select in localized connector words
                // ([lead] <select> [trail]). Empty slots (per locale/role) render nothing,
                // so ONE grammar yields ka "[from] დან [to] მდე" and en "from [x] to [y]".
                const lead  = t(`span-${role}-lead`)
                const trail = t(`span-${role}-trail`)
                span.push(
                  <span key={item.key} className="filter-span-endpoint" data-span-role={role}>
                    {lead  && <span className="filter-range-word">{lead}</span>}
                    <PartAnchor field={bar.id ?? ''} index={itemIndex}>
                      <slice.Shell filterKey={item.key} config={item} />
                    </PartAnchor>
                    {trail && <span className="filter-range-word">{trail}</span>}
                  </span>,
                )
              })
              flushSpan()
              return out
            })()}
          </div>
        )
      })}
    </>
  )
}
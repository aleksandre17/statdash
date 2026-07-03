import './section.css'

import { resolveViewState }                                  from '@statdash/styles'
import { useT, useExtensions, SECTION_HEADER_ACTIONS }       from '@statdash/react'
import { defineShell, useViewToggle, useCollapsible, useDisclosure, accentStyle, useNodeTemplate, mergePlacement, useNodeStatusScope, NodeStatusProvider } from '@statdash/react/engine'
import type { ShellProps, NodeDef }                          from '@statdash/react/engine'
import type { SectionNode }                                  from './SectionNode'
import { META }                                              from './meta'
import { SECTION }                                           from './styleKeys'
import { SectionHeader }                                     from './SectionHeader'
import { SectionMethodology }                                from './SectionMethodology'

// ── Empty-state policy (ADR, inline) ──────────────────────────────────
//
//  DECISION: Option D — panel-level empty state, NO section-level data
//  awareness. A section is a STRUCTURAL container; panels are the DATA
//  containers. Each panel shell (chart/table/map) already owns its own
//  <EmptyState/> when interpretSpec returns []. The section never inspects
//  ctx.rows of its children — that is the Grafana row/panel model and keeps
//  the section's single responsibility (layout + collapse + view-toggle).
//
//  Why not the alternatives:
//   • Option B (NodeStatusContext status bus): the "real" aggregate solution,
//     but it couples the structural container to child data state and adds a
//     cross-cutting context that has exactly ZERO second consumers today
//     (no "collapse when all panels empty", no export-disable-on-empty).
//     Speculative generality (YAGNI). The seam to add it later is marked below.
//   • Option C (def.view.emptyMessage): opt-in only; never fires automatically
//     and adds schema surface speculatively.
//
//  The ONE section-level check that is legitimate is STRUCTURAL, not data:
//  a section authored with zero children is an empty structural container.
//  That guard (below) inspects children.defs — never panel rows — so the
//  data/structure boundary stays intact.
//
//  PROTECTED VARIATIONS seam — NOW ACTIVATED (AR-39): the reserved
//  NodeStatusContext is introduced for its intended reason — a real aggregate-
//  status consumer appeared (data-integrity consolidation). Child data panels
//  PUBLISH their preliminary NodeStatus; the section SUBSCRIBES and folds them
//  into ONE header indicator. The empty-state boundary is untouched — the section
//  receives a *reported status*, never reads child ctx.rows, so Option D's
//  data/structure separation stands. (A rows-aggregation consumer, e.g.
//  section-level export, remains deferred — YAGNI.)
//
export const SectionShell = defineShell<SectionNode>({
  // The slice's DECLARED variants (meta.ts). defineShell resolves them against
  // def.variants into `variantAttrs` (data-* attrs); the shell only chooses WHICH
  // element carries them — it writes ZERO variant→class logic.
  variants: META.variants,
  render({ def, ctx, children, vs, placement, merged, variantAttrs }) {
    return <SectionControl def={def} ctx={ctx} children={children} vs={vs} placement={placement} merged={merged} variantAttrs={variantAttrs} />
  },
})

function SectionControl({
  def,
  ctx,
  children,
  vs,
  placement,
  merged,
  variantAttrs,
}: ShellProps<SectionNode>) {
  const t = useT('section')

  // Canonical template resolver — binds resolveTemplate to this ctx with the
  // standard { ...filterParams, ...vars } merge so node.vars-derived variables
  // and RepeatShell flat vars (e.g. account_label, account_code) resolve.
  const resolve = useNodeTemplate(ctx)

  // Resolve id/title through the template engine so Repeat-injected vars work
  // (e.g. id: 'account-{account_code}', title: '{account_label}').
  // resolvedId MUST be computed before useViewToggle/useGlobalVar so the
  // GlobalState key is unique per Repeat iteration.
  const resolvedId = resolve(def.id)
  const title      = resolve(def.title)
  const label      = resolve(def.label)
  const subtitle   = resolve(merged.subtitle)

  const viewToggle  = useViewToggle(children.defs, 'section', resolvedId, merged.toggle)
  const collapsible = useCollapsible(merged.defaultOpen, merged.noCollapse)

  const info = useDisclosure()

  // ── AR-39 — section-scoped data-integrity aggregation ──────────────────────
  //  The section is the information expert for its panels' aggregate provenance:
  //  child data panels PUBLISH their resolved preliminary status via the scope
  //  collector (they hold ctx.rows — the section never reads child rows), and the
  //  section OR-folds them (plus an explicit author override) into ONE indicator.
  const { collector, aggregate } = useNodeStatusScope()
  const preliminary = aggregate.preliminary || def.methodology?.preliminary === true

  const sectionActions = useExtensions(ctx.extensions, SECTION_HEADER_ACTIONS, {
    sectionId:      resolvedId,
    hasMethodology: !!def.methodology,
  })

  const outerStyle = mergePlacement(vs.panel.style, placement)

  return (
    <div {...vs.panel} style={outerStyle}>
      {def.prependLabel && (
        <div className={SECTION.drillLabel}>
          {resolve(def.prependLabel)}
        </div>
      )}
      <section
        className={SECTION.block}
        {...variantAttrs}
        id={def.anchor ?? resolvedId}
        style={accentStyle(def.color)}
      >
        <SectionHeader
          headProps={collapsible.headProps}
          open={collapsible.open}
          canCollapse={collapsible.canCollapse}
          title={title}
          label={label}
          subtitle={subtitle}
          viewToggle={viewToggle}
          actions={sectionActions}
          hasMethodology={!!def.methodology}
          preliminary={preliminary}
          infoOpen={info.open}
          onToggleInfo={info.toggle}
          t={t}
        />

        {(def.methodology || preliminary) && info.open && (
          <SectionMethodology
            methodology={def.methodology}
            preliminary={preliminary}
            resolve={resolve}
            onClose={info.close}
            t={t}
          />
        )}

        {/* TODO(export): wire ExportBar here when a section-aggregate-ROWS mechanism exists.
            Decision: Option C (defer). A section is a structural container; it has no
            ctx.rows of its own, and per-panel export belongs in each panel's shell
            (TableShell / ChartShell). The NodeStatusContext seam now DOES exist (AR-39,
            below) but publishes derived STATUS, not rows — a rows-aggregation channel is a
            separate, still-unneeded consumer (YAGNI). */}

        {(merged.noCollapse || collapsible.open) && (
          // NodeStatusProvider makes this section the publish scope for its child
          // panels (AR-39): each data panel reports its preliminary status here
          // instead of rendering its own pill. Wraps the body only — the header
          // reads the folded aggregate directly (same component), no context round-trip.
          <NodeStatusProvider collector={collector}>
            <div className={SECTION.body} {...vs.body}>
              {children.defs.map((d: NodeDef, i: number) => (
                <div key={i} className={SECTION.view} {...resolveViewState(viewToggle.isHidden(d))}>
                  {children.rendered[i]}
                </div>
              ))}
            </div>
          </NodeStatusProvider>
        )}
      </section>
    </div>
  )
}

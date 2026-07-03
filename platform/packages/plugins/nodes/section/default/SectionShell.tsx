import './section.css'

import { resolveViewState }                                  from '@statdash/styles'
import { useT, useExtensions, SECTION_HEADER_ACTIONS }       from '@statdash/react'
import { defineShell, useViewToggle, useCollapsible, useDisclosure, accentStyle, useNodeTemplate, mergePlacement } from '@statdash/react/engine'
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
//  DATA-INTEGRITY SCOPE — the section is NO LONGER the subscriber (AR-40): the
//  page-wide preliminary fold moved UP to the page root (inner-page owns the
//  scope; the page header renders the ONE indicator). Child panels still publish
//  their status upward via useReportNodeStatus — with no section-level provider
//  they now report straight to the page scope. The section stays a pure
//  structural container: no scope, no aggregate read, no per-section indicator.
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
          infoOpen={info.open}
          onToggleInfo={info.toggle}
          t={t}
        />

        {def.methodology && info.open && (
          <SectionMethodology
            methodology={def.methodology}
            resolve={resolve}
            onClose={info.close}
            t={t}
          />
        )}

        {/* TODO(export): wire ExportBar here when a section-aggregate-ROWS mechanism exists.
            Decision: Option C (defer). A section is a structural container; it has no
            ctx.rows of its own, and per-panel export belongs in each panel's shell
            (TableShell / ChartShell). The data-integrity STATUS channel exists at the
            PAGE scope (AR-40); a rows-aggregation channel is a separate, still-unneeded
            consumer (YAGNI). */}

        {(merged.noCollapse || collapsible.open) && (
          // No section-level status provider (AR-40): child panels publish straight
          // to the PAGE scope, so the section renders its body as a pure structural
          // container.
          <div className={SECTION.body} {...vs.body}>
            {children.defs.map((d: NodeDef, i: number) => (
              <div key={i} className={SECTION.view} {...resolveViewState(viewToggle.isHidden(d))}>
                {children.rendered[i]}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

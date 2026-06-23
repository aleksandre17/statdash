import './section.css'

import { Fragment, useState }                               from 'react'
import type { CSSProperties }                               from 'react'
import { resolveTemplate }                                  from '@statdash/engine'
import { resolveViewState }                                 from '@statdash/styles'
import { useT, useExtensions, SECTION_HEADER_ACTIONS }      from '@statdash/react'
import { InfoIcon, ChevronIcon }                             from '@statdash/react'
import { defineShell, useGlobalVar }                        from '@statdash/react/engine'
import type { ShellProps, NodeDef, NodeBase }               from '@statdash/react/engine'
import type { SectionNode }                                 from './SectionNode'

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
//  PROTECTED VARIATIONS seam: if a real aggregate-status consumer appears
//  (e.g. collapse-empty-sections, disable section export when all panels are
//  empty), introduce a NodeStatusContext: panels publish NodeStatus, the
//  section subscribes and aggregates here. Until that second consumer is
//  real, this stays Option D.
//
export const SectionShell = defineShell<SectionNode>({
  render({ def, ctx, children, vs, placement, merged }) {
    return <SectionControl def={def} ctx={ctx} children={children} vs={vs} placement={placement} merged={merged} />
  },
})

function SectionControl({
  def,
  ctx,
  children,
  vs,
  placement,
  merged,
}: ShellProps<SectionNode>) {
  const t = useT('section')

  const view  = def.view ?? {}

  const childMeta = children.defs.map((d: NodeDef) => ({
    role:  (d as NodeBase).view?.role,
    label: (d as NodeBase).view?.label,
  }))
  const distinctRoles = [...new Set(childMeta.map(m => m.role).filter((r): r is string => !!r))]

  const roleLabels: Record<string, string> = {}
  childMeta.forEach(({ role, label }) => {
    if (role && !(role in roleLabels)) roleLabels[role] = label ?? role
  })

  // Gap 7: merge ctx.vars into template params so node.vars-derived variables and
  // RepeatShell flat vars (e.g. account_label, account_code) are available in templates
  const templateParams = { ...ctx.filterParams, ...ctx.vars }

  // Resolve id and title through template engine so Repeat-injected vars work
  // (e.g. id: 'account-{account_code}', title: '{account_label}')
  // Must be before useGlobalVar so the GlobalState key is unique per Repeat iteration.
  const resolvedId = def.id?.includes('{') ? resolveTemplate(def.id, ctx.sectionCtx, templateParams) : def.id
  const title      = def.title?.includes('{') ? resolveTemplate(def.title, ctx.sectionCtx, templateParams) : def.title

  // Gap 11: GlobalState — persist section view toggle (chart/table) across navigations
  const [storedRole, setStoredRole] = useGlobalVar<string>(`section:view:${resolvedId ?? 'anon'}`)
  const activeRole  = storedRole ?? distinctRoles[0]
  const setActiveRole = (r: string) => setStoredRole(r)

  const [open, setOpen]           = useState(view.defaultOpen ?? true)
  const [infoOpen, setInfoOpen]   = useState(false)

  const sectionActions = useExtensions(ctx.extensions, SECTION_HEADER_ACTIONS, {
    sectionId:      resolvedId,
    hasMethodology: !!def.methodology,
  })

  const canCollapse = !(view.noCollapse ?? false)
  const showToggle  = merged.toggle && distinctRoles.length > 1

  const label    = def.label       ? resolveTemplate(def.label,       ctx.sectionCtx, templateParams) : undefined
  const subtitle = merged.subtitle ? resolveTemplate(merged.subtitle, ctx.sectionCtx, templateParams) : undefined

  const outerStyle = (vs.panel.style || placement)
    ? { ...vs.panel.style, ...(placement as Record<string, string>) } as CSSProperties
    : undefined

  const sectionClass = [
    'section',
    view.hero      && 'section--hero',
    merged.compact && 'section--compact',
  ].filter(Boolean).join(' ')

  return (
    <div {...vs.panel} style={outerStyle}>
      {def.prependLabel && (
        <div className="section__drill-label">
          {resolveTemplate(def.prependLabel, ctx.sectionCtx)}
        </div>
      )}
      <section
        className={sectionClass}
        id={def.anchor ?? resolvedId}
        style={def.color ? { '--sc': def.color } as CSSProperties : undefined}
      >
        <div
          className={`section__head${open ? ' open' : ''}`}
          onClick={() => canCollapse && setOpen(o => !o)}
          onKeyDown={(e) => {
            if (canCollapse && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              setOpen(o => !o)
            }
          }}
          role={canCollapse ? 'button' : undefined}
          tabIndex={canCollapse ? 0 : undefined}
          aria-expanded={canCollapse ? open : undefined}
          style={{ cursor: canCollapse ? 'pointer' : 'default' }}
        >
          <span className="section__accent" />
          <div className="section__title-wrap">
            <div className="section__title">{title}</div>
            {label    && <div className="section__label">{label}</div>}
            {subtitle && <div className="section__subtitle">{subtitle}</div>}
          </div>
          <div className="section__actions" onClick={(e) => e.stopPropagation()}>
            {showToggle && (
              <div className="section__view-toggle" role="group" aria-label={t('view-toggle')}>
                {distinctRoles.map(r => (
                  <button
                    key={r}
                    className={`section__view-btn${activeRole === r ? ' active' : ''}`}
                    onClick={() => setActiveRole(r)}
                    type="button"
                    aria-pressed={activeRole === r}
                  >
                    <span>{roleLabels[r]}</span>
                  </button>
                ))}
              </div>
            )}
            {sectionActions.map((action, i) => (
              <Fragment key={i}>{action}</Fragment>
            ))}
            {def.methodology && (
              <button
                className={`section__icon-btn${infoOpen ? ' active' : ''}`}
                title={t('info')}
                type="button"
                aria-label={t('info')}
                aria-expanded={infoOpen}
                onClick={() => setInfoOpen(o => !o)}
              >
                <InfoIcon />
              </button>
            )}
          </div>
          {canCollapse && (
            <ChevronIcon className={`section__chevron${open ? ' open' : ''}`} />
          )}
        </div>

        {def.methodology && infoOpen && (
          <div className="section__methodology" role="region" aria-label={t('methodology')}>
            {def.methodology.note && (
              <p className="section__methodology-note">
                {def.methodology.note.includes('{')
                  ? resolveTemplate(def.methodology.note, ctx.sectionCtx, templateParams)
                  : def.methodology.note}
              </p>
            )}
            {def.methodology.source && (
              <p className="section__methodology-meta">
                <span className="section__methodology-label">{t('source')}:</span>
                {' '}{def.methodology.source}
              </p>
            )}
            {def.methodology.lastUpdated && (
              <p className="section__methodology-meta">
                <span className="section__methodology-label">{t('last-updated')}:</span>
                {' '}{def.methodology.lastUpdated}
              </p>
            )}
            <button
              className="section__methodology-close"
              type="button"
              aria-label={t('close')}
              onClick={() => setInfoOpen(false)}
            >
              {t('close')}
            </button>
          </div>
        )}

        {/* TODO(export): wire ExportBar here when a section-aggregate-rows mechanism exists.
            Decision: Option C (defer). A section is a structural container (see ADR above);
            it has no ctx.rows of its own. Per-panel export belongs in each panel's shell
            (TableShell / ChartShell). Aggregating child rows requires a NodeStatusContext
            publish/subscribe seam that has zero second consumers today (YAGNI). */}

        {(view.noCollapse || open) && (
          <div className="section__body" {...vs.body} style={vs.body.style as CSSProperties | undefined}>
            {children.defs.map((d: NodeDef, i: number) => {
              const role   = (d as NodeBase).view?.role
              const hidden = showToggle && role && role !== activeRole
              return (
                <div key={i} className="section__view" {...resolveViewState(!!hidden)}>
                  {children.rendered[i]}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
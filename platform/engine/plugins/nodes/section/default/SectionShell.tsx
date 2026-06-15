import './section.css'

import { useState }                                        from 'react'
import type { CSSProperties }                               from 'react'
import { resolveTemplate }                                  from '@geostat/engine'
import { resolveViewState }                                 from '@geostat/styles'
import { useT }                                              from '@geostat/react'
import { InfoIcon, ChevronIcon }                             from '@geostat/react'
import { defineShell, useGlobalVar }                        from '@geostat/react/engine'
import type { ShellProps, NodeDef, NodeBase }               from '@geostat/react/engine'
import type { SectionNode }                                 from './SectionNode'

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
  const color = def.color ?? ctx.color

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

  const [open, setOpen] = useState(view.defaultOpen ?? true)

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
        style={{ '--sc': color } as CSSProperties}
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
            <button className="section__icon-btn" title={t('info')} type="button" aria-label={t('info')}>
              <InfoIcon />
            </button>
          </div>
          {canCollapse && (
            <ChevronIcon className={`section__chevron${open ? ' open' : ''}`} />
          )}
        </div>

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
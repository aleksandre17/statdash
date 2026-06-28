import { useRef }                                          from 'react'
import type { ReactNode, KeyboardEvent }                     from 'react'
import type { RenderContext, NodeRenderer, ChildrenArg }     from '@statdash/react/engine'
import { useT }                                              from '@statdash/react'
import type { PerspectiveBarNode }                           from './PerspectiveBarNode'
import './perspective-bar.css'

// ── PerspectiveBarControl — the axis toggle (WAI-ARIA APG Tabs) ─────────────────
//
//  Reads the active-perspective triad off `ctx.perspective` (SiteRenderer feeds it
//  from the PARSED axis: `available` = perspectiveOptions(axis) — id/label/icon
//  straight off each PerspectiveDef; `current` = the active id; `set` writes the
//  axis URL param). The axis OWNS its toggle presentation (decision B).
//
//  Keyboard: the full W3C APG Tabs interaction model with AUTOMATIC activation —
//  roving tabindex (only the selected tab is in the Tab order), Left/Right + Up/Down
//  move-and-activate, Home/End jump to first/last. This closes the blanket WCAG
//  2.1.1 (Keyboard, Level A) gap: previously every tab was Tab-reachable but no
//  arrow navigation existed and selection could not be changed from the keyboard.
//
//  Tab→panel association (aria-controls / role="tabpanel"): the perspective-bar does
//  NOT own a single adjacent panel — activating a perspective rewrites a URL param
//  that re-renders the WHOLE page (KPIs, filters, sections). Per APG, aria-controls
//  is appropriate only when a tab owns a discrete panel element; faking one here
//  would be incorrect. So the relationship is intentionally omitted, not stubbed —
//  the keyboard/selection contract (the real 2.1.1 defect) is fully met.
function PerspectiveBarControl({ ctx }: { ctx: RenderContext }): ReactNode {
  const { current, available, set } = ctx.perspective
  const t = useT('perspective-bar')
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([])

  if (available.length < 2) return null

  const currentIdx = Math.max(0, available.findIndex(d => d.id === current))

  // Move focus to + activate the tab at `next` (automatic activation: APG Tabs).
  function activate(next: number): void {
    const def = available[next]
    if (!def) return
    btnRefs.current[next]?.focus()
    set(def.id)
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    const n = available.length
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown': e.preventDefault(); activate((currentIdx + 1) % n);        break
      case 'ArrowLeft':
      case 'ArrowUp':   e.preventDefault(); activate((currentIdx - 1 + n) % n);    break
      case 'Home':      e.preventDefault(); activate(0);                            break
      case 'End':       e.preventDefault(); activate(n - 1);                        break
      default: /* leave other keys to the browser */
    }
  }

  return (
    <div
      className="perspective-tab-group"
      role="tablist"
      aria-label={t('aria-label')}
      onKeyDown={onKeyDown}
    >
      {available.map((def, i) => {
        const selected = current === def.id
        return (
          <button
            key={def.id}
            ref={el => { btnRefs.current[i] = el }}
            role="tab"
            type="button"
            aria-selected={selected}
            // Roving tabindex: only the selected tab is Tab-reachable; arrows move
            // within the tablist (APG). -1 keeps unselected tabs out of the Tab order.
            tabIndex={selected ? 0 : -1}
            className="perspective-tab-btn"
            onClick={() => set(def.id)}
          >
            {def.icon && <span className="perspective-tab-icon" data-icon={def.icon} aria-hidden />}
            {def.label}
          </button>
        )
      })}
    </div>
  )
}

export const PerspectiveBarShell: NodeRenderer<PerspectiveBarNode> = (
  _def:      PerspectiveBarNode,
  ctx:       RenderContext,
  _children: ChildrenArg,
): ReactNode => <PerspectiveBarControl ctx={ctx} />

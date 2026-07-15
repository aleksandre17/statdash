// ── BreakpointSwitcher — the Builder.io / Framer breakpoint control (canvas chrome) ──
//
//  The active-breakpoint selector that sits in the canvas toolbar. Picking a breakpoint
//  (a) makes it the inspector's authoring target and (b) constrains the canvas preview
//  to that width so the page reflows live (both via ActiveBreakpointContext). `default`
//  = the base value / full-bleed canvas.
//
//  Accessibility (WCAG 2.1 AA · Law 9): a `radiogroup` of single-choice `radio` buttons
//  with roving focus + arrow-key navigation; the active option is announced, and each
//  carries a text label (never colour/icon alone) plus the width in its accessible name.
//
import { useActiveBreakpoint, AUTHORING_BREAKPOINTS, previewWidthFor, type AuthoringBreakpoint } from './activeBreakpoint'

// Short, legible labels — the base plus the six container-query keys. `default` reads as
// "Base" (the value applied at every width); the rest use their scale key verbatim.
const LABELS: Record<AuthoringBreakpoint, string> = {
  default: 'ბაზა',   // Base
  '2xl':   '2XL',
  xl:      'XL',
  lg:      'LG',
  md:      'MD',
  sm:      'SM',
  xs:      'XS',
}

export function BreakpointSwitcher() {
  const { bp, setBp } = useActiveBreakpoint()

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const last = AUTHORING_BREAKPOINTS.length - 1
    let next = i
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown')      next = i === last ? 0 : i + 1
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')    next = i === 0 ? last : i - 1
    else if (e.key === 'Home')                                next = 0
    else if (e.key === 'End')                                 next = last
    else return
    e.preventDefault()
    setBp(AUTHORING_BREAKPOINTS[next])
  }

  return (
    <div
      className="canvas-toolbar__modes"
      role="radiogroup"
      aria-label="საავტორო breakpoint"
      data-testid="breakpoint-switcher"
    >
      {AUTHORING_BREAKPOINTS.map((key, i) => {
        const active = bp === key
        const w = previewWidthFor(key)
        const name = w ? `${LABELS[key]} — ${w}px` : `${LABELS[key]} — სრული სიგანე`
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={name}
            title={name}
            tabIndex={active ? 0 : -1}
            data-bp={key}
            className={`canvas-toolbar__mode${active ? ' canvas-toolbar__mode--active' : ''}`}
            onClick={() => setBp(key)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {LABELS[key]}
          </button>
        )
      })}
    </div>
  )
}

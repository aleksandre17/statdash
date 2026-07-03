// ── useContainerVisible — laid-out-container gate ──────────────────────
//
//  App-agnostic primitive: a ref + a boolean that is true ONLY when the
//  attached element is actually laid out (non-zero width AND attached to a
//  rendered ancestor chain — `offsetParent !== null`), false while it sits
//  inside a `display:none` ancestor (e.g. an inactive `[data-view="hidden"]`
//  chart/table toggle slot).
//
//  Any renderer that measures its own DOM box at mount time (ApexCharts'
//  getBBox/getBoundingClientRect-driven SVG sizing is the motivating case —
//  measuring a 0×0 detached box produces NaN transforms) can gate its mount
//  on `visible` instead of re-deriving this check inline. Reusable by ANY
//  such renderer, not just charts — a map, a canvas, any library that sizes
//  itself off its container at construction time.
//
//  useLayoutEffect (not useEffect) so the first measurement runs before the
//  browser paints — no visible flash of an unmeasured render. A ResizeObserver
//  re-measures on every layout change (e.g. the view toggle flips the
//  ancestor's `display`), flipping `visible` false→true the moment the
//  container is shown again.
//

import { useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

export interface ContainerVisible<T extends HTMLElement> {
  /** Attach to the element whose layout box gates `visible`. */
  ref:     RefObject<T | null>
  /** True only when the element has a non-zero box and a rendered ancestor chain. */
  visible: boolean
}

function isLaidOut(el: HTMLElement): boolean {
  return el.clientWidth > 0 && el.offsetParent !== null
}

/**
 * @param T the host element type (defaults to HTMLDivElement).
 */
export function useContainerVisible<T extends HTMLElement = HTMLDivElement>(): ContainerVisible<T> {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => setVisible(isLaidOut(el))
    check()

    // jsdom / very old browsers may lack ResizeObserver — the initial check()
    // above still gates the first mount; without it, a hidden container just
    // never flips to visible until something else remounts this hook.
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, visible }
}

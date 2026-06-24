// ── useSidebarScroll — anchor-scroll coordination for the nav sidebar ──
//
//  Owns the sidebar's two scroll concerns as ONE cohesive seam:
//
//   1. `scrollToAnchor(id)` — smooth-scroll an in-page anchor into view,
//      offsetting by the live sticky-chrome height (stickyOffset).
//   2. The PENDING-scroll effect — when a sub-item needs a time-mode switch
//      first, the target anchor only exists AFTER the mode's sections mount.
//      We stash the pending id and fire the scroll once the URL (searchParams)
//      has applied and the element is in the DOM.
//
//  Extracted from InnerSidebarShell so the shell reads as pure markup + intent;
//  the scroll mechanics (refs, the post-navigation effect) live behind this hook.
//

import { useRef, useEffect } from 'react'
import { stickyOffset }      from '@statdash/react/engine'

/** Smooth-scroll the element with `anchor` id into view below the sticky chrome. */
export function scrollToAnchor(anchor: string): void {
  const el = document.getElementById(anchor)
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY - stickyOffset()
  window.scrollTo({ top, behavior: 'smooth' })
}

export interface SidebarScroll {
  /** Immediately scroll to an anchor already present in the DOM. */
  scrollToAnchor: (anchor: string) => void
  /**
   * Queue a scroll that must wait for a navigation/mode-switch to mount the
   * target. The pending effect fires it once `searchParams` (passed as the
   * effect's trigger) settles and the element exists.
   */
  queueScroll:    (anchor: string) => void
}

/**
 * @param navigationTrigger a value that changes when the URL applies (e.g. the
 *        searchParams object) — the pending-scroll effect re-runs on its change.
 */
export function useSidebarScroll(navigationTrigger: unknown): SidebarScroll {
  const pendingRef = useRef<string | null>(null)

  useEffect(() => {
    const anchor = pendingRef.current
    if (!anchor) return
    if (document.getElementById(anchor)) {
      scrollToAnchor(anchor)
      pendingRef.current = null
    }
  }, [navigationTrigger])

  return {
    scrollToAnchor,
    queueScroll: (anchor: string) => { pendingRef.current = anchor },
  }
}

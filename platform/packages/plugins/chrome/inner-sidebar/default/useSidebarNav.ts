// ── useSidebarNav — the sidebar's single navigation seam ──────────────
//
//  Centralises ALL sub-item navigation through the SPA router (react-router
//  `useNavigate`) — the SAME client-side navigation channel the sidebar's own
//  parent-item <Link> and AppHeader's nav <Link>s already use. This is the root
//  fix for the former `window.location.href = …` hard reload, which bypassed the
//  router, tore down React state, and re-fetched the whole document just to land
//  on an anchor the SPA could reach in place.
//
//  Three intents, resolved by the section's own data — never by element name:
//
//   • mode-switch  — the target lives under a different time-mode; flip the mode
//     param in the URL and QUEUE the scroll (the anchor mounts after the switch).
//   • cross-page   — the target is on another page; route there with the anchor
//     hash via the router (push), no full reload.
//   • in-page      — the target is on this page; just smooth-scroll to it.
//

import { useCallback }   from 'react'
import { useNavigate }   from 'react-router-dom'
import type { SetURLSearchParams } from 'react-router-dom'
import type { NavSection } from '@statdash/react/engine'
import type { SidebarScroll } from './useSidebarScroll'

export interface SidebarNavParams {
  /** Locale-prefixed path of the nav entry that owns this section (e.g. `/en/regional`). */
  localePath:   string
  /** Whether that path is the page currently rendered. */
  isCurrentPage: boolean
  /** The active time-mode param value on the URL right now. */
  currentMode:  string
  /** The URL key the time-mode is stored under. */
  timeModeKey:  string
  setSearchParams: SetURLSearchParams
  scroll:       SidebarScroll
}

/** Returns a click handler for a sub-item, resolving its navigation intent. */
export function useSidebarNav({
  localePath,
  isCurrentPage,
  currentMode,
  timeModeKey,
  setSearchParams,
  scroll,
}: SidebarNavParams): (sec: NavSection) => void {
  const navigate = useNavigate()

  return useCallback(
    (sec: NavSection) => {
      const targetMode = sec.navMode

      if (targetMode && targetMode !== currentMode) {
        // The target anchor only mounts after the mode's sections render — queue
        // the scroll, then flip the mode param in place (no navigation).
        scroll.queueScroll(sec.id)
        setSearchParams(prev => {
          prev.set(timeModeKey, targetMode)
          return prev
        }, { replace: true })
        return
      }

      if (!isCurrentPage) {
        // Cross-page: SPA route to the target page + anchor — NOT a hard reload.
        navigate(`${localePath}#${sec.id}`)
        return
      }

      // Already here: smooth-scroll to the anchor.
      scroll.scrollToAnchor(sec.id)
    },
    [navigate, localePath, isCurrentPage, currentMode, timeModeKey, setSearchParams, scroll],
  )
}

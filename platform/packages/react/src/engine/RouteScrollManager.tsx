// ── RouteScrollManager — scroll parity across navigation paths ─────────
//
//  Restores the ONE behaviour a classic-router SPA silently drops: a full
//  browser load always starts the incoming document at the top, but a
//  client-side (soft) navigation keeps the OUTGOING route's window scroll
//  offset. So soft-nav and hard-load of the same URL render at DIFFERENT
//  scroll positions — the soft-nav lands mid/bottom-page (header, filter bar
//  and first sections scrolled out of view), which reads as "the page is
//  broken" even though the DOM is byte-identical. (This app mounts a classic
//  <BrowserRouter>, so react-router's data-router <ScrollRestoration> is not
//  available — this is its equivalent.)
//
//  Fires ONLY on a real route change (pathname or hash), NEVER on search-param
//  changes — so a filter/perspective interaction (which mutates the query
//  string but keeps the pathname) does not yank the user back to the top.
//
//  Two intents, resolved by the URL itself:
//    · no hash  → scroll to top (parity with a full browser load).
//    · #anchor  → a cross-page anchor navigation (useSidebarNav emits
//                 `navigate(path#sec.id)`); scroll that section into view below
//                 the sticky chrome once it mounts. This also closes the latent
//                 gap where the cross-page anchor hash was previously ignored.
//
//  It does NOT compete with the in-page anchor seam (useSidebarScroll's
//  scrollToAnchor / queued mode-switch scroll): those never mutate pathname or
//  hash, so this effect is inert for them. stickyOffset is the shared offset
//  authority (navUtils) — one source of truth, not a second copy.
//
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { stickyOffset } from './navUtils'
import { motionSafeScrollBehavior } from '@statdash/styles'

// Bounded rAF retry: the target section for a cross-page anchor mounts only
// after the incoming page renders (lazy renderer + async data), so the element
// may be absent on the first frame. Give it a few frames, then give up.
const MAX_ANCHOR_FRAMES = 30

export function RouteScrollManager(): null {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      const id = decodeURIComponent(hash.slice(1))
      let frames = 0
      let raf = 0
      const tryScroll = () => {
        const el = document.getElementById(id)
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY - stickyOffset()
          window.scrollTo({ top, behavior: motionSafeScrollBehavior('smooth') })
          return
        }
        if (frames++ < MAX_ANCHOR_FRAMES) raf = requestAnimationFrame(tryScroll)
      }
      raf = requestAnimationFrame(tryScroll)
      return () => cancelAnimationFrame(raf)
    }

    // Plain cross-page navigation → reset to the top, matching a hard load.
    // Instant (not smooth): a fresh document load has no scroll animation.
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname, hash])

  return null
}

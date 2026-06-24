
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { stickyOffset }                                            from '../engine/navUtils'
import type { NavSection }                                         from '../engine/navUtils'

// ── AnchorNavContext — generic active-anchor scroll-spy ───────────────
//
//  Tracks which of a list of anchor targets (NavSection[]) is currently active
//  via IntersectionObserver. App-agnostic: it knows nothing about sections —
//  any node that contributes a NavSection (id/title/navMode) participates.
//  (No-Privileged-Node ADR: de-privileged from the section-named original.)
//

interface AnchorNavCtxValue {
  sections:    NavSection[]
  activeId:    string | null
  timeModeKey: string
}

const AnchorNavCtx = createContext<AnchorNavCtxValue>({
  sections:    [],
  activeId:    null,
  timeModeKey: 'mode',
})

export function AnchorNavProvider({
  sections,
  timeModeKey,
  children,
}: {
  sections:    NavSection[]
  timeModeKey: string
  children:    React.ReactNode
}) {
  const [activeId, setActiveId] = useState<string | null>(null)

  // Always-fresh ref — the IO effect reads this to avoid a stale closure without
  // adding `sections` to its dependency array (which would thrash on every parent
  // render when navSections is computed inline). The ref is synced in its own
  // effect (not during render) per react-hooks/refs.
  const sectionsRef = useRef(sections)
  useEffect(() => {
    sectionsRef.current = sections
  })

  // Re-run the observer only when anchor IDs actually change.
  // Because navSections is pre-filtered by currentMode upstream (SiteRenderer),
  // a mode switch produces a different ID set → sectionKey changes → IO rebuilds.
  const sectionKey = sections.map(s => s.id).join('|')

  useEffect(() => {
    const sects = sectionsRef.current
    if (sects.length === 0) return

    const offset  = stickyOffset()
    const state   = new Map<string, boolean>()

    const pick = () => {
      for (const { id } of sects) {
        if (state.get(id)) { setActiveId(id); return }
      }
      // Scrolled past all anchors — keep the last one above the offset line active.
      let last: string | null = null
      for (const { id } of sects) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top < offset) last = id
      }
      setActiveId(last)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => state.set(e.target.id, e.isIntersecting))
        pick()
      },
      {
        // Pixel-based margins avoid % unit browser quirks.
        // Detection band: [stickyOffset … 60 % of viewport height].
        rootMargin: `-${offset}px 0px -${Math.floor(window.innerHeight * 0.4)}px 0px`,
        threshold:  0,
      },
    )

    sects.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
    // sectionKey encodes anchor IDs; sectionsRef.current is always up-to-date.
  }, [sectionKey])

  return (
    <AnchorNavCtx.Provider value={{ sections, activeId, timeModeKey }}>
      {children}
    </AnchorNavCtx.Provider>
  )
}

export const useAnchorNav = () => useContext(AnchorNavCtx)

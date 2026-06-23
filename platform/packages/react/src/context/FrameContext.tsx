// ── FrameContext — page frame provider for chrome adaptation ──────────
//
//  Grafana NavModel / Builder.io page.meta.frame pattern:
//  Page config DECLARES frame (JSON data) → LocaleGuard sets FrameProvider →
//  AppChrome reads usePageFrame() → sets data-frame attribute →
//  CSS [data-frame="..."] rules handle all visual adaptation.
//
//  Design rules:
//    Open string — never close to a union (extensibility rule #1)
//    Default 'default' — graceful degradation without Provider
//    One Provider per route — LocaleGuard wraps AppChrome + inner routes
//    Chrome shells: zero frame-aware JS — CSS cascade only
//
//  Known frames (convention, not closed union):
//    'default'    — solid header, standard footer
//    'landing'    — transparent header + backdrop-blur, landing layout
//    'minimal'    — compact chrome, reduced borders
//    'canvas'     — chrome hidden (Constructor edit mode — Phase 2)
//    'full-width' — no chrome sidebar influence, page controls width
//
import { createContext, useContext, type ReactNode } from 'react'

const FrameContext = createContext<string>('default')

export function FrameProvider({
  frame,
  children,
}: {
  frame:    string
  children: ReactNode
}) {
  return <FrameContext.Provider value={frame}>{children}</FrameContext.Provider>
}

/** Returns the current page frame. Defaults to 'default' if no FrameProvider is set. */
export function usePageFrame(): string {
  return useContext(FrameContext)
}
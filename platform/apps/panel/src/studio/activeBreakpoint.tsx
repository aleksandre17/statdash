// ── activeBreakpoint — the Studio's active-breakpoint CONTEXT (Builder.io switcher) ──
//
//  The per-breakpoint authoring context (the Builder.io / Framer breakpoint switcher):
//  ONE view-state — the breakpoint the author is currently EDITING AT — with TWO
//  projections, exactly as the reference tools do:
//    1. AUTHORING — the inspector's value-authoring control writes the ACTIVE
//       breakpoint's entry of a `ResponsiveVal` prop (`default` is the base).
//    2. PREVIEW   — the canvas renderer is constrained to that breakpoint's WIDTH so
//       the EXISTING container-query cascade (layout.css `@container`) reflows the page
//       to what that breakpoint actually shows ("the canvas never lies" — root Law 11).
//  Both projections read this ONE state; there is no second responsive mechanism.
//
//  Transient view-state (like the canvas preview-mode / dark toggle) — never persisted,
//  never authored config. Default 'default' (the unconstrained base): with no provider
//  (isolated mounts / tests) the hook returns the base + a no-op setter, so every
//  existing surface is byte-identical.
//
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Breakpoint } from '@statdash/styles'

// The authoring breakpoint set = the styles-package `Breakpoint` scale PLUS `default`
// (the base value applied at all widths). This is NOT a new scale — it is exactly the
// container-query cascade keys `ResponsiveVal` / resolveGrid already lower (Law: reuse
// the existing breakpoint set, invent nothing).
export type AuthoringBreakpoint = 'default' | Breakpoint

// Desktop-first order (base → widest → narrowest), matching BREAKPOINT_KEYS_CASCADE so
// the switcher reads left-to-right as "wider … narrower", the reference-tool convention.
export const AUTHORING_BREAKPOINTS: readonly AuthoringBreakpoint[] =
  ['default', '2xl', 'xl', 'lg', 'md', 'sm', 'xs'] as const

// The canvas PREVIEW width for each breakpoint — the band's own max-width (the
// container-query edge). Constraining the renderer to this width lands the page's
// layout containers inside (or below) that band, so the `@container` cascade selects
// that breakpoint's value — or, when it is unset, the nearest LARGER set value it
// inherits from (identical to the CSS `var()` fallback), which is the honest preview.
// `default` = no constraint (the full-bleed base, byte-identical to pre-slice).
const PREVIEW_WIDTHS: Record<AuthoringBreakpoint, number | undefined> = {
  default: undefined,
  '2xl':   1536,
  xl:      1280,
  lg:      1024,
  md:      768,
  sm:      640,
  xs:      480,
}

/** The canvas preview width (px) for a breakpoint, or undefined for the base (no cap). */
export function previewWidthFor(bp: AuthoringBreakpoint): number | undefined {
  return PREVIEW_WIDTHS[bp]
}

interface ActiveBreakpointValue {
  /** The breakpoint the author is editing at ('default' = the base value). */
  bp:    AuthoringBreakpoint
  /** Switch the active breakpoint (authoring target + canvas preview width). */
  setBp: (bp: AuthoringBreakpoint) => void
}

const DEFAULT_VALUE: ActiveBreakpointValue = { bp: 'default', setBp: () => {} }

const ActiveBreakpointContext = createContext<ActiveBreakpointValue>(DEFAULT_VALUE)

export function ActiveBreakpointProvider({ children }: { children: ReactNode }) {
  const [bp, setBp] = useState<AuthoringBreakpoint>('default')
  const value = useMemo(() => ({ bp, setBp }), [bp])
  return <ActiveBreakpointContext.Provider value={value}>{children}</ActiveBreakpointContext.Provider>
}

/** The active authoring breakpoint + setter. No provider ⇒ the base + a no-op setter. */
export function useActiveBreakpoint(): ActiveBreakpointValue {
  return useContext(ActiveBreakpointContext)
}

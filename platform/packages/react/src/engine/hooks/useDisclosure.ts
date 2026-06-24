// ── useDisclosure — minimal open/close/toggle disclosure primitive ────
//
//  The lightest disclosure abstraction: a single boolean with the three
//  canonical transitions (toggle · close · open). Reusable by ANY shell
//  needing a simple show/hide toggle — a methodology panel, a popover, an
//  info flyout — without re-deriving useState(false) + the three closures
//  inline at every call site.
//
//  Relationship to useCollapsible: useCollapsible is the RICHER sibling for
//  the header-as-disclosure-button case — it adds the keyboard/ARIA contract
//  (role/tabIndex/aria-expanded/onKeyDown) and a `canCollapse` inert mode.
//  It is intentionally NOT layered on useDisclosure: its `toggle` is gated by
//  `canCollapse` and its state seeds from `defaultOpen ?? true`, so the two
//  hooks own different state contracts. useDisclosure stays the minimal
//  primitive; collapse keeps its specialized a11y surface.
//

import { useState } from 'react'

export interface Disclosure {
  /** Whether the disclosure is currently open. */
  open:   boolean
  /** Flip the open state. */
  toggle: () => void
  /** Force-close. */
  close:  () => void
  /** Force-open. */
  show:   () => void
}

/**
 * @param initial initial open state — defaults to closed (false).
 */
export function useDisclosure(initial = false): Disclosure {
  const [open, setOpen] = useState(initial)
  return {
    open,
    toggle: () => setOpen(o => !o),
    close:  () => setOpen(false),
    show:   () => setOpen(true),
  }
}

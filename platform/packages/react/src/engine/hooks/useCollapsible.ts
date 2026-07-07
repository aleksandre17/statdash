// ── useCollapsible — collapse state + chevron-button a11y contract ────
//
//  App-agnostic disclosure hook. Owns the open/closed state and the a11y
//  contract for the ONE control that toggles it: a real chevron <button>.
//
//  WHY a dedicated button (not a clickable header): a whole-header click
//  target is a false affordance — it swallows clicks meant for the title,
//  export menu, or view toggle, and collapses the section by accident
//  (Principle of Least Astonishment). The toggle is a single, labelled
//  <button aria-expanded>; the header itself is inert. A native <button>
//  also carries Enter/Space activation and focus for free (WCAG 2.1 AA) —
//  no hand-rolled role/tabIndex/keydown on a div.
//
//  `toggleProps` is spread directly onto the chevron button; the label
//  (aria-label) and any aria-controls are the caller's to supply (i18n +
//  body-id are shell concerns). Reusable by ANY collapsible shell (section,
//  panel, accordion, drawer) — zero element knowledge.
//

import { useState } from 'react'

export interface CollapsibleToggleProps {
  /** Toggles open/closed. Native button ⇒ also fires on Enter/Space. */
  onClick:         () => void
  /** Always a real submit-safe button. */
  type:            'button'
  /** Reflects the current open state to assistive tech. */
  'aria-expanded': boolean
}

export interface Collapsible {
  /** Whether the body is currently expanded. */
  open:        boolean
  /** False when collapse is disabled (noCollapse) — no toggle is rendered. */
  canCollapse: boolean
  /**
   * Spread onto the chevron <button>. `undefined` when collapse is disabled,
   * so the caller renders no toggle at all (a pinned/hero shell).
   */
  toggleProps: CollapsibleToggleProps | undefined
}

/**
 * @param defaultOpen defaultOpen ?? true
 * @param noCollapse  noCollapse ?? false — disables the disclosure behavior
 */
export function useCollapsible(
  defaultOpen: boolean | undefined,
  noCollapse:  boolean | undefined,
): Collapsible {
  const [open, setOpen] = useState(defaultOpen ?? true)
  const canCollapse = !(noCollapse ?? false)

  const toggleProps: CollapsibleToggleProps | undefined = canCollapse
    ? {
        onClick:         () => setOpen(o => !o),
        type:            'button',
        'aria-expanded': open,
      }
    : undefined

  return { open, canCollapse, toggleProps }
}

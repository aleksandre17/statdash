// ── useCollapsible — collapse state + header a11y props ───────────────
//
//  Owns the open/closed state and the keyboard/ARIA contract for the
//  section header acting as a disclosure button. When collapse is disabled
//  (view.noCollapse, e.g. hero sections) the header is inert: no button
//  role, no tabIndex, no aria-expanded, default cursor.
//
//  `headProps` is spread directly onto the header element so the header
//  component carries no collapse logic of its own.
//

import { useState }       from 'react'
import type { CSSProperties } from 'react'

export interface CollapsibleHeadProps {
  onClick:         () => void
  onKeyDown:       (e: { key: string; preventDefault: () => void }) => void
  role:            'button' | undefined
  tabIndex:        number | undefined
  'aria-expanded': boolean | undefined
  style:           CSSProperties
}

export interface Collapsible {
  /** Whether the body is currently expanded. */
  open:        boolean
  /** False when collapse is disabled (view.noCollapse). */
  canCollapse: boolean
  /** Spread onto the header element — carries the full a11y/keyboard contract. */
  headProps:   CollapsibleHeadProps
}

/**
 * @param defaultOpen view.defaultOpen ?? true
 * @param noCollapse  view.noCollapse ?? false — disables the disclosure behavior
 */
export function useCollapsible(
  defaultOpen: boolean | undefined,
  noCollapse:  boolean | undefined,
): Collapsible {
  const [open, setOpen] = useState(defaultOpen ?? true)
  const canCollapse = !(noCollapse ?? false)

  const toggle = () => canCollapse && setOpen(o => !o)

  const headProps: CollapsibleHeadProps = {
    onClick:   toggle,
    onKeyDown: (e) => {
      if (canCollapse && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        setOpen(o => !o)
      }
    },
    role:            canCollapse ? 'button' : undefined,
    tabIndex:        canCollapse ? 0 : undefined,
    'aria-expanded': canCollapse ? open : undefined,
    style:           { cursor: canCollapse ? 'pointer' : 'default' },
  }

  return { open, canCollapse, headProps }
}

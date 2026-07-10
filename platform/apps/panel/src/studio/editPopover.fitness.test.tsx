// ── SL-3 fitness — the EditPopover is the glance-weight container, and ONLY that ─
//  (AR-49 SL-3, SPEC-studio-shell-layout §3.2 / §6)
//
//  FF-POPOVER-GLANCE-ONLY — the <EditPopover> renders only glance-weight (single-
//    property) content. A subject whose derived weight EXCEEDS glance is NOT placed
//    in a popover: it resolves (via the SAME placement primitive) to the dock/focus-
//    view, and the container REFUSES to render it. The Esc / anchor-return keyboard
//    model holds (WCAG 2.1 AA · 2.1.2 / 2.4.3).
//
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditPopover } from './EditPopover'
import { placeSubject } from './placement'
import type { SubjectShape } from './placement'

function anchor(): HTMLElement {
  const el = document.createElement('button')
  document.body.appendChild(el)
  return el
}

describe('FF-POPOVER-GLANCE-ONLY — the popover hosts ONLY a glance subject', () => {
  it('a single-property (glance) micro-target IS admitted — the dialog renders', () => {
    render(
      <EditPopover open anchorEl={anchor()} title="Rename — Item 1" onClose={() => {}}>
        <input aria-label="Name" defaultValue="Item 1" />
      </EditPopover>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Rename — Item 1' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
  })

  it('a NESTED subject (→ dock-drill) is REFUSED — no popover renders', () => {
    // A nested-structure subject is form-weight; by the law it drills in the dock,
    // it does not pop over. The container self-guards and renders nothing.
    render(
      <EditPopover open anchorEl={anchor()} title="Nope" shape={{ flatFields: 1, hasNested: true }} onClose={() => {}}>
        <input aria-label="Name" />
      </EditPopover>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a RICH/workspace subject (→ focus-view) is REFUSED — no popover renders', () => {
    render(
      <EditPopover open anchorEl={anchor()} title="Nope" shape={{ flatFields: 1, hasRichType: true }} onClose={() => {}}>
        <input aria-label="Name" />
      </EditPopover>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('the refusal is LAW-DERIVED — the guarded shapes route elsewhere via the same primitive', () => {
    // The container does not invent its own admission rule; it asks placeSubject.
    const glance:  SubjectShape = { flatFields: 1 }
    const nested:  SubjectShape = { flatFields: 1, hasNested: true }
    const rich:    SubjectShape = { flatFields: 1, hasRichType: true }
    expect(placeSubject('micro-target', glance)).toBe('popover')       // admitted
    expect(placeSubject('micro-target', nested)).not.toBe('popover')   // → dock-drill
    expect(placeSubject('micro-target', rich)).not.toBe('popover')     // → focus-view
  })
})

describe('FF-POPOVER-GLANCE-ONLY — the keyboard / a11y model holds (WCAG 2.1 AA)', () => {
  it('the surface is a labelled dialog (role + accessible name — 4.1.2)', () => {
    render(
      <EditPopover open anchorEl={anchor()} title="Rename" onClose={() => {}}>
        <input aria-label="Name" />
      </EditPopover>,
    )
    expect(screen.getByRole('dialog', { name: 'Rename' })).toBeInTheDocument()
  })

  it('Esc dismisses with the escape reason (2.1.2 — the caller can then cancel/return)', () => {
    const onClose = vi.fn()
    render(
      <EditPopover open anchorEl={anchor()} title="Rename" onClose={onClose}>
        <input aria-label="Name" />
      </EditPopover>,
    )
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' })
    expect(onClose).toHaveBeenCalledWith('escape')
  })

  it('focus MOVES into the popover on open (2.4.3 — MUI Modal focus trap)', () => {
    render(
      <EditPopover open anchorEl={anchor()} title="Rename" onClose={() => {}}>
        <input aria-label="Name" />
      </EditPopover>,
    )
    // Focus is trapped INSIDE the surface on open (the active element is within the
    // dialog) — the precondition for Esc-returns-to-anchor (MUI Modal restores focus).
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
  })
})

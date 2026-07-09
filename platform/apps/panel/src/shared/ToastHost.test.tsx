// ── FF-NOTIFY-PORT — the notify port's renderer (ToastHost) ────────────────────
//
//  ToastHost is the MUI surface behind the notify port. These tests lock what the
//  port promises at the UI edge: it renders the queue (one toast at a time), the
//  toast is accessible (an alert role carrying the message + a labelled dismiss
//  control), and dismissing removes it from the queue. The impl is MUI; the PORT is
//  ours — so these assertions are on behaviour, not on MUI internals.
//
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ToastHost } from './ToastHost'
import { useNotifyStore } from '../store/notify'

beforeEach(() => { useNotifyStore.setState({ queue: [] }) })

describe('ToastHost — renders the notify queue (a11y)', () => {
  it('renders nothing when the queue is empty', () => {
    const { container } = render(<ToastHost />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('surfaces the head-of-queue toast as an accessible alert carrying its message', () => {
    useNotifyStore.getState().notify('config saved', { type: 'success' })
    render(<ToastHost />)
    // MUI Alert exposes role="alert" — the toast is announced to assistive tech.
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('config saved')
  })

  it('shows exactly ONE toast at a time (the queue head)', () => {
    const { notify } = useNotifyStore.getState()
    notify('first'); notify('second')
    render(<ToastHost />)
    expect(screen.getByText('first')).toBeInTheDocument()
    expect(screen.queryByText('second')).not.toBeInTheDocument()
  })

  it('offers a labelled dismiss control that removes the toast from the queue', () => {
    useNotifyStore.getState().notify('dismiss me')
    render(<ToastHost />)
    // MUI Alert onClose renders a labelled Close button (keyboard-operable).
    const close = screen.getByRole('button', { name: /close/i })
    fireEvent.click(close)
    expect(useNotifyStore.getState().queue).toHaveLength(0)
  })

  it('advances to the next toast once the head is dismissed', () => {
    const { notify } = useNotifyStore.getState()
    notify('first'); notify('second')
    const { rerender } = render(<ToastHost />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    rerender(<ToastHost />)
    expect(screen.getByText('second')).toBeInTheDocument()
  })
})

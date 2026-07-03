// @vitest-environment jsdom
//
// ── useContainerVisible — laid-out-container gate ─────────────────────────────
//
//  Pins the NaN-transform guard's foundation: `visible` starts false for a
//  container that isn't laid out (zero width / detached, the `display:none`
//  chart↔table toggle case) and flips true once a ResizeObserver reports a
//  real layout box — WITHOUT requiring a remount. jsdom ships neither real
//  layout nor ResizeObserver, so both are faked deterministically here (the
//  fake stands in for the browser the same way apps/*/vitest.setup.ts's
//  NoopObserver stands in for jsdom's missing implementation elsewhere).
//
//  Layout is faked at the HTMLElement.prototype level (a getter reading a
//  module-level flag) rather than by reaching into the hook's own ref — the
//  hook's ref is React-owned (assigned by React itself via `ref={hostRef}`),
//  and mutating a hook-returned ref from a test is the exact anti-pattern
//  react-hooks/immutability rejects. Stubbing the prototype means the node's
//  clientWidth/offsetParent already reflect the desired state the instant
//  React constructs + attaches it — before the hook's own useLayoutEffect
//  measurement runs — with zero special test-only wiring in the hook or Probe.
//

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, act, screen } from '@testing-library/react'
import { useContainerVisible } from './useContainerVisible'

afterEach(cleanup)

let laidOut = false

function stubLayout(): () => void {
  const clientWidth  = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
  const offsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent')
  Object.defineProperty(HTMLElement.prototype, 'clientWidth',  { configurable: true, get: () => (laidOut ? 240 : 0) })
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', { configurable: true, get: () => (laidOut ? document.body : null) })
  return () => {
    if (clientWidth)  Object.defineProperty(HTMLElement.prototype, 'clientWidth',  clientWidth)
    if (offsetParent) Object.defineProperty(HTMLElement.prototype, 'offsetParent', offsetParent)
  }
}

type ROCallback = (entries: unknown[], observer: unknown) => void

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = []
  private readonly callback: ROCallback
  constructor(cb: ROCallback) {
    this.callback = cb
    FakeResizeObserver.instances.push(this)
  }
  observe()    {}
  unobserve() {}
  disconnect() {}
  trigger() { this.callback([], this) }
}

function Probe() {
  const { ref, visible } = useContainerVisible<HTMLDivElement>()
  return <div ref={ref} data-testid="host">{visible ? 'visible' : 'hidden'}</div>
}

describe('useContainerVisible', () => {
  it('is false for a container with zero width (display:none case) and true for a laid-out one', () => {
    const restore = stubLayout()
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    FakeResizeObserver.instances = []

    laidOut = false
    render(<Probe />)
    expect(screen.getByTestId('host')).toHaveTextContent('hidden')
    cleanup()

    laidOut = true
    render(<Probe />)
    expect(screen.getByTestId('host')).toHaveTextContent('visible')

    vi.unstubAllGlobals()
    restore()
  })

  it('flips false→true when ResizeObserver reports the container became laid out — no remount required', () => {
    const restore = stubLayout()
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    FakeResizeObserver.instances = []

    laidOut = false
    render(<Probe />)
    expect(screen.getByTestId('host')).toHaveTextContent('hidden')

    // The view toggle shows the container (CSS display:none → block) — same node,
    // no remount. Simulate the browser recomputing layout, then the observer firing.
    laidOut = true
    const observer = FakeResizeObserver.instances.at(-1)
    act(() => observer?.trigger())

    expect(screen.getByTestId('host')).toHaveTextContent('visible')

    vi.unstubAllGlobals()
    restore()
  })

  it('does not crash when ResizeObserver is unavailable (jsdom-without-shim) — initial measurement still gates the mount', () => {
    const restore = stubLayout()
    const original = (globalThis as { ResizeObserver?: unknown }).ResizeObserver
    vi.stubGlobal('ResizeObserver', undefined)

    laidOut = true
    render(<Probe />)
    expect(screen.getByTestId('host')).toHaveTextContent('visible')
    cleanup()

    laidOut = false
    render(<Probe />)
    expect(screen.getByTestId('host')).toHaveTextContent('hidden')

    vi.stubGlobal('ResizeObserver', original)
    vi.unstubAllGlobals()
    restore()
  })
})

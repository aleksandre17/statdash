// @vitest-environment jsdom
//
// ── ApexRenderer — visibility gate (NaN-transform guard) ───────────────────────
//
//  Locks the fix for the chart↔table toggle NaN crash: while the host is NOT
//  laid out (the `[data-view="hidden"]{display:none}` ancestor a hidden chart
//  view sits behind — 0 width, no offsetParent), ReactApexChart must NOT mount
//  at all — nothing measures a 0×0/detached box, so no NaN width/height/
//  transform. The moment the host becomes laid out (the toggle flips the
//  ancestor back to `display:block`), the SAME useContainerVisible
//  ResizeObserver flips `visible` true and ReactApexChart mounts fresh — no
//  remount of ApexRenderer itself required, `key={chartKey}` composes on top.
//
//  react-apexcharts is mocked to a lightweight probe — real ApexCharts drives
//  heavy SVG measurement jsdom can't do, and is irrelevant to the GATE this
//  test pins. @statdash/react's useLocale is mocked (SiteProvider is not this
//  unit's collaborator — same pattern as SectionShell.test.tsx).
//

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import type { ChartOutput, AxisOutput } from '@statdash/charts'

const mounts: unknown[] = []
vi.mock('react-apexcharts', () => ({
  default: (props: unknown) => {
    mounts.push(props)
    return <div data-testid="apex-mounted" />
  },
}))
vi.mock('@statdash/react', () => ({ useLocale: () => 'en' }))

import { ApexRenderer } from './ApexRenderer'

afterEach(() => { cleanup(); mounts.length = 0 })

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

function setLaidOut(el: HTMLElement, laidOut: boolean): void {
  Object.defineProperty(el, 'clientWidth',  { value: laidOut ? 300 : 0, configurable: true })
  Object.defineProperty(el, 'offsetParent', { value: laidOut ? document.body : null, configurable: true })
}

function makeOutput(): ChartOutput {
  const y: AxisOutput = { unit: undefined, decimals: undefined }
  return {
    type: 'bar', categories: ['A', 'B'],
    series: [{
      name: 'S', color: '#00A896',
      data: [{ value: 10, formatted: '10' }, { value: 20, formatted: '20' }],
    }],
    axes: { x: {}, y, y2: undefined },
    stacked: false, horizontal: false,
    legend: { show: true }, tooltip: { show: true }, annotations: [],
  }
}

describe('ApexRenderer — visibility gate', () => {
  it('does NOT mount ReactApexChart while the host is a 0×0/detached box (hidden view)', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    FakeResizeObserver.instances = []

    // jsdom's default clientWidth/offsetParent for a freshly mounted node is
    // already the "not laid out" state — mirrors an inactive [data-view="hidden"]
    // toggle slot with zero explicit stubbing.
    const { container, queryByTestId } = render(<ApexRenderer output={makeOutput()} />)
    expect(queryByTestId('apex-mounted')).toBeNull()
    expect(mounts).toHaveLength(0)
    expect(container.firstElementChild).not.toBeNull() // host div still renders (keeps its footprint)

    vi.unstubAllGlobals()
  })

  it('mounts ReactApexChart once the host becomes laid out — no NaN box ever measured', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    FakeResizeObserver.instances = []

    const { container, queryByTestId } = render(<ApexRenderer output={makeOutput()} />)
    expect(queryByTestId('apex-mounted')).toBeNull()

    const host = container.firstElementChild as HTMLElement
    setLaidOut(host, true)
    act(() => FakeResizeObserver.instances.at(-1)?.trigger())

    expect(queryByTestId('apex-mounted')).not.toBeNull()
    expect(mounts).toHaveLength(1)

    vi.unstubAllGlobals()
  })

  it('unmounts ReactApexChart again if the toggle flips back to hidden (no dangling measurement)', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    FakeResizeObserver.instances = []

    const { container, queryByTestId } = render(<ApexRenderer output={makeOutput()} />)
    const host = container.firstElementChild as HTMLElement

    setLaidOut(host, true)
    act(() => FakeResizeObserver.instances.at(-1)?.trigger())
    expect(queryByTestId('apex-mounted')).not.toBeNull()

    setLaidOut(host, false)
    act(() => FakeResizeObserver.instances.at(-1)?.trigger())
    expect(queryByTestId('apex-mounted')).toBeNull()

    vi.unstubAllGlobals()
  })
})

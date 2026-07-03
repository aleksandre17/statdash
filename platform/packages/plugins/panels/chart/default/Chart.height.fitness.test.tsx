// @vitest-environment jsdom
//
// ── Chart.tsx horizontal height model (FF-HBAR-HEIGHT-BOUNDED) ────────────────
//
//  Regression b5ae777 (2026-07-03 diagnosis, defects B+C): the horizontal opt-out
//  `{ height:'auto', flex:'0 0 auto' }` UNBOUND `.chart-wrap` height for every
//  horizontal chart —
//   B: a TALL custom horizontal renderer (many categories, own internal
//      `overflow-y:auto` scroll area) grew to full content height, broke out of
//      the fixed section band, and lost its scrollbar (content clipped, unreachable).
//   C: a SHORT few-bar horizontal Apex renderer floored at a cramped 240px sliver.
//
//  The fix bounds the wrap between a generous MIN (base.ts HBAR_MIN_HEIGHT, tested
//  separately in low-cardinality/chart-fill) and the section band as a MAX-with-
//  internal-scroll — one coherent model, not two patches. This test pins the
//  Chart.tsx half: a horizontal chart's wrap must
//   1. size to content (height:auto) — never stretch to fill the band (keeps the
//      no-whitespace win for a short hbar),
//   2. cap at the band token (`--size-panel-height`) so a tall renderer can never
//      break out of the fixed section band again,
//   3. gain its OWN overflow-y:auto so content beyond the cap is reachable by
//      scroll (restores the accounts-table scroll lost in b5ae777),
//   4. shrink (not grow) if the flex row is narrower than content — flex:'0 1 auto'
//      + minHeight:0 (required for a flex item's overflow to actually clip).
//  Vertical charts are asserted UNCHANGED (still fill the band, unbounded height).
//

import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import type { ChartOutput, AxisOutput } from '@statdash/charts'
import type { BodyStyleAttrs } from '@statdash/react/engine'
import { chartRendererRegistry } from '@statdash/react/engine'
import Chart from './Chart'

const PROBE_TYPE = 'probe-fill-test'
chartRendererRegistry.register(PROBE_TYPE, () => <div data-testid="probe-renderer" />)

afterEach(cleanup)

function makeOutput(over: Partial<ChartOutput> = {}): ChartOutput {
  const y: AxisOutput = { unit: undefined, decimals: undefined }
  return {
    type:        PROBE_TYPE as ChartOutput['type'],
    categories:  ['A', 'B'],
    series:      [{ name: 'S', color: '#00A896', data: [{ value: 1, formatted: '1' }, { value: 2, formatted: '2' }] }],
    axes:        { x: {}, y, y2: undefined },
    stacked:     false,
    horizontal:  false,
    legend:      { show: false },
    tooltip:     { show: true },
    annotations: [],
    ...over,
  }
}

const bodyAttrs: BodyStyleAttrs = { style: { flex: '1 1 var(--size-panel-height)' } } as BodyStyleAttrs

function wrapStyleOf(container: HTMLElement): CSSStyleDeclaration {
  const wrap = container.querySelector('.chart-wrap') as HTMLElement
  expect(wrap).not.toBeNull()
  return wrap.style
}

describe('Chart.tsx horizontal height model (FF-HBAR-HEIGHT-BOUNDED)', () => {
  it('a horizontal chart wrap sizes to content (height:auto), never the band', () => {
    const { container } = render(<Chart output={makeOutput({ horizontal: true })} bodyAttrs={bodyAttrs} />)
    expect(wrapStyleOf(container).height).toBe('auto')
  })

  it('a horizontal chart wrap CAPS at the section-band token (no unbound growth — fix B)', () => {
    const { container } = render(<Chart output={makeOutput({ horizontal: true })} bodyAttrs={bodyAttrs} />)
    expect(wrapStyleOf(container).maxHeight).toBe('var(--size-panel-height)')
  })

  it('a horizontal chart wrap gains its own overflow-y:auto (scroll restored past the cap)', () => {
    const { container } = render(<Chart output={makeOutput({ horizontal: true })} bodyAttrs={bodyAttrs} />)
    expect(wrapStyleOf(container).overflowY).toBe('auto')
  })

  it('a horizontal chart wrap may SHRINK but never grow to fill (flex:0 1 auto, minHeight:0)', () => {
    const { container } = render(<Chart output={makeOutput({ horizontal: true })} bodyAttrs={bodyAttrs} />)
    const style = wrapStyleOf(container)
    expect(style.flexGrow).toBe('0')
    expect(style.flexShrink).toBe('1')
    expect(style.flexBasis).toBe('auto')
    expect(style.minHeight).toBe('0px')
  })

  it('a VERTICAL chart wrap is UNCHANGED — keeps filling its band, no cap/scroll override', () => {
    const { container } = render(<Chart output={makeOutput({ horizontal: false })} bodyAttrs={bodyAttrs} />)
    const style = wrapStyleOf(container)
    expect(style.maxHeight).toBe('')
    expect(style.overflowY).toBe('')
    expect(style.flex).toBe(bodyAttrs.style!.flex)
  })
})

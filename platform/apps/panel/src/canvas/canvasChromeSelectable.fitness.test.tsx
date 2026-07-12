// ── FF-CANVAS-CHROME-SELECTABLE — chrome is selectable on the canvas (SPEC S4) ──
//
//  The owner's "chrome konfigebi / can't reach every element": chrome (header /
//  sidebar / footer) could only be selected from a LIST in Pages&Site — never by
//  clicking it on the canvas. S4 makes it canvas-selectable through ONE generic
//  mechanism: the engine `ChromeSlot` stamps a layout-inert `data-canvas-chrome-slot`
//  anchor ONLY under the authoring canvas (byte-identical off it); the CanvasOverlay
//  frames every AUTHORABLE chrome region (declares a schema — the SAME contract the
//  ChromePalette offers) and a click dispatches the EXISTING `selectChrome` arm. No
//  per-type branch: the (slot, key) coordinate is read from the anchor, not hardcoded.
//
//  Interim (S4): this rides the existing chrome-selection arm. S6 folds chrome into
//  the ONE PartAddress selection (chrome-as-part of `site-frame`, ADR-041 Ph.6).
//
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { chromeRegistry, CHROME_SLOT_ATTR, CHROME_KEY_ATTR } from '@statdash/react/engine'
import { CanvasOverlay } from './CanvasOverlay'
import { setupCanvasRegistry } from './setupCanvasRegistry'
import type { NodeBase } from '@statdash/react/engine'

beforeAll(() => { setupCanvasRegistry() })

// The FIRST authorable chrome (slot, key) — DERIVED from the registry exactly as the
// ChromePalette derives its list (schema-bearing). Registry-driven, never hardcoded.
function firstAuthorableChrome(): { slot: string; key: string } | null {
  for (const slot of chromeRegistry.list()) {
    for (const key of chromeRegistry.listVariants(slot)) {
      if ((chromeRegistry.getMeta(slot, key)?.schema?.length ?? 0) > 0) return { slot, key }
    }
  }
  return null
}

const page: NodeBase = { type: 'inner-page', id: 'page-1', children: [] } as NodeBase

/** Render the overlay inside a .canvas-root that also carries the chrome anchors the
 *  engine stamps under the authoring canvas (mirrors the real DOM the overlay reads). */
function renderWithChrome(
  anchors: Array<{ slot: string; key: string }>,
  props: Partial<React.ComponentProps<typeof CanvasOverlay>> = {},
) {
  const onSelectChrome = vi.fn()
  render(
    <div className="canvas-root">
      <div className="canvas-layer canvas-layer--renderer">
        <div data-part-node-id="page-1"><div>page</div></div>
        {anchors.map((a) => (
          <div key={`${a.slot}:${a.key}`} {...{ [CHROME_SLOT_ATTR]: a.slot, [CHROME_KEY_ATTR]: a.key }}>
            <div>{a.slot}</div>
          </div>
        ))}
      </div>
      <CanvasOverlay page={page} onSelect={vi.fn()} onDrop={vi.fn()} onSelectChrome={onSelectChrome} {...props} />
    </div>,
  )
  return onSelectChrome
}

describe('FF-CANVAS-CHROME-SELECTABLE — the anchor contract', () => {
  it('the interim chrome-anchor attributes are the stable contract the overlay reads', () => {
    expect(CHROME_SLOT_ATTR).toBe('data-canvas-chrome-slot')
    expect(CHROME_KEY_ATTR).toBe('data-canvas-chrome-key')
  })

  it('at least one authorable chrome region exists in the registry (guard is meaningful)', () => {
    expect(firstAuthorableChrome()).not.toBeNull()
  })
})

describe('FF-CANVAS-CHROME-SELECTABLE — the overlay frames + selects chrome', () => {
  it('frames an AUTHORABLE chrome region and a click dispatches selectChrome(slot, key)', () => {
    const chrome = firstAuthorableChrome()!
    const onSelectChrome = renderWithChrome([chrome])

    const frame = document.querySelector(`.canvas-chrome[data-chrome-slot="${chrome.slot}"]`)
    expect(frame).not.toBeNull()

    fireEvent.click(frame!)
    expect(onSelectChrome).toHaveBeenCalledWith(chrome.slot, chrome.key)
  })

  it('does NOT frame a non-authorable region (no schema) — never a dead selection', () => {
    // A bogus slot resolves to no registry meta ⇒ no schema ⇒ not authorable ⇒ not framed.
    renderWithChrome([{ slot: 'not-a-real-chrome-slot', key: 'default' }])
    expect(document.querySelector('.canvas-chrome')).toBeNull()
  })

  it('renders NO chrome frames when no chrome handler is provided (backward-compatible)', () => {
    const chrome = firstAuthorableChrome()!
    render(
      <div className="canvas-root">
        <div className="canvas-layer canvas-layer--renderer">
          <div data-part-node-id="page-1"><div>page</div></div>
          <div {...{ [CHROME_SLOT_ATTR]: chrome.slot, [CHROME_KEY_ATTR]: chrome.key }}><div>x</div></div>
        </div>
        <CanvasOverlay page={page} onSelect={vi.fn()} onDrop={vi.fn()} />
      </div>,
    )
    expect(document.querySelector('.canvas-chrome')).toBeNull()
  })

  it('marks the selected chrome region (selected-frame highlight, WCAG shape+colour)', () => {
    const chrome = firstAuthorableChrome()!
    renderWithChrome([chrome], { selectedChrome: chrome })
    const frame = screen.getByRole('button', { name: `Select chrome ${chrome.slot}` })
    expect(frame.className).toContain('canvas-chrome--selected')
    expect(frame.getAttribute('aria-pressed')).toBe('true')
  })
})

// ── FF-CANVAS-CHROME-SELECTABLE — chrome is selectable on the canvas (S6 fold) ──
//
//  The owner's "chrome konfigebi / can't reach every element": chrome (header /
//  sidebar / footer) is selectable by CLICKING it on the canvas. S6 folds this into the
//  ONE Part port + ONE `PartAddress`: `ChromeSlot` stamps the generic
//  `<PartAnchor field={slot} index={0}>` (the `data-part-*` family) ONLY under the
//  authoring canvas; the CanvasOverlay enumerates the SITE-FRAME's chrome regions through
//  the ONE Part port (`chromeParts`), frames each RENDERED region, and a click dispatches
//  the ONE part-select `onSelectItem(SITE_FRAME_ID, chrome.<slot>)` — NO chrome-specific
//  anchor family, NO `selectChrome` arm, NO per-type branch. Chrome is a part like any
//  other; the (slot) coordinate is read from the enumerated part, not hardcoded.
//
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  chromeRegistry, PART_FIELD_ATTR, PART_INDEX_ATTR, SITE_FRAME_ID, chromePartPath,
} from '@statdash/react/engine'
import type { ChromeEntry } from '@statdash/react/engine'
import { CanvasOverlay } from './CanvasOverlay'
import { setupCanvasRegistry } from './setupCanvasRegistry'
import type { NodeBase } from '@statdash/react/engine'

beforeAll(() => { setupCanvasRegistry() })

// The FIRST authorable chrome (slot, key) — DERIVED from the registry exactly as the
// overlay's port enumeration does (schema-bearing). Registry-driven, never hardcoded.
function firstAuthorableChrome(): { slot: string; key: string } | null {
  for (const slot of chromeRegistry.list()) {
    for (const key of chromeRegistry.listVariants(slot)) {
      if ((chromeRegistry.getMeta(slot, key)?.schema?.length ?? 0) > 0) return { slot, key }
    }
  }
  return null
}

const page: NodeBase = { type: 'inner-page', id: 'page-1', children: [] } as NodeBase

/** Render the overlay inside a .canvas-root that also carries the chrome PartAnchors the
 *  engine stamps under the authoring canvas (`data-part-field`/`data-part-index`, keyed by
 *  slot) — mirrors the real DOM the overlay reads. The `chrome` prop is the site chrome
 *  SSOT the overlay's port enumeration uses to resolve the rendered variant. */
function renderWithChrome(
  anchors: Array<{ slot: string; key: string }>,
  props: Partial<React.ComponentProps<typeof CanvasOverlay>> = {},
) {
  const onSelectItem = vi.fn()
  // The site chrome map (`site.chrome` shape): each rendered slot on its variant.
  const chrome: Record<string, ChromeEntry> = Object.fromEntries(
    anchors.map((a) => [a.slot, { variant: a.key }]),
  )
  render(
    <div className="canvas-root">
      <div className="canvas-layer canvas-layer--renderer">
        <div data-part-node-id="page-1"><div>page</div></div>
        {anchors.map((a) => (
          <div key={`${a.slot}:${a.key}`} {...{ [PART_FIELD_ATTR]: a.slot, [PART_INDEX_ATTR]: '0' }}>
            <div>{a.slot}</div>
          </div>
        ))}
      </div>
      <CanvasOverlay page={page} onSelect={vi.fn()} onDrop={vi.fn()} onSelectItem={onSelectItem} chrome={chrome} {...props} />
    </div>,
  )
  return onSelectItem
}

describe('FF-CANVAS-CHROME-SELECTABLE — the anchor contract', () => {
  it('chrome uses the ONE generic part-anchor family (no chrome-specific attributes)', () => {
    expect(PART_FIELD_ATTR).toBe('data-part-field')
    expect(PART_INDEX_ATTR).toBe('data-part-index')
  })

  it('at least one authorable chrome region exists in the registry (guard is meaningful)', () => {
    expect(firstAuthorableChrome()).not.toBeNull()
  })
})

describe('FF-CANVAS-CHROME-SELECTABLE — the overlay frames + selects chrome', () => {
  it('frames an AUTHORABLE chrome region and a click selects the ONE PartAddress', () => {
    const chrome = firstAuthorableChrome()!
    const onSelectItem = renderWithChrome([chrome])

    const frame = document.querySelector(`.canvas-chrome[data-chrome-slot="${chrome.slot}"]`)
    expect(frame).not.toBeNull()

    fireEvent.click(frame!)
    // The click funnels through the ONE part-select: site-frame owner + `chrome.<slot>`.
    expect(onSelectItem).toHaveBeenCalledWith(SITE_FRAME_ID, chromePartPath(chrome.slot))
  })

  it('does NOT frame a non-registered region — never a dead selection', () => {
    // A bogus slot is not in the chrome registry ⇒ the port never enumerates it ⇒ its
    // (stray) anchor is never queried ⇒ not framed.
    renderWithChrome([{ slot: 'not-a-real-chrome-slot', key: 'default' }])
    expect(document.querySelector('.canvas-chrome')).toBeNull()
  })

  it('renders NO chrome frames when no part-select handler is provided (backward-compatible)', () => {
    const chrome = firstAuthorableChrome()!
    render(
      <div className="canvas-root">
        <div className="canvas-layer canvas-layer--renderer">
          <div data-part-node-id="page-1"><div>page</div></div>
          <div {...{ [PART_FIELD_ATTR]: chrome.slot, [PART_INDEX_ATTR]: '0' }}><div>x</div></div>
        </div>
        <CanvasOverlay page={page} onSelect={vi.fn()} onDrop={vi.fn()} />
      </div>,
    )
    expect(document.querySelector('.canvas-chrome')).toBeNull()
  })

  it('marks the selected chrome region (selected-frame highlight, WCAG shape+colour)', () => {
    const chrome = firstAuthorableChrome()!
    renderWithChrome([chrome], {
      selectedNodeId: SITE_FRAME_ID,
      selectedItemPath: chromePartPath(chrome.slot),
    })
    const frame = screen.getByRole('button', { name: `Select chrome ${chrome.slot}` })
    expect(frame.className).toContain('canvas-chrome--selected')
    expect(frame.getAttribute('aria-pressed')).toBe('true')
  })
})

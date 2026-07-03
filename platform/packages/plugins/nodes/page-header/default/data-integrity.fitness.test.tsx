// @vitest-environment jsdom
//
// ── Fitness — AR-40 data-integrity consolidation at the PAGE ──────────────────
//
//  FF-ONE-INTEGRITY-INDICATOR — a PAGE with N preliminary panels renders EXACTLY
//    ONE page-level indicator (in the page header) and ZERO per-panel pills; a
//    panel with no scope above it (standalone) still renders its OWN badge
//    (Postel); a page header with no scope above it renders NO indicator.
//  FF-INTEGRITY-REACHABLE — the ONE indicator is not color-only: a dot AND a
//    visible text label, plus a title/aria caption — WCAG 2.1 AA / Law 9. The
//    per-cell OBS_STATUS 'p' + footer legend keep the locality detail.
//
//  The SUT is the page-level scope: the engine publish/subscribe seam
//  (useNodeStatusScope / NodeStatusProvider / useReportNodeStatus /
//  useNodeStatusAggregate) plus the REAL page-header presentational component
//  that renders the consolidated indicator. `PageIndicator` mirrors exactly what
//  PageHeaderShell does (subscribe → pass `preliminary` to <PageHeader/>), and
//  `Page` mirrors what InnerPageShell does (own the scope, provide it). The
//  engine hooks are real — nothing about the consolidation is mocked.
//

import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup }                  from '@testing-library/react'
import { MemoryRouter }                     from 'react-router-dom'
import type { ReactNode }                   from 'react'
import {
  NodeStatusProvider,
  useNodeStatusScope,
  useReportNodeStatus,
  useNodeStatusAggregate,
} from '@statdash/react/engine'
import PageHeader from './components/PageHeader'

afterEach(cleanup)

// A minimal data panel exercising the real publish contract: reports its
// preliminary status upward; renders its OWN badge only when NOT published
// (standalone) — the exact consolidation/Postel branch usePanelTitleBadge takes.
function Panel({ id, preliminary }: { id: string; preliminary: boolean }) {
  const published = useReportNodeStatus(id, { preliminary })
  return published ? <div data-panel={id} /> : <span className="local-badge" data-panel={id}>Prelim.</span>
}

// Mirrors PageHeaderShell: SUBSCRIBE to the page-wide fold, render the REAL
// page-header with the consolidated `preliminary` flag + localized labels.
function PageIndicator() {
  const status = useNodeStatusAggregate()
  return (
    <PageHeader
      title="National Accounts"
      preliminary={status?.preliminary === true}
      integrityLabel="Prelim."
      integrityTitle="Preliminary data"
      integrityAriaLabel="Data integrity"
    />
  )
}

// Mirrors InnerPageShell: the page root OWNS the scope and provides it to the
// whole page body (the page header AND the panels).
function Page({ children }: { children: ReactNode }) {
  const { collector, aggregate } = useNodeStatusScope()
  return <NodeStatusProvider collector={collector} aggregate={aggregate}>{children}</NodeStatusProvider>
}

function renderPage(panels: ReactNode) {
  return render(
    <MemoryRouter>
      <Page>
        <PageIndicator />
        {panels}
      </Page>
    </MemoryRouter>,
  )
}

function panels(count: number, preliminary = true): ReactNode {
  return Array.from({ length: count }, (_, i) => (
    <Panel key={i} id={`p${i}`} preliminary={preliminary} />
  ))
}

describe('FF-ONE-INTEGRITY-INDICATOR — the PAGE consolidates per-panel preliminary into ONE', () => {
  it('N preliminary panels → exactly ONE page indicator, ZERO per-panel pills', () => {
    const { container } = renderPage(panels(4, true))
    expect(container.querySelectorAll('.page-header__integrity').length).toBe(1)
    // every panel published upward → none renders its own local pill
    expect(container.querySelectorAll('.local-badge').length).toBe(0)
  })

  it('a page with NO preliminary panels renders NO indicator', () => {
    const { container } = renderPage(panels(3, false))
    expect(container.querySelector('.page-header__integrity')).toBeNull()
  })

  it('a standalone panel (no page scope) renders its OWN badge (Postel)', () => {
    const { container } = render(<Panel id="solo" preliminary />)
    expect(container.querySelector('.local-badge')).toBeTruthy()
  })

  it('a page header with NO scope above it renders NO indicator (Postel)', () => {
    const { container } = render(<MemoryRouter><PageIndicator /></MemoryRouter>)
    expect(container.querySelector('.page-header__integrity')).toBeNull()
  })
})

describe('FF-INTEGRITY-REACHABLE — the ONE indicator is not color-only', () => {
  it('carries a dot AND a visible non-empty text label, with a caption', () => {
    const { container } = renderPage(panels(2, true))
    const indicator = container.querySelector('.page-header__integrity') as HTMLElement
    expect(indicator).toBeTruthy()
    // not color-only: a dot AND a visible text label
    expect(indicator.querySelector('.page-header__integrity-dot')).toBeTruthy()
    const label = indicator.querySelector('.page-header__integrity-label')
    expect(label).toBeTruthy()
    expect((label!.textContent ?? '').trim().length).toBeGreaterThan(0)
    // a caption (title/aria) explains the short label to AT / on hover
    expect(indicator.getAttribute('title')).toBe('Preliminary data')
    expect(indicator.getAttribute('aria-label')).toBe('Data integrity')
    // the dot is decorative (the label carries the meaning)
    expect(indicator.querySelector('.page-header__integrity-dot')!.getAttribute('aria-hidden')).toBe('true')
  })
})

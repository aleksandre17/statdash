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
  NodeVisibilityProvider,
  useNodeStatusScope,
  useReportNodeStatus,
  useNodeStatusAggregate,
  resolvePreliminary,
} from '@statdash/react/engine'
import type { RenderContext, NodeBase } from '@statdash/react/engine'
import { applyEncoding }                from '@statdash/engine'
import type { EngineRow, EncodingSpec } from '@statdash/engine'
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

describe('FF-INTEGRITY-VISIBLE-FOLD — a hidden (mounted, display:none) panel does NOT fold', () => {
  // Mirrors what SectionShell/GeographShell now do: each view-slot wraps its
  // (still-mounted) subtree in NodeVisibilityProvider visible={!hidden}. A hidden
  // preliminary panel must contribute NOTHING to the page fold; a visible one must.
  it('a hidden preliminary panel does not raise the page indicator', () => {
    const { container } = renderPage(
      <NodeVisibilityProvider visible={false}>
        <Panel id="hidden-prelim" preliminary />
      </NodeVisibilityProvider>,
    )
    // The only preliminary panel is hidden → the page shows NO integrity indicator.
    expect(container.querySelector('.page-header__integrity')).toBeNull()
  })

  it('a VISIBLE preliminary panel raises the indicator even beside a hidden one', () => {
    const { container } = renderPage(
      <>
        <NodeVisibilityProvider visible={false}>
          <Panel id="hidden-prelim" preliminary />
        </NodeVisibilityProvider>
        <NodeVisibilityProvider visible={true}>
          <Panel id="shown-prelim" preliminary />
        </NodeVisibilityProvider>
      </>,
    )
    // The visible preliminary panel folds → exactly ONE page indicator.
    expect(container.querySelectorAll('.page-header__integrity').length).toBe(1)
  })

  it('nested visibility composes — a visible slot inside a hidden one stays hidden', () => {
    const { container } = renderPage(
      <NodeVisibilityProvider visible={false}>
        <NodeVisibilityProvider visible={true}>
          <Panel id="nested-prelim" preliminary />
        </NodeVisibilityProvider>
      </NodeVisibilityProvider>,
    )
    // Parent gate wins (AND-composition) → hidden → no fold, no indicator.
    expect(container.querySelector('.page-header__integrity')).toBeNull()
  })

  it('toggling a slot from hidden→visible re-folds the panel into the indicator', () => {
    function Toggling({ visible }: { visible: boolean }) {
      return (
        <NodeVisibilityProvider visible={visible}>
          <Panel id="toggle-prelim" preliminary />
        </NodeVisibilityProvider>
      )
    }
    const { container, rerender } = render(
      <MemoryRouter>
        <Page>
          <PageIndicator />
          <Toggling visible={false} />
        </Page>
      </MemoryRouter>,
    )
    expect(container.querySelector('.page-header__integrity')).toBeNull()

    rerender(
      <MemoryRouter>
        <Page>
          <PageIndicator />
          <Toggling visible={true} />
        </Page>
      </MemoryRouter>,
    )
    expect(container.querySelectorAll('.page-header__integrity').length).toBe(1)
  })
})

// ── FF-INTEGRITY-DISPLAYED-SLICE — the badge reflects the SHOWN obs, year-aware ──
//
//  resolvePreliminary fires from the DISPLAYED slice ONLY (its ctx.rows), never
//  dataset-wide. A panel whose rows are all final (obsStatus 'A') → no badge; a panel
//  whose rows contain a preliminary obs (obsStatus 'p') → badge. Year-agnostic:
//  asserted via a synthetic P-marked obs, never a literal-year branch. The encoded
//  path is covered too — applyEncoding propagates obsStatus onto chart/table rows, so
//  a chart panel showing a preliminary period is equally year-aware.

describe('FF-INTEGRITY-DISPLAYED-SLICE — resolvePreliminary reads the shown slice', () => {
  const ctxWithRows = (rows: unknown[]): RenderContext =>
    ({ sectionCtx: { dims: {} }, stores: {}, rows } as unknown as RenderContext)
  const node = { type: 'chart', id: 'n1' } as NodeBase & { preliminary?: boolean }

  it('a panel showing only FINAL rows (obsStatus A) → not preliminary', () => {
    expect(resolvePreliminary(node, ctxWithRows([{ id: 'a', label: 'A', value: 1, obsStatus: 'A' }]))).toBeUndefined()
  })

  it('a panel showing a slice containing obsStatus P → preliminary', () => {
    expect(resolvePreliminary(node, ctxWithRows([
      { id: 'a', label: 'A', value: 1, obsStatus: 'A' },
      { id: 'b', label: 'B', value: 2, obsStatus: 'p' },   // the shown P obs
    ]))).toBe(true)
  })

  it('an ENCODED chart panel carries obsStatus (applyEncoding passthrough) → year-aware', () => {
    const enc: EncodingSpec = { label: 'label', value: 'value' }
    const finalRows: EngineRow[] = [{ measure: 'gdp', label: 'GDP', value: 100, obsStatus: 'A' }]
    const prelimRows: EngineRow[] = [{ measure: 'gdp', label: 'GDP', value: 110, obsStatus: 'p' }]
    // applyEncoding propagates the SDMX status onto the DataRow (the fix at the source)
    expect(applyEncoding(finalRows, enc)[0]!.obsStatus).toBe('A')
    expect(applyEncoding(prelimRows, enc)[0]!.obsStatus).toBe('p')
    // …so resolvePreliminary fires from the encoded slice exactly as from a raw one
    expect(resolvePreliminary(node, ctxWithRows(applyEncoding(finalRows, enc)))).toBeUndefined()
    expect(resolvePreliminary(node, ctxWithRows(applyEncoding(prelimRows, enc)))).toBe(true)
  })

  it('status-free rows are byte-identical (no obsStatus field added)', () => {
    const enc: EncodingSpec = { label: 'label', value: 'value' }
    const out = applyEncoding([{ measure: 'gdp', label: 'GDP', value: 100 }], enc)
    expect('obsStatus' in out[0]!).toBe(false)
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

// @vitest-environment jsdom
//
// ── Fitness — AR-39 data-integrity consolidation ──────────────────────────────
//
//  FF-ONE-INTEGRITY-INDICATOR — a section with N preliminary panels renders
//    EXACTLY ONE section-level indicator and ZERO per-panel pills; a panel with
//    no scope above it (standalone) still renders its OWN badge (Postel).
//  FF-INTEGRITY-REACHABLE — preliminary + source + last-updated + methodology are
//    all reachable through the section disclosure, and the indicator is not
//    color-only (a dot AND a text label) — WCAG 2.1 AA / Law 9.
//
//  The section shell + the NodeStatusContext publish/subscribe seam are the SUT.
//  A minimal `<Panel>` exercises the real publish contract (useReportNodeStatus):
//  inside a section it publishes upward and renders no local badge; outside, it
//  falls back to its own. `@statdash/react` (useT/useResolveLocale/icons) is
//  stubbed exactly as SectionShell.test.tsx does — the engine hooks are real.
//

import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@statdash/react', () => ({
  useT:            () => (key: string) => key,
  useResolveLocale: () => (s: string | Record<string, string>) =>
    typeof s === 'string' ? s : (Object.values(s)[0] ?? ''),
  useExtensions: () => [] as unknown[],
  SECTION_HEADER_ACTIONS: { id: 'section.header.actions' },
  InfoIcon:    () => <svg data-icon="info" />,
  ChevronIcon: ({ className }: { className?: string }) => <svg data-icon="chevron" className={className} />,
}))

import { render, fireEvent, cleanup }             from '@testing-library/react'
import { GlobalStateProvider, useReportNodeStatus } from '@statdash/react/engine'
import type { ShellProps, NodeDef }                from '@statdash/react/engine'
import { SectionShell }                            from './SectionShell'
import type { SectionNode }                        from './SectionNode'

afterEach(cleanup)

// A minimal data panel exercising the real publish contract: reports its
// preliminary status upward; renders its OWN badge only when NOT published
// (standalone) — the exact consolidation/Postel branch usePanelTitleBadge takes.
function Panel({ id, preliminary }: { id: string; preliminary: boolean }) {
  const published = useReportNodeStatus(id, { preliminary })
  return published ? <div data-panel={id} /> : <span className="local-badge" data-panel={id}>Prelim.</span>
}

function makeCtx(): ShellProps<SectionNode>['ctx'] {
  return {
    sectionCtx:   { dims: {} },
    filterParams: {},
    vars:         {},
    extensions:   {} as never,
  } as unknown as ShellProps<SectionNode>['ctx']
}

/** N publishing panels as the section's children (both mounted → both report). */
function panelChildren(count: number, preliminary = true): ShellProps<SectionNode>['children'] {
  const defs: NodeDef[] = Array.from({ length: count }, () => ({ type: 'chart' } as unknown as NodeDef))
  const rendered = Array.from({ length: count }, (_, i) => (
    <Panel key={i} id={`p${i}`} preliminary={preliminary} />
  ))
  return { defs, rendered } as unknown as ShellProps<SectionNode>['children']
}

function renderShell(def: Partial<SectionNode>, children: ShellProps<SectionNode>['children']) {
  const fullDef = { type: 'section', id: 's1', title: 'Title', ...def } as SectionNode
  const node = SectionShell(fullDef, makeCtx() as never, children as never)
  return render(<GlobalStateProvider>{node}</GlobalStateProvider>)
}

describe('FF-ONE-INTEGRITY-INDICATOR — section consolidates per-panel preliminary into ONE', () => {
  it('N preliminary panels → exactly ONE section indicator, ZERO per-panel pills', () => {
    const { container } = renderShell({}, panelChildren(4, true))
    expect(container.querySelectorAll('.section__integrity').length).toBe(1)
    // every panel published upward → none renders its own local pill
    expect(container.querySelectorAll('.local-badge').length).toBe(0)
  })

  it('a section with NO preliminary panels renders NO indicator', () => {
    const { container } = renderShell({}, panelChildren(3, false))
    expect(container.querySelector('.section__integrity')).toBeNull()
  })

  it('a standalone panel (no section scope) renders its OWN badge (Postel)', () => {
    const { container } = render(<Panel id="solo" preliminary />)
    expect(container.querySelector('.local-badge')).toBeTruthy()
  })

  it('an explicit author override marks the section preliminary with no child signal', () => {
    const { container } = renderShell(
      { methodology: { preliminary: true } },
      panelChildren(2, false),
    )
    expect(container.querySelectorAll('.section__integrity').length).toBe(1)
  })
})

describe('FF-INTEGRITY-REACHABLE — provenance reachable via disclosure, not color-only', () => {
  it('the indicator is not color-only: it carries a visible text label', () => {
    const { container } = renderShell({}, panelChildren(2, true))
    const label = container.querySelector('.section__integrity-label')
    expect(label).toBeTruthy()
    expect((label!.textContent ?? '').trim().length).toBeGreaterThan(0)
  })

  it('preliminary + source + last-updated + methodology all reachable through the disclosure', () => {
    const { container } = renderShell(
      { methodology: { note: 'Note', source: 'GeoStat', lastUpdated: '2024-03' } },
      panelChildren(2, true),
    )
    // Disclosure is keyboard-reachable: a real button with aria-expanded.
    const infoBtn = container.querySelector('.section__icon-btn') as HTMLElement
    expect(infoBtn).toBeTruthy()
    expect(infoBtn.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(infoBtn)

    const panel = container.querySelector('.section__methodology[role="region"]')!
    expect(panel).toBeTruthy()
    // preliminary status line (consolidated) + note + source + last-updated
    expect(panel.querySelector('.section__integrity-note')).toBeTruthy()
    expect(panel.querySelector('.section__methodology-note')!.textContent).toBe('Note')
    const metas = panel.querySelectorAll('.section__methodology-meta')
    expect(metas.length).toBe(2)
    expect(metas[0].textContent).toContain('GeoStat')
    expect(metas[1].textContent).toContain('2024-03')
  })

  it('a preliminary section with NO authored methodology still opens a disclosure to explain it', () => {
    const { container } = renderShell({}, panelChildren(1, true))
    const infoBtn = container.querySelector('.section__icon-btn') as HTMLElement
    expect(infoBtn).toBeTruthy()   // toggle appears from preliminary alone (reachability)
    fireEvent.click(infoBtn)
    expect(container.querySelector('.section__integrity-note')).toBeTruthy()
  })
})

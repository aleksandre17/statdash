// ── SL-2 fitness — the Focus-View is a SEPARATE route, and Model re-homes onto it ─
//  (AR-49 SL-2, SPEC-studio-shell-layout §3.4 / §6)
//
//  FF-FOCUSVIEW-SEPARATE-ROUTE — the Focus-View is a DISTINCT screen: while active
//    the editing shell (rail + docks + canvas grid) is NOT the primary chrome; a
//    breadcrumb-back returns to where the author was. It is NOT a canvas-grid-area
//    overlay (the editing grid is gone, not merely covered).
//  FF-MODEL-IS-FOCUSVIEW — Model mode composes the SHARED <FocusView> shell (no
//    forked takeover) and its entry resolves THROUGH the focus-view target registry;
//    ModelSurface's only render site is that registry, never the shell directly.
//
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StudioShell } from './StudioShell'
import { setupCanvasRegistry } from '../canvas/setupCanvasRegistry'
import { useConstructorStore } from '../store/constructor.store'
import { useRoleStore } from './useRole'
import { FOCUS_VIEW_TARGETS, getFocusViewTarget } from './focusViewRegistry'

// Enter the Data-model focus-view: the Steward lens over the `model` surface is the
// SL-2 route state (StudioShell renders <FocusView> for effectiveSurface === 'model').
beforeEach(() => {
  setupCanvasRegistry()
  useConstructorStore.setState({ activeSurface: 'model', selectedNodeId: null, chromeSelection: null })
  useConstructorStore.getState().updateSite({ defaultLocale: 'en', activeLocales: ['en'] })
  useRoleStore.setState({ role: 'steward' })
})

describe('FF-FOCUSVIEW-SEPARATE-ROUTE — the focus-view is a distinct screen, not an overlay', () => {
  it('while active, the editing shell chrome (rail + docks + grid + bottom strip) is GONE', () => {
    const { container } = render(<StudioShell />)
    // The focus-view screen is present…
    expect(screen.getByRole('region', { name: 'Data model' })).toBeInTheDocument()
    // …and the whole 4-column editing shell is NOT rendered (a separate route — the
    // rail/docks are not the primary chrome, and the grid is absent, not covered).
    expect(container.querySelector('.studio-shell')).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Studio surfaces' })).toBeNull() // rail gone
    expect(screen.queryByRole('contentinfo')).toBeNull()                              // bottom strip gone
    // Only a MINIMAL top chrome orients: a breadcrumb-back + the context title.
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })

  it('breadcrumb-back returns to the editing shell (loss-free — the route is reversible)', () => {
    render(<StudioShell />)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    // The editing shell is restored (the rail is back) and the focus-view screen is gone.
    expect(screen.getByRole('navigation', { name: 'Studio surfaces' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Data model' })).toBeNull()
  })

  it('focus MOVES into the focus-view on enter (WCAG 2.1 AA · 2.4.3)', () => {
    render(<StudioShell />)
    expect(screen.getByRole('button', { name: 'Back' })).toHaveFocus()
  })
})

// All Studio sources as raw text (Vite ?raw, browser-graph typed — no fs dep), to
// prove ModelSurface is composed ONLY through the registry (no forked shell takeover).
const STUDIO_SOURCES = import.meta.glob(['./**/*.ts', './**/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

describe('FF-MODEL-IS-FOCUSVIEW — Model composes the shared shell via the registry', () => {
  it('the registry holds a data-model target whose body is the role-split DataModelBody', () => {
    const target = getFocusViewTarget('data-model')
    expect(target).toBeDefined()
    expect(target!.title.en).toBe('Data model')
    // The target renders the role-split body (AR-50 M5b): DataModelBody projects the
    // destination by the lens — steward→ModelSurface, author→DataDictionarySurface —
    // so the destination is reachable in ANY lens while the modeler stays steward-only.
    const el = target!.render({ locale: 'en' }) as { type?: { name?: string } }
    expect(el.type?.name).toBe('DataModelBody')
  })

  it('the data-model body renders the read-only Dictionary for AUTHOR and the modeler for STEWARD', () => {
    // Author lens → the read-only Data Dictionary (no modeler, no query cliff).
    useRoleStore.setState({ role: 'author' })
    const { unmount } = render(<StudioShell />)
    expect(screen.getByTestId('data-dictionary')).toBeInTheDocument()
    expect(screen.queryByText(/Define the governed data model/)).toBeNull()
    unmount()

    // Steward lens → the full modeler (the relocated ModelSurface).
    useRoleStore.setState({ role: 'steward' })
    render(<StudioShell />)
    expect(screen.getByText(/Define the governed data model/)).toBeInTheDocument()
    expect(screen.queryByTestId('data-dictionary')).toBeNull()
  })

  it('the Studio shell composes the shared <FocusView> for Model — no fork', () => {
    // The focus-view region + the relocated ModelSurface body inside it prove Model
    // rides the shared shell, not a bespoke takeover.
    render(<StudioShell />)
    const region = screen.getByRole('region', { name: 'Data model' })
    expect(region).toBeInTheDocument()
    expect(screen.getByText(/Define the governed data model/)).toBeInTheDocument()
  })

  it('ModelSurface is rendered ONLY through DataModelBody (the registry body — no direct shell mount)', () => {
    // Any consumer that IMPORTS the ModelSurface component (excluding its own module,
    // tests, and DataModelBody — the role-split body the registry renders) would be a
    // forked takeover. DataModelBody is the sole legitimate mount site, behind its
    // steward branch (FF-MODEL-IS-FOCUSVIEW + FF-AUTHOR-NO-QUERY).
    const offenders = Object.entries(STUDIO_SOURCES)
      .filter(([path]) =>
        !path.includes('/ModelSurface.') &&
        !path.includes('/DataModelBody.') &&
        !path.includes('.test.') &&
        !path.includes('.fitness.'),
      )
      .filter(([, src]) => /\bimport\b[^\n]*\bModelSurface\b/.test(stripComments(src)))
      .map(([path]) => path)
    expect(offenders).toEqual([])
  })

  it('the target table is the OCP seam — exactly the registered targets, keyed by id', () => {
    // Data, not a switch: every entry is keyed by its own id (a new workspace editor
    // is one more row, the shell unchanged).
    for (const [id, target] of Object.entries(FOCUS_VIEW_TARGETS)) {
      expect(target.id).toBe(id)
    }
    expect(Object.keys(FOCUS_VIEW_TARGETS)).toContain('data-model')
  })

  it('the guard actually bites — a planted direct ModelSurface import IS detected', () => {
    expect(/\bimport\b[^\n]*\bModelSurface\b/.test(stripComments("import { ModelSurface } from './surfaces/ModelSurface'"))).toBe(true)
  })
})

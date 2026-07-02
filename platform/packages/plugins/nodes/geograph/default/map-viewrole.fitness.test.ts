import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ── FF-ONE-VIEW-MECHANISM — the map uses the standard view.role toggle ────────
//
//  AX6 (unify the map toggle into C7): the geograph map↔table toggle MUST be the
//  ONE view-toggle mechanism every other section uses — `useViewToggle` over
//  `view.role`-tagged participants — NOT the retired bespoke path (PanelLayout's
//  index toggle: a `views: PanelView[]` array + `defaultViewIndex` + internal
//  activeIdx child-switching). This source-scan fitness function makes the
//  unification un-regressable: it fails the build the moment the bespoke toggle
//  reappears in the geograph shell, or the standard mechanism disappears.
//
//  Two toggle implementations for one concept = SSOT drift. This is the guard.
//

const here  = dirname(fileURLToPath(import.meta.url))
const shell = readFileSync(resolve(here, 'GeographShell.tsx'), 'utf8')
const meta  = readFileSync(resolve(here, 'meta.ts'), 'utf8')

describe('geograph map toggle — the ONE view.role mechanism (FF-ONE-VIEW-MECHANISM)', () => {
  it('drives the toggle through the shared useViewToggle mechanism', () => {
    expect(shell).toContain('useViewToggle')
  })

  it("registers the map as a first-class view.role ('map')", () => {
    // The inline <GeoMap/> participates as role 'map' alongside the table child's
    // view.role:'table' — a third view-role under the SAME mechanism (OCP).
    expect(shell).toMatch(/role:\s*MAP_ROLE|MAP_ROLE\s*=\s*'map'/)
    expect(shell).toContain("'map'")
  })

  it('hides inactive views via resolveViewState (both mounted — no re-query on toggle)', () => {
    expect(shell).toContain('resolveViewState')
    // The map visibility is keyed on the shared role predicate, not a bespoke flag.
    expect(shell).toContain('isRoleHidden')
  })

  it('retires the bespoke PanelLayout index toggle (no views[]/defaultViewIndex)', () => {
    expect(shell).not.toMatch(/views\s*=\s*\{/)
    expect(shell).not.toContain('defaultViewIndex')
    expect(shell).not.toContain('viewToggleLabel')
  })

  it('still declares the view-toggle capability', () => {
    expect(meta).toContain("'view-toggle'")
  })
})

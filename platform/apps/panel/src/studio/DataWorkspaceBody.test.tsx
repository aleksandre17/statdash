// ── DataWorkspaceBody — URL-canonical floor (DU6-IA-1 F2+F3, Law 9: URL = permalink) ──
//
//  An absent/invalid `dataFloor` still RENDERS (parseDataFloor's default), but the address
//  bar must never keep lying about which floor is actually open. This gate proves the
//  one-shot canonicalization: the raw param is rewritten ONCE to the explicit resolved
//  floor id (`replace`, no extra history entry), every other param preserved, and an
//  already-explicit valid floor is left untouched (no rewrite loop).
//
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, useSearchParams } from 'react-router-dom'
import { DataWorkspaceBody } from './DataWorkspaceBody'

// The three floor bodies are heavy (real stores/APIs) — stubbed so this test stays scoped
// to the ONE thing it owns: the floor-selector's URL canonicalization. Each body's own
// content is covered by its own test suite (SourcesBody.test.tsx, SpecsBody.test.tsx, …).
vi.mock('./sources/SourcesBody', () => ({ SourcesBody: () => <div data-testid="stub-sources" /> }))
vi.mock('./DataModelBody', () => ({ DataModelBody: () => <div data-testid="stub-model" /> }))
vi.mock('./specs/SpecsBody', () => ({ SpecsBody: () => <div data-testid="stub-specs" /> }))

// A tiny probe surfacing the live router search string, so a test can assert the address
// bar was rewritten — not just what rendered.
function SearchProbe() {
  const [params] = useSearchParams()
  return <div data-testid="search">{params.toString()}</div>
}

function renderAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <DataWorkspaceBody locale="ka" />
      <SearchProbe />
    </MemoryRouter>,
  )
}

describe('DataWorkspaceBody — the floor param is canonicalized, not left dishonest', () => {
  it('an ABSENT dataFloor renders the default (sources) floor and rewrites the URL to the explicit id', async () => {
    renderAt('/studio/data?foo=bar')
    expect(await screen.findByTestId('stub-sources')).toBeInTheDocument()
    const q = new URLSearchParams(screen.getByTestId('search').textContent ?? '')
    expect(q.get('dataFloor')).toBe('sources')
    expect(q.get('foo')).toBe('bar') // every other param preserved
  })

  it('an INVALID dataFloor value canonicalizes to the resolved default, preserving other params', async () => {
    renderAt('/studio/data?dataFloor=bogus&page=p1')
    expect(await screen.findByTestId('stub-sources')).toBeInTheDocument()
    const q = new URLSearchParams(screen.getByTestId('search').textContent ?? '')
    expect(q.get('dataFloor')).toBe('sources')
    expect(q.get('page')).toBe('p1')
  })

  it('an already-EXPLICIT valid dataFloor is left untouched (no rewrite loop)', async () => {
    renderAt('/studio/data?dataFloor=model')
    expect(await screen.findByTestId('stub-model')).toBeInTheDocument()
    const q = new URLSearchParams(screen.getByTestId('search').textContent ?? '')
    expect(q.get('dataFloor')).toBe('model')
  })
})

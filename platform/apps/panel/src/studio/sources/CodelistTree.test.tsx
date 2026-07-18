// ── CodelistTree tests (0091 · the browsable classifier of one dimension) ───────
//
//  Renders a dimension's live codelist with governed labels; a TREE where parentCode
//  edges exist, a flat list where they don't; honest "code only" fallback for the R/U
//  label gap. Pure comprehension — no manipulation.
//
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { CubeProfileMember } from '../../lib/cubeApi'
import { CodelistTree } from './CodelistTree'

const flat: CubeProfileMember[] = [
  { code: 'adjara', label: { ka: 'აჭარა', en: 'Adjara' }, parentCode: null },
  { code: 'tbilisi', label: { ka: 'თბილისი', en: 'Tbilisi' }, parentCode: null },
  { code: 'R', label: {}, parentCode: null },   // label debt → "code only"
]

const hierarchical: CubeProfileMember[] = [
  { code: 'GE', label: { ka: 'საქართველო', en: 'Georgia' }, parentCode: null },
  { code: 'GE-AJ', label: { ka: 'აჭარა', en: 'Adjara' }, parentCode: 'GE' },
  { code: 'GE-TB', label: { ka: 'თბილისი', en: 'Tbilisi' }, parentCode: 'GE' },
]

describe('CodelistTree', () => {
  it('renders governed member labels (flat codelist, no parent edges)', () => {
    render(<CodelistTree members={flat} locale="ka" />)
    const tree = screen.getByTestId('codelist-tree')
    expect(tree).not.toHaveAttribute('data-hierarchical')
    expect(within(tree).getByText('აჭარა')).toBeInTheDocument()
    expect(within(tree).getByText('თბილისი')).toBeInTheDocument()
  })

  it('falls back HONESTLY to the raw code + a "code only" mark when a label is missing', () => {
    render(<CodelistTree members={flat} locale="en" />)
    const tree = screen.getByTestId('codelist-tree')
    expect(within(tree).getByText('R')).toBeInTheDocument()
    expect(within(tree).getByText('code only')).toBeInTheDocument()
  })

  it('builds a TREE from parentCode edges — children reachable by expanding the parent', () => {
    render(<CodelistTree members={hierarchical} locale="ka" />)
    const tree = screen.getByTestId('codelist-tree')
    expect(tree).toHaveAttribute('data-hierarchical', 'true')
    // The root branch is a disclosure; its children live under it.
    const rootBranch = within(tree).getByRole('button', { name: /საქართველო/ })
    fireEvent.click(rootBranch)   // toggle (defaults open at depth 0, click closes/reopens deterministically)
    // Re-open to assert children are present in the expanded state.
    if (rootBranch.getAttribute('aria-expanded') === 'false') fireEvent.click(rootBranch)
    expect(within(tree).getByText('აჭარა')).toBeInTheDocument()
    expect(within(tree).getByText('თბილისი')).toBeInTheDocument()
  })

  it('declares an empty codelist honestly, never a blank', () => {
    render(<CodelistTree members={[]} locale="en" />)
    expect(screen.getByTestId('codelist-empty')).toBeInTheDocument()
  })
})

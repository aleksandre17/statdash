import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { DataModelingPanel } from './DataModelingPanel'
import { useConstructorStore } from '../../store/constructor.store'
import type { DataSourceDef, NamedDataSpec } from '../../types/constructor'

// The full data-modeling body (source/spec browser + editor), extracted from the
// wizard's DataStep so the Studio Data surface mounts the SAME component. These
// tests prove it mounts against the real store (reads sources + specs), reveals the
// real DataSpecEditor on selection, and WRITES back through the same store action
// (updateDataSpec) — byte-identical to the wizard.

const SOURCE: DataSourceDef = {
  id: 'src-1', name: 'SDMX source', type: 'sdmx-json', config: {}, status: 'connected',
}
const SPEC: NamedDataSpec = {
  id: 'spec-1', name: 'GDP query',
  spec: { type: 'query', query: { measure: [] }, pipe: [], encoding: { label: 'label' } },
}

beforeEach(() => {
  useConstructorStore.setState({ dataSources: [SOURCE], dataSpecs: [SPEC] })
})

describe('DataModelingPanel — relocated data authoring (AR-49 M1.3)', () => {
  it('mounts the source + spec browser reading the store', () => {
    render(<DataModelingPanel />)
    expect(screen.getByText('მონაცემების წყაროები')).toBeInTheDocument()
    expect(screen.getByText('მონაცემების სპეც-ები')).toBeInTheDocument()
    expect(screen.getByText('SDMX source')).toBeInTheDocument()
    expect(screen.getByText('GDP query')).toBeInTheDocument()
    // The add + Excel-ingest affordances relocate too.
    expect(screen.getByRole('button', { name: 'დამატება' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Excel' })).toBeInTheDocument()
  })

  it('selecting a spec reveals the real DataSpecEditor', () => {
    render(<DataModelingPanel />)
    fireEvent.click(screen.getByText('GDP query'))
    // The DataSpecEditor's type picker — proof the SAME editor mounted, not a stub.
    expect(screen.getByRole('combobox', { name: 'სპეც-ის ტიპი' })).toBeInTheDocument()
  })

  it('editing a selected spec writes through the same store action (updateDataSpec)', () => {
    render(<DataModelingPanel />)
    fireEvent.click(screen.getByText('GDP query'))
    // Change the spec type via the editor → onChange funnels to updateDataSpec.
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'სპეც-ის ტიპი' }))
    const listbox = screen.getByRole('listbox')
    fireEvent.click(within(listbox).getByText(/\(row-list\)/))
    expect(useConstructorStore.getState().dataSpecs[0].spec.type).toBe('row-list')
  })

  it('selecting a source reveals the authoring panel with delete', () => {
    render(<DataModelingPanel />)
    fireEvent.click(screen.getByText('SDMX source'))
    expect(screen.getByRole('button', { name: 'წაშლა' })).toBeInTheDocument()
  })
})

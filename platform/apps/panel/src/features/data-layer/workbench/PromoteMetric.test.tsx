// ── PromoteMetric tests (0084 §2 — the raw→governed promotion loop) ────────────
//
//  The loop: propose a governed metric from the raw read (id + bilingual name) → the EXISTING
//  definition seam (upsertMetric + saveSemanticCatalog) → on bless, onPromoted(id) replaces
//  the head. SAFE-SAVE: the working copy is hydrated before an upsert (never wipe the catalog).
//
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PromoteMetric } from './PromoteMetric'
import { useSemanticCatalogStore } from '../../../studio/model/semanticCatalog.store'

const saveMock = vi.fn()
vi.mock('../../../studio/model/saveSemanticCatalog', () => ({
  saveSemanticCatalog: () => saveMock(),
}))
// The active-dataset/profile hooks (no network in a unit test).
vi.mock('../../../discovery/useActiveProfile', () => ({
  useActiveProfile: () => ({ status: 'none' }),
  profileOrNull: () => null,
}))
vi.mock('../../../store/constructor.store', () => ({ useDataSources: () => [] }))

function setInput(testid: string, value: string) {
  const input = screen.getByTestId(testid).querySelector('input')!
  fireEvent.change(input, { target: { value } })
}

beforeEach(() => {
  saveMock.mockResolvedValue({ ok: true })
  useSemanticCatalogStore.setState({ status: 'ready', metrics: [{ id: 'existing', code: 'X', label: { en: 'X' } }], dimensions: [], dirty: false })
})
afterEach(() => {
  useSemanticCatalogStore.setState({ status: 'idle', metrics: [], dimensions: [], dirty: false })
  vi.clearAllMocks()
})

describe('PromoteMetric', () => {
  it('opens the promotion form from the affordance', () => {
    render(<PromoteMetric measure="GVA" locales={['ka', 'en']} locale="ka" onPromoted={() => {}} />)
    expect(screen.queryByTestId('promote-id')).toBeNull()
    fireEvent.click(screen.getByTestId('promote-metric-open'))
    expect(screen.getByTestId('promote-id')).toBeInTheDocument()
  })

  it('promotes: upserts the governed metric (code = the raw measure) + calls onPromoted', async () => {
    const onPromoted = vi.fn()
    render(<PromoteMetric measure="GVA" locales={['ka', 'en']} locale="ka" onPromoted={onPromoted} />)
    fireEvent.click(screen.getByTestId('promote-metric-open'))
    setInput('promote-id', 'regional_gva')
    const kaName = document.querySelector<HTMLInputElement>('#promote-label-ka')!
    fireEvent.change(kaName, { target: { value: 'რეგიონული მშპ' } })
    fireEvent.click(screen.getByTestId('promote-submit'))

    await waitFor(() => expect(onPromoted).toHaveBeenCalledWith('regional_gva'))
    expect(saveMock).toHaveBeenCalled()
    const metrics = useSemanticCatalogStore.getState().metrics
    const promoted = metrics.find((m) => m.id === 'regional_gva')!
    expect(promoted.code).toBe('GVA')                       // pick, never type (Law 2)
    expect(promoted.label.ka).toBe('რეგიონული მშპ')          // writeLocale fills the locale record

    // SAFE-SAVE: the existing metric is still present (the catalog was not wiped).
    expect(metrics.some((m) => m.id === 'existing')).toBe(true)
  })

  it('blocks Save until the id is valid AND a name is present', () => {
    render(<PromoteMetric measure="GVA" locales={['ka', 'en']} locale="ka" onPromoted={() => {}} />)
    fireEvent.click(screen.getByTestId('promote-metric-open'))
    const submit = () => screen.getByTestId('promote-submit') as HTMLButtonElement
    expect(submit().disabled).toBe(true)                     // nothing filled
    setInput('promote-id', 'regional_gva')
    expect(submit().disabled).toBe(true)                     // no name yet
    const kaName = document.querySelector<HTMLInputElement>('#promote-label-ka')!
    fireEvent.change(kaName, { target: { value: 'სახელი' } })
    expect(submit().disabled).toBe(false)
  })

  it('rejects a duplicate id (governance — ids are immutable keys)', () => {
    render(<PromoteMetric measure="GVA" locales={['ka', 'en']} locale="ka" onPromoted={() => {}} />)
    fireEvent.click(screen.getByTestId('promote-metric-open'))
    setInput('promote-id', 'existing')
    const kaName = document.querySelector<HTMLInputElement>('#promote-label-ka')!
    fireEvent.change(kaName, { target: { value: 'სახელი' } })
    expect((screen.getByTestId('promote-submit') as HTMLButtonElement).disabled).toBe(true)
  })
})

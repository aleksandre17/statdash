// ── CanonicalUpload.test — front-plane raw-data ingestion (AR-51 / ADR-040) ─────
//
//  Locks the review→confirm flow (never a blind commit): upload → STAGED (facts
//  behind the publish gate) → PUBLISH → published. The panel is format-agnostic —
//  it ships bytes to the ingestion port (mocked here) and renders what came back.
//
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CanonicalUpload } from './CanonicalUpload'
import { uploadCanonical, publishCanonicalJob } from '../../lib/api'

vi.mock('../../lib/api', () => ({
  uploadCanonical:     vi.fn(),
  publishCanonicalJob: vi.fn(),
}))
const mockUpload  = vi.mocked(uploadCanonical)
const mockPublish = vi.mocked(publishCanonicalJob)

function selectWorkbook() {
  const file = new File([new Uint8Array([1, 2, 3])], 'data.xlsx')
  // jsdom's File may not implement arrayBuffer() — polyfill on the instance.
  Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(3) })
  const input = document.querySelector('input[type=file]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [file] } })
}

describe('CanonicalUpload — front-plane raw-data ingestion (AR-51)', () => {
  beforeEach(() => { mockUpload.mockReset(); mockPublish.mockReset() })

  it('upload → STAGED reveals the review→confirm (publish) step', async () => {
    mockUpload.mockResolvedValue({ jobIds: { facts: 'job-1' } })
    render(<CanonicalUpload locale="ka" />)
    selectWorkbook()
    await waitFor(() => expect(screen.getByTestId('canonical-staged')).toBeInTheDocument())
    expect(mockUpload).toHaveBeenCalledOnce()
    expect(screen.getByTestId('canonical-publish')).toBeInTheDocument()
  })

  it('confirm (publish) the staged facts → published (obs live)', async () => {
    mockUpload.mockResolvedValue({ jobIds: { facts: 'job-1' } })
    mockPublish.mockResolvedValue({})
    render(<CanonicalUpload locale="ka" />)
    selectWorkbook()
    await waitFor(() => screen.getByTestId('canonical-publish'))
    fireEvent.click(screen.getByTestId('canonical-publish'))
    await waitFor(() => expect(screen.getByTestId('canonical-published')).toBeInTheDocument())
    expect(mockPublish).toHaveBeenCalledWith('job-1')
  })

  it('a reference-only upload (no facts job) shows no publish button', async () => {
    mockUpload.mockResolvedValue({ jobIds: {} })
    render(<CanonicalUpload locale="ka" />)
    selectWorkbook()
    await waitFor(() => expect(screen.getByTestId('canonical-staged')).toBeInTheDocument())
    expect(screen.queryByTestId('canonical-publish')).not.toBeInTheDocument()
  })

  it('surfaces an upload error — never a blind failure', async () => {
    mockUpload.mockRejectedValue(new Error('bad workbook'))
    render(<CanonicalUpload locale="ka" />)
    selectWorkbook()
    await waitFor(() => expect(screen.getByTestId('canonical-error')).toHaveTextContent('bad workbook'))
  })
})

// ── ExcelUpload.test — accept + post + 202 + approve + error-map + a11y ───────
//
//  Pins the Phase-2 upload surface end to end against a MOCKED ingestApi (the one
//  HTTP seam): a .xlsx is accepted, POSTed, the 202 result renders (dataset +
//  published reference data + the staged-facts approve action), and approving
//  publishes. A 400 PARSE_ISSUES maps to a FRIENDLY message (never a raw blob).
//  A11y: the dropzone is a role=button with an aria-label, keyboard-operable
//  (Enter opens the picker) — WCAG 2.1 AA.
//
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { IngestProblem, type CanonicalUploadResult } from '../../lib/ingestApi'

// ── Mock the one transport seam — no real fetch/auth in a component test ───────
const uploadCanonical =
  vi.fn<(b: ArrayBuffer, n: string, opts?: { datasetVersion?: string }) => Promise<CanonicalUploadResult>>()
const getJob = vi.fn().mockResolvedValue({
  job: { id: 'facts-1', kind: 'facts', status: 'staged' },
  issuesBySeverity: { error: 0, warn: 2, info: 0 },
  canPublish: true,
})
const publishJob = vi.fn().mockResolvedValue({})

vi.mock('../../lib/ingestApi', async (orig) => ({
  ...(await orig<typeof import('../../lib/ingestApi')>()),
  ingestApi: {
    uploadCanonical: (b: ArrayBuffer, n: string, opts?: { datasetVersion?: string }) =>
      uploadCanonical(b, n, opts),
    getJob:    (id: string) => getJob(id),
    publishJob: (id: string) => publishJob(id),
  },
}))

import { ExcelUpload } from './ExcelUpload'

// A 202 with published reference data + a staged facts job (the headline case).
const RESULT_202: CanonicalUploadResult = {
  datasetCode:  'GDP_BY_SECTOR',
  sourceDigest: 'abc123',
  jobIds: [
    { kind: 'codelists', jobId: 'cl-1', status: 'published' },
    { kind: 'displays',  jobId: 'dp-1', status: 'published' },
    { kind: 'facts',     jobId: 'facts-1', status: 'staged' },
  ],
}

/** A jsdom File whose .arrayBuffer() resolves (the component reads bytes). */
function xlsxFile(name = 'data.xlsx'): File {
  const f = new File([new Uint8Array([1, 2, 3])], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  // jsdom File lacks arrayBuffer in some versions — guarantee it.
  if (typeof f.arrayBuffer !== 'function') {
    Object.defineProperty(f, 'arrayBuffer', { value: () => Promise.resolve(new ArrayBuffer(3)) })
  }
  return f
}

/** The hidden <input type=file> the dropzone drives. */
function fileInput(): HTMLInputElement {
  // The only file input in the component.
  return document.querySelector('input[type="file"]') as HTMLInputElement
}

beforeEach(() => {
  uploadCanonical.mockReset()
  getJob.mockClear()
  publishJob.mockClear()
})

describe('ExcelUpload — a11y', () => {
  it('exposes the dropzone as a labelled, keyboard-focusable button', () => {
    render(<ExcelUpload />)
    const zone = screen.getByRole('button', { name: /ატვირთეთ Excel/i })
    expect(zone).toHaveAttribute('tabindex', '0')
    // The native picker accepts .xlsx only.
    expect(fileInput()).toHaveAttribute('accept', expect.stringContaining('.xlsx'))
  })

  it('announces state through an aria-live status region', () => {
    render(<ExcelUpload />)
    const live = document.querySelector('[role="status"][aria-live="polite"]')
    expect(live).toBeInTheDocument()
  })

  it('opens the file picker on Enter (keyboard equivalent of click)', () => {
    render(<ExcelUpload />)
    const click = vi.spyOn(fileInput(), 'click').mockImplementation(() => {})
    fireEvent.keyDown(screen.getByRole('button', { name: /ატვირთეთ Excel/i }), { key: 'Enter' })
    expect(click).toHaveBeenCalledTimes(1)
  })
})

describe('ExcelUpload — accept + post + 202 + approve', () => {
  it('accepts a .xlsx, posts it, renders the 202 result and the approve action', async () => {
    uploadCanonical.mockResolvedValue(RESULT_202)
    render(<ExcelUpload />)

    fireEvent.change(fileInput(), { target: { files: [xlsxFile()] } })

    // Posted with the filename.
    await waitFor(() => expect(uploadCanonical).toHaveBeenCalledTimes(1))
    expect(uploadCanonical.mock.calls[0][1]).toBe('data.xlsx')

    // The dataset + published reference data render.
    expect(await screen.findByText('GDP_BY_SECTOR')).toBeInTheDocument()
    expect(screen.getByText('codelists')).toBeInTheDocument()
    expect(screen.getByText('displays')).toBeInTheDocument()

    // The staged facts → an "Approve & publish" action.
    const approve = await screen.findByRole('button', { name: /დადასტურება და გამოქვეყნება/ })
    fireEvent.click(approve)

    await waitFor(() => expect(publishJob).toHaveBeenCalledWith('facts-1'))
    // On success: "ingested ✓" (the success alert; the live region mirrors it).
    const done = await screen.findByRole('alert')
    expect(within(done).getByText(/ჩაიტვირთა/)).toBeInTheDocument()
  })

  it('calls onIngested after a successful publish (parent refresh)', async () => {
    uploadCanonical.mockResolvedValue(RESULT_202)
    const onIngested = vi.fn()
    render(<ExcelUpload onIngested={onIngested} />)

    fireEvent.change(fileInput(), { target: { files: [xlsxFile()] } })
    const approve = await screen.findByRole('button', { name: /დადასტურება და გამოქვეყნება/ })
    fireEvent.click(approve)
    await waitFor(() => expect(onIngested).toHaveBeenCalledTimes(1))
  })

  it('shows the DQAF WARN issues before approving (methodology transparency)', async () => {
    uploadCanonical.mockResolvedValue(RESULT_202)
    render(<ExcelUpload />)
    fireEvent.change(fileInput(), { target: { files: [xlsxFile()] } })
    // getJob is polled → 2 warns surfaced (non-blocking).
    expect(await screen.findByText(/2 გაფრთხილება/)).toBeInTheDocument()
  })
})

describe('ExcelUpload — error mapping (RFC 9457 → friendly)', () => {
  it('rejects a non-.xlsx with a clear message and never posts', async () => {
    render(<ExcelUpload />)
    const csv = new File(['a,b'], 'data.csv', { type: 'text/csv' })
    fireEvent.change(fileInput(), { target: { files: [csv] } })
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText(/მხოლოდ/)).toBeInTheDocument()
    expect(uploadCanonical).not.toHaveBeenCalled()
  })

  it('maps a 400 PARSE_ISSUES to a friendly message listing the issues', async () => {
    uploadCanonical.mockRejectedValue(
      new IngestProblem(400, {
        type: 'urn:statdash:problem:bad-request',
        title: 'Bad request',
        status: 400,
        code: 'PARSE_ISSUES',
        parseIssues: [
          { sheet: 'STRUCTURE', message: 'missing measure column' },
          { sheet: 'DATA', message: 'no header row' },
        ],
      }, 'fallback'),
    )
    render(<ExcelUpload />)
    fireEvent.change(fileInput(), { target: { files: [xlsxFile()] } })

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText(/სტრუქტურა არასწორია/)).toBeInTheDocument()
    expect(within(alert).getByText(/STRUCTURE: missing measure column/)).toBeInTheDocument()
    expect(within(alert).getByText(/DATA: no header row/)).toBeInTheDocument()
  })

  it('maps a 409 ALREADY_PUBLISHED to the duplicate message', async () => {
    uploadCanonical.mockRejectedValue(
      new IngestProblem(409, {
        type: 'urn:statdash:problem:conflict', title: 'Conflict', status: 409,
        code: 'ALREADY_PUBLISHED', existingJobId: 'old-1',
      }, 'fallback'),
    )
    render(<ExcelUpload />)
    fireEvent.change(fileInput(), { target: { files: [xlsxFile()] } })
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText(/უკვე ჩატვირთულია/)).toBeInTheDocument()
  })
})

// ── DSD-change → "ingest as a new version" governance flow ─────────────────────
//
//  A 400 DSD_INCOMPATIBLE (a richer/different DSD than the registered dataset) is NOT
//  a dead-end error: it opens the governance panel — the plain-language structural diff
//  + the version-mint action. Confirming re-POSTs the SAME bytes with ?datasetVersion=
//  and renders the 202 success. WCAG: the version input is a labelled, keyboard-operable
//  control focused on open; the parent announces the diff + outcome via aria-live.

/** A 400 DSD_INCOMPATIBLE problem: the workbook ADDS the `approach` dimension. */
function dsdIncompatible(): IngestProblem {
  return new IngestProblem(400, {
    type: 'urn:statdash:problem:bad-request',
    title: 'Bad request',
    status: 400,
    code: 'DSD_INCOMPATIBLE',
    datasetCode: 'GDP_BY_SECTOR',
    dimensionsBefore: ['time', 'sector'],
    dimensionsAfter:  ['time', 'sector', 'approach'],
    reason: 'the workbook declares a dimension the registered dataset does not have',
    versioned: false,
  }, 'fallback')
}

describe('ExcelUpload — DSD change → ingest as a new version', () => {
  it('renders the structural diff in plain language instead of a flat error', async () => {
    uploadCanonical.mockRejectedValue(dsdIncompatible())
    render(<ExcelUpload />)
    fireEvent.change(fileInput(), { target: { files: [xlsxFile()] } })

    // The governance panel (a labelled group), naming the dataset + the ADDED dimension.
    const panel = await screen.findByRole('group', { name: /სტრუქტურული ცვლილება/ })
    expect(within(panel).getByText('GDP_BY_SECTOR')).toBeInTheDocument()
    expect(within(panel).getByText('+ approach')).toBeInTheDocument()
    // It is the version panel, not the generic error Alert.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('exposes a labelled, defaulted, keyboard-focusable version input', async () => {
    uploadCanonical.mockRejectedValue(dsdIncompatible())
    render(<ExcelUpload />)
    fireEvent.change(fileInput(), { target: { files: [xlsxFile()] } })

    const input = await screen.findByLabelText('ვერსიის ნიშნული')
    // Defaulted to a sensible value (today's ISO date) — never empty.
    expect((input as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // Focused on open so the curator lands on the action (WCAG 2.4.3).
    await waitFor(() => expect(input).toHaveFocus())
  })

  it('confirming re-POSTs the SAME bytes with ?datasetVersion= and shows success', async () => {
    uploadCanonical
      .mockRejectedValueOnce(dsdIncompatible())   // first upload → DSD change
      .mockResolvedValueOnce(RESULT_202)          // version-mint re-POST → 202
    render(<ExcelUpload />)
    fireEvent.change(fileInput(), { target: { files: [xlsxFile('v2.xlsx')] } })

    const input = await screen.findByLabelText('ვერსიის ნიშნული')
    fireEvent.change(input, { target: { value: 'v2' } })
    fireEvent.click(screen.getByRole('button', { name: /ახალ ვერსიად ჩატვირთვა/ }))

    // Re-POSTed with the same filename + the version label (NOT a re-drop).
    await waitFor(() => expect(uploadCanonical).toHaveBeenCalledTimes(2))
    const rePost = uploadCanonical.mock.calls[1]
    expect(rePost[1]).toBe('v2.xlsx')
    expect(rePost[2]).toEqual({ datasetVersion: 'v2' })

    // The 202 success renders (the dataset + the staged-facts approve action).
    expect(await screen.findByText('GDP_BY_SECTOR')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /დადასტურება და გამოქვეყნება/ })).toBeInTheDocument()
  })

  it('Enter in the version input confirms (keyboard equivalent of the button)', async () => {
    uploadCanonical
      .mockRejectedValueOnce(dsdIncompatible())
      .mockResolvedValueOnce(RESULT_202)
    render(<ExcelUpload />)
    fireEvent.change(fileInput(), { target: { files: [xlsxFile()] } })

    const input = await screen.findByLabelText('ვერსიის ნიშნული')
    fireEvent.change(input, { target: { value: 'v2' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(uploadCanonical).toHaveBeenCalledTimes(2))
    expect(uploadCanonical.mock.calls[1][2]).toEqual({ datasetVersion: 'v2' })
  })
})

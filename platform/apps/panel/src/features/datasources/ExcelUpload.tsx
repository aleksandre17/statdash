// ── ExcelUpload — drag-drop canonical-workbook upload → validate → approve ────
//
//  Phase-2 Constructor surface: a NON-programmer drops a `.xlsx`, sees validation,
//  and ingests data with zero code. The user-facing layer over the canonical-
//  ingestion route (apps/api/src/routes/ingest/canonical.ts) — drop → POST raw
//  bytes → 202 with the dataset + per-kind jobs → approve the STAGED facts.
//
//  FLOW (a small explicit state machine, never a multi-step wizard — YAGNI):
//    idle ──drop/pick a .xlsx──▶ uploading ──202──▶ result
//                                          └─400/409──▶ error (friendly, mapped)
//    result ──"Approve & publish"──▶ approving ──ok──▶ done (facts ingested ✓)
//
//  A11y (WCAG 2.1 AA — Law 9 + the panel's bar): the dropzone is a real button
//  (role=button, tabIndex=0, aria-label) operable by Enter/Space AND click AND
//  drop; the focus ring is visible; every state transition is announced through an
//  aria-live region. Color is never the only signal (icon + text accompany it).
//
//  Auth + transport reuse the ONE seam: ingestApi (lib/ingestApi) carries the
//  panel JWT via lib/auth — this component never touches fetch/headers/tokens.
//
import { useState, useRef, useCallback, useId } from 'react'
import {
  Box, Typography, Alert, AlertTitle, CircularProgress,
  Link, List, ListItem, ListItemText,
} from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import TableChartIcon from '@mui/icons-material/TableChart'
import {
  ingestApi,
  type CanonicalUploadResult,
  type IngestJobView,
} from '../../lib/ingestApi'
import { ingestErrorMessage, type DsdChange } from './ingestErrorMessage'
import { DsdVersionPanel, dsdChangeSummary } from './DsdVersionPanel'
import { IngestResultPanel } from './IngestResultPanel'

// The link target documenting the canonical workbook format (STRUCTURE + CL_* +
// DATA). Runtime-config seam: an env override lets a deployment point at its own
// hosted spec; the default is the repo doc path (no hardcoded service URL).
const FORMAT_DOC_HREF =
  (import.meta.env.VITE_CANONICAL_FORMAT_DOC as string | undefined) ??
  'https://github.com/statdash/platform/blob/main/docs/canonical-workbook.md'

const XLSX_EXT = '.xlsx'
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

// 'versioning' = the DSD-change governance panel is showing (a structural diff +
// the version-mint action); 're-uploading' = the version-labelled re-POST is in flight.
type Phase = 'idle' | 'uploading' | 'result' | 'approving' | 'done' | 'versioning' | 're-uploading'

interface UploadError {
  message:    string
  lines:      string[]
  /** When set, the upload was a versionable DSD change → render the governance panel. */
  dsdChange?: DsdChange
}

/** A sensible default version label: today's date (ISO yyyy-mm-dd) — SDMX-style. */
function defaultVersionLabel(): string {
  return new Date().toISOString().slice(0, 10)
}

export interface ExcelUploadProps {
  /** Called after the facts are published so the parent refreshes the data list. */
  onIngested?: () => void
}

/** True when a file looks like a .xlsx (extension or MIME — liberal acceptance). */
function isXlsx(file: File): boolean {
  return file.name.toLowerCase().endsWith(XLSX_EXT) || file.type === XLSX_MIME
}

export function ExcelUpload({ onIngested }: ExcelUploadProps) {
  const [phase, setPhase]   = useState<Phase>('idle')
  const [dragOver, setDrag] = useState(false)
  const [result, setResult] = useState<CanonicalUploadResult | null>(null)
  const [error, setError]   = useState<UploadError | null>(null)
  const [filename, setName] = useState<string | null>(null)
  // The polled facts-job view (WARN issues) — methodology transparency before approve.
  const [jobView, setJobView] = useState<IngestJobView | null>(null)
  // The version label the curator confirms (defaulted to today; editable).
  const [versionLabel, setVersionLabel] = useState<string>(defaultVersionLabel)
  // The DSD change being resolved — held separately from the transient `error` so the
  // governance panel STAYS MOUNTED (keeps focus + busy state) across the version-mint
  // re-POST, which clears `error`. Cleared on a fresh upload or on success.
  const [dsdChange, setDsdChange] = useState<DsdChange | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  // The cached source bytes — so the version-mint re-POST never re-drops the file.
  const bytesRef = useRef<ArrayBuffer | null>(null)
  const statusId = useId()

  const factsJob = result?.jobIds.find((j) => j.kind === 'facts') ?? null

  /** Apply a 202 result: clear any DSD panel, render the dataset + poll WARN issues. */
  const applyResult = useCallback((res: CanonicalUploadResult) => {
    setDsdChange(null)
    setResult(res)
    setPhase('result')
    const facts = res.jobIds.find((j) => j.kind === 'facts')
    if (facts) {
      ingestApi.getJob(facts.jobId).then(setJobView).catch(() => { /* advisory only */ })
    }
  }, [])

  /** Map a thrown error → friendly message; route a versionable DSD change to the panel. */
  const handleFailure = useCallback((e: unknown) => {
    const mapped = ingestErrorMessage(e)
    setError(mapped)
    if (mapped.dsdChange) {
      // A versionable DSD change is a RESOLUTION, not a dead end: open the governance
      // panel (the structural diff + the version-mint action) instead of just erroring.
      setDsdChange(mapped.dsdChange)
      setPhase('versioning')
    } else {
      setPhase('idle')
    }
  }, [])

  // ── Upload — read bytes → POST → 202 result | DSD-change panel | friendly error ─
  const upload = useCallback(async (file: File) => {
    if (!isXlsx(file)) {
      setError({ message: `მხოლოდ ${XLSX_EXT} ფაილებია დაშვებული. აირჩიეთ Excel სამუშაო წიგნი.`, lines: [] })
      return
    }
    setError(null); setResult(null); setJobView(null); setDsdChange(null)
    setName(file.name)
    setVersionLabel(defaultVersionLabel())
    setPhase('uploading')
    try {
      const bytes = await file.arrayBuffer()
      bytesRef.current = bytes // cache for a possible version-mint re-POST
      const res = await ingestApi.uploadCanonical(bytes, file.name)
      applyResult(res)
    } catch (e) {
      handleFailure(e)
    }
  }, [applyResult, handleFailure])

  // ── Version-mint — re-POST the SAME cached bytes with ?datasetVersion=<label> ──
  // The canonical resolution to a DSD change (SDMX governance): a structural change
  // WITH a version succeeds (warn-governed) → 202 with the new version.
  const ingestAsVersion = useCallback(async () => {
    const bytes = bytesRef.current
    const label = versionLabel.trim()
    if (!bytes || !filename || label === '') return
    setError(null)
    setPhase('re-uploading')
    try {
      const res = await ingestApi.uploadCanonical(bytes, filename, { datasetVersion: label })
      applyResult(res)
    } catch (e) {
      // Stay on the governance panel (dsdChange held) so the curator can correct the
      // label and retry; only a non-DSD failure (e.g. session) collapses back to idle.
      handleFailure(e)
    }
  }, [versionLabel, filename, applyResult, handleFailure])

  // ── Approve — publish the staged facts → gold, then refresh the parent ──────
  const approve = useCallback(async () => {
    if (!factsJob) return
    setError(null)
    setPhase('approving')
    try {
      await ingestApi.publishJob(factsJob.jobId)
      setPhase('done')
      onIngested?.()
    } catch (e) {
      setError(ingestErrorMessage(e))
      setPhase('result')
    }
  }, [factsJob, onIngested])

  // ── Input + DnD handlers ────────────────────────────────────────────────────
  const onFiles = useCallback((files: FileList | null) => {
    const file = files?.[0]
    if (file) void upload(file)
  }, [upload])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDrag(false)
    onFiles(e.dataTransfer.files)
  }, [onFiles])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Keyboard equivalent of the click target (WCAG 2.1.1) — Enter or Space opens
    // the native file picker.
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      inputRef.current?.click()
    }
  }, [])

  const busy = phase === 'uploading' || phase === 'approving' || phase === 're-uploading'
  const showVersionPanel = (phase === 'versioning' || phase === 're-uploading') && dsdChange !== null

  // The status line that the aria-live region announces on each transition. For a DSD
  // change we announce the plain-language structural diff so a screen-reader curator
  // hears WHY a version is required (not just that an error occurred).
  const liveStatus =
    phase === 'uploading' ? `${filename ?? 'ფაილი'} იტვირთება…`
    : phase === 're-uploading' ? `ახალი ვერსია იქმნება: ${versionLabel}…`
    : phase === 'approving' ? 'მონაცემები ქვეყნდება…'
    : phase === 'done' ? 'მონაცემები ჩაიტვირთა.'
    : phase === 'versioning' && dsdChange ? dsdChangeSummary(dsdChange)
    : error ? error.message
    : phase === 'result' ? 'სამუშაო წიგნი დამუშავდა — საჭიროა დადასტურება.'
    : ''

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <Typography variant="h6" fontWeight={600}>Excel-ით ატვირთვა</Typography>
        <Typography variant="body2" color="text.secondary">
          ჩააგდეთ კანონიკური სამუშაო წიგნი (.xlsx) — ვალიდაცია და ჩატვირთვა კოდის გარეშე.
        </Typography>
      </Box>

      {/* ── Dropzone — a real, keyboard-operable button (role+label+focus) ─────── */}
      <Box
        role="button"
        tabIndex={busy ? -1 : 0}
        aria-label="ატვირთეთ Excel სამუშაო წიგნი — ჩააგდეთ ფაილი ან დააჭირეთ ასარჩევად"
        aria-disabled={busy}
        aria-describedby={statusId}
        onClick={() => { if (!busy) inputRef.current?.click() }}
        onKeyDown={busy ? undefined : onKeyDown}
        onDragOver={(e) => { e.preventDefault(); if (!busy) setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={busy ? undefined : onDrop}
        sx={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 1, p: 4, textAlign: 'center',
          border: '2px dashed',
          borderColor: dragOver ? 'primary.main' : 'divider',
          borderRadius: 1,
          bgcolor: dragOver ? 'action.hover' : 'background.default',
          color: 'text.secondary',
          cursor: busy ? 'default' : 'pointer',
          transition: 'border-color 120ms, background-color 120ms',
          // A clearly visible focus indicator (WCAG 2.4.7) — never suppressed.
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
        }}
      >
        {phase === 'uploading'
          ? <CircularProgress size={32} aria-hidden />
          : <UploadFileIcon sx={{ fontSize: 40, color: dragOver ? 'primary.main' : 'text.disabled' }} aria-hidden />}
        <Typography variant="body2">
          {phase === 'uploading'
            ? `${filename ?? 'ფაილი'} იტვირთება…`
            : 'ჩააგდეთ .xlsx ფაილი აქ, ან დააჭირეთ ასარჩევად'}
        </Typography>
        <Typography variant="caption" color="text.disabled">
          მხოლოდ {XLSX_EXT} — კანონიკური ფორმატი
        </Typography>
        <input
          ref={inputRef}
          type="file"
          accept={`${XLSX_EXT},${XLSX_MIME}`}
          hidden
          // The native picker is the accessible label's target; the dropzone owns
          // the visible affordance. Hidden but reachable via the button above.
          aria-hidden
          tabIndex={-1}
          onChange={(e) => { onFiles(e.target.files); e.target.value = '' }}
        />
      </Box>

      {/* ── Format hint — what to upload (the standard we defined) ─────────────── */}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <TableChartIcon fontSize="inherit" />
        ფაილი უნდა შეიცავდეს{' '}
        <Box component="code" sx={{ fontFamily: 'monospace' }}>STRUCTURE</Box>,{' '}
        <Box component="code" sx={{ fontFamily: 'monospace' }}>CL_*</Box> და{' '}
        <Box component="code" sx={{ fontFamily: 'monospace' }}>DATA</Box> ფურცლებს —{' '}
        <Link href={FORMAT_DOC_HREF} target="_blank" rel="noopener noreferrer">
          კანონიკური ფორმატის აღწერა
        </Link>
      </Typography>

      {/* ── Live region — announces every state transition (screen readers) ───── */}
      <Box id={statusId} role="status" aria-live="polite" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {liveStatus}
      </Box>

      {/* ── Error — friendly, mapped from the RFC 9457 code (never a raw blob). A
            versionable DSD change is NOT a flat error: it renders the governance panel
            below instead, so here we render the flat Alert for every OTHER error. ─── */}
      {error && !showVersionPanel && (
        <Alert severity="error" variant="outlined">
          <AlertTitle>{error.message}</AlertTitle>
          {error.lines.length > 0 && (
            <List dense disablePadding>
              {error.lines.map((line, i) => (
                <ListItem key={i} disableGutters sx={{ py: 0 }}>
                  <ListItemText primary={line} primaryTypographyProps={{ variant: 'body2' }} />
                </ListItem>
              ))}
            </List>
          )}
        </Alert>
      )}

      {/* ── DSD change → "ingest as a new version" governance panel ────────────── */}
      {showVersionPanel && dsdChange && (
        <DsdVersionPanel
          change={dsdChange}
          versionLabel={versionLabel}
          onVersionLabelChange={setVersionLabel}
          onConfirm={() => void ingestAsVersion()}
          busy={phase === 're-uploading'}
        />
      )}

      {/* ── 202 result — the dataset, published reference data, the staged facts ── */}
      {result && (phase === 'result' || phase === 'approving' || phase === 'done') && (
        <IngestResultPanel
          result={result}
          factsJob={factsJob}
          jobView={jobView}
          phase={phase}
          onApprove={() => void approve()}
        />
      )}
    </Box>
  )
}


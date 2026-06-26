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
  Box, Typography, Button, Chip, Alert, AlertTitle, CircularProgress,
  Stack, Link, List, ListItem, ListItemText, Divider,
} from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import HourglassTopIcon from '@mui/icons-material/HourglassTop'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import TableChartIcon from '@mui/icons-material/TableChart'
import {
  ingestApi,
  type CanonicalUploadResult,
  type IngestKindJob,
  type IngestJobView,
} from '../../lib/ingestApi'
import { ingestErrorMessage } from './ingestErrorMessage'

// The link target documenting the canonical workbook format (STRUCTURE + CL_* +
// DATA). Runtime-config seam: an env override lets a deployment point at its own
// hosted spec; the default is the repo doc path (no hardcoded service URL).
const FORMAT_DOC_HREF =
  (import.meta.env.VITE_CANONICAL_FORMAT_DOC as string | undefined) ??
  'https://github.com/statdash/platform/blob/main/docs/canonical-workbook.md'

const XLSX_EXT = '.xlsx'
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

type Phase = 'idle' | 'uploading' | 'result' | 'approving' | 'done'

interface UploadError {
  message: string
  lines:   string[]
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

  const inputRef = useRef<HTMLInputElement>(null)
  const statusId = useId()

  const factsJob = result?.jobIds.find((j) => j.kind === 'facts') ?? null

  // ── Upload — read bytes → POST → 202 result | friendly error ────────────────
  const upload = useCallback(async (file: File) => {
    if (!isXlsx(file)) {
      setError({ message: `მხოლოდ ${XLSX_EXT} ფაილებია დაშვებული. აირჩიეთ Excel სამუშაო წიგნი.`, lines: [] })
      return
    }
    setError(null); setResult(null); setJobView(null)
    setName(file.name)
    setPhase('uploading')
    try {
      const bytes = await file.arrayBuffer()
      const res = await ingestApi.uploadCanonical(bytes, file.name)
      setResult(res)
      setPhase('result')
      // Best-effort: poll the staged facts job for its WARN issues (DQAF integrity).
      const facts = res.jobIds.find((j) => j.kind === 'facts')
      if (facts) {
        ingestApi.getJob(facts.jobId).then(setJobView).catch(() => { /* advisory only */ })
      }
    } catch (e) {
      setError(ingestErrorMessage(e))
      setPhase('idle')
    }
  }, [])

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

  const busy = phase === 'uploading' || phase === 'approving'

  // The status line that the aria-live region announces on each transition.
  const liveStatus =
    phase === 'uploading' ? `${filename ?? 'ფაილი'} იტვირთება…`
    : phase === 'approving' ? 'მონაცემები ქვეყნდება…'
    : phase === 'done' ? 'მონაცემები ჩაიტვირთა.'
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

      {/* ── Error — friendly, mapped from the RFC 9457 code (never a raw blob) ── */}
      {error && (
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

      {/* ── 202 result — the dataset, published reference data, the staged facts ── */}
      {result && (phase === 'result' || phase === 'approving' || phase === 'done') && (
        <ResultPanel
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

// ── ResultPanel — the 202 outcome + the curator-approval action ────────────────
function ResultPanel({
  result, factsJob, jobView, phase, onApprove,
}: {
  result:    CanonicalUploadResult
  factsJob:  IngestKindJob | null
  jobView:   IngestJobView | null
  phase:     Phase
  onApprove: () => void
}) {
  const published = result.jobIds.filter((j) => j.kind !== 'facts')
  const warnCount = jobView?.issuesBySeverity.warn ?? 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="subtitle2">მონაცემთა ნაკრები:</Typography>
        <Chip size="small" color="primary" variant="outlined" label={result.datasetCode} />
      </Box>

      {/* Published reference data (codelists/displays) — auto, already in gold. */}
      {published.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary">საცნობარო მონაცემები (გამოქვეყნდა)</Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 0.5 }}>
            {published.map((j) => (
              <Chip
                key={j.jobId}
                size="small" color="success" variant="outlined"
                icon={<CheckCircleIcon />}
                label={j.kind}
              />
            ))}
          </Stack>
        </Box>
      )}

      <Divider />

      {/* The facts — the approval-gated DATA. Staged until the curator publishes. */}
      {factsJob ? (
        phase === 'done' ? (
          <Alert severity="success" variant="outlined" icon={<CheckCircleIcon />}>
            მონაცემები ჩაიტვირთა ✓
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip size="small" color="warning" variant="outlined" icon={<HourglassTopIcon />} label="facts — staged" />
              <Typography variant="caption" color="text.secondary">
                მონაცემები მზადაა დასადასტურებლად
              </Typography>
            </Box>

            {/* DQAF integrity rules surface as WARN — show them (they do NOT block). */}
            {warnCount > 0 && (
              <Alert severity="warning" variant="outlined" icon={<WarningAmberIcon />}>
                {warnCount} გაფრთხილება მონაცემთა ხარისხის შესახებ — გამოქვეყნებას არ აბრკოლებს.
              </Alert>
            )}

            <Button
              variant="contained"
              disabled={phase === 'approving'}
              startIcon={phase === 'approving' ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
              onClick={onApprove}
            >
              დადასტურება და გამოქვეყნება
            </Button>
          </Box>
        )
      ) : (
        <Typography variant="body2" color="text.secondary">
          ფაქტობრივი მონაცემები არ იყო — მხოლოდ საცნობარო მონაცემები განახლდა.
        </Typography>
      )}
    </Box>
  )
}
